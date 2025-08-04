// Inicializar Firebase
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_BUCKET",
  messagingSenderId: "TU_MESSAGING_ID",
  appId: "TU_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let empleadoActual = null;
const fechaHoy = new Date().toISOString().split('T')[0];

// Login
function login() {
  const input = document.getElementById("employeeId");
  const id = input.value.trim();
  if (id) {
    empleadoActual = id;
    document.getElementById("login").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    cargarActividades();
    if (empleadoActual === "0001") {
      mostrarGraficaPorEmpleado();
    }
  }
}

// Cerrar sesión
function cerrarSesion() {
  location.reload();
}

// Guardar actividad
function guardarActividad() {
  const titulo = document.getElementById("titulo").value;
  const comentario = document.getElementById("comentario").value;
  const asignado = document.getElementById("asignado").value;
  const fecha = document.getElementById("fecha").value;

  if (titulo && comentario && asignado && fecha) {
    db.collection("actividades").add({
      titulo,
      comentario,
      asignado,
      fecha,
      estado: "pendiente",
      creadaPor: empleadoActual,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      document.getElementById("titulo").value = "";
      document.getElementById("comentario").value = "";
      document.getElementById("asignado").value = "";
      document.getElementById("fecha").value = "";
      cargarActividades();
      if (empleadoActual === "0001") {
        mostrarGraficaPorEmpleado();
      }
    });
  }
}

// Cargar actividades
function cargarActividades() {
  const lista = document.getElementById("listaTareas");
  lista.innerHTML = "";

  db.collection("actividades")
    .where("fecha", "==", fechaHoy)
    .get()
    .then((querySnapshot) => {
      const actividades = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (empleadoActual === "0001" || data.asignado === empleadoActual) {
          actividades.push({ id: doc.id, ...data });
        }
      });

      actividades.forEach((act) => {
        const div = document.createElement("div");
        div.classList.add("actividad");
        div.innerHTML = `
          <h3>${act.titulo}</h3>
          <p>${act.comentario}</p>
          <p>Asignado a: ${act.asignado}</p>
          <p>Estado: ${act.estado}</p>
          ${act.estado === "pendiente" && act.asignado === empleadoActual ? `<button onclick="finalizarActividad('${act.id}')">Finalizar</button>` : ""}
        `;
        lista.appendChild(div);
      });
    });
}

// Finalizar actividad
function finalizarActividad(id) {
  db.collection("actividades").doc(id).update({
    estado: "finalizado"
  }).then(() => {
    cargarActividades();
    if (empleadoActual === "0001") {
      mostrarGraficaPorEmpleado();
    }
  });
}

// Mostrar gráfica circular por empleado
function mostrarGraficaPorEmpleado() {
  db.collection("actividades")
    .where("fecha", "==", fechaHoy)
    .get()
    .then((querySnapshot) => {
      const contador = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const emp = data.asignado;
        if (!contador[emp]) {
          contador[emp] = { total: 0, finalizadas: 0 };
        }
        contador[emp].total++;
        if (data.estado === "finalizado") {
          contador[emp].finalizadas++;
        }
      });

      const labels = Object.keys(contador);
      const porcentajes = labels.map((emp) => {
        const { total, finalizadas } = contador[emp];
        return total ? Math.round((finalizadas / total) * 100) : 0;
      });

      const ctx = document.getElementById("graficoCumplidas").getContext("2d");
      if (window.graficoCumplidas) window.graficoCumplidas.destroy(); // limpiar si ya existe

      window.graficoCumplidas = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: labels.map(e => `Empleado ${e}`),
          datasets: [{
            label: "% Completado",
            data: porcentajes,
            backgroundColor: ["#4caf50", "#2196f3", "#ff9800", "#e91e63"],
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',
            },
            title: {
              display: true,
              text: 'Actividades Completadas por Empleado (Hoy)'
            }
          }
        }
      });
    });
}
