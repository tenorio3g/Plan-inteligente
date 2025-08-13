// =========================
// CONFIGURACIÓN FIREBASE
// =========================
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// =========================
// VARIABLES GLOBALES
// =========================
let usuarioActual = null;
let actividadesGlobal = []; // Siempre contiene TODAS las tareas

// =========================
// LOGIN Y LOGOUT
// =========================
function login() {
  const id = document.getElementById("employeeId").value.trim();
  if (!id) {
    mostrarAlerta("Ingrese un número de empleado", "error");
    return;
  }
  usuarioActual = id;
  document.getElementById("login").classList.add("hidden");
  document.getElementById("logout").classList.remove("hidden");

  if (usuarioActual === "0001") {
    document.getElementById("adminPanel").classList.remove("hidden");
    escucharActividadesAdmin();
  } else {
    document.getElementById("progresoEmpleado").classList.remove("hidden");
    escucharActividadesEmpleado();
  }
}

function logout() {
  usuarioActual = null;
  actividadesGlobal = [];
  document.getElementById("login").classList.remove("hidden");
  document.getElementById("logout").classList.add("hidden");
  document.getElementById("adminPanel").classList.add("hidden");
  document.getElementById("progresoEmpleado").classList.add("hidden");
  document.getElementById("listaTareas").innerHTML = "";
  document.getElementById("progresoAdmin").innerHTML = "";
}

// =========================
// ESCUCHA EN TIEMPO REAL
// =========================
function escucharActividadesAdmin() {
  db.collection("actividades").orderBy("fecha", "asc").onSnapshot((snapshot) => {
    actividadesGlobal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderizarLista(actividadesGlobal);
    renderizarGraficoAdmin(actividadesGlobal);
  });
}

function escucharActividadesEmpleado() {
  db.collection("actividades")
    .where("asignado", "array-contains", usuarioActual)
    .orderBy("fecha", "asc")
    .onSnapshot((snapshot) => {
      actividadesGlobal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderizarListaEmpleado(actividadesGlobal);
    });
}

// =========================
// GUARDAR ACTIVIDAD
// =========================
function guardarActividad() {
  const titulo = document.getElementById("titulo").value.trim();
  const comentario = document.getElementById("comentario").value.trim();
  const asignado = document.getElementById("asignado").value.trim().split(",").map(x => x.trim());
  const fecha = document.getElementById("fecha").value;
  const activo = document.getElementById("activo").value === "true";

  if (!titulo || !asignado.length || !fecha) {
    mostrarAlerta("Complete todos los campos obligatorios", "error");
    return;
  }

  db.collection("actividades").add({
    titulo,
    comentario,
    asignado,
    fecha,
    activo,
    estado: "pendiente",
    historial: [],
    creadoEn: firebase.firestore.Timestamp.now()
  }).then(() => {
    mostrarAlerta("Actividad guardada correctamente", "success");
    document.getElementById("titulo").value = "";
    document.getElementById("comentario").value = "";
    document.getElementById("asignado").value = "";
    document.getElementById("fecha").value = "";
  });
}

// =========================
// RENDERIZAR LISTAS
// =========================
function renderizarLista(lista) {
  const contenedor = document.getElementById("listaTareas");
  contenedor.innerHTML = "";

  if (!lista.length) {
    contenedor.innerHTML = "<p>No hay tareas registradas</p>";
    return;
  }

  lista.forEach(act => {
    const card = document.createElement("div");
    card.className = "tarea";
    card.innerHTML = `
      <h4>${act.titulo}</h4>
      <p><b>Asignado:</b> ${act.asignado.join(", ")}</p>
      <p><b>Fecha límite:</b> ${act.fecha}</p>
      <p><b>Estado:</b> ${act.estado}</p>
      <p>${act.comentario || ""}</p>
    `;
    contenedor.appendChild(card);
  });
}

function renderizarListaEmpleado(lista) {
  const contenedor = document.getElementById("listaTareas");
  contenedor.innerHTML = "";

  if (!lista.length) {
    contenedor.innerHTML = "<p>No tienes tareas asignadas</p>";
    return;
  }

  lista.forEach(act => {
    const card = document.createElement("div");
    card.className = "tarea";
    card.innerHTML = `
      <h4>${act.titulo}</h4>
      <p><b>Fecha límite:</b> ${act.fecha}</p>
      <p><b>Estado:</b> ${act.estado}</p>
      <p>${act.comentario || ""}</p>
      ${act.estado === "pendiente" ? `<button onclick="marcarComoCompletada('${act.id}')">Marcar como completada</button>` : ""}
    `;
    contenedor.appendChild(card);
  });
}

