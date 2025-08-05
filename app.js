// Configuración de Firebase
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tareas-inteligentes.firebaseapp.com",
  projectId: "tareas-inteligentes",
  storageBucket: "tareas-inteligentes.appspot.com",
  messagingSenderId: "1016472192983",
  appId: "1:1016472192983:web:369bbf0942a95e5ccbad92",
  measurementId: "G-QM9K6W0C4Q"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = null;
const adminId = "0001";

// LOGIN
function login() {
  const id = document.getElementById("employeeId").value.trim();
  if (!id) return alert("Ingresa tu número de empleado");
  currentUser = id;
  document.getElementById("login").classList.add("hidden");
  document.getElementById("listaTareas").classList.remove("hidden");

  if (currentUser === adminId) {
    document.getElementById("adminPanel").classList.remove("hidden");
    cargarGrafico();
  }

  mostrarTareas();
}

// CERRAR SESIÓN
function logout() {
  currentUser = null;
  document.getElementById("login").classList.remove("hidden");
  document.getElementById("adminPanel").classList.add("hidden");
  document.getElementById("listaTareas").classList.add("hidden");
  document.getElementById("listaTareas").innerHTML = "";
}

// GUARDAR NUEVA ACTIVIDAD
function guardarActividad() {
  const titulo = document.getElementById("titulo").value.trim();
  const comentario = document.getElementById("comentario").value.trim();
  const asignado = document.getElementById("asignado").value.trim();
  if (!titulo || !asignado) return alert("Título y asignación son obligatorios");

  db.collection("actividades").add({
    titulo,
    comentario,
    asignado,
    estado: "pendiente",
    comentarios: [],
    creada: new Date()
  }).then(() => {
    document.getElementById("titulo").value = "";
    document.getElementById("comentario").value = "";
    document.getElementById("asignado").value = "";
    mostrarTareas();
    cargarGrafico();
  });
}

// MOSTRAR ACTIVIDADES
function mostrarTareas() {
  db.collection("actividades").orderBy("creada", "desc").onSnapshot(snapshot => {
    const lista = document.getElementById("listaTareas");
    lista.innerHTML = "";

    snapshot.forEach(doc => {
      const data = doc.data();
      const id = doc.id;

      if (currentUser !== adminId && currentUser !== data.asignado) return;

      const div = document.createElement("div");
      div.className = "tarea";
      div.innerHTML = `
        <h3>${data.titulo}</h3>
        <p><strong>Asignado a:</strong> ${data.asignado}</p>
        <p><strong>Comentario inicial:</strong> ${data.comentario}</p>
        <p><strong>Estado:</strong> ${data.estado}</p>
        ${data.comentarios.map(c => `<p>🗨️ ${c.usuario}: ${c.texto}</p>`).join("")}
        ${currentUser === adminId ? `
          <button onclick="editarActividad('${id}')">Editar</button>
          <button onclick="eliminarActividad('${id}')">Eliminar</button>
        ` : ""}
        ${currentUser !== adminId && data.asignado === currentUser && data.estado !== "finalizado" ? `
          <button onclick="cambiarEstado('${id}', 'iniciado')">Iniciar</button>
          <button onclick="cambiarEstado('${id}', 'finalizado')">Finalizar</button>
          <textarea id="comentario-${id}" placeholder="Agregar comentario"></textarea>
          <button onclick="agregarComentario('${id}')">Comentar</button>
        ` : ""}
      `;
      lista.appendChild(div);
    });
  });
}

// CAMBIAR ESTADO DE ACTIVIDAD
function cambiarEstado(id, nuevoEstado) {
  db.collection("actividades").doc(id).update({ estado: nuevoEstado });
}

// AGREGAR COMENTARIO
function agregarComentario(id) {
  const comentario = document.getElementById(`comentario-${id}`).value.trim();
  if (!comentario) return;

  db.collection("actividades").doc(id).update({
    comentarios: firebase.firestore.FieldValue.arrayUnion({
      usuario: currentUser,
      texto: comentario
    })
  }).then(() => {
    document.getElementById(`comentario-${id}`).value = "";
  });
}

// ELIMINAR ACTIVIDAD
function eliminarActividad(id) {
  if (confirm("¿Seguro que deseas eliminar esta actividad?")) {
    db.collection("actividades").doc(id).delete();
  }
}

// EDITAR ACTIVIDAD (básico - reemplaza)
function editarActividad(id) {
  const nuevoTitulo = prompt("Nuevo título:");
  const nuevoComentario = prompt("Nuevo comentario:");
  const nuevoAsignado = prompt("Nuevo asignado:");

  if (nuevoTitulo && nuevoAsignado) {
    db.collection("actividades").doc(id).update({
      titulo: nuevoTitulo,
      comentario: nuevoComentario,
      asignado: nuevoAsignado
    });
  }
}

// GRAFICO DE CUMPLIMIENTO
function cargarGrafico() {
  db.collection("actividades").get().then(snapshot => {
    const counts = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!counts[data.asignado]) counts[data.asignado] = 0;
      if (data.estado === "finalizado") counts[data.asignado]++;
    });

    const ctx = document.getElementById("graficoCumplidas").getContext("2d");
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(counts),
        datasets: [{
          label: "Tareas cumplidas",
          data: Object.values(counts),
          backgroundColor: "rgba(75,192,192,0.6)"
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: "Tareas finalizadas por usuario" }
        }
      }
    });
  });
}

// Exponer logout en global para HTML
window.login = login;
window.logout = logout;
window.guardarActividad = guardarActividad;
window.eliminarActividad = eliminarActividad;
window.editarActividad = editarActividad;
window.cambiarEstado = cambiarEstado;
window.agregarComentario = agregarComentario;
