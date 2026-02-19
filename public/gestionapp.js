import { GRUPOS, COLORES } from './config.js';

// const CLAVE_GESTIONAR = 'clave1super2secreta3';

let trabajadores = [];
let gruposDisponibles = Array.isArray(GRUPOS) ? [...GRUPOS] : [];
let rutParaBorrar = null;
let rutParaOcultar = null;
let esReactivar = false;

const el = {
  modalLogin: null,
  formLogin: null,
  gruposColumnas: null,
  inputBuscar: null,
  selectFiltro: null,
  modalAgregar: null,
  modalConfirm: null,
  modalResult: null,
  resultOk: null,
  formAgregar: null,
  closeModal: null,
  cancelAdd: null,
  confirmTitle: null,
  confirmMsg: null,
  confirmCancel: null,
  confirmOk: null,
  modalOcultar: null,
  modalEliminar: null
};

function formatearRUT(val) {
  const s = (val || '').replace(/[.\-\s]/g, '').toUpperCase();
  if (s.length < 8 || s.length > 9) return null;
  return s.slice(0, -1) + '-' + s.slice(-1);
}

function formatearTelefono(val) {
  const s = (val || '').replace(/\D/g, '');
  const n = s.startsWith('56') ? s.slice(2) : s;
  if (n.length !== 9) return null;
  return '+56' + n;
}

// Normalizar a Title Case: primera letra en mayúscula por palabra
function titleCase(s) {
  return String(s || '').trim().split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
async function cargar(incluirInactivos = false) {
  try {
    const url = `/datos${incluirInactivos ? '?incluirInactivos=true' : ''}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Error al cargar');
    trabajadores = await r.json();
    if (!Array.isArray(trabajadores)) trabajadores = [];
    // Normalizar nombres/apellidos/cargo para display
    trabajadores = trabajadores.map(t => ({
      ...t,
      nombres: titleCase(t.nombres),
      apellidos: titleCase(t.apellidos),
      cargo: t.cargo ? titleCase(t.cargo) : t.cargo
    }));
  } catch (e) {
    console.error(e);
    trabajadores = [];
  }
  render();
}

function getFiltrados() {
  const buscar = (el.inputBuscar && el.inputBuscar.value || '').trim().toLowerCase();
  const grupo = (el.selectFiltro && el.selectFiltro.value || '');
  let list = trabajadores;
  if (buscar) {
    list = list.filter(t => {
      const n = ((t.nombres || '') + ' ' + (t.apellidos || '')).toLowerCase();
      const a = ((t.apellidos || '') + ' ' + (t.nombres || '')).toLowerCase();
      const r = String(t.RUT || '').toLowerCase();
      return n.includes(buscar) || a.includes(buscar) || r.includes(buscar);
    });
  }
  
  // Manejar filtro de grupo
  if (grupo === 'sin_grupo') {
    // Mostrar solo trabajadores sin grupo asignado
    list = list.filter(t => !t.grupo || t.grupo === '');
  } else if (grupo) {
    // Filtrar por grupo específico
    list = list.filter(t => t.grupo === grupo);
  }
  // Si grupo es '', no filtrar (mostrar todos)
  
  return list;
}

function render() {
  const list = getFiltrados();
  const baseGrupos = gruposDisponibles.length ? gruposDisponibles : GRUPOS;
  const porGrupo = {};
  baseGrupos.forEach(g => { porGrupo[g] = []; });
  porGrupo['sin_grupo'] = []; // Crear entrada para trabajadores sin grupo
  
  list.forEach(t => {
    if (t.grupo && porGrupo[t.grupo]) {
      porGrupo[t.grupo].push(t);
    } else if (!t.grupo || t.grupo === '') {
      // Si no tiene grupo o es vacío, agregarlo a sin_grupo
      porGrupo['sin_grupo'].push(t);
    } else {
      // Grupo no reconocido: no ocultar el trabajador
      porGrupo['sin_grupo'].push(t);
    }
  });

  const filterGrupo = (el.selectFiltro && el.selectFiltro.value) || '';
  let gruposAmostrar;
  
  if (filterGrupo === 'sin_grupo') {
    gruposAmostrar = ['sin_grupo'];
  } else if (filterGrupo === '') {
    // Mostrar todos los grupos (incluyendo sin_grupo si hay trabajadores)
    gruposAmostrar = [...baseGrupos, 'sin_grupo'];
  } else {
    // Mostrar solo el grupo seleccionado
    gruposAmostrar = [filterGrupo];
  }

  el.gruposColumnas.innerHTML = '';
  
  // Determinar si estamos en vista filtrada (grupo específico)
  const esVistaFiltrada = filterGrupo && filterGrupo !== '';
  
  gruposAmostrar.forEach((g, idx) => {
    const workers = porGrupo[g] || [];
    const col = document.createElement('div');
    
    // Estilos especiales para columna "Sin Grupo"
    if (g === 'sin_grupo') {
      col.className = 'grupo-col grupo-sin-grupo';
      col.style.setProperty('--accent', '#9ca3af'); // Gris
    } else {
      col.className = 'grupo-col grupo-' + String(g).toLowerCase();
      col.style.setProperty('--accent', COLORES[g] || '#22c55e');
    }
    
    // Aplicar clase modo-grid-expandido solo cuando hay filtro específico
    if (esVistaFiltrada) {
      col.classList.add('modo-grid-expandido');
    }

    const tit = document.createElement('div');
    tit.className = 'grupo-col-titulo';
    tit.textContent = g === 'sin_grupo' ? 'Sin Grupo / Por Asignar' : 'Grupo ' + g;
    col.appendChild(tit);

    // Contenedor interno para tarjetas (scrolleable verticalmente en modo Kanban)
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'grupo-cards-container';

    workers.forEach(t => {
      const card = document.createElement('div');
      card.className = 'trabajador-card';
      
      // Si el trabajador está inactivo, aplicar estilo gris
      if (t.activo === false) {
        card.style.opacity = '0.6';
        card.style.backgroundColor = '#f3f4f6';
        card.style.borderColor = '#d1d5db';
      }

      const body = document.createElement('div');
      body.className = 'trabajador-card-body';

      const nom = document.createElement('div');
      nom.className = 'trabajador-card-nombre';
      nom.textContent = `${t.apellidos || ''}, ${t.nombres || ''}`.replace(/^,\s*|,\s*$/g, '').trim() || '-';
      
      // Si está inactivo, agregar etiqueta
      if (t.activo === false) {
        const inactivoLabel = document.createElement('span');
        inactivoLabel.style.cssText = 'color: #9ca3af; font-size: 12px; font-weight: 500; margin-left: 8px; padding: 2px 6px; background-color: #e5e7eb; border-radius: 4px;';
        inactivoLabel.textContent = '(Oculto)';
        nom.appendChild(inactivoLabel);
      }

      const rutCargo = document.createElement('div');
      rutCargo.className = 'trabajador-card-linea';
      // Si no tiene grupo, mostrar etiqueta visual
      const grupoText = t.grupo ? `Grupo: ${t.grupo}` : '<span style="color: #ef4444; font-weight: 600;">Sin Grupo</span>';
      rutCargo.innerHTML = `RUT: ${t.RUT || '-'} | ${grupoText} | Cargo: ${t.cargo || '-'}`;

      const tel = document.createElement('div');
      tel.className = 'trabajador-card-linea';
      tel.textContent = `Tel: ${t.telefono || '-'}`;

      const resto = document.createElement('div');
      resto.className = 'trabajador-card-resto';
      resto.textContent = t.email || '';

      body.appendChild(nom);
      body.appendChild(rutCargo);
      body.appendChild(tel);
      body.appendChild(resto);

      const btnActions = document.createElement('div');
      btnActions.className = 'trabajador-card-actions';

      const btnExcepciones = document.createElement('button');
      btnExcepciones.className = 'btn btn-excepciones';
      btnExcepciones.title = 'Gestionar Desfase de Turno';
      btnExcepciones.innerHTML = '<i class="fa-solid fa-calendar-days"></i>';
      btnExcepciones.addEventListener('click', () => abrirExcepciones(t.RUT, `${t.nombres} ${t.apellidos}`));

      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn btn-editar';
      btnEdit.title = 'Editar';
      btnEdit.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
      btnEdit.addEventListener('click', () => abrirEditar(t.RUT));

      // Botón Archivar/Ocultar (Soft Delete)
      const btnOcultar = document.createElement('button');
      btnOcultar.className = 'btn btn-ocultar';
      btnOcultar.title = t.activo === false ? 'Reactivar trabajador' : 'Ocultar trabajador';
      btnOcultar.style.backgroundColor = t.activo === false ? '#f59e0b' : '#f97316';
      btnOcultar.innerHTML = t.activo === false ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
      btnOcultar.addEventListener('click', () => {
        abrirModalOcultar(t.RUT, `${t.nombres} ${t.apellidos}`, t.activo === false);
      });

      // Botón Eliminar Definitivamente (Hard Delete)
      const btnBorrar = document.createElement('button');
      btnBorrar.className = 'btn btn-borrar';
      btnBorrar.title = 'Eliminar definitivamente';
      btnBorrar.innerHTML = '<i class="fa-solid fa-trash"></i>';
      btnBorrar.addEventListener('click', () => abrirModalEliminar(t.RUT, `${t.nombres} ${t.apellidos}`));

      btnActions.appendChild(btnExcepciones);
      btnActions.appendChild(btnEdit);
      btnActions.appendChild(btnOcultar);
      btnActions.appendChild(btnBorrar);

      card.appendChild(body);
      card.appendChild(btnActions);
      cardsContainer.appendChild(card);
    });

    col.appendChild(cardsContainer);

    // si el grupo está vacío, mostrar placeholder informativo
    if (!workers || workers.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'grupo-empty';
      empty.textContent = g === 'sin_grupo' ? 'Todos tienen grupo asignado' : 'Sin trabajadores activos';
      cardsContainer.appendChild(empty);
    }

    el.gruposColumnas.appendChild(col);
  });
}

// SOFT DELETE - Ocultar/Reactivar trabajador (cambiar estado activo)
async function cambiarEstadoTrabajador(rut, reactivar = false) {
  try {
    const adminRut = localStorage.getItem('userRUT');
    const nuevoEstado = reactivar;
    
    const r = await fetch(`/api/trabajadores/${rut}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activo: nuevoEstado,
        admin_rut: adminRut
      })
    });
    
    const data = await r.json().catch(() => ({}));
    
    if (r.ok && data.success) {
      // Recargar datos
      await cargar();
      const accion = reactivar ? 'reactivado' : 'ocultado';
      showResult('Éxito', `Trabajador ${accion} correctamente`);
    } else {
      console.error('Error del servidor:', data);
      showResult('Error', data.error || `Error al cambiar estado (${r.status})`, true);
    }
  } catch (err) {
    console.error('Error en cambiarEstadoTrabajador:', err);
    showResult('Error', 'Error al cambiar estado: ' + err.message, true);
  }
}

