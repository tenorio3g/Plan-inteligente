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

function login() {
  const id = document.getElementById("employeeId").value.trim();
  if (!id) return alert("Ingresa tu número de empleado");
  currentUser = id;
  document.getElementById("login").classList.add("hidden");
  document.getElementById("listaTareas").classList.remove("hidden");
  if (currentUser === adminId) {
    document.getElementById("adminPanel").classList.remove("hidden");
    cargarGrafico();
    mostrarProgresoAdmin();
  }
  mostrarTareas();
}

function logout() {
  currentUser = null;
  document.getElementById("login").classList.remove("hidden");
  document.getElementById("adminPanel").classList.add("hidden");
  document.getElementById("listaTareas").classList.add("hidden");
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

  if (!titulo || !asignadoRaw) return alert("Campos obligatorios");

  const asignados = asignadoRaw.split(",").map(s => s.trim()).filter(Boolean);

  const nuevaActividad = {
    titulo,
    comentario,
    asignados,
    fecha: fecha || null,
    estado: "pendiente",
    activo,
    comentarios: [],
    creada: new Date()
  };

  db.collection("actividades").add(nuevaActividad).then(() => {
    document.getElementById("titulo").value = "";
    document.getElementById("comentario").value = "";
    document.getElementById("asignado").value = "";
    document.getElementById("fecha").value = "";
    document.getElementById("activo").value = "false";
    mostrarTareas();
    cargarGrafico();
  });
}

function mostrarTareas() {
  db.collection("actividades").orderBy("creada", "desc").onSnapshot(snapshot => {
    const lista = document.getElementById("listaTareas");
    lista.innerHTML = "";
    const tareasEmpleado = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const id = doc.id;
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
      div.className = "tarea";
      div.innerHTML = `
        <h3>${data.titulo}</h3>
        <p><strong>Asignados:</strong> ${data.asignados.join(", ")}</p>
        <p><strong>Comentario inicial:</strong> ${data.comentario}</p>
        <p><strong>Estado:</strong> ${data.estado}</p>
        ${data.fecha ? `<p><strong>Fecha límite:</strong> ${data.fecha} ${vencida && data.estado !== "finalizado" ? "⚠️ Vencida" : ""}</p>` : ""}
        ${data.comentarios.map(c => `<p>🗨️ ${c.usuario}: ${c.texto}</p>`).join("")}
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
  });
}

function cambiarEstado(id, nuevoEstado) {
  db.collection("actividades").doc(id).update({ estado: nuevoEstado });
}

function agregarComentario(id) {
  const comentario = document.getElementById(`comentario-${id}`).value.trim();
  if (!comentario) return;
  db.collection("actividades").doc(id).update({
    comentarios: firebase.firestore.FieldValue.arrayUnion({
      usuario: currentUser,
      texto: comentario
    })
  }).then(() => {
    document.getElementById(`comentario-${id}`).value = "";
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

function mostrarProgreso(tareas) {
  const cont = document.getElementById("progresoEmpleado");
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
  db.collection("actividades").onSnapshot(snapshot => {
    const progreso = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      data.asignados?.forEach(emp => {
        if (!progreso[emp]) progreso[emp] = { total: 0, finalizadas: 0 };
        progreso[emp].total++;
        if (data.estado === "finalizado") progreso[emp].finalizadas++;
      });
    });
    const cont = document.getElementById("progresoAdmin");
    cont.innerHTML = "<h2>Progreso de Empleados</h2>";
    for (const emp in progreso) {
      const total = progreso[emp].total;
      const fin = progreso[emp].finalizadas;
      const pct = total > 0 ? Math.round((fin / total) * 100) : 0;
      let color = pct < 50 ? "#dc3545" : pct < 80 ? "#ffc107" : "#28a745";
      cont.innerHTML += `
        <h3>Empleado: ${emp} - ${fin} de ${total} (${pct}%)</h3>
        <div style="background:#ddd; height:20px; border-radius:10px; margin-bottom:10px;">
          <div style="background:${color}; height:100%; width:${pct}%; border-radius:10px;"></div>
        </div>
      `;
    }
  });
}

function cargarGrafico() {
  db.collection("actividades").get().then(snapshot => {
    const counts = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.estado === "finalizado") {
        data.asignados?.forEach(emp => {
          if (!counts[emp]) counts[emp] = 0;
          counts[emp]++;
        });
      }
    });
    const ctx = document.getElementById("graficoCumplidas").getContext("2d");
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(counts),
        datasets: [{
          label: "Tareas cumplidas",
          data: Object.values(counts),
          backgroundColor: "rgba(75,192,192,0.6)"
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: "Tareas finalizadas por usuario" }
        }
      }
    });
  });
}

window.login = login;
window.logout = logout;
window.guardarActividad = guardarActividad;
window.cambiarEstado = cambiarEstado;
window.agregarComentario = agregarComentario;
window.eliminarActividad = eliminarActividad;
window.toggleActivo = toggleActivo;
