
function pedirNumeroEmpleado() {
  const numero = prompt("Ingrese su número de empleado:");

  if (!numero) return;

  localStorage.setItem("empleadoId", numero);
  window.location.reload();
}

function obtenerRolEmpleado(id) {
  if (id === "0001") return "admin";
  return "empleado";
}

const empleadoId = localStorage.getItem("empleadoId");
const rol = obtenerRolEmpleado(empleadoId);

if (!empleadoId) {
  pedirNumeroEmpleado();
} else {
  iniciarFormulario(rol);
}