// MODAL OCULTAR/REACTIVAR TRABAJADOR
function abrirModalOcultar(rut, nombreTrabajador, esReactivarFlag) {
  rutParaOcultar = rut;
  esReactivar = esReactivarFlag;
  
  const modal = document.getElementById('modal-ocultar');
  if (modal) {
    const titulo = document.getElementById('ocultar-titulo');
    const mensaje = document.getElementById('ocultar-mensaje');
    const icono = document.getElementById('ocultar-icon');
    const nombre = document.getElementById('ocultar-nombre-trabajador');
    const btnConfirm = document.getElementById('confirm-ocultar-texto');
    
    if (esReactivarFlag) {
      titulo.textContent = 'Reactivar Trabajador';
      icono.classList.remove('fa-eye-slash');
      icono.classList.add('fa-eye');
      mensaje.textContent = '¿Desea reactivar a este trabajador?';
      btnConfirm.textContent = 'Reactivar';
    } else {
      titulo.textContent = 'Ocultar Trabajador';
      icono.classList.remove('fa-eye');
      icono.classList.add('fa-eye-slash');
      mensaje.textContent = '¿Desea ocultar a este trabajador? No se perderá su historial.';
      btnConfirm.textContent = 'Ocultar';
    }
    
    if (nombre) nombre.textContent = nombreTrabajador;
    modal.classList.add('show');
  }
}

// MODAL ELIMINAR DEFINITIVAMENTE
function abrirModalEliminar(rut, nombreTrabajador) {
  rutParaBorrar = rut;
  
  const modal = document.getElementById('modal-eliminar');
  if (modal) {
    const nombre = document.getElementById('eliminar-nombre-trabajador');
    const passwordInput = document.getElementById('eliminar-password');
    
    if (nombre) nombre.textContent = nombreTrabajador;
    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.focus();
    }
    
    modal.classList.add('show');
  }
}

async function ejecutarBorrarDefinitivo(rut, password) {
  try {
    const adminRut = localStorage.getItem('userRUT');
    
    const r = await fetch('/eliminar-trabajador', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        rut: rut,
        admin_password: password,
        admin_rut: adminRut
      })
    });
    
    const data = await r.json().catch(() => ({}));
    
    if (r.ok && data.success) {
      trabajadores = data.trabajadores || [];
      render();
      showResult('Éxito', 'Trabajador ELIMINADO DEFINITIVAMENTE del sistema');
    } else if (r.status === 401) {
      showResult('Error', 'Contraseña incorrecta. Acción cancelada.', true);
    } else if (r.status === 404) {
      showResult('Error', data.error || 'Error: El RUT no existe', true);
    } else if (r.status === 400) {
      showResult('Error', data.error || 'Solicitud inválida', true);
    } else {
      showResult('Error', data.error || `Error al eliminar (${r.status})`, true);
    }
  } catch (err) {
    console.error('Error en ejecutarBorrarDefinitivo:', err);
    showResult('Error', 'Error al eliminar: ' + (err && err.message), true);
  }
}

// Legacy function - kept for backward compatibility, redirects to new system
function confirmarBorrar(rut) {
  // This function is deprecated, use abrirConfirmacionBorrar instead
  abrirConfirmacionBorrar(rut, 'el trabajador');
}

// Legacy function - kept for backward compatibility
async function ejecutarBorrar() {
  // This function is deprecated, no longer used
  return;
}

function abrirAgregar() {
  el.formAgregar.reset();
  el.modalAgregar.classList.add('show');
}

function cerrarAgregar() {
  el.modalAgregar.classList.remove('show');
}