// =========================
// ACTUALIZAR ESTADO EMPLEADO
// =========================
function marcarComoCompletada(id) {
  db.collection("actividades").doc(id).update({
    estado: "finalizada",
    historial: firebase.firestore.FieldValue.arrayUnion({
      usuario: usuarioActual,
      accion: "finalizó la tarea",
      fecha: firebase.firestore.Timestamp.now()
    })
  }).then(() => {
    mostrarAlerta("Tarea completada", "success");
  });
}

// =========================
// GRÁFICOS ADMIN
// =========================
function renderizarGraficoAdmin(lista) {
  const ctx = document.getElementById("graficoCumplidas").getContext("2d");
  const total = lista.length;
  const finalizadas = lista.filter(a => a.estado === "finalizada").length;
  const pendientes = total - finalizadas;

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Finalizadas", "Pendientes"],
      datasets: [{
        data: [finalizadas, pendientes],
        backgroundColor: ["#4CAF50", "#F44336"]
      }]
    },
    options: { responsive: true }
  });
}

// =========================
// ALERTAS
// =========================
function mostrarAlerta(mensaje, tipo = "info") {
  const cont = document.getElementById("alerta-container");
  const div = document.createElement("div");
  div.className = `alerta ${tipo}`;
  div.textContent = mensaje;
  cont.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}
// =========================
// FILTROS Y BÚSQUEDA
// =========================
function filtrarPorFecha(fecha) {
  if (!fecha) {
    renderizarLista(actividadesGlobal);
    return;
  }
  const filtradas = actividadesGlobal.filter(a => a.fecha === fecha);
  if (usuarioActual === "0001") {
    renderizarLista(filtradas);
    renderizarGraficoAdmin(filtradas);
  } else {
    renderizarListaEmpleado(filtradas);
  }
}

function buscarTareas(texto) {
  const t = texto.toLowerCase();
  const filtradas = actividadesGlobal.filter(a =>
    a.titulo.toLowerCase().includes(t) ||
    a.comentario?.toLowerCase().includes(t) ||
    a.asignado.some(asg => asg.toLowerCase().includes(t))
  );

  if (usuarioActual === "0001") {
    renderizarLista(filtradas);
    renderizarGraficoAdmin(filtradas);
  } else {
    renderizarListaEmpleado(filtradas);
  }
}

// =========================
// EXPORTAR CSV
// =========================
function exportarCSV() {
  if (!actividadesGlobal.length) {
    mostrarAlerta("No hay datos para exportar", "error");
    return;
  }
  let csv = "Título,Asignado,Fecha,Estado,Comentario\n";
  actividadesGlobal.forEach(a => {
    csv += `"${a.titulo}","${a.asignado.join(", ")}","${a.fecha}","${a.estado}","${a.comentario || ""}"\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", "actividades.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =========================
// EXPORTAR PDF
// =========================
function exportarPDF() {
  if (!actividadesGlobal.length) {
    mostrarAlerta("No hay datos para exportar", "error");
    return;
  }
  const doc = new jspdf.jsPDF();
  doc.setFontSize(14);
  doc.text("Reporte de Actividades", 10, 10);

  let y = 20;
  actividadesGlobal.forEach((a, i) => {
    doc.text(`${i + 1}. ${a.titulo} | ${a.asignado.join(", ")} | ${a.fecha} | ${a.estado}`, 10, y);
    y += 8;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  doc.save("actividades.pdf");
}

// =========================
// ELIMINAR ACTIVIDAD (ADMIN)
// =========================
function eliminarActividad(id) {
  if (confirm("¿Seguro que quieres eliminar esta actividad?")) {
    db.collection("actividades").doc(id).delete()
      .then(() => mostrarAlerta("Actividad eliminada", "success"));
  }
}

// =========================
// MARCAR COMO PENDIENTE (ADMIN)
// =========================
function marcarComoPendiente(id) {
  db.collection("actividades").doc(id).update({ estado: "pendiente" })
    .then(() => mostrarAlerta("Actividad marcada como pendiente", "success"));
}

// =========================
// EVENTOS UI
// =========================
document.getElementById("btnGuardar").addEventListener("click", guardarActividad);
document.getElementById("btnExportarCSV").addEventListener("click", exportarCSV);
document.getElementById("btnExportarPDF").addEventListener("click", exportarPDF);
document.getElementById("btnLogout").addEventListener("click", logout);

document.getElementById("filtroFecha").addEventListener("change", (e) => filtrarPorFecha(e.target.value));
document.getElementById("buscar").addEventListener("input", (e) => buscarTareas(e.target.value));
