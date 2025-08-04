// Configuración de Firebase (debes reemplazar con tu propio config)
const firebaseConfig = {
  apiKey: "AIzaSyDPWYVBgVpkBhJdMvlhPV3JzCJHF-za7Us",
  authDomain: "tareas-inteligentes.firebaseapp.com",
  projectId: "tareas-inteligentes",
  storageBucket: "tareas-inteligentes.appspot.com",
  messagingSenderId: "1016472192983",
  appId: "1:1016472192983:web:369bbf0942a95e5ccbad92"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let usuarioActual = "";

function login() {
  const id = document.getElementById("employeeId").value.trim();
  if (!id) {
    alert("Ingrese un número válido");
    return;
  }

  usuarioActual = id;
  document.getElementById("login").classList.add("hidden");

  if (id === "0001") {
    document.getElementById("adminPanel").classList.remove("hidden");
    mostrarGrafico();
  }

  cargarTareas();
}
