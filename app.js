
// ---------------- Firebase config ----------------
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

// ---------------- Globals ----------------
const adminId = "0001";
let currentUser = null;
let graficoRef = null;
let últimoSnapshot = null; // para export

// ---------------- Helpers ----------------
function mostrarAlerta(text, ms = 3500) {
  let cont = document.getElementById("alerta-container");
  if (!cont) {
    cont = document.createElement("div");
    cont.id = "alerta-container";
    document.body.appendChild(cont);
  }
  const el = document.createElement("div");
  el.className = "alerta";
  el.innerHTML = text;
  cont.appendChild(el);
  setTimeout(() => {
    el.style.opacity = 0;
    setTimeout(() => el.remove(), 300);
  }, ms);
}

function formatoFechaCampo(f) {
  if (!f) return "";
  const d = (f.seconds ? f.toDate() : new Date(f));
  return d.toLocaleString();
}

function toTimestampOrNull(d) {
  if (!d) return null;
  if (d instanceof Date) return firebase.firestore.Timestamp.fromDate(d);
  // if it's ISO string
  const parsed = new Date(d);
  if (!isNaN(parsed)) return firebase.firestore.Timestamp.fromDate(parsed);
  return null;
}

// ---------------- Login / Logout ----------------
function login() {
  const id = document.getElementById("employeeId").value.trim();
  if (!id) return mostrarAlerta("⚠️ Ingresa tu número de empleado");

  currentUser = id;

  // Ocultar login
  document.getElementById("login").classList.add("hidden");

  // Mostrar logout
  document.getElementById("logout").classList.remove("hidden");

  // Si es admin, mostrar panel completo
  if (currentUser === adminId) {
    document.getElementById("adminPanel").classList.remove("hidden");
    document.getElementById("listaTareas").classList.remove("hidden");
    aplicarFiltros(); // Carga tareas, gráfico y progreso
  } 
  // Si es empleado, solo sus tareas y progreso personal
  else {
    document.getElementById("listaTareas").classList.remove("hidden");
    aplicarFiltros(); // Solo mostrará las tareas asignadas a él
  }
}


// ---------------- Guardar actividad (admin) ----------------
function guardarActividad() {
  const titulo = document.getElementById("titulo").value.trim();
  const comentario = document.getElementById("comentario").value.trim();
  const asignadoRaw = document.getElementById("asignado").value.trim();
  const fecha = document.getElementById("fecha").value;
  const activo = document.getElementById("activo").value === "true";

  if (!titulo || !asignadoRaw) return mostrarAlerta("⚠️ Título y asignado son obligatorios");

  const asignados = asignadoRaw.split(",").map(s => s.trim()).filter(Boolean);

  const nueva = {
    titulo,
    comentario,
    asignados,
    fecha: fecha ? fecha : null, // almacenamos como string YYYY-MM-DD (compatible)
    estado: "pendiente",
    activo,
    horaInicio: null,
    horaFin: null,
    comentarios: [],
    creada: firebase.firestore.Timestamp.fromDate(new Date())
  };

  db.collection("actividades").add(nueva)
    .then(() => {
      document.getElementById("titulo").value = "";
      document.getElementById("comentario").value = "";
      document.getElementById("asignado").value = "";
      document.getElementById("fecha").value = "";
      document.getElementById("activo").value = "false";
      mostrarAlerta("✅ Actividad guardada");
      aplicarFiltros();
    })
    .catch(err => {
      console.error("Error guardar:", err);
      mostrarAlerta("❌ Error al guardar (ver consola)");
    });
}

// ---------------- Filtros / búsqueda ----------------
function aplicarFiltros() {
  mostrarTareas();
  if (currentUser === adminId) {
    cargarGrafico();
    mostrarProgresoAdmin();
  }
}


function resetFiltros() {
  document.getElementById("filtroDesde").value = "";
  document.getElementById("filtroHasta").value = "";
  document.getElementById("buscarTexto").value = "";
  aplicarFiltros();
}


// ---------------- Mostrar tareas (más eficiente) ----------------
let unsubscribeTareas = null; // para evitar duplicar listeners

