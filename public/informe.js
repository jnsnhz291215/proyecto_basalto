document.addEventListener('DOMContentLoaded', () => {
  const actividadesList = document.getElementById('actividades-list');
  const btnAdd = document.getElementById('btn-add-actividad');
  const btnReset = document.getElementById('btn-reset');
  const btnGuardar = document.getElementById('btn-guardar');
  const fechaInput = document.getElementById('informe-fecha');
  const turnoSelect = document.getElementById('informe-turno');
  const horasInput = document.getElementById('informe-horas');

  // Inicializar fecha por defecto a hoy
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  if (fechaInput) fechaInput.value = `${yyyy}-${mm}-${dd}`;

  btnAdd.addEventListener('click', (e) => {
    e.preventDefault();
    const row = document.createElement('div');
    row.className = 'actividad-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'actividad[]';
    input.placeholder = 'Descripción';
    input.className = 'actividad-input';
    const btnRem = document.createElement('button');
    btnRem.className = 'btn btn-secondary';
    btnRem.textContent = 'Eliminar';
    btnRem.addEventListener('click', (ev) => { ev.preventDefault(); row.remove(); });
    row.appendChild(input);
    row.appendChild(btnRem);
    actividadesList.appendChild(row);
  });

  // No se usa el botón de "Agregar fecha" en esta vista; la fecha/turno/horas se toman del formulario.

  btnReset.addEventListener('click', () => {
    document.getElementById('informe-form').reset();
    // leave one actividad row
    const rows = actividadesList.querySelectorAll('.actividad-row');
    rows.forEach((r, i) => { if (i>0) r.remove(); else r.querySelector('input').value = ''; });
  });

  btnGuardar.addEventListener('click', () => {
    alert('Formulario guardado localmente (no conectado a BD).');
  });
});
