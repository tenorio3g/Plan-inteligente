
function iniciarFormulario(rol) {
  const contenedor = document.getElementById("formulario-container");
  contenedor.innerHTML = "";

  if (rol === "admin") {
    contenedor.innerHTML = \`
      <h2>Administrador</h2>
      <form id="actividadForm">
        <label>Descripción:</label>
        <input type="text" id="descripcion" required>

        <label>Asignar a (empleado ID):</label>
        <input type="text" id="asignado">

        <label>Comentario:</label>
        <textarea id="comentario"></textarea>

        <label>Foto:</label>
        <input type="file" id="foto" accept="image/*">

        <button type="submit">Guardar actividad</button>
      </form>
      <div id="historial"></div>
    \`;
  } else {
    contenedor.innerHTML = \`
      <h2>Empleado \${empleadoId}</h2>
      <div id="actividadesEmpleado"></div>
    \`;

    mostrarActividadesAsignadas(empleadoId);
  }
}
