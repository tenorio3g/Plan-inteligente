// Firebase Config (reemplazar con los datos de tu proyecto)
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_ID",
  appId: "TU_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}

let empleadoID = localStorage.getItem("empleadoID");
if (empleadoID) {
  mostrarApp(empleadoID);
}

function iniciarSesion() {
  const id = document.getElementById("empleado").value;
  if (id) {
    localStorage.setItem("empleadoID", id);
    mostrarApp(id);
  }
}

function mostrarApp(id) {
  document.getElementById("login-section").style.display = "none";
  document.getElementById("app-section").style.display = "block";
  document.getElementById("bienvenida").textContent = `Empleado: ${id}`;
  mostrarHistorial();
}

document.getElementById('actividad-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const actividad = document.getElementById('actividad').value;
  const comentarios = document.getElementById('comentarios').value;
  const foto = document.getElementById('foto').files[0];
  const empleadoID = localStorage.getItem("empleadoID");

  const item = {
    actividad,
    comentarios,
    empleado: empleadoID,
    timestamp: new Date().toISOString()
  };

  const reader = new FileReader();
  reader.onloadend = () => {
    item.foto = reader.result;
    guardar(item);
  };
  if (foto) {
    reader.readAsDataURL(foto);
  } else {
    guardar(item);
  }
});

function guardar(item) {
  db.collection("actividades").add(item)
    .then(() => mostrarHistorial())
    .catch(err => console.error("Error guardando:", err));
}

function mostrarHistorial() {
  const historial = document.getElementById('historial');
  historial.innerHTML = '';
  const empleadoID = localStorage.getItem("empleadoID");

  db.collection("actividades")
    .where("empleado", "==", empleadoID)
    .orderBy("timestamp", "desc")
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        const item = doc.data();
        const li = document.createElement('li');
        li.innerHTML = `<strong>${item.actividad}</strong><br>${item.comentarios}<br>${item.timestamp}`;
        if (item.foto) {
          const img = document.createElement('img');
          img.src = item.foto;
          img.style.width = '100px';
          li.appendChild(img);
        }
        historial.appendChild(li);
      });
    });
}