function abrirEditar(rut) {
  const trabajador = trabajadores.find(t => t.RUT === rut);
  if (!trabajador) {
    alert('No se encontró el trabajador');
    return;
  }
  
  // Precarga los datos en el formulario de edición
  document.getElementById('edit-rut').value = trabajador.RUT;
  document.getElementById('edit-nombre').value = trabajador.nombres || '';
  document.getElementById('edit-apellido').value = trabajador.apellidos || '';
  document.getElementById('edit-telefono').value = trabajador.telefono || '';
  document.getElementById('edit-email').value = trabajador.email || '';
  const selectEditCargo = document.getElementById('edit-cargo');
  if (selectEditCargo) {
    const cargoNombre = (trabajador.cargo || '').trim();
    const cargoId = trabajador.id_cargo ? String(trabajador.id_cargo) : '';
    const optionMatch = Array.from(selectEditCargo.options)
      .find(opt => (cargoId && opt.value === cargoId) || opt.textContent.trim() === cargoNombre);
    selectEditCargo.value = optionMatch ? optionMatch.value : '';
  }
  const selectEditGrupo = document.getElementById('edit-grupo');
  if (selectEditGrupo) {
    const grupoId = trabajador.id_grupo ? String(trabajador.id_grupo) : '';
    selectEditGrupo.value = grupoId;
  }
  const selectEditCiudad = document.getElementById('edit-ciudad');
  if (selectEditCiudad) {
    const ciudadNombre = (trabajador.ciudad || '').trim();
    const optionMatch = Array.from(selectEditCiudad.options)
      .find(opt => opt.textContent.trim() === ciudadNombre);
    selectEditCiudad.value = optionMatch ? optionMatch.value : '';
  }
  const fechaNacimiento = trabajador.fecha_nacimiento
    ? String(trabajador.fecha_nacimiento).split('T')[0]
    : '';
  document.getElementById('edit-fecha-nacimiento').value = fechaNacimiento;

  if (el.formEditar) {
    el.formEditar.dataset.originalRut = trabajador.RUT || '';
    el.formEditar.dataset.originalNombre = trabajador.nombres || '';
    el.formEditar.dataset.originalApellido = trabajador.apellidos || '';
    el.formEditar.dataset.originalTelefono = trabajador.telefono || '';
    el.formEditar.dataset.originalEmail = trabajador.email || '';
    el.formEditar.dataset.originalCargo = trabajador.cargo || '';
    el.formEditar.dataset.originalCargoId = trabajador.id_cargo ? String(trabajador.id_cargo) : '';
    el.formEditar.dataset.originalGrupoId = trabajador.id_grupo ? String(trabajador.id_grupo) : '';
    el.formEditar.dataset.originalCiudad = trabajador.ciudad || '';
    el.formEditar.dataset.originalFechaNacimiento = fechaNacimiento || '';
  }
  
  el.modalEditar.classList.add('show');
}

function cerrarEditar() {
  el.modalEditar.classList.remove('show');
}

async function enviarAgregar(e) {
  e.preventDefault();
  const fd = new FormData(el.formAgregar);
  const nombre = (fd.get('nombre') || '').trim();
  const apellido = (fd.get('apellido') || '').trim();
  const rutRaw = (fd.get('rut') || '').trim();
  const cargoId = (fd.get('cargo') || '').trim();
  const cargoNombre = obtenerNombreCargoSeleccionado('cargo', cargoId);
  const email = (fd.get('email') || '').trim();
  const telefonoRaw = (fd.get('telefono') || '').trim();
  const idGrupoRaw = (fd.get('grupo') || '').trim();
  const ciudadId = (fd.get('ciudad') || '').trim();
  const ciudadNombre = obtenerNombreCiudadSeleccionada('ciudad', ciudadId);
  const fecha_nacimiento = (fd.get('fecha_nacimiento') || '').trim();

  if (!nombre || !apellido || !rutRaw || !email || !telefonoRaw || !idGrupoRaw) {
    alert('Complete todos los campos requeridos.');
    return;
  }

  const idGrupo = parseInt(idGrupoRaw, 10);
  if (!Number.isInteger(idGrupo)) {
    alert('Seleccione un grupo válido');
    return;
  }

  const rut = formatearRUT(rutRaw);
  const telefono = formatearTelefono(telefonoRaw);
  if (!rut) { alert('RUT inválido (8-9 dígitos).'); return; }
  if (!telefono) { alert('Teléfono inválido (9 dígitos).'); return; }

  // Validar email antes de enviar
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert('Email inválido. Debe ser: texto@texto.texto');
    return;
  }

  const obj = {
    nombres: nombre.replace(/\s+/g, ' ').trim(),
    apellidos: apellido.replace(/\s+/g, ' ').trim(),
    RUT: rut,
    email: email.toLowerCase().trim(),
    telefono,
    id_grupo: idGrupo
  };
  if (cargoNombre) obj.cargo = cargoNombre.trim();
  if (ciudadNombre) obj.ciudad = ciudadNombre.trim();
  if (fecha_nacimiento) obj.fecha_nacimiento = fecha_nacimiento;

  // Normalizar a Title Case en frontend para mostrar inmediatamente
  obj.nombres = titleCase(obj.nombres);
  obj.apellidos = titleCase(obj.apellidos);
  if (obj.cargo) obj.cargo = titleCase(obj.cargo);

  try {
    const r = await fetch('/agregar-trabajador', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj)
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.success) {
      trabajadores = data.trabajadores || [];
      render();
      cerrarAgregar();
      showResult('Éxito', data.message || 'Trabajador agregado correctamente');
    } else {
      console.error('Error del servidor:', data);
      const detalle = data.detail ? '\nDetalle: ' + data.detail : '';
      // visual error + result modal
      showAddWorkerError(data.error || `Error al agregar (${r.status})`);
      showResult('Error', (data.error || `Error al agregar (${r.status})`) + detalle, true);
    }
  } catch (err) {
    console.error('Error en enviarAgregar:', err);
    showAddWorkerError('Error al agregar: ' + (err.message || 'Error de conexión'));
    showResult('Error', 'Error al agregar: ' + err.message, true);
  }
}

async function enviarEdicion(e) {
  e.preventDefault();
  const fd = new FormData(el.formEditar);
  const original = el.formEditar ? el.formEditar.dataset : {};
  const nombre = (fd.get('nombre') || '').trim() || (original.originalNombre || '');
  const apellido = (fd.get('apellido') || '').trim() || (original.originalApellido || '');
  const rut = (fd.get('rut') || '').trim() || (original.originalRut || '');
  const cargoId = (fd.get('cargo') || '').trim();
  const cargoNombre = obtenerNombreCargoSeleccionado('edit-cargo', cargoId) || (original.originalCargo || '');
  const email = (fd.get('email') || '').trim() || (original.originalEmail || '');
  const telefonoRaw = (fd.get('telefono') || '').trim() || (original.originalTelefono || '');
  const idGrupoRaw = (fd.get('grupo') || '').trim() || (original.originalGrupoId || '');
  const ciudadId = (fd.get('ciudad') || '').trim();
  const ciudadNombre = obtenerNombreCiudadSeleccionada('edit-ciudad', ciudadId) || (original.originalCiudad || '');
  const fecha_nacimiento = (fd.get('fecha_nacimiento') || '').trim() || (original.originalFechaNacimiento || '');

  if (!nombre || !apellido || !email || !telefonoRaw || !idGrupoRaw) {
    alert('Complete todos los campos requeridos.');
    return;
  }

  const idGrupo = parseInt(idGrupoRaw, 10);
  if (!Number.isInteger(idGrupo)) {
    alert('Seleccione un grupo válido');
    return;
  }

  const telefono = formatearTelefono(telefonoRaw);
  if (!telefono) { alert('Teléfono inválido (9 dígitos).'); return; }

  // Validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert('Email inválido. Debe ser: texto@texto.texto');
    return;
  }

  const obj = {
    rut: rut,
    nombres: nombre.replace(/\s+/g, ' ').trim(),
    apellidos: apellido.replace(/\s+/g, ' ').trim(),
    email: email.toLowerCase().trim(),
    telefono,
    id_grupo: idGrupo
  };
  if (cargoNombre) obj.cargo = cargoNombre.trim();
  if (ciudadNombre) obj.ciudad = ciudadNombre.trim();
  if (fecha_nacimiento) obj.fecha_nacimiento = fecha_nacimiento;

  // Normalizar a Title Case
  obj.nombres = titleCase(obj.nombres);
  obj.apellidos = titleCase(obj.apellidos);
  if (obj.cargo) obj.cargo = titleCase(obj.cargo);

  try {
    const r = await fetch('/editar-trabajador', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj)
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.success) {
      trabajadores = data.trabajadores || [];
      render();
      cerrarEditar();
      showResult('Éxito', data.message || 'Trabajador actualizado correctamente');
    } else {
      console.error('Error del servidor:', data);
      showResult('Error', data.error || `Error al actualizar (${r.status})`, true);
    }
  } catch (err) {
    console.error('Error en enviarEdicion:', err);
    showResult('Error', 'Error al actualizar: ' + err.message, true);
  }
}

