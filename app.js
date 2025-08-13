// app.js (versión optimizada con listener único y actualización optimista)

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
let unsubscribeTareas = null; // para cancelar listener anterior

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
  const parsed = new Date(d);
  if (!isNaN(parsed)) return firebase.firestore.Timestamp.fromDate(parsed);
  return null;
}

function escapeHtml(s = "") {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

const palette = ["#007bff", "#28a745", "#ff5722", "#6f42c1", "#20c997", "#fd7e14", "#6610f2", "#e83e8c", "#17a2b8", "#343a40"];
const colorCache = {};
function colorForKey(k) {
  if (colorCache[k]) return colorCache[k];
  const idx = Math.abs(hashCode(k)) % palette.length;
  colorCache[k] = palette[idx];
  return colorCache[k];
}
function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }

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

function logout() {
  currentUser = null;
  document.getElementById("login").classList.remove("hidden");
  document.getElementById("adminPanel").classList.add("hidden");
  document.getElementById("listaTareas").classList.add("hidden");
  document.getElementById("logout").classList.add("hidden");
  document.getElementById("listaTareas").innerHTML = "";
  mostrarAlerta("Sesión cerrada");
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
    fecha: fecha ? fecha : null,
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

// ---------------- Mostrar tareas (listener único) ----------------
function mostrarTareas() {
  if (unsubscribeTareas) unsubscribeTareas(); // Cancelar listener anterior

  const buscar = (document.getElementById("buscarTexto")?.value || "").trim().toLowerCase();
  const desde = document.getElementById("filtroDesde")?.value || null;
  const hasta = document.getElementById("filtroHasta")?.value || null;
  const desdeFecha = desde ? new Date(desde + "T00:00:00") : null;
  const hastaFecha = hasta ? new Date(hasta + "T23:59:59") : null;

  let query = db.collection("actividades").orderBy("creada", "desc");
  if (currentUser && currentUser !== adminId) {
    query = db.collection("actividades").where("asignados", "array-contains", currentUser).orderBy("creada", "desc");
  }

  unsubscribeTareas = query.onSnapshot(snapshot => {
    últimoSnapshot = snapshot;
    const lista = document.getElementById("listaTareas");
    lista.innerHTML = "";
    const tareasEmpleado = [];

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

    snapshot.forEach(doc => {
      const data = doc.data();
      const id = doc.id;

      let fechaActividad = null;
      if (data.fecha) {
        fechaActividad = new Date(data.fecha + "T00:00:00");
      }

      // Filtrado por fechas
      if (desdeFecha && (!fechaActividad || fechaActividad < desdeFecha)) return;
      if (hastaFecha && (!fechaActividad || fechaActividad > hastaFecha)) return;

      // Filtro búsqueda
      if (buscar) {
        const inTitle = (data.titulo || "").toLowerCase().includes(buscar);
        const inAsignados = (data.asignados || []).some(a => a.toLowerCase().includes(buscar));
        if (!inTitle && !inAsignados) return;
      }

      const fechaLimite = fechaActividad;
      const esAsignado = (data.asignados || []).includes(currentUser);
      const visibleParaEmpleado = currentUser !== adminId && esAsignado && data.activo && (!fechaLimite || fechaLimite <= hoy);

      if (!(currentUser === adminId || visibleParaEmpleado)) return;

      if (esAsignado) tareasEmpleado.push({ ...data, id });

      // Crear div tarea
      const div = document.createElement("div");
      div.className = `tarea ${data.estado || "pendiente"}`;
      div.setAttribute("data-id", id);
      const vencida = fechaLimite && fechaLimite < hoy;
      if (vencida && data.estado !== "finalizado") div.classList.add("vencida");

      // Horas formato
      const horaInicioText = data.horaInicio ? formatoFechaCampo(data.horaInicio) : "";
      const horaFinText = data.horaFin ? formatoFechaCampo(data.horaFin) : "";

      // Botones y inputs
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

      // Controles admin
      let adminHTML = "";
      if (currentUser === adminId) {
        adminHTML = `<div class="admin-controls">
          <button onclick="toggleActivo('${id}', ${!data.activo})">${data.activo ? "Desactivar" : "Activar"}</button>
          <button onclick="eliminarActividad('${id}')">Eliminar</button>
        </div>`;
      }

      div.innerHTML = `
        <h3>${escapeHtml(data.titulo)}</h3>
        <p><strong>Asignados:</strong> ${escapeHtml((data.asignados || []).join(", "))}</p>
        <p><strong>Comentario:</strong> ${escapeHtml(data.comentario || "")}</p>
        <p><strong>Estado:</strong> ${escapeHtml(data.estado)}</p>
        ${data.fecha ? `<p><strong>Fecha límite:</strong> ${escapeHtml(data.fecha)} ${vencida ? "⚠️ Vencida" : ""}</p>` : ""}
        ${horaInicioText ? `<p><strong>Hora inicio:</strong> ${horaInicioText}</p>` : ""}
        ${horaFinText ? `<p><strong>Hora fin:</strong> ${horaFinText}</p>` : ""}
        ${(data.comentarios || []).map(c => `<p class="coment">🗨️ ${escapeHtml(c.usuario)}: ${escapeHtml(c.texto)}</p>`).join("")}
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

// ---------------- cambiarEstado con actualización optimista ----------------
function cambiarEstado(id, nuevoEstado) {
  const docRef = db.collection("actividades").doc(id);
  const updateData = { estado: nuevoEstado };

  if (nuevoEstado === "iniciado") {
    const inputVal = document.getElementById(`horaInicio-${id}`)?.value;
    updateData.horaInicio = inputVal ? firebase.firestore.Timestamp.fromDate(new Date(inputVal)) : firebase.firestore.Timestamp.fromDate(new Date());
  } else if (nuevoEstado === "finalizado") {
    const inputVal = document.getElementById(`horaFin-${id}`)?.value;
    updateData.horaFin = inputVal ? firebase.firestore.Timestamp.fromDate(new Date(inputVal)) : firebase.firestore.Timestamp.fromDate(new Date());
  } else if (nuevoEstado === "pendiente") {
    updateData.horaInicio = null;
    updateData.horaFin = null;
  }

  // Actualización optimista en UI
  actualizarEstadoUI(id, nuevoEstado, updateData.horaInicio, updateData.horaFin);

  docRef.update(updateData)
    .then(() => mostrarAlerta(`✅ Estado actualizado a ${nuevoEstado}`))
    .catch(err => {
      console.error("Error cambiarEstado:", err);
      mostrarAlerta("❌ Error al cambiar estado");
      // En caso de error, recarga tareas para sincronizar UI
      aplicarFiltros();
    });
}

function actualizarEstadoUI(id, nuevoEstado, horaInicio, horaFin) {
  const tareaDiv = document.querySelector(`div.tarea[data-id='${id}']`);
  if (!tareaDiv) return;

  tareaDiv.classList.remove("pendiente", "iniciado", "finalizado");
  tareaDiv.classList.add(nuevoEstado);

  // Actualizar texto Estado
  const estadoP = tareaDiv.querySelector("p strong:nth-of-type(2)") || tareaDiv.querySelector("p:nth-child(4)");
  if (estadoP) {
    // Busca <p><strong>Estado:</strong> texto</p> para cambiar el texto
    const estadoElem = [...tareaDiv.querySelectorAll("p")].find(p => p.innerHTML.includes("<strong>Estado:</strong>"));
    if (estadoElem) {
      estadoElem.innerHTML = `<strong>Estado:</strong> ${escapeHtml(nuevoEstado)}`;
    }
  }

  // Actualizar horas
  // Eliminar si existen anteriores
  const horaInicioP = [...tareaDiv.querySelectorAll("p")].find(p => p.innerHTML.includes("<strong>Hora inicio:</strong>"));
  if (horaInicioP) horaInicioP.remove();
  const horaFinP = [...tareaDiv.querySelectorAll("p")].find(p => p.innerHTML.includes("<strong>Hora fin:</strong>"));
  if (horaFinP) horaFinP.remove();

  if (horaInicio) {
    const horaIniStr = formatoFechaCampo(horaInicio);
    const p = document.createElement("p");
    p.innerHTML = `<strong>Hora inicio:</strong> ${escapeHtml(horaIniStr)}`;
    tareaDiv.insertBefore(p, tareaDiv.querySelector(".acciones"));
  }
  if (horaFin) {
    const horaFinStr = formatoFechaCampo(horaFin);
    const p = document.createElement("p");
    p.innerHTML = `<strong>Hora fin:</strong> ${escapeHtml(horaFinStr)}`;
    tareaDiv.insertBefore(p, tareaDiv.querySelector(".acciones"));
  }

  // Actualizar botones según nuevo estado (remplazar innerHTML de .acciones)
  let accionesHTML = "";
  if (nuevoEstado === "pendiente") {
    accionesHTML += `<div class="inline-field"><label>Hora inicio (opcional)</label><input type="datetime-local" id="horaInicio-${id}" /></div>`;
    accionesHTML += `<button onclick="cambiarEstado('${id}','iniciado')">Iniciar</button>`;
  }
  if (nuevoEstado === "iniciado") {
    accionesHTML += `<div class="inline-field"><label>Hora fin (opcional)</label><input type="datetime-local" id="horaFin-${id}" /></div>`;
    accionesHTML += `<button onclick="cambiarEstado('${id}','finalizado')">Finalizar</button>`;
  }
  if (nuevoEstado === "finalizado") {
    accionesHTML += `<button onclick="cambiarEstado('${id}','pendiente')">Reabrir</button>`;
  }
  accionesHTML += `<textarea id="comentario-${id}" placeholder="Agregar comentario"></textarea>`;
  accionesHTML += `<button class="small" onclick="agregarComentario('${id}')">Comentar</button>`;

  const accionesDiv = tareaDiv.querySelector(".acciones");
  if (accionesDiv) accionesDiv.innerHTML = accionesHTML;
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
function toggleActivo(id, estado) {
  db.collection("actividades").doc(id).update({ activo: estado })
    .then(() => mostrarAlerta(estado ? "✅ Activada" : "✅ Desactivada"))
    .catch(err => { console.error(err); mostrarAlerta("❌ Error"); });
}

function eliminarActividad(id) {
  if (!confirm("¿Eliminar actividad?")) return;
  db.collection("actividades").doc(id).delete()
    .then(() => mostrarAlerta("✅ Eliminada"))
    .catch(err => { console.error(err); mostrarAlerta("❌ Error al eliminar"); });
}



// ---------------- Progreso ----------------
function mostrarProgreso(tareas) {
const progreso = document.getElementById("progreso");
if (!progreso) return;
const total = tareas.length;
if (total === 0) {
progreso.innerHTML = "No hay tareas asignadas";
return;
}
const finalizadas = tareas.filter(t => t.estado === "finalizado").length;
const porcentaje = Math.round((finalizadas / total) * 100);
progreso.innerHTML = Tareas completadas: ${finalizadas} / ${total} (${porcentaje}%);
}

function mostrarProgresoAdmin() {
// Puedes implementar resumen para admin si quieres
}

// ---------------- Gráfico ----------------
function cargarGrafico() {
// Implementa gráfico aquí, si quieres
}

// ---------------- Inicio ----------------
document.getElementById("loginBtn").onclick = login;
document.getElementById("logoutBtn").onclick = logout;
document.getElementById("guardarBtn").onclick = guardarActividad;
document.getElementById("buscarBtn").onclick = aplicarFiltros;
document.getElementById("resetBtn").onclick = resetFiltros;

// Si quieres que muestre tareas automáticamente si ya está logueado
// currentUser = adminId; aplicarFiltros();