function mostrarTareas() {
  const buscar = (document.getElementById("buscarTexto")?.value || "").trim().toLowerCase();
  const desde = document.getElementById("filtroDesde")?.value || null;
  const hasta = document.getElementById("filtroHasta")?.value || null;
  const desdeFecha = desde ? new Date(desde + "T00:00:00") : null;
  const hastaFecha = hasta ? new Date(hasta + "T23:59:59") : null;

  // Si ya hay un listener previo, lo cerramos para no duplicar
  if (unsubscribeTareas) unsubscribeTareas();

  // Query base (admin: todas, empleado: solo asignadas)
  let query = db.collection("actividades").orderBy("creada", "desc");
  if (currentUser && currentUser !== adminId) {
    query = db.collection("actividades")
      .where("asignados", "array-contains", currentUser)
      .orderBy("creada", "desc");
  }

  unsubscribeTareas = query.onSnapshot(snapshot => {
    últimoSnapshot = snapshot; // para export
    const lista = document.getElementById("listaTareas");
    lista.innerHTML = "";
    const tareasEmpleado = [];
    const hoy = new Date(); hoy.setHours(0,0,0,0);

    snapshot.forEach(doc => {
      const data = doc.data();
      const id = doc.id;

      // Fecha de actividad
      let fechaActividad = null;
      if (data.fecha) fechaActividad = new Date(data.fecha + "T00:00:00");

      // Filtros
      if (desdeFecha && (!fechaActividad || fechaActividad < desdeFecha)) return;
      if (hastaFecha && (!fechaActividad || fechaActividad > hastaFecha)) return;

      if (buscar) {
        const inTitle = (data.titulo || "").toLowerCase().includes(buscar);
        const inAsignados = (data.asignados || []).some(a => a.toLowerCase().includes(buscar));
        if (!inTitle && !inAsignados) return;
      }

      // Control de visibilidad para empleados
      const esAsignado = (data.asignados || []).includes(currentUser);
      const fechaLimite = fechaActividad;
      const visibleParaEmpleado = currentUser !== adminId && esAsignado && data.activo && (!fechaLimite || fechaLimite <= hoy);

      if (!(currentUser === adminId || visibleParaEmpleado)) return;

      if (esAsignado) tareasEmpleado.push({ ...data, id });

      // Resto igual que antes...
      const div = document.createElement("div");
      div.className = `tarea ${data.estado || "pendiente"}`;
      const vencida = fechaLimite && fechaLimite < hoy;
      if (vencida && data.estado !== "finalizado") div.classList.add("vencida");

      const horaInicioText = data.horaInicio ? formatoFechaCampo(data.horaInicio) : "";
      const horaFinText = data.horaFin ? formatoFechaCampo(data.horaFin) : "";

      let accionesHTML = "";
      if (esAsignado || currentUser === adminId) {
        if (data.estado === "pendiente" && esAsignado) {
          accionesHTML += `<div class="inline-field"><label>Hora inicio (opcional)</label><input type="datetime-local" id="horaInicio-${id}" /></div>`;
          accionesHTML += `<button onclick="cambiarEstado('${id}','iniciado')">Iniciar</button>`;
        }
        if (data.estado === "iniciado" && esAsignado) {
          accionesHTML += `<div class="inline-field"><label>Hora fin (opcional)</label><input type="datetime-local" id="horaFin-${id}" /></div>`;
          accionesHTML += `<button onclick="cambiarEstado('${id}','finalizado')">Finalizar</button>`;
        }
        if (data.estado === "finalizado" && esAsignado) {
          accionesHTML += `<button onclick="cambiarEstado('${id}','pendiente')">Reabrir</button>`;
        }

        accionesHTML += `<textarea id="comentario-${id}" placeholder="Agregar comentario"></textarea>`;
        accionesHTML += `<button class="small" onclick="agregarComentario('${id}')">Comentar</button>`;
      }

      let adminHTML = "";
      if (currentUser === adminId) {
        adminHTML = `<div class="admin-controls">
          <button onclick="toggleActivo('${id}', ${!data.activo})">${data.activo ? "Desactivar" : "Activar"}</button>
          <button onclick="eliminarActividad('${id}')">Eliminar</button>
        </div>`;
      }

      div.innerHTML = `
        <h3>${escapeHtml(data.titulo)}</h3>
        <p><strong>Asignados:</strong> ${escapeHtml((data.asignados||[]).join(", "))}</p>
        <p><strong>Comentario:</strong> ${escapeHtml(data.comentario||"")}</p>
        <p><strong>Estado:</strong> ${escapeHtml(data.estado)}</p>
        ${data.fecha ? `<p><strong>Fecha límite:</strong> ${escapeHtml(data.fecha)} ${vencida ? "⚠️ Vencida" : ""}</p>` : ""}
        ${horaInicioText ? `<p><strong>Hora inicio:</strong> ${horaInicioText}</p>` : ""}
        ${horaFinText ? `<p><strong>Hora fin:</strong> ${horaFinText}</p>` : ""}
        ${(data.comentarios||[]).map(c => `<p class="coment">🗨️ ${escapeHtml(c.usuario)}: ${escapeHtml(c.texto)}</p>`).join("")}
        <div class="acciones">${accionesHTML}</div>
        ${adminHTML}
      `;
      lista.appendChild(div);
    });

    if (currentUser !== adminId) mostrarProgreso(tareasEmpleado);
  }, err => {
    console.error("mostrarTareas onSnapshot:", err);
    mostrarAlerta("❌ Error cargando tareas");
  });
}

