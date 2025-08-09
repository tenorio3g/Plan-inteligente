// app.js — completo

// --------------------
// Configuración Firebase (pon aquí tus credenciales reales)
// --------------------
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

// --------------------
// Globales
// --------------------
const adminId = "0001";
let currentUser = null;
let graficoRef = null;

// Empleados disponibles (puedes cargar esto desde Firestore o mantenerlo estático)
const empleados = ["Nato", "Juan", "Ana", "Luisa", "Pedro", "Carlos", "Erika", "Sandra"];
const maxEmpleados = 5;

// Variables relacionadas con UI de chips — se inicializan en initApp()
let inputEmpleado = null;
let chipsContainer = null;
let empleadosSeleccionados = [];

// --------------------
// Inicialización cuando DOM esté listo
// --------------------
document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  // Referencias a elementos del DOM (si no existen, las dejamos como null y comprobamos antes)
  inputEmpleado = document.getElementById("input-empleado");
  chipsContainer = document.getElementById("chips-container");

  // Si existen el input y el contenedor, configurar el comportamiento de chips
  if (inputEmpleado && chipsContainer) {
    // Autocompletar simple (completa con el primer match)
    inputEmpleado.addEventListener("input", function () {
      const valor = this.value.toLowerCase();
      const coincidencia = empleados.find(emp => emp.toLowerCase().startsWith(valor));
      if (coincidencia && valor.length > 0) {
        // No sobreescribir si ya hay selección idéntica
        // (dejamos que el usuario confirme con Enter o botón)
        // Esta línea es opcional; si prefieres no autocompletar automáticamente, coméntala.
        this.value = coincidencia;
      }
    });

    // Detectar Enter o coma (escritorio)
    inputEmpleado.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        agregarDesdeInput();
      }
    });
  }

  // Llamamos cargarGrafico() y mostrarTareas() para que los listeners onSnapshot comiencen
  // (no requieren usuario logueado para montar listeners; filtrado de UI se aplica luego)
  cargarGrafico();
  mostrarTareas();
  mostrarProgresoAdmin(); // monta listener admin (no muestra si no eres admin)
}

// --------------------
// UI: Alertas
// --------------------
function mostrarAlerta(mensaje, ms = 3800) {
  let cont = document.getElementById("alerta-container");
  if (!cont) {
    cont = document.createElement("div");
    cont.id = "alerta-container";
    document.body.appendChild(cont);
  }

  const alerta = document.createElement("div");
  alerta.className = "alerta";
  alerta.textContent = mensaje;
  cont.appendChild(alerta);

  setTimeout(() => {
    alerta.style.transition = "opacity 0.25s, transform 0.25s";
    alerta.style.opacity = "0";
    alerta.style.transform = "translateY(-8px)";
    setTimeout(() => alerta.remove(), 250);
  }, ms);
}

// --------------------
// Chips / selección de empleados (UI)
// --------------------
function agregarDesdeInput() {
  if (!inputEmpleado || !chipsContainer) return;
  const nombre = inputEmpleado.value.trim();
  if (!nombre) return mostrarAlerta("⚠️ Escribe un nombre válido");

  if (!empleados.includes(nombre)) {
    return mostrarAlerta("⚠️ Nombre inválido (no existe en la lista)");
  }
  if (empleadosSeleccionados.includes(nombre)) {
    return mostrarAlerta("⚠️ Ya está seleccionado");
  }
  if (empleadosSeleccionados.length >= maxEmpleados) {
    return mostrarAlerta(`⚠️ Límite de ${maxEmpleados} empleados alcanzado`);
  }
  empleadosSeleccionados.push(nombre);
  agregarChip(nombre);
  inputEmpleado.value = "";
}

function forzarAgregarChip() {
  // Esta función puede ser llamada desde el botón ➕ del HTML
  agregarDesdeInput();
}

function agregarChip(nombre) {
  if (!chipsContainer) return;
  const chip = document.createElement("div");
  chip.className = "chip";
  chip.setAttribute("data-nombre", nombre);
  chip.innerHTML = `${nombre} <span class="chip-close" title="Quitar" onclick="removerChip('${nombre}')">&times;</span>`;
  chipsContainer.appendChild(chip);
}

