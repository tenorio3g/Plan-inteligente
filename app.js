// Configuración de Firebase
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = null;
let isAdmin = false;
let chart = null;

function login() {
  const id = document.getElementById('employeeId').value.trim();
  if (!id) return alert('Ingresa un número de empleado');
  currentUser = id;
  isAdmin = id === '0001';
  document.getElementById('login').classList.add('hidden');
  document.getElementById('logoutPanel').classList.remove('hidden');
  if (isAdmin) {
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('graficoCumplidas').classList.remove('hidden');
    cargarGrafico();
  }
  cargarTareas();
}

function logout() {
  currentUser = null;
  isAdmin = false;
  document.getElementById('login').classList.remove('hidden');
  document.getElementById('logoutPanel').classList.add('hidden');
  document.getElementById('adminPanel').classList.add('hidden');
  document.getElementById('graficoCumplidas').classList.add('hidden');
  document.getElementById('listaTareas').innerHTML = '';
}

function guardarActividad() {
  const titulo = document.getElementById('titulo').value;
  const comentario = document.getElementById('comentario').value;
  const asignado = document.getElementById('asignado').value;
  const fecha = document.getElementById('fechaActividad').value;
  if (!titulo || !asignado || !fecha) return alert('Faltan campos');
  db.collection("actividades").add({
    titulo,
    comentario,
    asignado,
    finalizado: false,
    fecha
  }).then(() => {
    document.getElementById('titulo').value = '';
    document.getElementById('comentario').value = '';
    document.getElementById('asignado').value = '';
    document.getElementById('fechaActividad').value = '';
    cargarTareas();
    if (isAdmin) cargarGrafico();
  });
}

function cargarTareas() {
  db.collection("actividades").onSnapshot(snapshot => {
    const lista = document.getElementById("listaTareas");
    lista.innerHTML = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      const fechaHoy = new Date().toISOString().slice(0,10);
      if (isAdmin || data.asignado === currentUser) {
        const div = document.createElement("div");
        div.className = "task";
        div.innerHTML = \`
          <b>\${data.titulo}</b> (\${data.fecha})<br/>
          \${data.comentario}<br/>
          Asignado a: \${data.asignado}<br/>
          <input type="checkbox" \${data.finalizado ? 'checked' : ''} onchange="toggleFinalizado('\${doc.id}', this.checked)">
        \`;
        lista.appendChild(div);
      }
    });
  });
}

function toggleFinalizado(id, estado) {
  db.collection("actividades").doc(id).update({ finalizado: estado });
  if (isAdmin) cargarGrafico();
}

function cargarGrafico() {
  const hoy = new Date().toISOString().slice(0,10);
  db.collection("actividades").get().then(snapshot => {
    const datos = {};
    snapshot.forEach(doc => {
      const { asignado, finalizado, fecha } = doc.data();
      if (fecha === hoy) {
        if (!datos[asignado]) datos[asignado] = { total: 0, hechas: 0 };
        datos[asignado].total++;
        if (finalizado) datos[asignado].hechas++;
      }
    });
    const labels = Object.keys(datos);
    const valores = labels.map(id => {
      const { hechas, total } = datos[id];
      return total ? Math.round((hechas / total) * 100) : 0;
    });
    const ctx = document.getElementById("graficoCumplidas").getContext("2d");
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          label: "% Cumplimiento",
          data: valores,
          backgroundColor: labels.map(() => `hsl(\${Math.random()*360},70%,70%)`)
        }]
      }
    });
  });
}