// Visual shake and highlight for agregar trabajador modal
function showAddWorkerError(msg) {
  const modalCard = document.querySelector('#modal-agregar .modal-content') || document.querySelector('#modal-agregar .modal-card');
  const form = document.getElementById('form-agregar');
  if (modalCard) modalCard.classList.add('has-error');
  // highlight inputs
  if (form) {
    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(i => i.classList.add('input-error'));
  }
  const btn = document.querySelector('#modal-agregar .btn-save') || (form && form.querySelector('button[type="submit"]'));
  if (btn) btn.classList.add('btn-error');
  // inline message
  let errEl = document.querySelector('#modal-agregar #add-error');
  if (!errEl && modalCard) {
    errEl = document.createElement('div');
    errEl.id = 'add-error';
    errEl.style.color = '#b91c1c';
    errEl.style.fontWeight = '600';
    errEl.style.marginTop = '10px';
    modalCard.appendChild(errEl);
  }
  if (errEl) { errEl.textContent = msg || 'Error'; errEl.style.display = 'block'; }

  setTimeout(() => {
    if (modalCard) modalCard.classList.remove('has-error');
    if (form) {
      const inputs = form.querySelectorAll('input, select');
      inputs.forEach(i => i.classList.remove('input-error'));
    }
    if (btn) btn.classList.remove('btn-error');
    if (errEl) errEl.style.display = 'none';
  }, 1600);
}

function showResult(title, msg, isError=false){
  const m = document.getElementById('modal-result');
  const t = document.getElementById('result-title');
  const p = document.getElementById('result-msg');
  t.textContent = title || 'Resultado';
  p.textContent = msg || '';
  if (m) m.classList.add('show');
  // optional styling for error
  if (isError) t.style.color = '#b91c1c'; else t.style.color = '';
}

/* ============================================================
   FUNCIONES DE LOGIN ANTIGUO - YA NO SE USAN
   El sistema ahora usa un login unificado con auth_guard.js
   ============================================================ */
/*
function comprobarLogin(e) {
  e.preventDefault();
  (async () => {
    const rut = String((el.formLogin.querySelector('#rut-login')||{value:''}).value||'').replace(/[^0-9kK]/g,'').toUpperCase().trim();
    const password = String((el.formLogin.querySelector('#pass-login')||{value:''}).value||'');
    if (!rut || !password) { showAdminLoginError('Ingrese RUT y password'); return; }
    try{
      const resp = await fetch('/admin-login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ rut, password }) });
      const d = await resp.json().catch(()=>({}));
      
      console.log('[GESTION] Respuesta del servidor:', d);
      
      if (resp.ok && d && d.success && d.user) {
        // persist admin session con datos completos del servidor
        console.log('[GESTION] Login exitoso, datos del usuario:', d.user);
        
        try { 
          const serverRut = d.user.rut || rut;
          // Construir nombre completo, si está vacío usar RUT formateado
          let adminFullName = ((d.user.nombres || '') + ' ' + (d.user.apellido_paterno || '') + ' ' + (d.user.apellido_materno || '')).trim();
          
          // Si no hay nombre, usar el RUT como fallback
          if (!adminFullName) {
            adminFullName = serverRut;
          }
          
          console.log('[GESTION] serverRut:', serverRut);
          console.log('[GESTION] adminFullName:', adminFullName);
          
          const usuarioActivo = { 
            rol: 'admin', 
            nombre: adminFullName,
            rut: serverRut,
            isAdmin: true
          };
          
          console.log('[GESTION] Guardando usuarioActivo:', usuarioActivo);
          localStorage.setItem('usuarioActivo', JSON.stringify(usuarioActivo)); 
          
          // También guardar datos para que datos.html los detecte
          localStorage.setItem('userRUT', serverRut);
          localStorage.setItem('userName', adminFullName);
          
          // Guardar todos los datos del admin para acceso directo (asegurar que adminData siempre se guarde correctamente)
          const adminDataToSave = {
            rut: serverRut,
            nombres: d.user.nombres || null,
            apellido_paterno: d.user.apellido_paterno || null,
            apellido_materno: d.user.apellido_materno || null,
            email: d.user.email || null,
            isAdmin: true
          };
          console.log('[GESTION] Guardando adminData:', adminDataToSave);
          localStorage.setItem('adminData', JSON.stringify(adminDataToSave));
          
          console.log('[GESTION] Todo guardado correctamente');
          console.log('[GESTION] Verificando localStorage:');
          console.log('  - usuarioActivo:', localStorage.getItem('usuarioActivo'));
          console.log('  - userRUT:', localStorage.getItem('userRUT'));
          console.log('  - userName:', localStorage.getItem('userName'));
          console.log('  - adminData:', localStorage.getItem('adminData'));
        } catch(e){
          console.error('[GESTION] Error guardando sesión admin:', e);
        }
        el.modalLogin.classList.remove('show');
        cargar();
      } else {
        showAdminLoginError(d.error || 'Credenciales inválidas');
      }
    }catch(err){
      console.error('Error en admin-login:', err);
      showAdminLoginError('Error conectando al servidor');
    }
  })();
}

// Verificar sesión en carga de gestionar
function verificarSesion() {
  try {
    const s = localStorage.getItem('usuarioActivo');
    if (!s) return false;
    const u = JSON.parse(s);
    if (u && u.rol === 'admin') {
      if (el.modalLogin) el.modalLogin.classList.remove('show');
      cargar();
      return true;
    }
  } catch (e) { }
  return false;
}

// Visual error for admin login: shake card and mark inputs/button
function showAdminLoginError(msg) {
  const loginCardEl = document.querySelector('#modal-login .login-card');
  const inputRut = document.getElementById('rut-login');
  const inputPass = document.getElementById('pass-login');
  const btn = document.querySelector('#modal-login .btn-login-primary');
  const errEl = document.querySelector('#modal-login #login-error');
  // create or show inline error element near modal if not present
  if (errEl) {
    errEl.textContent = msg || 'Error';
    errEl.style.display = 'block';
  } else {
    // append temporary error element inside login-card
    if (loginCardEl) {
      const pe = document.createElement('div');
      pe.id = 'login-error';
      pe.style.color = '#b91c1c';
      pe.style.fontWeight = '600';
      pe.style.marginTop = '10px';
      pe.textContent = msg || 'Error';
      loginCardEl.appendChild(pe);
    }
  }
  if (loginCardEl) loginCardEl.classList.add('has-error');
  if (inputRut) inputRut.classList.add('input-error');
  if (inputPass) inputPass.classList.add('input-error');
  if (btn) btn.classList.add('btn-error');
  setTimeout(() => {
    if (loginCardEl) loginCardEl.classList.remove('has-error');
    if (inputRut) inputRut.classList.remove('input-error');
    if (inputPass) inputPass.classList.remove('input-error');
    if (btn) btn.classList.remove('btn-error');
    if (errEl) errEl.style.display = 'none';
  }, 1600);
}
*/
/* ============================================================ */

// ============================================
// GESTIÓN DE CARGOS
// ============================================