function removerChip(nombre) {
  empleadosSeleccionados = empleadosSeleccionados.filter(emp => emp !== nombre);
  if (!chipsContainer) return;
  const chips = chipsContainer.querySelectorAll(".chip");
  chips.forEach(chip => {
    if (chip.getAttribute("data-nombre") === nombre) chip.remove();
  });
}

function obtenerEmpleadosSeleccionados() {
  return empleadosSeleccionados;
}

// --------------------
// Guardar actividad (administrador) — corregida y robusta
// --------------------
function guardarActividad() {
  // Validaciones: elementos en DOM
  const tituloEl = document.getElementById("titulo");
  const comentarioEl = document.getElementById("comentario");
  const fechaEl = document.getElementById("fecha");
  const activoEl = document.getElementById("activo");

  if (!tituloEl || !comentarioEl || !fechaEl || !activoEl) {
    mostrarAlerta("❌ Error: el formulario no está completo en el HTML");
    return;
  }

  const titulo = tituloEl.value.trim();
  const comentario = comentarioEl.value.trim();
  const fecha = fechaEl.value;
  const activo = activoEl.value === "true";

  const asignados = obtenerEmpleadosSeleccionados();

  if (!titulo || asignados.length === 0) {
    mostrarAlerta("⚠️ Título y al menos un empleado son obligatorios");
    return;
  }

  const nuevaActividad = {
    titulo,
    comentario,
    asignados,
    fecha: fecha || null,
    // horaInicio/horaFin las llenará el empleado cuando inicie/finalice
    horaInicio: null,
    horaFin: null,
    estado: "pendiente",
    activo,
    comentarios: [],
    creada: new Date()
  };

  // Guardar en Firestore
  db.collection("actividades").add(nuevaActividad)
    .then(() => {
      // Limpiar formulario (sólo si existían los elementos)
      tituloEl.value = "";
      comentarioEl.value = "";
      fechaEl.value = "";
      activoEl.value = "false";

      // Limpiar asignados (chips)
      empleadosSeleccionados = [];
      if (chipsContainer) chipsContainer.innerHTML = "";
      if (inputEmpleado) inputEmpleado.value = "";

      mostrarAlerta("✅ Actividad guardada correctamente");
      // Refrescar vista
      aplicarFiltros();
    })
    .catch((error) => {
      console.error("Error al guardar actividad:", error);
      mostrarAlerta("❌ Error al guardar la actividad");
    });
}

// --------------------
// Login / logout
// --------------------
function login() {
  const id = document.getElementById("employeeId").value.trim();
  if (!id) return mostrarAlerta("⚠️ Ingresa tu número de empleado");
  currentUser = id;
  // Mostrar/ocultar secciones
  const loginSec = document.getElementById("login");
  const listaSec = document.getElementById("listaTareas");
  const adminPanel = document.getElementById("adminPanel");
  const logoutBtn = document.getElementById("logout");

  if (loginSec) loginSec.classList.add("hidden");
  if (listaSec) listaSec.classList.remove("hidden");
  if (logoutBtn) logoutBtn.classList.remove("hidden");
  if (currentUser === adminId) {
    if (adminPanel) adminPanel.classList.remove("hidden");
  } else {
    if (adminPanel) adminPanel.classList.add("hidden");
  }

  aplicarFiltros();
}

function logout() {
  currentUser = null;
  const loginSec = document.getElementById("login");
  const adminPanel = document.getElementById("adminPanel");
  const listaSec = document.getElementById("listaTareas");
  const logoutBtn = document.getElementById("logout");
  const progresoEmpleado = document.getElementById("progresoEmpleado");
  const progresoAdmin = document.getElementById("progresoAdmin");

  if (loginSec) loginSec.classList.remove("hidden");
  if (adminPanel) adminPanel.classList.add("hidden");
  if (listaSec) listaSec.classList.add("hidden");
  if (logoutBtn) logoutBtn.classList.add("hidden");
  if (listaSec) listaSec.innerHTML = "";
  if (progresoEmpleado) progresoEmpleado.classList.add("hidden");
  if (progresoAdmin) progresoAdmin.innerHTML = "";
}

