
function exportarCSV() {
  const desde = document.getElementById('filtroDesde')?.value;
  const hasta = document.getElementById('filtroHasta')?.value;
  const desdeFecha = desde ? new Date(desde) : null;
  const hastaFecha = hasta ? new Date(hasta) : null;
  if (hastaFecha) hastaFecha.setHours(23, 59, 59, 999);

  db.collection("actividades").get().then(snapshot => {
    const filas = [
      ["Título", "Asignados", "Fecha", "Estado", "Comentario inicial", "Comentarios"]
    ];

    snapshot.forEach(doc => {
      const data = doc.data();
      const fechaActividad = data.fecha ? new Date(data.fecha) : null;
      if (desdeFecha && (!fechaActividad || fechaActividad < desdeFecha)) return;
      if (hastaFecha && (!fechaActividad || fechaActividad > hastaFecha)) return;

      const comentarios = (data.comentarios || []).map(c => `${c.usuario}: ${c.texto}`).join(" | ");
      filas.push([
        data.titulo,
        data.asignados?.join(", "),
        data.fecha || "",
        data.estado,
        data.comentario || "",
        comentarios
      ]);
    });

    let csv = filas.map(f => f.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tareas_filtradas.csv";
    a.click();
    URL.revokeObjectURL(url);
  });
}