async function cargarCargos() {
  try {
    const res = await fetch('/api/cargos');
    if (!res.ok) throw new Error('Error al cargar cargos');
    
    const cargos = await res.json();
    const selectCargo = document.getElementById('cargo');
    const selectEditCargo = document.getElementById('edit-cargo');
    
    const renderizarSelect = (select) => {
      if (!select) return;
      
      // Limpiar opciones anteriores (excepto la primera "Seleccione...")
      select.innerHTML = '<option value="" disabled selected>Seleccione un cargo...</option>';
      
      // Agregar cargos dinámicos
      const cargosNormalizados = cargos.map(cargo => {
        if (typeof cargo === 'string') {
          return { id_cargo: '', nombre_cargo: cargo };
        }
        return cargo;
      });

      cargosNormalizados.forEach(cargo => {
        const option = document.createElement('option');
        option.value = cargo.id_cargo ? String(cargo.id_cargo) : cargo.nombre_cargo;
        option.textContent = cargo.nombre_cargo;
        select.appendChild(option);
      });
      
      // Agregar opción para crear nuevo cargo (con estilo diferenciado)
      const optionNuevo = document.createElement('option');
      optionNuevo.value = 'nuevo_cargo';
      optionNuevo.textContent = '+ Crear nuevo cargo...';
      optionNuevo.style.color = '#8b5cf6';
      optionNuevo.style.fontWeight = '600';
      select.appendChild(optionNuevo);
    };
    
    // Renderizar en ambos selects
    renderizarSelect(selectCargo);
    renderizarSelect(selectEditCargo);

    if (selectEditCargo && el.formEditar) {
      const originalCargoId = el.formEditar.dataset.originalCargoId || '';
      const originalCargo = el.formEditar.dataset.originalCargo || '';
      const optionMatch = Array.from(selectEditCargo.options)
        .find(opt => (originalCargoId && opt.value === originalCargoId) || opt.textContent.trim() === originalCargo.trim());
      if (optionMatch) {
        selectEditCargo.value = optionMatch.value;
      }
    }
    
  } catch (error) {
    console.error('Error al cargar cargos:', error);
  }
}

// ============================================
// GESTIÓN DE GRUPOS
// ============================================

async function cargarGrupos(seleccionarValor = '') {
  try {
    const res = await fetch('/api/grupos');
    if (!res.ok) throw new Error('Error al cargar grupos');

    const grupos = await res.json();
    gruposDisponibles = grupos.map(grupo => grupo.nombre_grupo);
    const selectGrupo = document.getElementById('grupo');
    const selectEditGrupo = document.getElementById('edit-grupo');
    const selectFiltro = el.selectFiltro || document.getElementById('select-filtro');

    const renderizarSelect = (select) => {
      if (!select) return;
      select.innerHTML = '<option value="" disabled selected>Seleccione...</option>';

      grupos.forEach(grupo => {
        const option = document.createElement('option');
        option.value = String(grupo.id_grupo);
        option.textContent = grupo.nombre_grupo;
        select.appendChild(option);
      });
    };

    renderizarSelect(selectGrupo);
    renderizarSelect(selectEditGrupo);

    if (selectFiltro) {
      selectFiltro.innerHTML = '<option value="">Todos los grupos</option>';
      grupos.forEach(grupo => {
        const option = document.createElement('option');
        option.value = String(grupo.nombre_grupo);
        option.textContent = `Grupo ${grupo.nombre_grupo}`;
        selectFiltro.appendChild(option);
      });
      const optionSinGrupo = document.createElement('option');
      optionSinGrupo.value = 'sin_grupo';
      optionSinGrupo.textContent = 'Sin Grupo / Por Asignar';
      selectFiltro.appendChild(optionSinGrupo);
    }

    if (seleccionarValor) {
      const valorNormalizado = String(seleccionarValor).trim();
      if (selectGrupo) selectGrupo.value = valorNormalizado;
      if (selectEditGrupo) selectEditGrupo.value = valorNormalizado;
    } else if (selectEditGrupo && el.formEditar) {
      const originalGrupoId = el.formEditar.dataset.originalGrupoId || '';
      if (originalGrupoId) {
        selectEditGrupo.value = originalGrupoId;
      }
    }
  } catch (error) {
    console.error('Error al cargar grupos:', error);
  }
}

// ============================================
// GESTIÓN DE CIUDADES
// ============================================

async function cargarCiudades(seleccionarValor = '') {
  try {
    const res = await fetch('/api/ciudades');
    if (!res.ok) throw new Error('Error al cargar ciudades');

    const ciudades = await res.json();
    const selectCiudad = document.getElementById('ciudad');
    const selectEditCiudad = document.getElementById('edit-ciudad');

    const renderizarSelect = (select) => {
      if (!select) return;
      select.innerHTML = '<option value="" disabled selected>Seleccione una ciudad...</option>';

      ciudades.forEach(ciudad => {
        const option = document.createElement('option');
        option.value = ciudad.id_ciudad;
        option.textContent = ciudad.nombre_ciudad;
        select.appendChild(option);
      });
    };

    renderizarSelect(selectCiudad);
    renderizarSelect(selectEditCiudad);

    if (seleccionarValor) {
      const valorNormalizado = String(seleccionarValor).trim();
      const ciudadEncontrada = ciudades.find(
        ciudad => String(ciudad.id_ciudad) === valorNormalizado || ciudad.nombre_ciudad === valorNormalizado
      );

      if (ciudadEncontrada) {
        if (selectCiudad) selectCiudad.value = ciudadEncontrada.id_ciudad;
        if (selectEditCiudad) selectEditCiudad.value = ciudadEncontrada.id_ciudad;
      }
    }
  } catch (error) {
    console.error('Error al cargar ciudades:', error);
  }
}

function obtenerNombreCiudadSeleccionada(selectId, valorFallback = '') {
  const select = document.getElementById(selectId);
  if (!select) return valorFallback;

  const option = select.options[select.selectedIndex];
  if (!option || !option.value) return '';

  return option.textContent.trim();
}

function obtenerNombreCargoSeleccionado(selectId, valorFallback = '') {
  const select = document.getElementById(selectId);
  if (!select) return valorFallback;

  const option = select.options[select.selectedIndex];
  if (!option || !option.value || option.value === 'nuevo_cargo') return '';

  return option.textContent.trim();
}

async function guardarNuevaCiudad(nombreCiudad) {
  try {
    const res = await fetch('/api/ciudades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre_ciudad: nombreCiudad })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 409) {
        showResult('Error', 'Esta ciudad ya existe', true);
      } else {
        showResult('Error', data.error || 'Error al crear la ciudad', true);
      }
      return null;
    }

    await cargarCiudades(data.nombre_ciudad);
    showResult('Éxito', 'Ciudad creada exitosamente');
    return data.nombre_ciudad;
  } catch (error) {
    console.error('Error al guardar ciudad:', error);
    showResult('Error', 'Error al crear la ciudad: ' + (error.message || 'Error desconocido'), true);
    return null;
  }
}

function pedirNuevaCiudad() {
  const nombre = window.prompt('Ingrese nombre de la ciudad');
  const nombreTrim = String(nombre || '').trim();
  if (!nombreTrim) return;
  guardarNuevaCiudad(nombreTrim);
}

function mostrarResultadoCargo(titulo, mensaje) {
  const modalResult = document.getElementById('modal-result');
  const resultTitle = document.getElementById('result-title');
  const resultMsg = document.getElementById('result-msg');
  
  if (resultTitle) resultTitle.textContent = titulo;
  if (resultMsg) resultMsg.textContent = mensaje;
  if (modalResult) modalResult.classList.add('show');
}