// --------------------
// Mostrar tareas (listener real-time + filtrado por fechas)
// --------------------
function mostrarTareas() {
  const desde = document.getElementById('filtroDesde')?.value;
  const hasta = document.getElementById('filtroHasta')?.value;
  const desdeFecha = desde ? new Date(desde) : null;
  const hastaFecha = hasta ? new Date(hasta) : null;
  if (hastaFecha) hastaFecha.setHours(23,59,59,999);

  // Listener en tiempo real
  db.collection("actividades").orderBy("creada", "desc").onSnapshot(snapshot => {
    const lista = document.getElementById("listaTareas");
    if (!lista) return;
    lista.innerHTML = "";
    const tareasEmpleado = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const id = doc.id;

      const fechaActividad = data.fecha ? new Date(data.fecha) : null;
      if (desdeFecha && (!fechaActividad || fechaActividad < desdeFecha)) return;
      if (hastaFecha && (!fechaActividad || fechaActividad > hastaFecha)) return;

      const hoy = new Date();
      hoy.setHours(0,0,0,0);
      const fechaLimite = data.fecha ? new Date(data.fecha) : null;

      const esAsignado = data.asignados?.includes(currentUser);
      const visibleParaEmpleado = currentUser !== adminId && esAsignado &&
        data.activo &&
        (!fechaLimite || fechaLimite <= hoy);

      if (!(currentUser === adminId || visibleParaEmpleado)) return;

      if (esAsignado) tareasEmpleado.push({ ...data, id });

      const div = document.createElement("div");
      const vencida = fechaLimite && fechaLimite < hoy;
      div.className = `tarea ${data.estado || "pendiente"}`;
      if (vencida && data.estado !== "finalizado") {
        div.classList.add("vencida");
      }

      // Mostrar horas si existen
      const horaInicioHtml = data.horaInicio ? `<p><strong>Hora inicio:</strong> ${data.horaInicio}</p>` : "";
      const horaFinHtml = data.horaFin ? `<p><strong>Hora fin:</strong> ${data.horaFin}</p>` : "";

      div.innerHTML = `
        <h3>${escapeHtml(data.titulo)}</h3>
        <p><strong>Asignados:</strong> ${escapeHtml((data.asignados || []).join(", "))}</p>
        <p><strong>Comentario inicial:</strong> ${escapeHtml(data.comentario || "")}</p>
        <p><strong>Estado:</strong> ${escapeHtml(data.estado)}</p>
        ${data.fecha ? `<p><strong>Fecha límite:</strong> ${escapeHtml(data.fecha)} ${vencida && data.estado !== "finalizado" ? "⚠️ Vencida" : ""}</p>` : ""}
        ${horaInicioHtml}
        ${horaFinHtml}
        ${data.comentarios?.map(c => `<p>🗨️ ${escapeHtml(c.usuario)}: ${escapeHtml(c.texto)}</p>`).join("")}
        ${(esAsignado || currentUser === adminId) ? `
          ${data.estado === "pendiente" && esAsignado ? `<button onclick="cambiarEstado('${id}', 'iniciado')">Iniciar</button>` : ""}
          ${data.estado !== "finalizado" && esAsignado ? `<button onclick="cambiarEstado('${id}', 'finalizado')">Finalizar</button>` : ""}
          ${data.estado === "finalizado" && esAsignado ? `<button onclick="cambiarEstado('${id}', 'pendiente')">Reabrir</button>` : ""}
          <textarea id="comentario-${id}" placeholder="Agregar comentario"></textarea>
          <button onclick="agregarComentario('${id}')">Comentar</button>
        ` : ""}
        ${currentUser === adminId ? `
          <button onclick="toggleActivo('${id}', ${!data.activo})">${data.activo ? "Desactivar" : "Activar"}</button>
          <button onclick="eliminarActividad('${id}')">Eliminar</button>
        ` : ""}
      `;
      lista.appendChild(div);
    });

    if (currentUser !== adminId) mostrarProgreso(tareasEmpleado);
  }, error => {
    console.error("Error en onSnapshot mostrarTareas:", error);
    mostrarAlerta("❌ Error al cargar tareas (ver consola)");
  });
}

