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
let tareasMap = new Map(); // Para tener referencias a los divs de cada tarea

function mostrarTareas() {
  const desde = document.getElementById('filtroDesde')?.value;
  const hasta = document.getElementById('filtroHasta')?.value;
  const desdeFecha = desde ? new Date(desde) : null;
  const hastaFecha = hasta ? new Date(hasta) : null;
  if (hastaFecha) hastaFecha.setHours(23,59,59,999);

  if (unsubscribeTareas) unsubscribeTareas();

  unsubscribeTareas = db.collection("actividades").orderBy("creada", "desc")
    .onSnapshot(snapshot => {
      const lista = document.getElementById("listaTareas");

      snapshot.docChanges().forEach(change => {
        const doc = change.doc;
        const id = doc.id;
        const data = doc.data();

        // Filtrado por fechas
        const fechaActividad = data.fecha ? new Date(data.fecha) : null;
        if (desdeFecha && (!fechaActividad || fechaActividad < desdeFecha)) return;
        if (hastaFecha && (!fechaActividad || fechaActividad > hastaFecha)) return;

        // Procesar según tipo de cambio
        if (change.type === "added" || change.type === "modified") {
          // Crear o actualizar div
          let div = tareasMap.get(id);
          if (!div) {
            div = document.createElement("div");
            tareasMap.set(id, div);
            lista.appendChild(div);
          }

          // Actualizar contenido del div
          div.className = `tarea ${data.estado}`;
          const hoy = new Date(); hoy.setHours(0,0,0,0);
          const fechaLimite = fechaActividad;
          const vencida = fechaLimite && fechaLimite < hoy;

          if (vencida && data.estado !== "finalizado") div.classList.add("vencida");

          const esAsignado = data.asignados?.includes(currentUser);
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

          // Si fue modificado, puedes también manejar animaciones o resaltar aquí.

        } else if (change.type === "removed") {
          // Remover div si existe
          let div = tareasMap.get(id);
          if (div) {
            div.remove();
            tareasMap.delete(id);
          }
        }
      });

      // Opcional: actualizar progreso si es necesario aquí
      // ...
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