// ---------------- cambiarEstado con inputs manuales ----------------
function cambiarEstado(id, nuevoEstado) {
  const docRef = db.collection("actividades").doc(id);
  const updateData = { estado: nuevoEstado };

  if (nuevoEstado === "iniciado") {
    const inputVal = document.getElementById(`horaInicio-${id}`)?.value;
    updateData.horaInicio = inputVal ? firebase.firestore.Timestamp.fromDate(new Date(inputVal)) : null;
  } else if (nuevoEstado === "finalizado") {
    const inputVal = document.getElementById(`horaFin-${id}`)?.value;
    updateData.horaFin = inputVal ? firebase.firestore.Timestamp.fromDate(new Date(inputVal)) : null;
  } else if (nuevoEstado === "pendiente") {
    updateData.horaInicio = null;
    updateData.horaFin = null;
  }

  docRef.update(updateData)
    .then(() => mostrarAlerta(`✅ Estado actualizado a ${nuevoEstado}`))
    .catch(err => {
      console.error("Error cambiarEstado:", err);
      mostrarAlerta("❌ Error al cambiar estado");
    });
}

// ---------------- Comentarios ----------------
function agregarComentario(id) {
  const textarea = document.getElementById(`comentario-${id}`);
  if (!textarea) return mostrarAlerta("⚠️ Campo comentario no encontrado");
  const texto = textarea.value.trim();
  if (!texto) return mostrarAlerta("⚠️ Escribe un comentario");
  db.collection("actividades").doc(id).update({
    comentarios: firebase.firestore.FieldValue.arrayUnion({
      usuario: currentUser || "anon",
      texto
    })
  }).then(() => {
    textarea.value = "";
    mostrarAlerta("🗨️ Comentario agregado");
  }).catch(err => {
    console.error("Error agregarComentario:", err);
    mostrarAlerta("❌ Error al agregar comentario");
  });
}

// ---------------- Toggle activo / eliminar ----------------

// ---------------- Progreso ----------------
function mostrarProgreso(tareas) {
  const cont = document.getElementById("progresoEmpleado");
  if (!cont) return;
  const total = tareas.length;
  const fin = tareas.filter(t => t.estado === "finalizado").length;
  const pct = total ? Math.round((fin/total)*100) : 0;
  cont.classList.remove("hidden");
  cont.innerHTML = `<h2>Progreso: ${fin} / ${total} (${pct}%)</h2>
    <div class="bar"><div style="width:${pct}%;background:${pct<50?'#dc3545':pct<80?'#ffc107':'#28a745'}"></div></div>`;
}

function mostrarProgresoAdmin() {
  const desde = document.getElementById('filtroDesde')?.value;
  const hasta = document.getElementById('filtroHasta')?.value;
  const desdeFecha = desde ? new Date(desde + "T00:00:00") : null;
  const hastaFecha = hasta ? new Date(hasta + "T23:59:59") : null;

  db.collection("actividades").onSnapshot(snapshot => {
    const progreso = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      // date filter
      let fechaActividad = data.fecha ? new Date(data.fecha + "T00:00:00") : null;
      if (desdeFecha && (!fechaActividad || fechaActividad < desdeFecha)) return;
      if (hastaFecha && (!fechaActividad || fechaActividad > hastaFecha)) return;

      (data.asignados||[]).forEach(emp => {
        progreso[emp] = progreso[emp] || { total:0, finalizadas:0 };
        progreso[emp].total++;
        if (data.estado === "finalizado") progreso[emp].finalizadas++;
      });
    });

    const cont = document.getElementById("progresoAdmin");
    if (!cont) return;
    cont.innerHTML = "<h2>Progreso por empleado</h2>";
    Object.keys(progreso).forEach(emp => {
      const p = progreso[emp];
      const pct = p.total ? Math.round((p.finalizadas/p.total)*100) : 0;
      cont.innerHTML += `<div class="emp-row"><strong>${escapeHtml(emp)}</strong> - ${p.finalizadas}/${p.total} (${pct}%)<div class="bar"><div style="width:${pct}%;background:${pct<50?'#dc3545':pct<80?'#ffc107':'#28a745'}"></div></div></div>`;
    });
  });
}

// ---------------- Gráfica ----------------

// ---------------- Export CSV / PDF ----------------


// ---------------- Utilities ----------------
function escapeHtml(s="") {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

const palette = ["#007bff","#28a745","#ff5722","#6f42c1","#20c997","#fd7e14","#6610f2","#e83e8c","#17a2b8","#343a40"];
const colorCache = {};
function colorForKey(k) {
  if (colorCache[k]) return colorCache[k];
  const idx = Math.abs(hashCode(k)) % palette.length;
  colorCache[k] = palette[idx];
  return colorCache[k];
}
function hashCode(s) { let h=0; for(let i=0;i<s.length;i++){h=(h<<5)-h + s.charCodeAt(i); h|=0;} return h; }

// ---------------- Init ----------------
window.login = login;
window.logout = logout;
window.guardarActividad = guardarActividad;
window.cambiarEstado = cambiarEstado;
window.agregarComentario = agregarComentario;
window.eliminarActividad = eliminarActividad;
window.toggleActivo = toggleActivo;
window.aplicarFiltros = aplicarFiltros;
window.resetFiltros = resetFiltros;
window.exportarCSV = exportarCSV;
window.exportarPDF = exportarPDF;

// Start listeners for graph/progress even before login (ok)
cargarGrafico();
mostrarProgresoAdmin();
