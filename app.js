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


// === CONFIGURACIÓN FIREBASE ===
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT_ID.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROJECT_ID.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// === VARIABLES GLOBALES ===
let actividadesGlobal = [];
let usuarioActual = null;
let modoActual = null; // 'admin' o 'empleado'

// === LOGIN ===
function login() {
  const id = document.getElementById("employeeId").value.trim();
  if (!id) return alert("Ingresa tu número de empleado");

  usuarioActual = id;
  modoActual = id === "0001" ? "admin" : "empleado";

  document.getElementById("login").classList.add("hidden");
  document.getElementById("logout").classList.remove("hidden");

  if (modoActual === "admin") {
    document.getElementById("adminPanel").classList.remove("hidden");
  } else {
    document.getElementById("progresoEmpleado").classList.remove("hidden");
  }

  escucharActividades();
}

// === LOGOUT ===
function logout() {
  usuarioActual = null;
  modoActual = null;
  actividadesGlobal = [];
  document.getElementById("login").classList.remove("hidden");
  document.getElementById("logout").classList.add("hidden");
  document.getElementById("adminPanel").classList.add("hidden");
  document.getElementById("progresoEmpleado").classList.add("hidden");
  document.getElementById("listaTareas").innerHTML = "";
}

// === GUARDAR ACTIVIDAD (SOLO ADMIN) ===
function guardarActividad() {
  const titulo = document.getElementById("titulo").value.trim();
  const comentario = document.getElementById("comentario").value.trim();
  const asignado = document.getElementById("asignado").value.trim();
  const fecha = document.getElementById("fecha").value;

  if (!titulo || !asignado) {
    return alert("Título y asignado son obligatorios");
  }

  db.collection("actividades").add({
    titulo,
    comentario,
    asignado,
    fecha,
    completada: false,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    document.getElementById("titulo").value = "";
    document.getElementById("comentario").value = "";
    document.getElementById("asignado").value = "";
    document.getElementById("fecha").value = "";
  });
}

// === ESCUCHAR CAMBIOS EN TIEMPO REAL ===
function escucharActividades() {
  db.collection("actividades").orderBy("timestamp", "desc").onSnapshot(snapshot => {
    actividadesGlobal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderizarLista();
  });
}

// === RENDERIZAR LISTA ===
function renderizarLista() {
  const contenedor = document.getElementById("listaTareas");
  contenedor.innerHTML = "";

  let actividadesFiltradas = [];

  if (modoActual === "admin") {
    actividadesFiltradas = actividadesGlobal;
  } else {
    actividadesFiltradas = actividadesGlobal.filter(act =>
      act.asignado.split(",").map(a => a.trim()).includes(usuarioActual)
    );
  }

  if (actividadesFiltradas.length === 0) {
    contenedor.innerHTML = "<p>No hay actividades</p>";
    return;
  }

  actividadesFiltradas.forEach(act => {
    const div = document.createElement("div");
    div.classList.add("tarea");
    div.innerHTML = `
      <h4>${act.titulo}</h4>
      <p>${act.comentario || ""}</p>
      <small>Asignado: ${act.asignado}</small><br>
      <small>Fecha: ${act.fecha || "No definida"}</small>
    `;
    contenedor.appendChild(div);
  });
}