async function guardarNuevoCargo() {
  const inputNombre = document.getElementById('nuevoNombreCargo');
  
  if (!inputNombre) {
    console.error('Error: El elemento nuevoNombreCargo no existe en el DOM');
    mostrarResultadoCargo('Error', 'No se pudo encontrar el campo de entrada');
    return;
  }
  
  const nombreCargo = inputNombre.value.trim();
  
  if (!nombreCargo) {
    mostrarResultadoCargo('Error', 'Por favor, ingrese el nombre del cargo');
    return;
  }
  
  try {
    const res = await fetch('/api/cargos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre_cargo: nombreCargo })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      if (res.status === 409) {
        mostrarResultadoCargo('Error', 'Este cargo ya existe');
      } else {
        mostrarResultadoCargo('Error', data.error || 'Error al crear el cargo');
      }
      return;
    }
    
    // Cerrar modal
    const modalNuevoCargo = document.getElementById('modal-nuevo-cargo');
    if (modalNuevoCargo) {
      modalNuevoCargo.classList.remove('show');
    }
    
    // Limpiar input
    inputNombre.value = '';
    
    // Recargar lista de cargos
    await cargarCargos();
    
    // Seleccionar automáticamente el cargo recién creado
    const selectCargo = document.getElementById('cargo');
    if (selectCargo) {
      selectCargo.value = data.id_cargo ? String(data.id_cargo) : data.nombre_cargo;
    }
    
    mostrarResultadoCargo('Éxito', 'Cargo creado exitosamente');
    
  } catch (error) {
    console.error('Error al guardar cargo:', error);
    mostrarResultadoCargo('Error', 'Error al crear el cargo: ' + (error.message || 'Error desconocido'));
  }
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Referencias a elementos del DOM
  el.gruposColumnas = document.getElementById('grupos-columnas');
  el.inputBuscar = document.getElementById('input-buscar');
  el.selectFiltro = document.getElementById('select-filtro');
  el.modalAgregar = document.getElementById('modal-agregar');
  el.modalEditar = document.getElementById('modal-editar');
  el.modalConfirm = document.getElementById('modal-confirm');
  el.modalOcultar = document.getElementById('modal-ocultar');
  el.modalEliminar = document.getElementById('modal-eliminar');
  el.formAgregar = document.getElementById('form-agregar');
  el.formEditar = document.getElementById('form-editar');
  el.cancelAdd = document.getElementById('cancel-add');
  el.cancelEdit = document.getElementById('cancel-edit');
  el.confirmTitle = document.getElementById('confirm-title');
  el.confirmMsg = document.getElementById('confirm-msg');
  el.confirmCancel = document.getElementById('confirm-cancel');
  el.confirmOk = document.getElementById('confirm-ok');
  el.modalResult = document.getElementById('modal-result');
  el.resultOk = document.getElementById('result-ok');

  // El auth_guard.js ya verificó que somos admin, cargar datos directamente
  console.log('[GESTION] Inicializando página de gestión');
  cargar();

  // Cargar cargos al iniciar
  cargarCargos();

  // Cargar ciudades al iniciar
  cargarCiudades();

  // Cargar grupos al iniciar
  cargarGrupos();

  const btnNuevaCiudad = document.getElementById('btn-nueva-ciudad');
  if (btnNuevaCiudad) btnNuevaCiudad.addEventListener('click', pedirNuevaCiudad);
  const btnNuevaCiudadEdit = document.getElementById('btn-nueva-ciudad-edit');
  if (btnNuevaCiudadEdit) btnNuevaCiudadEdit.addEventListener('click', pedirNuevaCiudad);

  const btnAgregar = document.getElementById('btn-agregar');
  if (btnAgregar) btnAgregar.addEventListener('click', abrirAgregar);
  
  const btnDescargar = document.getElementById('btn-descargar');
  if (btnDescargar) btnDescargar.addEventListener('click', descargarTrabajadoresExcel);
  
  if (el.inputBuscar) el.inputBuscar.addEventListener('input', render);
  if (el.selectFiltro) el.selectFiltro.addEventListener('change', render);
  
  // Checkbox para mostrar trabajadores ocultos (inactivos)
  const checkMostrarInactivos = document.getElementById('mostrar-inactivos');
  if (checkMostrarInactivos) {
    checkMostrarInactivos.addEventListener('change', (e) => {
      cargar(e.target.checked);
    });
  }
  
  if (el.cancelAdd) el.cancelAdd.addEventListener('click', cerrarAgregar);
  if (el.cancelEdit) el.cancelEdit.addEventListener('click', cerrarEditar);
  if (el.formAgregar) el.formAgregar.addEventListener('submit', enviarAgregar);
  if (el.formEditar) el.formEditar.addEventListener('submit', enviarEdicion);
  el.confirmCancel.addEventListener('click', () => {
    rutParaBorrar = null;
    el.modalConfirm.classList.remove('show');
  });
  el.confirmOk.addEventListener('click', ejecutarBorrar);

  // Event listeners para modal ocultar/reactivar
  const cancelOcultar = document.getElementById('cancel-ocultar');
  if (cancelOcultar) {
    cancelOcultar.addEventListener('click', () => {
      rutParaOcultar = null;
      if (el.modalOcultar) el.modalOcultar.classList.remove('show');
    });
  }

  const confirmOcultar = document.getElementById('confirm-ocultar');
  if (confirmOcultar) {
    confirmOcultar.addEventListener('click', () => {
      if (rutParaOcultar) {
        cambiarEstadoTrabajador(rutParaOcultar, esReactivar);
        if (el.modalOcultar) el.modalOcultar.classList.remove('show');
        rutParaOcultar = null;
      }
    });
  }

  // Cerrar modal ocultar al hacer click fuera
  if (el.modalOcultar) {
    el.modalOcultar.addEventListener('click', (ev) => {
      if (ev.target === el.modalOcultar) {
        rutParaOcultar = null;
        el.modalOcultar.classList.remove('show');
      }
    });
  }

  // Event listeners para modal eliminar
  const cancelEliminar = document.getElementById('cancel-eliminar');
  if (cancelEliminar) {
    cancelEliminar.addEventListener('click', () => {
      rutParaBorrar = null;
      const passwordInput = document.getElementById('eliminar-password');
      if (passwordInput) passwordInput.value = '';
      if (el.modalEliminar) el.modalEliminar.classList.remove('show');
    });
  }

  const confirmEliminar = document.getElementById('confirm-eliminar');
  if (confirmEliminar) {
    confirmEliminar.addEventListener('click', () => {
      const passwordInput = document.getElementById('eliminar-password');
      const password = passwordInput ? passwordInput.value : '';
      
      if (rutParaBorrar && password) {
        ejecutarBorrarDefinitivo(rutParaBorrar, password);
        if (el.modalEliminar) el.modalEliminar.classList.remove('show');
      } else if (!password) {
        // Mostrar error
        if (passwordInput) {
          passwordInput.classList.add('input-error');
          setTimeout(() => {
            passwordInput.classList.remove('input-error');
          }, 2000);
        }
      }
    });
  }

  // Cerrar modal eliminar al hacer click fuera
  if (el.modalEliminar) {
    el.modalEliminar.addEventListener('click', (ev) => {
      if (ev.target === el.modalEliminar) {
        rutParaBorrar = null;
        const passwordInput = document.getElementById('eliminar-password');
        if (passwordInput) passwordInput.value = '';
        el.modalEliminar.classList.remove('show');
      }
    });
  }

  if (el.resultOk) {
    el.resultOk.addEventListener('click', () => {
      if (el.modalResult) el.modalResult.classList.remove('show');
    });
  }

  // Cerrar modal-result al hacer click fuera
  if (el.modalResult) {
    el.modalResult.addEventListener('click', (ev) => {
      if (ev.target === el.modalResult) {
        el.modalResult.classList.remove('show');
      }
    });
  }

  // Cerrar modal-login al hacer click fuera (excepto en la card)
  if (el.modalLogin) {
    el.modalLogin.addEventListener('click', (ev) => {
      if (ev.target === el.modalLogin) {
        el.modalLogin.classList.remove('show');
      }
    });
  }

  // Los modales de agregar y editar NO se cierran al hacer click afuera
  // (descomentados estos listeners si se desea reactivar este comportamiento)
  // el.modalAgregar.addEventListener('click', ev => {
  //   if (ev.target === el.modalAgregar) cerrarAgregar();
  // });
  // el.modalEditar.addEventListener('click', ev => {
  //   if (ev.target === el.modalEditar) cerrarEditar();
  // });
  el.modalConfirm.addEventListener('click', ev => {
    if (ev.target === el.modalConfirm) {
      rutParaBorrar = null;
      el.modalConfirm.classList.remove('show');
    }
  });

  // RUT: dígitos y letra K (verificador)
  const rutInput = document.getElementById('rut');
  if (rutInput) {
    rutInput.addEventListener('input', ev => {
      // Permitir dígitos y la letra K (máximo 9 caracteres)
      ev.target.value = ev.target.value.replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
    });
  }
  const telInput = document.getElementById('telefono');
  if (telInput) {
    telInput.addEventListener('input', ev => {
      ev.target.value = ev.target.value.replace(/\D/g, '').slice(0, 9);
    });
  }

  const telInputEdit = document.getElementById('edit-telefono');
  if (telInputEdit) {
    telInputEdit.addEventListener('input', ev => {
      ev.target.value = ev.target.value.replace(/\D/g, '').slice(0, 9);
    });
  }

  // ============================================
  // EVENT LISTENERS: MODAL NUEVO CARGO (AGREGAR Y EDITAR)
  // ============================================
  
  // Select de cargo: abrir modal cuando se elige "nuevo_cargo"
  const selectCargo = document.getElementById('cargo');
  const selectEditCargo = document.getElementById('edit-cargo');
  
  const agregarEventoNuevoCargo = (select) => {
    if (select) {
      select.addEventListener('change', (e) => {
        if (e.target.value === 'nuevo_cargo') {
          const modalNuevoCargo = document.getElementById('modal-nuevo-cargo');
          if (modalNuevoCargo) {
            modalNuevoCargo.classList.add('show');
          }
          // Resetear el select a la primera opción
          e.target.selectedIndex = 0;
          
          // Enfocar el input
          setTimeout(() => {
            const inputNombre = document.getElementById('nuevoNombreCargo');
            if (inputNombre) inputNombre.focus();
          }, 100);
        }
      });
    }
  };
  
  agregarEventoNuevoCargo(selectCargo);
  agregarEventoNuevoCargo(selectEditCargo);
  
  // Botón cerrar modal (X)
  const closeNuevoCargo = document.getElementById('close-nuevo-cargo');
  if (closeNuevoCargo) {
    closeNuevoCargo.addEventListener('click', () => {
      const modalNuevoCargo = document.getElementById('modal-nuevo-cargo');
      if (modalNuevoCargo) {
        modalNuevoCargo.classList.remove('show');
      }
      const inputNombre = document.getElementById('nuevoNombreCargo');
      if (inputNombre) inputNombre.value = '';
    });
  }

  // Botón Cancelar
  const cancelNuevoCargo = document.getElementById('cancel-nuevo-cargo');
  if (cancelNuevoCargo) {
    cancelNuevoCargo.addEventListener('click', () => {
      const modalNuevoCargo = document.getElementById('modal-nuevo-cargo');
      if (modalNuevoCargo) {
        modalNuevoCargo.classList.remove('show');
      }
      const inputNombre = document.getElementById('nuevoNombreCargo');
      if (inputNombre) inputNombre.value = '';
    });
  }

  // Botón Guardar Cargo (CRÍTICO)
  const guardarCargoBtn = document.getElementById('guardar-nuevo-cargo');
  if (guardarCargoBtn) {
    guardarCargoBtn.addEventListener('click', () => {
      guardarNuevoCargo();
    });
  }

  // Permitir guardar con Enter en el input
  const inputNuevoCargo = document.getElementById('nuevoNombreCargo');
  if (inputNuevoCargo) {
    inputNuevoCargo.addEventListener('keypress', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        guardarNuevoCargo();
      }
    });
  }

  // Cerrar modal al hacer click fuera
  const modalNuevoCargo = document.getElementById('modal-nuevo-cargo');
  if (modalNuevoCargo) {
    modalNuevoCargo.addEventListener('click', (ev) => {
      if (ev.target === modalNuevoCargo) {
        modalNuevoCargo.classList.remove('show');
        const inputNombre = document.getElementById('nuevoNombreCargo');
        if (inputNombre) inputNombre.value = '';
      }
    });
  }

  // ============================================
  // GESTIÓN DE EXCEPCIONES DE TURNO
  // ============================================
  
  let rutExcepcionActual = null;

  // Función para abrir modal de excepciones
  function abrirExcepciones(rut, nombreCompleto) {
    rutExcepcionActual = rut;
    
    const modalExcepciones = document.getElementById('modal-excepciones');
    const nombreEl = document.getElementById('excepcion-trabajador-nombre');
    const formExcepciones = document.getElementById('form-excepciones');
    
    if (!modalExcepciones || !nombreEl || !formExcepciones) return;
    
    // Establecer nombre del trabajador
    nombreEl.textContent = nombreCompleto;
    
    // Resetear formulario
    formExcepciones.reset();
    document.getElementById('excepcion-duracion-info').style.display = 'none';
    
    // Cargar historial de excepciones
    cargarHistorialExcepciones(rut);
    
    // Mostrar modal
    modalExcepciones.classList.add('show');
  }

  // Función para calcular y mostrar duración en tiempo real
  function actualizarDuracion() {
    const fechaInicio = document.getElementById('excepcion-fecha-inicio').value;
    const fechaFin = document.getElementById('excepcion-fecha-fin').value;
    const infoDiv = document.getElementById('excepcion-duracion-info');
    const textoSpan = document.getElementById('excepcion-duracion-texto');
    const advertenciaDiv = document.getElementById('excepcion-advertencia');
    const diasTexto = document.getElementById('excepcion-dias-texto');
    
    if (!fechaInicio || !fechaFin) {
      infoDiv.style.display = 'none';
      return;
    }
    
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    
    if (fin < inicio) {
      infoDiv.style.display = 'block';
      infoDiv.style.backgroundColor = '#fee2e2';
      infoDiv.style.color = '#991b1b';
      textoSpan.textContent = 'Error: La fecha de fin no puede ser anterior a la fecha de inicio';
      advertenciaDiv.style.display = 'none';
      return;
    }
    
    // Calcular días (incluye ambos extremos)
    const diffTime = Math.abs(fin - inicio);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    // Mostrar duración
    infoDiv.style.display = 'block';
    infoDiv.style.backgroundColor = diffDays === 14 ? '#d1fae5' : '#fef3c7';
    infoDiv.style.color = diffDays === 14 ? '#065f46' : '#92400e';
    textoSpan.textContent = `Duración: ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
    
    // Mostrar advertencia si no son 14 días
    if (diffDays !== 14) {
      advertenciaDiv.style.display = 'block';
      diasTexto.textContent = diffDays;
    } else {
      advertenciaDiv.style.display = 'none';
    }
  }

  // Event listeners para fechas
  const fechaInicioInput = document.getElementById('excepcion-fecha-inicio');
  const fechaFinInput = document.getElementById('excepcion-fecha-fin');
  
  if (fechaInicioInput) {
    fechaInicioInput.addEventListener('change', actualizarDuracion);
  }
  
  if (fechaFinInput) {
    fechaFinInput.addEventListener('change', actualizarDuracion);
  }

  // Función para cargar historial de excepciones
  async function cargarHistorialExcepciones(rut) {
    const historialDiv = document.getElementById('excepcion-historial');
    if (!historialDiv) return;
    
    historialDiv.innerHTML = '<p style="color: #6b7280; font-size: 14px; text-align: center; padding: 10px;">Cargando historial...</p>';
    
    try {
      const response = await fetch(`/api/excepciones/${rut}`);
      const data = await response.json();
      
      if (response.ok && data.success && data.excepciones && data.excepciones.length > 0) {
        historialDiv.innerHTML = '';
        data.excepciones.forEach(exc => {
          const item = document.createElement('div');
          item.style.cssText = 'padding: 8px; margin-bottom: 8px; background-color: #f9fafb; border-left: 3px solid #3b82f6; border-radius: 4px; font-size: 13px;';
          
          const fechaInicio = new Date(exc.fecha_inicio).toLocaleDateString('es-CL');
          const fechaFin = new Date(exc.fecha_fin).toLocaleDateString('es-CL');
          
          item.innerHTML = `
            <div style="font-weight: 600; color: #1f2937;">${fechaInicio} → ${fechaFin} (${exc.dias_duracion} días)</div>
            ${exc.motivo ? `<div style="color: #6b7280; margin-top: 4px;">${exc.motivo}</div>` : ''}
          `;
          
          historialDiv.appendChild(item);
        });
      } else {
        historialDiv.innerHTML = '<p style="color: #6b7280; font-size: 14px; text-align: center; padding: 10px;">Sin excepciones registradas</p>';
      }
    } catch (error) {
      console.error('Error al cargar historial:', error);
      historialDiv.innerHTML = '<p style="color: #dc2626; font-size: 14px; text-align: center; padding: 10px;">Error al cargar el historial</p>';
    }
  }

  // Submit del formulario de excepciones
  const formExcepciones = document.getElementById('form-excepciones');
  if (formExcepciones) {
    formExcepciones.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const fechaInicio = document.getElementById('excepcion-fecha-inicio').value;
      const fechaFin = document.getElementById('excepcion-fecha-fin').value;
      const motivo = document.getElementById('excepcion-motivo').value.trim();
      
      if (!rutExcepcionActual || !fechaInicio || !fechaFin) {
        alert('Por favor complete todos los campos requeridos');
        return;
      }
      
      // Validar que la fecha fin no sea anterior a la fecha inicio
      if (new Date(fechaFin) < new Date(fechaInicio)) {
        alert('La fecha de fin no puede ser anterior a la fecha de inicio');
        return;
      }
      
      try {
        const response = await fetch('/api/excepciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rut: rutExcepcionActual,
            inicio: fechaInicio,
            fin: fechaFin,
            motivo: motivo || null
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          alert(`Excepción guardada correctamente (${data.dias_duracion} días)`);
          
          // Recargar historial
          cargarHistorialExcepciones(rutExcepcionActual);
          
          // Resetear formulario
          formExcepciones.reset();
          document.getElementById('excepcion-duracion-info').style.display = 'none';
        } else {
          alert(data.error || 'Error al guardar la excepción');
        }
      } catch (error) {
        console.error('Error al guardar excepción:', error);
        alert('Error al guardar la excepción: ' + error.message);
      }
    });
  }

  // Botón cancelar excepciones
  const cancelExcepciones = document.getElementById('cancel-excepciones');
  if (cancelExcepciones) {
    cancelExcepciones.addEventListener('click', () => {
      const modalExcepciones = document.getElementById('modal-excepciones');
      if (modalExcepciones) {
        modalExcepciones.classList.remove('show');
      }
      rutExcepcionActual = null;
    });
  }

  // Cerrar modal al hacer clic fuera
  const modalExcepciones = document.getElementById('modal-excepciones');
  if (modalExcepciones) {
    modalExcepciones.addEventListener('click', (ev) => {
      if (ev.target === modalExcepciones) {
        modalExcepciones.classList.remove('show');
        rutExcepcionActual = null;
      }
    });
  }

  // Exponer función globalmente para que esté disponible en render()
  window.abrirExcepciones = abrirExcepciones;

  // ============================================
  // GESTIÓN DE CONFIGURACIÓN DE CICLOS DE TURNOS
  // ============================================

  const modalConfigCiclos = document.getElementById('modal-config-ciclos');
  const btnConfigCiclos = document.getElementById('btn-config-ciclos');
  const closeConfigModal = document.getElementById('close-config-modal');
  const btnCancelarConfigModal = document.getElementById('btn-cancelar-config-modal');
  const formConfigCiclos = document.getElementById('form-config-ciclos');
  const modalPistaNombre = document.getElementById('modal-pista-nombre');
  const modalFechaSemilla = document.getElementById('modal-fecha-semilla');

  // Cargar configuración actual en el modal
  async function cargarConfigCiclos() {
    try {
      const response = await fetch('/api/config-turnos');
      const data = await response.json();

      if (response.ok && data.success && data.config) {
        // Cargar datos en el modal
        if (modalPistaNombre) modalPistaNombre.value = data.config.pista_nombre || 'Pista 1';
        if (modalFechaSemilla) modalFechaSemilla.value = data.config.fecha_semilla || '07/02/2026';
      } else {
        console.error('Error al cargar configuración:', data.error);
      }
    } catch (error) {
      console.error('Error al cargar configuración de ciclos:', error);
    }
  }

  // Abrir modal de configuración
  if (btnConfigCiclos) {
    btnConfigCiclos.addEventListener('click', () => {
      cargarConfigCiclos();
      if (modalConfigCiclos) {
        modalConfigCiclos.style.display = 'flex';
      }
    });
  }

  // Cerrar modal
  function cerrarModalConfig() {
    if (modalConfigCiclos) {
      modalConfigCiclos.style.display = 'none';
    }
  }

  if (closeConfigModal) {
    closeConfigModal.addEventListener('click', cerrarModalConfig);
  }

  if (btnCancelarConfigModal) {
    btnCancelarConfigModal.addEventListener('click', cerrarModalConfig);
  }

  // Cerrar modal al hacer clic fuera de él
  if (modalConfigCiclos) {
    modalConfigCiclos.addEventListener('click', (e) => {
      if (e.target === modalConfigCiclos) {
        cerrarModalConfig();
      }
    });
  }

  // Validar formato DD/MM/YYYY mientras el usuario escribe
  if (modalFechaSemilla) {
    modalFechaSemilla.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, ''); // Solo números
      
      if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2);
      }
      if (value.length >= 5) {
        value = value.slice(0, 5) + '/' + value.slice(5, 9);
      }
      
      e.target.value = value;
    });
  }

  // Guardar configuración
  if (formConfigCiclos) {
    formConfigCiclos.addEventListener('submit', async (e) => {
      e.preventDefault();

      const pistaNombre = modalPistaNombre ? modalPistaNombre.value.trim() : '';
      const fechaSemilla = modalFechaSemilla ? modalFechaSemilla.value.trim() : '';

      // Validación
      if (!pistaNombre || !fechaSemilla) {
        alert('Por favor complete todos los campos');
        return;
      }

      // Validar formato DD/MM/YYYY
      const fechaRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
      if (!fechaRegex.test(fechaSemilla)) {
        alert('Formato de fecha inválido. Use DD/MM/YYYY (Ej: 07/02/2026)');
        return;
      }

      // Validar que sea una fecha válida
      const [dia, mes, anio] = fechaSemilla.split('/').map(Number);
      const fecha = new Date(anio, mes - 1, dia);
      
      if (fecha.getDate() !== dia || fecha.getMonth() !== mes - 1 || fecha.getFullYear() !== anio) {
        alert('Fecha inválida. Verifique día, mes y año');
        return;
      }

      try {
        const response = await fetch('/api/config-turnos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pista_nombre: pistaNombre,
            fecha_semilla: fechaSemilla
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          alert('✅ Configuración de ciclos actualizada correctamente');
          cerrarModalConfig();
          
          // Refrescar el calendario si existe la función
          if (typeof cargarGrupos === 'function') {
            cargarGrupos();
          }
        } else {
          alert(data.error || 'Error al guardar la configuración');
        }
      } catch (error) {
        console.error('Error al guardar configuración:', error);
        alert('Error al guardar la configuración: ' + error.message);
      }
    });
  }

  // ============================================
  // DESCARGAR TRABAJADORES EN EXCEL
  // ============================================
  async function descargarTrabajadoresExcel() {
    try {
      console.log('[DESCARGA] Iniciando descarga de trabajadores en Excel...');
      
      const response = await fetch('/api/trabajadores/download');
      
      if (!response.ok) {
        throw new Error('Error al descargar el archivo');
      }
      
      // Obtener el blob
      const blob = await response.blob();
      
      // Crear URL temporal
      const url = window.URL.createObjectURL(blob);
      
      // Crear elemento <a> temporal
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Trabajadores_Basalto_Drilling.xlsx';
      
      // Insertar en el DOM, hacer click y remover
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Liberar memoria
      window.URL.revokeObjectURL(url);
      
      console.log('[DESCARGA] Archivo descargado exitosamente');
      
    } catch (error) {
      console.error('[ERROR DESCARGA] Error al descargar trabajadores:', error);
      alert('Error al descargar el archivo: ' + error.message);
    }
  }

  // cargar() se ejecuta solo tras login correcto en comprobarLogin
});
