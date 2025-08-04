const firebaseConfig = {
  // Tu configuración de Firebase
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = null;

function login() {
  const id = document.getElementById("employeeId").value.trim();
  if (!id) return;
  currentUser = id;
  document.getElementById("login").style.display = "none";
  if (id === "0001") {
    document.getElementById("adminPanel").classList.remove("hidden");
  }
  mostrarTareas();
  cargarGrafico();
}

function guardarActividad() {
  const titulo = document.getElementById("titulo").value.trim();
  const comentario = document.getElementById("comentario").value.trim();
  const asignado = document.getElementById("asignado").value.trim();
  const fecha = document.getElementById("fechaProgramada").value;

  if (!titulo || !asignado || !fecha) return alert("Título, asignación y fecha son obligatorios");

  db.collection("actividades").add({
    titulo,
    comentario,
    asignado,
    estado: "pendiente",
    comentarios: [],
    fecha: fecha,
    creada: new Date()
  }).then(() => {
    document.getElementById("titulo").value = "";
    document.getElementById("comentario").value = "";
    document.getElementById("asignado").value = "";
    document.getElementById("fechaProgramada").value = "";
    mostrarTareas();
    cargarGrafico();
  });
}

function mostrarTareas() {
  db.collection("actividades").orderBy("creada", "desc").onSnapshot(snapshot => {
    const contenedor = document.getElementById("listaTareas");
    contenedor.innerHTML = "";
    snapshot.forEach(doc => {
      const act = doc.data();
      const idDoc = doc.id;
      const mostrar =
        currentUser === "0001" || act.asignado === currentUser;
      if (!mostrar) return;

      const div = document.createElement("div");
      div.innerHTML = \`
        <strong>\${act.titulo}</strong> <br/>
        <em>Asignado a:</em> \${act.asignado} <br/>
        <em>Fecha:</em> \${act.fecha} <br/>
        <em>Estado:</em> \${act.estado} <br/>
        <em>Comentario:</em> \${act.comentario || ""}<br/>
        \${currentUser === "0001" ? \`
          <button onclick="eliminarActividad('\${idDoc}')">Eliminar</button>
        \` : \`
          \${act.estado !== "finalizado" ? '<button onclick="finalizarActividad(\'\${idDoc}\')">Finalizar</button>' : '<em>Finalizado</em>'}
        \`}
        <hr/>
      \`;
      contenedor.appendChild(div);
    });
  });
}

function finalizarActividad(id) {
  db.collection("actividades").doc(id).update({ estado: "finalizado" });
}

function eliminarActividad(id) {
  db.collection("actividades").doc(id).delete();
}

function cargarGrafico() {
  db.collection("actividades").get().then(snapshot => {
    const countsFinalizadas = {};
    const countsTotales = {};
    const hoy = new Date().toISOString().split("T")[0];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.fecha === hoy) {
        if (!countsTotales[data.asignado]) {
          countsTotales[data.asignado] = 0;
          countsFinalizadas[data.asignado] = 0;
        }
        countsTotales[data.asignado]++;
        if (data.estado === "finalizado") {
          countsFinalizadas[data.asignado]++;
        }
      }
    });

    const ctx1 = document.getElementById("graficoCumplidas").getContext("2d");
    new Chart(ctx1, {
      type: "bar",
      data: {
        labels: Object.keys(countsFinalizadas),
        datasets: [{
          label: "Tareas finalizadas hoy",
          data: Object.values(countsFinalizadas),
          backgroundColor: "rgba(75,192,192,0.6)"
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: "Tareas finalizadas hoy por usuario" }
        }
      }
    });

    const porcentajes = Object.keys(countsTotales).map(usuario => {
      const total = countsTotales[usuario];
      const finalizadas = countsFinalizadas[usuario] || 0;
      return Math.round((finalizadas / total) * 100);
    });

    const ctx2 = document.getElementById("graficoPorcentaje").getContext("2d");
    new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels: Object.keys(countsTotales),
        datasets: [{
          label: "% Finalizado",
          data: porcentajes,
          backgroundColor: ["#4caf50", "#2196f3", "#ff9800", "#f44336"]
        }]
      },
      options: {
        plugins: {
          title: { display: true, text: "Porcentaje de cumplimiento hoy" }
        }
      }
    });
  });
}
// Exponer funciones al entorno global
window.login = login;
window.logout = logout;
window.guardarActividad = guardarActividad;
window.eliminarActividad = eliminarActividad;
window.editarActividad = editarActividad;
window.cambiarEstado = cambiarEstado;
window.agregarComentario = agregarComentario;
