// Inicializar Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDPWYVBgVpkBhJdMvlhPV3JzCJHF-za7Us",
  authDomain: "tareas-inteligentes.firebaseapp.com",
  projectId: "tareas-inteligentes",
  storageBucket: "tareas-inteligentes.appspot.com",
  messagingSenderId: "1016472192983",
  appId: "1:1016472192983:web:369bbf0942a95e5ccbad92"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let usuarioActual = "";

// Iniciar sesión
function login() {
  const id = document.getElementById("employeeId").value.trim();
  if (!id) {
    alert("Ingrese un número válido");
    return;
  }

  usuarioActual = id;
  document.getElementById("login").classList.add("hidden");

  if (id === "0001") {
    document.getElementById("adminPanel").classList.remove("hidden");
    mostrarGrafico();
  }

  cargarTareas();
}

// Guardar o editar actividad
function guardarActividad() {
  const titulo = document.getElementById("titulo").value.trim();
  const comentario = document.getElementById("comentario").value.trim();
  const asignado = document.getElementById("asignado").value.trim();

  if (!titulo || !comentario || !asignado) {
    alert("Completa todos los campos");
    return;
  }

  db.collection("actividades").add({
    titulo,
    comentario,
    asignado,
    estado: "pendiente",
    comentarios: [],
    horaInicio: null,
    horaFin: null
  }).then(() => {
    document.getElementById("titulo").value = "";
    document.getElementById("comentario").value = "";
    document.getElementById("asignado").value = "";
    cargarTareas();
  });
}

// Mostrar tareas
function cargarTareas() {
  db.collection("actividades").onSnapshot(snapshot => {
    const lista = document.getElementById("listaTareas");
    lista.innerHTML = "";

    snapshot.forEach(doc => {
      const data = doc.data();
      const div = document.createElement("div");
      div.classList.add("tarea");

      const info = `
        <h3>${data.titulo}</h3>
        <p><strong>Asignado:</strong> ${data.asignado}</p>
        <p><strong>Comentario:</strong> ${data.comentario}</p>
        <p><strong>Estado:</strong> ${data.estado}</p>
        ${data.horaInicio ? `<p><strong>Inicio:</strong> ${data.horaInicio}</p>` : ""}
        ${data.horaFin ? `<p><strong>Finalizado:</strong> ${data.horaFin}</p>` : ""}
      `;

      div.innerHTML = info;

      // Mostrar botones según el rol
      if (usuarioActual === "0001") {
        const btnEditar = document.createElement("button");
        btnEditar.textContent = "Editar";
        btnEditar.onclick = () => editarTarea(doc.id, data);
        div.appendChild(btnEditar);

        const btnEliminar = document.createElement("button");
        btnEliminar.textContent = "Eliminar";
        btnEliminar.onclick = () => eliminarTarea(doc.id);
        div.appendChild(btnEliminar);
      }

      if (usuarioActual === data.asignado) {
        if (data.estado === "pendiente") {
          const btnIniciar = document.createElement("button");
          btnIniciar.textContent = "Iniciar";
          btnIniciar.onclick = () => actualizarEstado(doc.id, "en progreso");
          div.appendChild(btnIniciar);
        }

        if (data.estado === "en progreso") {
          const btnFinalizar = document.createElement("button");
          btnFinalizar.textContent = "Finalizar";
          btnFinalizar.onclick = () => actualizarEstado(doc.id, "finalizado");
          div.appendChild(btnFinalizar);
        }

        const inputComentario = document.createElement("input");
        inputComentario.placeholder = "Agregar comentario";

        const btnComentar = document.createElement("button");
        btnComentar.textContent = "Comentar";
        btnComentar.onclick = () => agregarComentario(doc.id, inputComentario.value);
        div.appendChild(inputComentario);
        div.appendChild(btnComentar);
      }

      // Mostrar comentarios (solo para admin)
      if (usuarioActual === "0001" && data.comentarios.length) {
        const coments = data.comentarios.map(c => `<li>${c.usuario}: ${c.texto}</li>`).join("");
        div.innerHTML += `<ul><strong>Comentarios:</strong>${coments}</ul>`;
      }

      lista.appendChild(div);
    });

    if (usuarioActual === "0001") mostrarGrafico();
  });
}

// Editar tarea
function editarTarea(id, data) {
  const nuevoTitulo = prompt("Nuevo título:", data.titulo);
  const nuevoComentario = prompt("Nuevo comentario:", data.comentario);
  const nuevoAsignado = prompt("Nuevo asignado:", data.asignado);

  db.collection("actividades").doc(id).update({
    titulo: nuevoTitulo,
    comentario: nuevoComentario,
    asignado: nuevoAsignado
  });
}

// Eliminar tarea
function eliminarTarea(id) {
  if (confirm("¿Eliminar esta tarea?")) {
    db.collection("actividades").doc(id).delete();
  }
}

// Actualizar estado
function actualizarEstado(id, nuevoEstado) {
  const hora = new Date().toLocaleString();
  const campoHora = nuevoEstado === "en progreso" ? { horaInicio: hora } : { horaFin: hora };

  db.collection("actividades").doc(id).update({
    estado: nuevoEstado,
    ...campoHora
  });
}

// Agregar comentario
function agregarComentario(id, texto) {
  if (!texto.trim()) return;

  db.collection("actividades").doc(id).update({
    comentarios: firebase.firestore.FieldValue.arrayUnion({
      usuario: usuarioActual,
      texto: texto.trim()
    })
  });
}

// Gráfico para admin
function mostrarGrafico() {
  db.collection("actividades").get().then(snapshot => {
    const cumplidasPorUsuario = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.estado === "finalizado") {
        cumplidasPorUsuario[data.asignado] = (cumplidasPorUsuario[data.asignado] || 0) + 1;
      }
    });

    const ctx = document.getElementById("graficoCumplidas").getContext("2d");
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(cumplidasPorUsuario),
        datasets: [{
          label: "Tareas finalizadas",
          data: Object.values(cumplidasPorUsuario),
          backgroundColor: "rgba(75,192,192,0.6)"
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        }
      }
    });
  });
}
