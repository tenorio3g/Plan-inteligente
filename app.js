if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}

document.getElementById('actividad-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const responsable = document.getElementById('responsable').value;
  const actividad = document.getElementById('actividad').value;
  const comentarios = document.getElementById('comentarios').value;
  const foto = document.getElementById('foto').files[0];

  const item = { responsable, actividad, comentarios, timestamp: new Date().toISOString() };
  const reader = new FileReader();
  reader.onloadend = () => {
    item.foto = reader.result;
    saveToLocal(item);
    mostrarHistorial();
  };
  if (foto) {
    reader.readAsDataURL(foto);
  } else {
    saveToLocal(item);
    mostrarHistorial();
  }
});

function saveToLocal(item) {
  let data = JSON.parse(localStorage.getItem('actividades')) || [];
  data.push(item);
  localStorage.setItem('actividades', JSON.stringify(data));
}

function mostrarHistorial() {
  const historial = document.getElementById('historial');
  historial.innerHTML = '';
  const data = JSON.parse(localStorage.getItem('actividades')) || [];
  data.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${item.responsable}</strong> - ${item.actividad}<br>${item.comentarios}<br>${item.timestamp}`;
    if (item.foto) {
      const img = document.createElement('img');
      img.src = item.foto;
      img.style.width = '100px';
      li.appendChild(img);
    }
    historial.appendChild(li);
  });
}

window.addEventListener('load', mostrarHistorial);