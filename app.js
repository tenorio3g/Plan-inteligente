
const firebaseConfig = {
  apiKey: "AIzaSyDPWYVBgVpkBhJdMvlhPV3JzCJHF-za7Us",
  authDomain: "tareas-inteligentes.firebaseapp.com",
  projectId: "tareas-inteligentes",
  storageBucket: "tareas-inteligentes.firebasestorage.app",
  messagingSenderId: "1016472192983",
  appId: "1:1016472192983:web:369bbf0942a95e5ccbad92",
  measurementId: "G-QM9K6W0C4Q"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let usuario = null;
let tareasRef = db.collection("actividades");

function login() {
  usuario = document.getElementById("employeeId").value.trim();
  if (!usuario) return alert("ID inválido");

  document.getElementById("login").classList.add("hidden");
  if (usuario === "0001") {
    document.getElementById("adminPanel").classList.remove("hidden");
    graficar();
  }
  mostrarTareas();
}

function guardarActividad() {
  const titulo = document.getElementById("titulo").value;
  const comentario = document.getElementById("comentario").value;
  const asignado = document.getElementById("asignado").value;
  if (!titulo || !comentario || !asignado) return alert("Faltan datos");
  tareasRef.add({ titulo, comentario, asignado, estado: "pendiente", comentarios: [] });
  document.getElementById("titulo").value = "";
  document.getElementById("comentario").value = "";
  document.getElementById("asignado").value = "";
}

function mostrarTareas() {
  tareasRef.onSnapshot(snapshot => {
    const cont = document.getElementById("listaTareas");
    cont.innerHTML = "";
    snapshot.forEach(doc => {
      const tarea = doc.data();
      const div = document.createElement("div");
      div.className = "tarea";
      div.innerHTML = \`
        <strong>\${tarea.titulo}</strong><br>
        Asignado a: \${tarea.asignado}<br>
        <em>\${tarea.comentario}</em><br>
        Estado: <span class="estado">\${tarea.estado}</span><br>
        \${usuario === "0001" ? 
          '<button onclick="editarTarea(\'' + doc.id + '\')">Editar</button><button onclick="eliminarTarea(\'' + doc.id + '\')">Eliminar</button>' :
          tarea.asignado === usuario && tarea.estado !== "finalizado" ? '<button onclick="cambiarEstado(\'' + doc.id + '\', \'iniciado\')">Iniciar</button><button onclick="cambiarEstado(\'' + doc.id + '\', \'finalizado\')">Finalizar</button>' : ''
        }
        \${tarea.comentarios && tarea.comentarios.length > 0 ? '<br><strong>Comentarios:</strong><ul>' + tarea.comentarios.map(c => '<li>' + c + '</li>').join('') + '</ul>' : ''}
        \${usuario !== "0001" && tarea.asignado === usuario && tarea.estado !== "finalizado" ? '<input placeholder="Comentario" onkeydown="if(event.key==\'Enter\'){ agregarComentario(\'' + doc.id + '\', this.value); this.value=\'\'}">' : ''}
      \`;
      cont.appendChild(div);
    });
  });
}

function editarTarea(id) {
  const nuevoTitulo = prompt("Nuevo título:");
  if (nuevoTitulo) tareasRef.doc(id).update({ titulo: nuevoTitulo });
}

function eliminarTarea(id) {
  if (confirm("¿Eliminar tarea?")) tareasRef.doc(id).delete();
}

function cambiarEstado(id, estado) {
  tareasRef.doc(id).update({ estado });
}

function agregarComentario(id, comentario) {
  tareasRef.doc(id).update({
    comentarios: firebase.firestore.FieldValue.arrayUnion(usuario + ": " + comentario)
  });
}

function graficar() {
  tareasRef.get().then(snapshot => {
    const data = {};
    snapshot.forEach(doc => {
      const tarea = doc.data();
      if (tarea.estado === "finalizado") {
        data[tarea.asignado] = (data[tarea.asignado] || 0) + 1;
      }
    });
    const ctx = document.createElement("canvas");
    document.getElementById("graficoCumplidas").appendChild(ctx);
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(data),
        datasets: [{ label: "Tareas cumplidas", data: Object.values(data), backgroundColor: "green" }]
      }
    });
  });
}