// --------------------
// Cambiar estado (empleado inicia/finaliza) — guarda hora automáticamente
// --------------------
function cambiarEstado(id, nuevoEstado) {
  const actualizacion = { estado: nuevoEstado };

  if (nuevoEstado === "iniciado") {
    const ahora = new Date();
    actualizacion.horaInicio = formatTime(ahora);
  } else if (nuevoEstado === "finalizado") {
    const ahora = new Date();
    actualizacion.horaFin = formatTime(ahora);
  } else if (nuevoEstado === "pendiente") {
    // reabrir: borrar horas si se desea (opcional)
    actualizacion.horaFin = null;
    actualizacion.horaInicio = null;
  }

  db.collection("actividades").doc(id).update(actualizacion)
    .then(() => mostrarAlerta(`✅ Estado actualizado a ${nuevoEstado}`))
    .catch(err => {
      console.error("Error actualizar estado:", err);
      mostrarAlerta("❌ Error al actualizar estado");
    });
}

// --------------------
// Agregar comentario
// --------------------
function agregarComentario(id) {
  const textarea = document.getElementById(`comentario-${id}`);
  if (!textarea) return mostrarAlerta("⚠️ No se encontró el campo de comentario");
  const comentario = textarea.value.trim();
  if (!comentario) return mostrarAlerta("⚠️ Ingresa un comentario");

  db.collection("actividades").doc(id).update({
    comentarios: firebase.firestore.FieldValue.arrayUnion({
      usuario: currentUser || "anon",
      texto: comentario
    })
  }).then(() => {
    textarea.value = "";
    mostrarAlerta("🗨️ Comentario agregado");
  }).catch(err => {
    console.error("Error agregar comentario:", err);
    mostrarAlerta("❌ Error al agregar comentario");
  });
}

// --------------------
// Toggle activo y eliminar
// --------------------
function toggleActivo(id, estado) {
  db.collection("actividades").doc(id).update({ activo: estado })
    .catch(err => {
      console.error("Error toggleActivo:", err);
      mostrarAlerta("❌ Error al cambiar activo");
    });
}

function eliminarActividad(id) {
  if (!confirm("¿Eliminar esta actividad?")) return;
  db.collection("actividades").doc(id).delete()
    .catch(err => {
      console.error("Error eliminar:", err);
      mostrarAlerta("❌ Error al eliminar actividad");
    });
}

// --------------------
// Progreso (empleado y admin)
// --------------------
function mostrarProgreso(tareas) {
  const cont = document.getElementById("progresoEmpleado");
  if (!cont) return;
  const total = tareas.length;
  const fin = tareas.filter(t => t.estado === "finalizado").length;
  const pct = total > 0 ? Math.round((fin / total) * 100) : 0;
  let color = pct < 50 ? "#dc3545" : pct < 80 ? "#ffc107" : "#28a745";
  cont.classList.remove("hidden");
  cont.innerHTML = `
    <h2>Progreso: ${fin} de ${total} tareas finalizadas (${pct}%)</h2>
    <div style="background:#ddd; height:20px; border-radius:10px;">
      <div style="background:${color}; height:100%; width:${pct}%; border-radius:10px;"></div>
    </div>
  `;
}

