// app.js (versión optimizada con exportar PDF)

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
  document.getElementById("login").classList.add("hidden");
  document.getElementById("logout").classList.remove("hidden");
  document.getElementById("listaTareas").classList.remove("hidden");
  if (currentUser === adminId) {
    document.getElementById("adminPanel").classList.remove("hidden");
  } else {
    document.getElementById("adminPanel").classList.add("hidden");
  }
  aplicarFiltros();
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
  cargarGrafico();
  if (currentUser === adminId) mostrarProgresoAdmin();
}

function resetFiltros() {
  document.getElementById("filtroDesde").value = "";
  document.getElementById("filtroHasta").value = "";
  document.getElementById("buscarTexto").value = "";
  aplicarFiltros();
}

// ---------------- Mostrar tareas (más eficiente) ----------------
function mostrarTareas() {
  const buscar = (document.getElementById("buscarTexto")?.value || "").trim().toLowerCase();
  const desde = document.getElementById("filtroDesde")?.value || null;
  const hasta = document.getElementById("filtroHasta")?.value || null;
  const desdeFecha = desde ? new Date(desde + "T00:00:00") : null;
  const hastaFecha = hasta ? new Date(hasta + "T23:59:59") : null;

  // Si es empleado, podemos usar array-contains para reducir datos
  let query = db.collection("actividades").orderBy("creada", "desc");
  if (currentUser && currentUser !== adminId) {
    query = db.collection("actividades").where("asignados", "array-contains", currentUser).orderBy("creada", "desc");
  }

  query.onSnapshot(snapshot => {
    últimoSnapshot = snapshot; // para export
    const lista = document.getElementById("listaTareas");
    lista.innerHTML = "";
    const tareasEmpleado = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const id = doc.id;

      // safe fecha (string or timestamp)
      let fechaActividad = null;
      if (data.fecha) {
        // data.fecha stored as "YYYY-MM-DD" string in this design
        fechaActividad = new Date(data.fecha + "T00:00:00");
      }

      // Aplica filtros de fecha si existen
      if (desdeFecha && (!fechaActividad || fechaActividad < desdeFecha)) return;
      if (hastaFecha && (!fechaActividad || fechaActividad > hastaFecha)) return;

      // Aplica búsqueda por texto (título o asignado)
      if (buscar) {
        const inTitle = (data.titulo || "").toLowerCase().includes(buscar);
        const inAsignados = (data.asignados || []).some(a => a.toLowerCase().includes(buscar));
        if (!inTitle && !inAsignados) return;
      }

      const hoy = new Date(); hoy.setHours(0,0,0,0);
      const fechaLimite = fechaActividad;
      const esAsignado = (data.asignados || []).includes(currentUser);
      const visibleParaEmpleado = currentUser !== adminId && esAsignado && data.activo && (!fechaLimite || fechaLimite <= hoy);

      if (!(currentUser === adminId || visibleParaEmpleado)) return;

      if (esAsignado) tareasEmpleado.push({ ...data, id });

      // Build DOM
      const div = document.createElement("div");
      div.className = `tarea ${data.estado || "pendiente"}`;
      const vencida = fechaLimite && fechaLimite < hoy;
      if (vencida && data.estado !== "finalizado") div.classList.add("vencida");

      // Mostrar horas (timestamp o Date)
      const horaInicioText = data.horaInicio ? formatoFechaCampo(data.horaInicio) : "";
      const horaFinText = data.horaFin ? formatoFechaCampo(data.horaFin) : "";

      // Build buttons + inputs conditionally
      let accionesHTML = "";
      if (esAsignado || currentUser === adminId) {
        // show inputs for manual times when appropriate
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

      // Admin controls
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
        ${ (data.comentarios||[]).map(c => `<p class="coment">🗨️ ${escapeHtml(c.usuario)}: ${escapeHtml(c.texto)}</p>`).join("")}
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
    updateData.horaInicio = inputVal ? firebase.firestore.Timestamp.fromDate(new Date(inputVal)) : firebase.firestore.Timestamp.fromDate(new Date());
  } else if (nuevoEstado === "finalizado") {
    const inputVal = document.getElementById(`horaFin-${id}`)?.value;
    updateData.horaFin = inputVal ? firebase.firestore.Timestamp.fromDate(new Date(inputVal)) : firebase.firestore.Timestamp.fromDate(new Date());
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
function cargarGrafico() {
  const desde = document.getElementById('filtroDesde')?.value;
  const hasta = document.getElementById('filtroHasta')?.value;
  const desdeFecha = desde ? new Date(desde + "T00:00:00") : null;
  const hastaFecha = hasta ? new Date(hasta + "T23:59:59") : null;

  db.collection("actividades").onSnapshot(snapshot => {
    const counts = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      // date filter
      const fechaActividad = data.fecha ? new Date(data.fecha + "T00:00:00") : null;
      if (desdeFecha && (!fechaActividad || fechaActividad < desdeFecha)) return;
      if (hastaFecha && (!fechaActividad || fechaActividad > hastaFecha)) return;

      if (data.estado === "finalizado") {
        (data.asignados||[]).forEach(emp => {
          counts[emp] = (counts[emp] || 0) + 1;
        });
      }
    });

    const labels = Object.keys(counts);
    const values = labels.map(l => counts[l]);

    const canvas = document.getElementById("graficoCumplidas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (graficoRef) graficoRef.destroy();
    graficoRef = new Chart(ctx, {
      type: "bar",
      data: { labels, datasets: [{ label: "Tareas finalizadas", data: values, backgroundColor: labels.map(l=>colorForKey(l)) }] },
      options: { responsive:true, plugins:{legend:{display:false}} }
    });
  });
}

// ---------------- Export CSV / PDF ----------------
function exportarCSV() {
  if (!últimoSnapshot) return mostrarAlerta("⚠️ No hay datos para exportar aún");
  const rows = [["id","titulo","asignados","estado","fecha","horaInicio","horaFin","comentarios"]];
  últimoSnapshot.forEach(doc => {
    const d = doc.data();
    rows.push([
      doc.id,
      d.titulo || "",
      (d.asignados||[]).join("|"),
      d.estado || "",
      d.fecha || "",
      d.horaInicio ? formatoFechaCampo(d.horaInicio) : "",
      d.horaFin ? formatoFechaCampo(d.horaFin) : "",
      (d.comentarios||[]).map(c=>`${c.usuario}:${c.texto}`).join(" | ")
    ]);
  });
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `actividades_export_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  mostrarAlerta("✅ CSV generado");
}

async function exportarPDF() {
  if (!últimoSnapshot) return mostrarAlerta("⚠️ No hay datos para exportar aún");
  // Usamos jsPDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(12);
  let y = 12;
  doc.text("Export Actividades - TENORIO3G", 10, y); y+=8;
  últimoSnapshot.forEach(docSnap => {
    const d = docSnap.data();
    const line = `${d.titulo || ""} | ${ (d.asignados||[]).join(", ") } | ${d.estado || ""} | ${d.fecha || ""}`;
    if (y > 270) { doc.addPage(); y = 12; }
    doc.text(line, 10, y); y += 6;
  });
  doc.save(`actividades_${Date.now()}.pdf`);
  mostrarAlerta("✅ PDF generado");
}

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
