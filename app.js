// Configuración Firebase 
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
const adminId = "0001";
let currentUser = null;
let graficoRef = null;
let últimoSnapshot = null; // para export

function login() {
  const id = document.getElementById("employeeId").value.trim();
  if (!id) return mostrarAlerta("⚠️ Ingresa tu número de empleado");
  currentUser = id;
  document.getElementById("login").classList.add("hidden");
  document.getElementById("listaTareas").classList.remove("hidden");
  document.getElementById("logout").classList.remove("hidden");
  if (currentUser === adminId) {
    document.getElementById("adminPanel").classList.remove("hidden");
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
  document.getElementById("progresoEmpleado").classList.add("hidden");
  document.getElementById("progresoAdmin").innerHTML = "";
}

function guardarActividad() {
  const titulo = document.getElementById("titulo").value.trim();
  const comentario = document.getElementById("comentario").value.trim();
  const asignadoRaw = document.getElementById("asignado").value.trim();
  const fecha = document.getElementById("fecha").value;
  const activo = document.getElementById("activo").value === "true";

  if (!titulo || !asignadoRaw) {
    mostrarAlerta("⚠️ Título y asignado son obligatorios");
    return;
  }

  const asignados = asignadoRaw.split(",").map(s => s.trim()).filter(Boolean);

  const nuevaActividad = {
    titulo,
    comentario,
    asignados,
    fecha: fecha || null,
    estado: "pendiente",
    activo,
    horaInicio: null,
    horaFin: null,
    comentarios: [],
    creada: new Date()
  };

  db.collection("actividades").add(nuevaActividad).then(() => {
    document.getElementById("titulo").value = "";
    document.getElementById("comentario").value = "";
    document.getElementById("asignado").value = "";
    document.getElementById("fecha").value = "";
    document.getElementById("activo").value = "false";
    mostrarAlerta("✅ Actividad guardada correctamente");
    aplicarFiltros();
  });
}

function aplicarFiltros() {
  mostrarTareas();
  cargarGrafico();
  if (currentUser === adminId) mostrarProgresoAdmin();
}

function mostrarTareas() {
  const desde = document.getElementById('filtroDesde')?.value;
  const hasta = document.getElementById('filtroHasta')?.value;
  const desdeFecha = desde ? new Date(desde) : null;
  const hastaFecha = hasta ? new Date(hasta) : null;
  if (hastaFecha) hastaFecha.setHours(23,59,59,999);

  db.collection("actividades").orderBy("creada", "desc").onSnapshot(snapshot => {
    const lista = document.getElementById("listaTareas");
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

      if (esAsignado) tareasEmpleado.push(data);

      const div = document.createElement("div");
      const vencida = fechaLimite && fechaLimite < hoy;
      div.className = `tarea ${data.estado}`;
      if (vencida && data.estado !== "finalizado") {
        div.classList.add("vencida");
      }

      div.innerHTML = `
        <h3>${data.titulo}</h3>
        <p><strong>Asignados:</strong> ${data.asignados.join(", ")}</p>
        <p><strong>Comentario inicial:</strong> ${data.comentario}</p>
        <p><strong>Estado:</strong> ${data.estado}</p>
        ${data.fecha ? `<p><strong>Fecha límite:</strong> ${data.fecha} ${vencida && data.estado !== "finalizado" ? "⚠️ Vencida" : ""}</p>` : ""}
        ${data.horaInicio ? `<p><strong>Hora inicio:</strong> ${new Date(data.horaInicio.toDate ? data.horaInicio.toDate() : data.horaInicio).toLocaleString()}</p>` : ""}
        ${data.horaFin ? `<p><strong>Hora fin:</strong> ${new Date(data.horaFin.toDate ? data.horaFin.toDate() : data.horaFin).toLocaleString()}</p>` : ""}
        ${data.comentarios.map(c => `<p>🗨️ ${c.usuario}: ${c.texto}</p>`).join("")}
        ${(esAsignado || currentUser === adminId) ? `
          ${data.estado === "pendiente" && esAsignado ? `
            <input type="datetime-local" id="horaInicio-${id}" />
            <button onclick="cambiarEstado('${id}', 'iniciado')">Iniciar</button>
          ` : ""}
          ${data.estado !== "finalizado" && esAsignado ? `
            <input type="datetime-local" id="horaFin-${id}" />
            <button onclick="cambiarEstado('${id}', 'finalizado')">Finalizar</button>
          ` : ""}
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
  });
}

function cambiarEstado(id, nuevoEstado) {
  let updateData = { estado: nuevoEstado };

  if (nuevoEstado === "iniciado") {
    let horaInput = document.getElementById(`horaInicio-${id}`)?.value;
    updateData.horaInicio = horaInput ? new Date(horaInput) : new Date();
  } 
  else if (nuevoEstado === "finalizado") {
    let horaInput = document.getElementById(`horaFin-${id}`)?.value;
    updateData.horaFin = horaInput ? new Date(horaInput) : new Date();
  } 
  else if (nuevoEstado === "pendiente") {
    updateData.horaInicio = null;
    updateData.horaFin = null;
  }

  db.collection("actividades").doc(id).update(updateData).then(() => {
    mostrarAlerta(`✅ Estado cambiado a ${nuevoEstado}`);
  });
}

function agregarComentario(id) {
  const comentario = document.getElementById(`comentario-${id}`).value.trim();
  if (!comentario) return mostrarAlerta("⚠️ Ingresa un comentario");
  db.collection("actividades").doc(id).update({
    comentarios: firebase.firestore.FieldValue.arrayUnion({
      usuario: currentUser,
      texto: comentario
    })
  }).then(() => {
    document.getElementById(`comentario-${id}`).value = "";
    mostrarAlerta("🗨️ Comentario agregado");
  });
}

function toggleActivo(id, estado) {
  db.collection("actividades").doc(id).update({ activo: estado });
}

function eliminarActividad(id) {
  if (confirm("¿Eliminar esta actividad?")) {
    db.collection("actividades").doc(id).delete();
  }
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
