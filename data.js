function guardarActividadLocal(actividad) {
  const actividades = JSON.parse(localStorage.getItem("actividades")) || [];
  actividades.push(actividad);
  localStorage.setItem("actividades", JSON.stringify(actividades));
}

function mostrarActividadesAsignadas(idEmpleado) {
  const actividades = JSON.parse(localStorage.getItem("actividades")) || [];
  const contenedor = document.getElementById("actividadesEmpleado");

  const asignadas = actividades.filter(act => act.asignado === idEmpleado);
  contenedor.innerHTML = asignadas.length
    ? asignadas.map(a => `
      <div>
        <strong>${a.descripcion}</strong><br>
        Comentario: ${a.comentario}<br>
        <img src="${a.foto}" width="100">
      </div>
    `).join('')
    : '<p>No hay actividades asignadas.</p>';
}