
// Inicializar Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyDPWYVBgVpkBhJdMvlhPV3JzCJHF-za7Us",
  authDomain: "tareas-inteligentes.firebaseapp.com",
  projectId: "tareas-inteligentes",
  storageBucket: "tareas-inteligentes.firebasestorage.app",
  messagingSenderId: "1016472192983",
  appId: "1:1016472192983:web:369bbf0942a95e5ccbad92",
  measurementId: "G-QM9K6W0C4Q"
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window.login = async function () {
  const id = document.getElementById('employeeId').value;
  if (!id) return alert("Ingresa tu número de empleado");

  const docRef = doc(db, "usuarios", id);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    alert("Bienvenido " + docSnap.data().nombre);
  } else {
    alert("Empleado no registrado");
  }
}
