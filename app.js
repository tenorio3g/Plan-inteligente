const firebaseConfig = {
  apiKey: "AIzaSyDPWYVBgVpkBhJdMvlhPV3JzCJHF-za7Us",
  authDomain: "tareas-inteligentes.firebaseapp.com",
  projectId: "tareas-inteligentes",
  storageBucket: "tareas-inteligentes.appspot.com",
  messagingSenderId: "1016472192983",
  appId: "1:1016472192983:web:369bbf0942a95e5ccbad92",
  measurementId: "G-QM9K6W0C4Q"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let usuarioActual = null;

function login() {
  const id = document.getElementById("employeeId").value.trim();
  if (!id) return alert("Ingrese un ID válido");
  usuarioActual = id;
  document.getElementById("loginModal").style.display = "none";

  if (id === "0001") {
    document.getElementById("adminPanel").classList.remove("hidden");
  }
  document.getElementById("tareasAsignadas").classList.remove("hidden");
  escucharCambios();
}

function guardarActividad() {
  const titulo = document.getElementById("titulo").value;
  const comentario = document.getElementById("comentario").value;
  const asignado = document.getElementById("asignado").value;
  const fotoInput = document.getElementById("foto");

  const nueva = {
    titulo,
    comentario,
    asignado,
    estado: "pendiente",
    comentarios: [],
    timestamp: new Date()
  };

  if (fotoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      nueva.foto = e.target.result;
      db.collection("actividades").add(nueva);
    };
    reader.readAsDataURL(fotoInput.files[0]);
  } else {
    nueva.foto = "";
    db.collection("actividades").add(nueva);
  }
}

function escucharCambios() {
  db.collection("actividades").orderBy("timestamp", "desc").onSnapshot(snapshot => {
    const contenedor = document.getElementById("listaTareas");
    contenedor.innerHTML = "";
    snapshot.forEach(doc => {
      const act = doc.data();
      const id = doc.id;
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <strong>${act.titulo}</strong><br>
        <em>Asignado a: ${act.asignado}</em><br>
        Estado: ${act.estado}<br>
        ${act.comentario}<br>
        ${act.foto ? `<img src="${act.foto}">` : ""}
        <div><strong>Comentarios:</strong><br>${
          act.comentarios.map(c => `<p><em>${c.usuario}:</em> ${c.texto}</p>`).join("")
        }</div>
      `;

      if (usuarioActual === act.asignado || usuarioActual === "0001") {
        const btnIniciar = document.createElement("button");
        btnIniciar.textContent = act.estado === "pendiente" ? "Iniciar" : "Finalizar";
        btnIniciar.onclick = () => {
          db.collection("actividades").doc(id).update({
            estado: act.estado === "pendiente" ? "en progreso" : "finalizado"
          });
        };
        card.appendChild(btnIniciar);

        const inputComentario = document.createElement("input");
        inputComentario.placeholder = "Escribe un comentario";
        card.appendChild(inputComentario);

        const btnComentar = document.createElement("button");
        btnComentar.textContent = "Agregar comentario";
        btnComentar.onclick = () => {
          const nuevo = {
            usuario: usuarioActual,
            texto: inputComentario.value,
            fecha: new Date()
          };
          db.collection("actividades").doc(id).update({
            comentarios: firebase.firestore.FieldValue.arrayUnion(nuevo)
          });
        };
        card.appendChild(btnComentar);
      }
      contenedor.appendChild(card);
    });
  });
}