function mostrarProgresoAdmin() {
  const desde = document.getElementById('filtroDesde')?.value;
  const hasta = document.getElementById('filtroHasta')?.value;
  const desdeFecha = desde ? new Date(desde) : null;
  const hastaFecha = hasta ? new Date(hasta) : null;
  if (hastaFecha) hastaFecha.setHours(23, 59, 59, 999);

  db.collection("actividades").onSnapshot(snapshot => {
    const progreso = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      const fechaActividad = data.fecha ? new Date(data.fecha) : null;
      if (desdeFecha && (!fechaActividad || fechaActividad < desdeFecha)) return;
      if (hastaFecha && (!fechaActividad || fechaActividad > hastaFecha)) return;

      (data.asignados || []).forEach(emp => {
        if (!progreso[emp]) progreso[emp] = { total: 0, finalizadas: 0 };
        progreso[emp].total++;
        if (data.estado === "finalizado") progreso[emp].finalizadas++;
      });
    });

    const cont = document.getElementById("progresoAdmin");
    if (!cont) return;
    cont.innerHTML = "<h2>Progreso de Empleados</h2>";
    for (const emp in progreso) {
      const total = progreso[emp].total;
      const fin = progreso[emp].finalizadas;
      const pct = total > 0 ? Math.round((fin / total) * 100) : 0;
      let color = pct < 50 ? "#dc3545" : pct < 80 ? "#ffc107" : "#28a745";

      cont.innerHTML += `
        <h3>Empleado: ${escapeHtml(emp)} - ${fin} de ${total} (${pct}%)</h3>
        <div style="background:#ddd; height:20px; border-radius:10px; margin-bottom:10px;">
          <div style="background:${color}; height:100%; width:${pct}%; border-radius:10px;"></div>
        </div>
      `;
    }
  }, err => {
    console.error("Error mostrarProgresoAdmin onSnapshot:", err);
  });
}

// --------------------
// Gráfico (real-time + respeta filtros) — usa Chart.js
// --------------------
function cargarGrafico() {
  const desde = document.getElementById('filtroDesde')?.value;
  const hasta = document.getElementById('filtroHasta')?.value;
  const desdeFecha = desde ? new Date(desde) : null;
  const hastaFecha = hasta ? new Date(hasta) : null;
  if (hastaFecha) hastaFecha.setHours(23, 59, 59, 999);

  // Listener en tiempo real
  db.collection("actividades").onSnapshot(snapshot => {
    const counts = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      const fechaActividad = data.fecha ? new Date(data.fecha) : null;
      if (desdeFecha && (!fechaActividad || fechaActividad < desdeFecha)) return;
      if (hastaFecha && (!fechaActividad || fechaActividad > hastaFecha)) return;

      if (data.estado === "finalizado") {
        (data.asignados || []).forEach(emp => {
          if (!counts[emp]) counts[emp] = 0;
          counts[emp]++;
        });
      }
    });

    const canvas = document.getElementById("graficoCumplidas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (graficoRef) graficoRef.destroy();
    graficoRef = new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(counts),
        datasets: [{
          label: "Tareas finalizadas",
          data: Object.values(counts),
          backgroundColor: Object.keys(counts).map(k => randomColorForKey(k))
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: "Tareas finalizadas por usuario (filtradas)" }
        }
      }
    });
  }, err => {
    console.error("Error cargarGrafico onSnapshot:", err);
  });
}

// --------------------
// Helpers
// --------------------
function formatTime(d) {
  // devuelve hh:mm
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

// Color consistente por clave (empleado)
const colorCache = {};
function randomColorForKey(key) {
  if (colorCache[key]) return colorCache[key];
  // Paleta predefinida para mejor control de colores
  const palette = [
    "#007bff","#28a745","#ff5722","#6f42c1","#20c997","#fd7e14","#6610f2","#e83e8c",
    "#17a2b8","#343a40"
  ];
  const idx = Math.abs(hashCode(key)) % palette.length;
  colorCache[key] = palette[idx];
  return colorCache[key];
}
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h<<5)-h) + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}

// --------------------
// Exportar funciones globales para HTML
// --------------------
window.login = login;
window.logout = logout;
window.guardarActividad = guardarActividad;
window.cambiarEstado = cambiarEstado;
window.agregarComentario = agregarComentario;
window.eliminarActividad = eliminarActividad;
window.toggleActivo = toggleActivo;
window.aplicarFiltros = aplicarFiltros;
window.forzarAgregarChip = forzarAgregarChip;
window.obtenerEmpleadosSeleccionados = obtenerEmpleadosSeleccionados;

// --------------------
// Nota: si quieres cargar la lista de empleados desde Firestore,
// reemplaza la constante `empleados` por una carga desde una colección.
// --------------------
