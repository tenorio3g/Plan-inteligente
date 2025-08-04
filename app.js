const firebaseConfig = {
  apiKey: "AIzaSyDPWYVBgVpkBhJdMvlhPV3JzCJHF-za7Us",
  authDomain: "tareas-inteligentes.firebaseapp.com",
  projectId: "tareas-inteligentes",
  storageBucket: "tareas-inteligentes.firebasestorage.app",
  messagingSenderId: "1016472192983",
  appId: "1:1016472192983:web:369bbf0942a95e5ccbad92",
  measurementId: "G-QM9K6W0C4Q"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let empleadoId = null;
let esAdmin = false;
const tareasRef = db.collection("tareas");

function login() {
  const input = document.getElementById("employeeId");
  empleadoId = input.value.trim();
  if (!empleadoId) return alert("Ingresa tu número de empleado");

  esAdmin = empleadoId === "0001";

  document.getElementById("login").classList.add("hidden");
  document.getElementById("listaTareas").innerHTML = "";
  if (esAdmin) {
    document.getElementById("adminPanel").classList.remove("hidden");
    cargarGrafico();
  }
  escucharTareas();
}

function logout() {
  location.reload(); // Reinicia la página
}

function guardarActividad() {
  const titulo = document.getElementById("titulo").value;
  const comentario = document.getElementById("comentario").value;
  const asignado = document.getElementById("asignado").value;
  const fecha = document.getElementById("fecha").value;

  if (!titulo || !asignado || !fecha) return alert("Completa todos los campos");

  tareasRef.add({
    titulo,
    comentario,
    asignado,
    fecha,
    estado: "pendiente",
    comentarios: [],
    creadaPor: empleadoId
  });

  document.getElementById("titulo").value = "";
  document.getElementById("comentario").value = "";
  document.getElementById("asignado").value = "";
  document.getElementById("fecha").value = "";
}

function escucharTareas() {
  tareasRef.orderBy("fecha").onSnapshot(snapshot => {
    document.getElementById("listaTareas").innerHTML = "";

    const hoy = new Date().toISOString().split("T")[0];
    const datosGrafico = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      const id = doc.id;

      // Mostrar a todos, incluso si no son asignados (modo solo lectura)
      const puedeVer = esAdmin || data.asignado === empleadoId;

      if (puedeVer) {
        const div = document.createElement("div");
        div.className = "tarea";
        div.innerHTML = `
          <h3>${data.titulo}</h3>
          <p><strong>Comentario:</strong> ${data.comentario || "Sin comentarios"}</p>
          <p><strong>Asignado a:</strong> ${data.asignado}</p>
          <p><strong>Fecha:</strong> ${data.fecha}</p>
          <p><strong>Estado:</strong> ${data.estado}</p>
          ${data.estado === "finalizado" && data.finalizadoPor ? `<p><strong>Finalizado por:</strong> ${data.finalizadoPor}</p>` : ""}
          ${mostrarBotones(data, id)}
          <div><strong>Comentarios:</strong> ${data.comentarios?.map(c => `<div>- ${c}</div>`).join("") || "Ninguno"}</div>
        `;
        document.getElementById("listaTareas").appendChild(div);
      }

      // Para el gráfico: contar solo tareas de hoy
      if (esAdmin && data.fecha === hoy) {
        if (!datosGrafico[data.asignado]) datosGrafico[data.asignado] = { total: 0, finalizadas: 0 };
        datosGrafico[data.asignado].total++;
        if (data.estado === "finalizado") datosGrafico[data.asignado].finalizadas++;
      }
    });

    if (esAdmin) dibujarGrafico(datosGrafico);
  });
}

function mostrarBotones(data, id) {
  let botones = "";

  if (esAdmin) {
    botones += `<button onclick="eliminarActividad('${id}')">Eliminar</button>`;
  } else if (data.asignado === empleadoId) {
    if (data.estado === "pendiente") {
      botones += `<button onclick="cambiarEstado('${id}', 'en progreso')">Iniciar</button>`;
    }
    if (data.estado === "en progreso") {
      botones += `<button onclick="cambiarEstado('${id}', 'finalizado')">Finalizar</button>`;
    }
    if (data.estado === "finalizado") {
      botones += `<button disabled>Finalizado</button>`;
    }
    botones += `
      <input type="text" id="comentario-${id}" placeholder="Agregar comentario" />
      <button onclick="agregarComentario('${id}')">Comentar</button>
    `;
  }

  return botones;
}

function cambiarEstado(id, estado) {
  tareasRef.doc(id).update({
    estado,
    finalizadoPor: estado === "finalizado" ? empleadoId : ""
  });
}

function agregarComentario(id) {
  const input = document.getElementById(`comentario-${id}`);
  const texto = input.value.trim();
  if (!texto) return;

  tareasRef.doc(id).update({
    comentarios: firebase.firestore.FieldValue.arrayUnion(`${empleadoId}: ${texto}`)
  });
  input.value = "";
}

function eliminarActividad(id) {
  if (confirm("¿Eliminar esta actividad?")) {
    tareasRef.doc(id).delete();
  }
}

function dibujarGrafico(datos) {
  const ctx = document.getElementById("grafico").getContext("2d");
  if (window.miGrafico) window.miGrafico.destroy();

  const labels = Object.keys(datos);
  const values = labels.map(emp => {
    const { finalizadas, total } = datos[emp];
    return Math.round((finalizadas / total) * 100);
  });

  window.miGrafico = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels.map(e => `Empleado ${e}`),
      datasets: [{
        label: "% Cumplimiento hoy",
        data: values,
        backgroundColor: ["#4caf50", "#ff9800", "#2196f3", "#f44336"]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        title: { display: true, text: "Cumplimiento diario por empleado" }
      }
    }
  });
}

// Exponer funciones
window.login = login;
window.logout = logout;
window.guardarActividad = guardarActividad;
window.eliminarActividad = eliminarActividad;
window.editarActividad = editarActividad;
window.cambiarEstado = cambiarEstado;
window.agregarComentario = agregarComentario;
