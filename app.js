let usuarioActual = "";
let graficoActual = null;

function login() {
  const id = document.getElementById("employeeId").value.trim();
  if (!id) {
    alert("Ingrese un número válido");
    return;
  }

  usuarioActual = id;
  document.getElementById("login").classList.add("hidden");
  document.getElementById("logoutPanel").classList.remove("hidden");

  if (id === "0001") {
    document.getElementById("adminPanel").classList.remove("hidden");
    mostrarGrafico();
  }

  cargarTareas();
}

function logout() {
  usuarioActual = "";
  document.getElementById("login").classList.remove("hidden");
  document.getElementById("adminPanel").classList.add("hidden");
  document.getElementById("logoutPanel").classList.add("hidden");
  document.getElementById("listaTareas").innerHTML = "";
  document.getElementById("employeeId").value = "";

  // Limpiar gráfica si está activa
  if (graficoActual) {
    graficoActual.destroy();
    graficoActual = null;
  }
}

function mostrarGrafico() {
  db.collection("actividades").get().then(snapshot => {
    const cumplidasPorUsuario = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.estado === "finalizado") {
        cumplidasPorUsuario[data.asignado] = (cumplidasPorUsuario[data.asignado] || 0) + 1;
      }
    });

    const ctx = document.getElementById("graficoCumplidas").getContext("2d");

    // Destruir gráfico anterior si existe
    if (graficoActual) {
      graficoActual.destroy();
    }

    graficoActual = new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(cumplidasPorUsuario),
        datasets: [{
          label: "Tareas finalizadas",
          data: Object.values(cumplidasPorUsuario),
          backgroundColor: "rgba(75,192,192,0.6)"
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        }
      }
    });
  });
}
