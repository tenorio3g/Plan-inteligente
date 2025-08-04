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
    mostrarProgresoAdmin(); // NUEVO
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

    const estados = { pendiente: [], iniciado: [], finalizado: [] };
    const tareasEmpleado = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const id = doc.id;

      if (currentUser !== adminId && currentUser !== data.asignado) return;
      tareasEmpleado.push(data);

      const div = document.createElement("div");
      div.className = "tarea";
      div.innerHTML = `
        <h3>${data.titulo}</h3>
        <p><strong>Asignado a:</strong> ${data.asignado}</p>
        <p><strong>Comentario inicial:</strong> ${data.comentario}</p>
        <p><strong>Estado:</strong> ${data.estado}</p>
        ${data.comentarios.map(c => `<p>🗨️ ${c.usuario}: ${c.texto}</p>`).join("")}
        ${currentUser !== adminId && data.asignado === currentUser ? `
          ${data.estado === "pendiente" ? `
            <button onclick="cambiarEstado('${id}', 'iniciado')">Iniciar</button>
            <button onclick="cambiarEstado('${id}', 'finalizado')">Finalizar</button>
          ` : data.estado === "iniciado" ? `
            <button onclick="cambiarEstado('${id}', 'finalizado')">Finalizar</button>
          ` : `
            <button onclick="cambiarEstado('${id}', 'pendiente')">Reabrir</button>
          `}
          <textarea id="comentario-${id}" placeholder="Agregar comentario"></textarea>
          <button onclick="agregarComentario('${id}')">Comentar</button>
        ` : ""}
        ${currentUser === adminId ? `
          <button onclick="editarActividad('${id}')">Editar</button>
          <button onclick="eliminarActividad('${id}')">Eliminar</button>
        ` : ""}
      `;

      estados[data.estado].push(div);
    });

    if (currentUser !== adminId) mostrarProgreso(tareasEmpleado);

    for (const estado in estados) {
      const grupo = estados[estado];
      if (grupo.length > 0) {
        const seccion = document.createElement("div");
        seccion.innerHTML = `<h2>${estado.charAt(0).toUpperCase() + estado.slice(1)} (${grupo.length})</h2>`;
        grupo.forEach(tarea => seccion.appendChild(tarea));
        lista.appendChild(seccion);
      }
    }
  });
}
function mostrarProgreso(tareas) {
  if (currentUser === adminId) return;

  const contenedor = document.getElementById("progresoEmpleado");
  const total = tareas.length;
  const finalizadas = tareas.filter(t => t.estado === "finalizado").length;
  const porcentaje = total > 0 ? Math.round((finalizadas / total) * 100) : 0;
  let color;

  if (porcentaje < 50) {
    color = "#dc3545";
  } else if (porcentaje < 80) {
    color = "#ffc107";
  } else {
    color = "#28a745";
  }

  contenedor.classList.remove("hidden");
  contenedor.innerHTML = `
    <h2>Progreso: ${finalizadas} de ${total} tareas finalizadas (${porcentaje}%)</h2>
    <div style="background:#ddd; height:20px; border-radius:10px;">
      <div style="background:${color}; height:100%; width:${porcentaje}%; border-radius:10px;"></div>
    </div>
  `;
}
function mostrarProgresoAdmin() {
  db.collection("actividades").onSnapshot(snapshot => {
    const progresos = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      const empleado = data.asignado;
      if (!progresos[empleado]) progresos[empleado] = { total: 0, finalizadas: 0 };
      progresos[empleado].total++;
      if(data.estado === "finalizado") progresos[empleado].finalizadas++;
    });

    const contenedorAdmin = document.getElementById("progresoAdmin");
    contenedorAdmin.innerHTML = "<h2>Progreso de Empleados</h2>";

    for (const empleado in progresos) {
      const total = progresos[empleado].total;
      const finalizadas = progresos[empleado].finalizadas;
      const porcentaje = total > 0 ? Math.round((finalizadas / total) * 100) : 0;
      let color;

      if (porcentaje < 50) {
        color = "#dc3545";
      } else if (porcentaje < 80) {
        color = "#ffc107";
      } else {
        color = "#28a745";
      }

      contenedorAdmin.innerHTML += `
        <h3>Empleado: ${empleado} - ${finalizadas} de ${total} (${porcentaje}%)</h3>
        <div style="background:#ddd; height:20px; border-radius:10px; margin-bottom:10px;">
          <div style="background:${color}; height:100%; width:${porcentaje}%; border-radius:10px;"></div>
        </div>
      `;
    }
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
