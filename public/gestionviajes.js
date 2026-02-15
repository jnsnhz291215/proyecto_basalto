// ============================================
// GESTIÓN DE VIAJES - Sistema de Transporte
// ============================================

let trabajadores = [];
let ciudades = [];
let viajes = [];
let trabajadorSeleccionado = null;
let tramoCounter = 0;
let viajeEditando = null; // Para modo edición

// Elementos del DOM
const el = {
  viajesLista: null,
  sinViajes: null,
  modalNuevoViaje: null,
  formNuevoViaje: null,
  btnNuevoViaje: null,
  btnGuardarViaje: null,
  btnCancelViaje: null,
  inputTrabajador: null,
  datalistTrabajadores: null,
  trabajadorInfo: null,
  tramosContainer: null,
  btnAgregarTramo: null,
  modalConfirm: null,
  modalResult: null,
  filtroTipo: null,
  filtroMes: null
};

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[VIAJES] Iniciando aplicación...');
  
  // Obtener referencias a elementos del DOM
  el.viajesLista = document.getElementById('viajes-lista');
  el.sinViajes = document.getElementById('sin-viajes');
  el.modalNuevoViaje = document.getElementById('modal-nuevo-viaje');
  el.formNuevoViaje = document.getElementById('form-nuevo-viaje');
  el.btnNuevoViaje = document.getElementById('btn-nuevo-viaje');
  el.btnGuardarViaje = document.getElementById('guardar-nuevo-viaje');
  el.btnCancelViaje = document.getElementById('cancel-nuevo-viaje');
  el.inputTrabajador = document.getElementById('nuevo-viaje-trabajador');
  el.datalistTrabajadores = document.getElementById('trabajadores-datalist');
  el.trabajadorInfo = document.getElementById('trabajador-info');
  el.tramosContainer = document.getElementById('tramos-container');
  el.btnAgregarTramo = document.getElementById('btn-agregar-tramo');
  el.modalConfirm = document.getElementById('modal-confirm');
  el.modalResult = document.getElementById('modal-result');
  el.filtroTipo = document.getElementById('filtro-tipo');
  el.filtroMes = document.getElementById('filtro-mes');
  
  // Cargar datos iniciales
  await Promise.all([
    cargarTrabajadores(),
    cargarCiudades(),
    cargarViajes()
  ]);
  
  // Event listeners
  el.btnNuevoViaje.addEventListener('click', abrirModalNuevoViaje);
  el.btnCancelViaje.addEventListener('click', cerrarModalNuevoViaje);
  el.btnGuardarViaje.addEventListener('click', guardarViaje);
  el.btnAgregarTramo.addEventListener('click', agregarTramo);
  el.inputTrabajador.addEventListener('input', buscarTrabajador);
  el.inputTrabajador.addEventListener('change', seleccionarTrabajador);
  el.filtroTipo.addEventListener('change', () => cargarViajes());
  el.filtroMes.addEventListener('change', () => cargarViajes());
  
  // Cerrar modales al hacer click en el fondo
  el.modalNuevoViaje.addEventListener('click', (e) => {
    if (e.target === el.modalNuevoViaje) cerrarModalNuevoViaje();
  });
  
  document.getElementById('result-ok').addEventListener('click', () => {
    el.modalResult.classList.remove('show');
  });
  
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    el.modalConfirm.classList.remove('show');
  });
  
  console.log('[VIAJES] Aplicación lista');
});

// ============================================
// CARGAR DATOS
// ============================================
async function cargarTrabajadores() {
  try {
    const response = await fetch('/datos');
    if (!response.ok) throw new Error('Error al cargar trabajadores');
    trabajadores = await response.json();
    console.log('[VIAJES] Trabajadores cargados:', trabajadores.length);
    actualizarDatalistTrabajadores();
  } catch (error) {
    console.error('[VIAJES] Error cargando trabajadores:', error);
    mostrarError('Error al cargar la lista de trabajadores');
  }
}

async function cargarCiudades() {
  try {
    const response = await fetch('/api/ciudades');
    if (!response.ok) throw new Error('Error al cargar ciudades');
    ciudades = await response.json();
    console.log('[VIAJES] Ciudades cargadas:', ciudades.length);
  } catch (error) {
    console.error('[VIAJES] Error cargando ciudades:', error);
    mostrarError('Error al cargar la lista de ciudades');
  }
}

async function cargarViajes() {
  try {
    // Construir URL con filtros
    let url = '/api/viajes';
    const params = new URLSearchParams();
    
    if (el.filtroTipo) {
      params.append('tipo', el.filtroTipo.value);
    }
    
    if (el.filtroMes && el.filtroMes.value) {
      params.append('mes', el.filtroMes.value);
    }
    
    if (params.toString()) {
      url += '?' + params.toString();
    }
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al cargar viajes');
    viajes = await response.json();
    console.log('[VIAJES] Viajes cargados:', viajes.length);
    renderViajes();
  } catch (error) {
    console.error('[VIAJES] Error cargando viajes:', error);
    mostrarError('Error al cargar la lista de viajes');
  }
}

// ============================================
// DATALIST DE TRABAJADORES
// ============================================
function actualizarDatalistTrabajadores() {
  if (!el.datalistTrabajadores) return;
  
  el.datalistTrabajadores.innerHTML = '';
  
  trabajadores.forEach(t => {
    const option = document.createElement('option');
    option.value = `${t.RUT} - ${t.nombres} ${t.apellidos}`;
    option.dataset.rut = t.RUT;
    el.datalistTrabajadores.appendChild(option);
  });
}

function buscarTrabajador() {
  const valor = el.inputTrabajador.value.trim();
  
  if (!valor) {
    trabajadorSeleccionado = null;
    el.trabajadorInfo.classList.remove('visible');
    return;
  }
}

function seleccionarTrabajador() {
  const valor = el.inputTrabajador.value.trim();
  
  // Buscar trabajador por RUT o nombre
  const trabajador = trabajadores.find(t => {
    const rutMatch = valor.includes(t.RUT);
    const nombreMatch = valor.toLowerCase().includes(t.nombres.toLowerCase()) || 
                        valor.toLowerCase().includes(t.apellidos.toLowerCase());
    return rutMatch || nombreMatch;
  });
  
  if (trabajador) {
    trabajadorSeleccionado = trabajador;
    mostrarInfoTrabajador(trabajador);
  } else {
    trabajadorSeleccionado = null;
    el.trabajadorInfo.classList.remove('visible');
  }
}

function mostrarInfoTrabajador(trabajador) {
  document.getElementById('info-nombre').textContent = `${trabajador.nombres} ${trabajador.apellidos}`;
  document.getElementById('info-grupo').textContent = trabajador.grupo || 'Sin grupo';
  document.getElementById('info-cargo').textContent = trabajador.cargo || 'Sin cargo';
  
  el.trabajadorInfo.classList.add('visible');
}

// ============================================
// MANEJO DE TRAMOS
// ============================================
function agregarTramo() {
  tramoCounter++;
  
  const tramoDiv = document.createElement('div');
  tramoDiv.className = 'tramo-item';
  tramoDiv.dataset.tramoId = tramoCounter;
  
  tramoDiv.innerHTML = `
    <div class="tramo-header">
      <span class="tramo-numero"><i class="fa-solid fa-route"></i> Tramo ${tramoCounter}</span>
      <button type="button" class="btn-eliminar-tramo" onclick="eliminarTramo(${tramoCounter})">
        <i class="fa-solid fa-trash"></i> Eliminar
      </button>
    </div>
    
    <div class="form-grid">
      <div class="form-group">
        <label>Tipo de Transporte</label>
        <div class="select-wrapper">
          <select class="modern-input plain" required>
            <option value="" disabled selected>Seleccione...</option>
            <option value="Bus">🚌 BUS</option>
            <option value="Avión">✈️ AVIÓN</option>
            <option value="Transfer">🚐 TRANSFER</option>
            <option value="Otro">🚗 OTRO</option>
          </select>
          <i class="fa-solid fa-chevron-down select-arrow"></i>
        </div>
      </div>
      
      <div class="form-group">
        <label>Código/Número (Opcional)</label>
        <input type="text" placeholder="Ej: LA-1234" class="modern-input plain">
      </div>
      
      <div class="form-group">
        <label>Fecha</label>
        <input type="date" class="modern-input plain" required>
      </div>
      
      <div class="form-group">
        <label>Hora</label>
        <input type="time" class="modern-input plain" required>
      </div>
      
      <div class="form-group">
        <label>Origen</label>
        <div class="select-wrapper">
          <select class="modern-input plain" required>
            <option value="">Seleccionar ciudad...</option>
            ${ciudades.map(c => `<option value="${c.id_ciudad}">${c.nombre}</option>`).join('')}
          </select>
          <i class="fa-solid fa-chevron-down select-arrow"></i>
        </div>
      </div>
      
      <div class="form-group">
        <label>Destino</label>
        <div class="select-wrapper">
          <select class="modern-input plain" required>
            <option value="">Seleccionar ciudad...</option>
            ${ciudades.map(c => `<option value="${c.id_ciudad}">${c.nombre}</option>`).join('')}
          </select>
          <i class="fa-solid fa-chevron-down select-arrow"></i>
        </div>
      </div>
    </div>
  `;
  
  el.tramosContainer.appendChild(tramoDiv);
}

window.eliminarTramo = function(tramoId) {
  const tramoDiv = document.querySelector(`[data-tramo-id="${tramoId}"]`);
  if (tramoDiv) {
    tramoDiv.remove();
    
    // Renumerar tramos
    const tramos = el.tramosContainer.querySelectorAll('.tramo-item');
    tramos.forEach((tramo, index) => {
      const numero = tramo.querySelector('.tramo-numero');
      if (numero) {
        numero.innerHTML = `<i class="fa-solid fa-route"></i> Tramo ${index + 1}`;
      }
    });
  }
};

// ============================================
// MODAL NUEVO VIAJE
// ============================================
function abrirModalNuevoViaje() {
  viajeEditando = null; // Modo creación
  el.modalNuevoViaje.classList.add('show');
  el.formNuevoViaje.reset();
  trabajadorSeleccionado = null;
  el.trabajadorInfo.classList.remove('visible');
  el.tramosContainer.innerHTML = '';
  tramoCounter = 0;
  
  // Actualizar título del modal
  document.querySelector('#modal-nuevo-viaje h2').textContent = 'Nuevo Viaje';
  el.btnGuardarViaje.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Viaje';
  
  // Agregar un tramo inicial
  agregarTramo();
}

function cerrarModalNuevoViaje() {
  el.modalNuevoViaje.classList.remove('show');
  viajeEditando = null;
}

// ============================================
// GUARDAR VIAJE
// ============================================
async function guardarViaje() {
  try {
    // Validar trabajador
    if (!trabajadorSeleccionado) {
      mostrarError('Debe seleccionar un trabajador');
      return;
    }
    
    // Obtener tramos
    const tramosElements = el.tramosContainer.querySelectorAll('.tramo-item');
    
    if (tramosElements.length === 0) {
      mostrarError('Debe agregar al menos un tramo');
      return;
    }
    
    const tramos = [];
    let error = false;
    
    tramosElements.forEach((tramoEl, index) => {
      const inputs = tramoEl.querySelectorAll('input, select');
      const tipoTransporte = inputs[0].value;
      const codigoTransporte = inputs[1].value;
      const fecha = inputs[2].value;
      const hora = inputs[3].value;
      const idOrigen = inputs[4].value;
      const idDestino = inputs[5].value;
      
      if (!tipoTransporte || !fecha || !hora || !idOrigen || !idDestino) {
        mostrarError(`Tramo ${index + 1}: Complete todos los campos obligatorios`);
        error = true;
        return;
      }
      
      tramos.push({
        tipo_transporte: tipoTransporte,
        codigo_transporte: codigoTransporte,
        fecha: fecha,
        hora: hora,
        id_ciudad_origen: parseInt(idOrigen),
        id_ciudad_destino: parseInt(idDestino)
      });
    });
    
    if (error) return;
    
    // Determinar si es creación o edición
    let response, data;
    
    if (viajeEditando) {
      // EDICIÓN: PUT /api/viajes/:id
      response = await fetch(`/api/viajes/${viajeEditando.id_viaje}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rut_trabajador: trabajadorSeleccionado.RUT,
          tramos: tramos
        })
      });
    } else {
      // CREACIÓN: POST /api/viajes
      response = await fetch('/api/viajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rut_trabajador: trabajadorSeleccionado.RUT,
          tramos: tramos
        })
      });
    }
    
    data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error al guardar el viaje');
    }
    
    // Éxito
    const accion = viajeEditando ? 'actualizado' : 'creado';
    mostrarExito(`Viaje ${accion} exitosamente con ${data.total_tramos || tramos.length} tramo${(data.total_tramos || tramos.length) !== 1 ? 's' : ''}`);
    cerrarModalNuevoViaje();
    await cargarViajes();
    
  } catch (error) {
    console.error('[VIAJES] Error guardando viaje:', error);
    mostrarError(error.message || 'Error al guardar el viaje');
  }
}

// ============================================
// RENDERIZAR VIAJES
// ============================================
function renderViajes() {
  if (!el.viajesLista) return;
  
  el.viajesLista.innerHTML = '';
  
  if (viajes.length === 0) {
    el.sinViajes.style.display = 'block';
    return;
  }
  
  el.sinViajes.style.display = 'none';
  
  viajes.forEach(viaje => {
    const card = crearCardViaje(viaje);
    el.viajesLista.appendChild(card);
  });
}

function crearCardViaje(viaje) {
  const card = document.createElement('div');
  card.className = (viaje.estado === 'Cancelado' || viaje.estado === 'Finalizado') ? 'viaje-card oculto' : 'viaje-card';
  
  // Formatear fecha de creación (registro)
  const fecha = new Date(viaje.fecha_registro);
  const fechaFormateada = fecha.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Formatear fecha de salida
  let fechaSalida = '';
  if (viaje.fecha_salida) {
    const fechaSalidaObj = new Date(viaje.fecha_salida);
    fechaSalida = fechaSalidaObj.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }
  
  // Generar resumen de tramos
  const tramosHTML = viaje.tramos.map(tramo => {
    // Lógica de iconos basada en tipo de transporte
    let icon = 'fa-bus'; // Por defecto Bus
    if (tramo.tipo_transporte === 'Avión') {
      icon = 'fa-plane';
    } else if (tramo.tipo_transporte === 'Transfer') {
      icon = 'fa-van-shuttle';
    } else if (tramo.tipo_transporte === 'Otro') {
      icon = 'fa-car';
    }
    
    const codigo = tramo.codigo_transporte ? ` (${tramo.codigo_transporte})` : '';
    const fechaTramo = new Date(tramo.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
    
    return `
      <div class="tramo-line">
        <i class="fa-solid ${icon} tramo-icon"></i>
        <span><strong>${tramo.tipo_transporte}${codigo}:</strong> ${tramo.origen} → ${tramo.destino} | ${fechaTramo} ${tramo.hora}</span>
      </div>
    `;
  }).join('');
  
  const estadoBadge = (viaje.estado === 'Cancelado' || viaje.estado === 'Finalizado') ? 
    `<span style="background:#f3f4f6;color:#6b7280;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;"><i class="fa-solid fa-${viaje.estado === 'Cancelado' ? 'ban' : 'check-circle'}"></i> ${viaje.estado}</span>` : 
    `<span style="background:#dbeafe;color:#1e40af;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;"><i class="fa-solid fa-clock"></i> ${viaje.estado}</span>`;
  
  card.innerHTML = `
    <div class="viaje-header" style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
      <div>
        <div class="viaje-trabajador" style="font-weight:700;font-size:16px;color:#1f2937;margin-bottom:4px;">
          <i class="fa-solid fa-user"></i> ${viaje.nombres} ${viaje.apellidos}
        </div>
        ${fechaSalida ? `<div style="font-size:14px;color:#059669;font-weight:600;margin-bottom:4px;"><i class="fa-solid fa-plane-departure"></i> Salida: ${fechaSalida}</div>` : ''}
        <div class="viaje-fecha" style="font-size:13px;color:#6b7280;">
          <i class="fa-solid fa-calendar"></i> Creado: ${fechaFormateada}
        </div>
        ${viaje.grupo ? `<div style="font-size:13px;color:#6b7280;margin-top:2px;"><i class="fa-solid fa-users"></i> Grupo ${viaje.grupo}</div>` : ''}
      </div>
      ${estadoBadge}
    </div>
    <div class="tramos-resumen">
      <strong style="display: block; margin-bottom: 8px; color: #1f2937;">
        <i class="fa-solid fa-route"></i> Tramos del viaje (${viaje.tramos.length}):
      </strong>
      ${tramosHTML}
    </div>
    <div class="viaje-acciones">
      <button class="btn-accion btn-editar" onclick="editarViaje(${viaje.id_viaje})">
        <i class="fa-solid fa-pen"></i> Editar
      </button>
      ${viaje.estado === 'Programado' || viaje.estado === 'En curso' ? `
      <button class="btn-accion btn-ocultar" onclick="confirmarOcultarViaje(${viaje.id_viaje})">
        <i class="fa-solid fa-ban"></i> Cancelar
      </button>
      ` : ''}
      <button class="btn-accion btn-borrar" onclick="confirmarEliminarViaje(${viaje.id_viaje})">
        <i class="fa-solid fa-trash"></i> Borrar
      </button>
    </div>
  `;
  
  return card;
}

// ============================================
// EDITAR VIAJE
// ============================================
window.editarViaje = async function(idViaje) {
  const viaje = viajes.find(v => v.id_viaje === idViaje);
  if (!viaje) return;
  
  viajeEditando = viaje;
  
  // Buscar trabajador
  trabajadorSeleccionado = trabajadores.find(t => t.RUT === viaje.rut_trabajador);
  
  if (!trabajadorSeleccionado) {
    mostrarError('No se encontró el trabajador asociado');
    return;
  }
  
  // Abrir modal
  el.modalNuevoViaje.classList.add('show');
  
  // Actualizar título del modal
  document.querySelector('#modal-nuevo-viaje h2').textContent = 'Editar Viaje';
  el.btnGuardarViaje.innerHTML = '<i class="fa-solid fa-save"></i> Actualizar Viaje';
  
  // Llenar campos del trabajador
  el.inputTrabajador.value = `${trabajadorSeleccionado.RUT} - ${trabajadorSeleccionado.nombres} ${trabajadorSeleccionado.apellidos}`;
  mostrarInfoTrabajador(trabajadorSeleccionado);
  
  // Limpiar tramos existentes
  el.tramosContainer.innerHTML = '';
  tramoCounter = 0;
  
  // Cargar tramos del viaje
  viaje.tramos.forEach(tramo => {
    tramoCounter++;
    
    const tramoDiv = document.createElement('div');
    tramoDiv.className = 'tramo-item';
    tramoDiv.dataset.tramoId = tramoCounter;
    
    tramoDiv.innerHTML = `
      <div class="tramo-header">
        <span class="tramo-numero"><i class="fa-solid fa-route"></i> Tramo ${tramoCounter}</span>
        <button type="button" class="btn-eliminar-tramo" onclick="eliminarTramo(${tramoCounter})">
          <i class="fa-solid fa-trash"></i> Eliminar
        </button>
      </div>
      
      <div class="form-grid">
        <div class="form-group">
          <label>Tipo de Transporte</label>
          <div class="select-wrapper">
            <select class="modern-input plain" required>
              <option value="" disabled>Seleccione...</option>
              <option value="Bus" ${tramo.tipo_transporte === 'Bus' ? 'selected' : ''}>🚌 BUS</option>
              <option value="Avión" ${tramo.tipo_transporte === 'Avión' ? 'selected' : ''}>✈️ AVIÓN</option>
              <option value="Transfer" ${tramo.tipo_transporte === 'Transfer' ? 'selected' : ''}>🚐 TRANSFER</option>
              <option value="Otro" ${tramo.tipo_transporte === 'Otro' ? 'selected' : ''}>🚗 OTRO</option>
            </select>
            <i class="fa-solid fa-chevron-down select-arrow"></i>
          </div>
        </div>
        
        <div class="form-group">
          <label>Código/Número (Opcional)</label>
          <input type="text" value="${tramo.codigo_transporte || ''}" placeholder="Ej: LA-1234" class="modern-input plain">
        </div>
        
        <div class="form-group">
          <label>Fecha</label>
          <input type="date" value="${tramo.fecha}" class="modern-input plain" required>
        </div>
        
        <div class="form-group">
          <label>Hora</label>
          <input type="time" value="${tramo.hora}" class="modern-input plain" required>
        </div>
        
        <div class="form-group">
          <label>Origen</label>
          <div class="select-wrapper">
            <select class="modern-input plain" required>
              <option value="">Seleccionar ciudad...</option>
              ${ciudades.map(c => `<option value="${c.id_ciudad}" ${c.id_ciudad === tramo.id_ciudad_origen ? 'selected' : ''}>${c.nombre}</option>`).join('')}
            </select>
            <i class="fa-solid fa-chevron-down select-arrow"></i>
          </div>
        </div>
        
        <div class="form-group">
          <label>Destino</label>
          <div class="select-wrapper">
            <select class="modern-input plain" required>
              <option value="">Seleccionar ciudad...</option>
              ${ciudades.map(c => `<option value="${c.id_ciudad}" ${c.id_ciudad === tramo.id_ciudad_destino ? 'selected' : ''}>${c.nombre}</option>`).join('')}
            </select>
            <i class="fa-solid fa-chevron-down select-arrow"></i>
          </div>
        </div>
      </div>
    `;
    
    el.tramosContainer.appendChild(tramoDiv);
  });
};

// ============================================
// OCULTAR VIAJE
// ============================================
window.confirmarOcultarViaje = function(idViaje) {
  const viaje = viajes.find(v => v.id_viaje === idViaje);
  if (!viaje) return;
  
  document.getElementById('confirm-title').textContent = 'Ocultar Viaje';
  document.getElementById('confirm-message').textContent = 
    `¿Desea ocultar el viaje de ${viaje.nombres} ${viaje.apellidos}? El viaje no se eliminará, solo se ocultará de la vista de próximos viajes.`;
  
  document.getElementById('confirm-ok').onclick = () => ocultarViaje(idViaje);
  
  el.modalConfirm.classList.add('show');
};

async function ocultarViaje(idViaje) {
  try {
    el.modalConfirm.classList.remove('show');
    
    const response = await fetch(`/api/viajes/${idViaje}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: false })
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error al ocultar el viaje');
    }
    
    mostrarExito('Viaje ocultado exitosamente');
    await cargarViajes();
    
  } catch (error) {
    console.error('[VIAJES] Error ocultando viaje:', error);
    mostrarError(error.message || 'Error al ocultar el viaje');
  }
}

// ============================================
// ELIMINAR VIAJE
// ============================================
window.confirmarEliminarViaje = function(idViaje) {
  const viaje = viajes.find(v => v.id_viaje === idViaje);
  if (!viaje) return;
  
  document.getElementById('confirm-title').textContent = 'Eliminar Viaje';
  document.getElementById('confirm-message').textContent = 
    `¿Está seguro de eliminar el viaje de ${viaje.nombres} ${viaje.apellidos}? Esta acción no se puede deshacer.`;
  
  document.getElementById('confirm-ok').onclick = () => eliminarViaje(idViaje);
  
  el.modalConfirm.classList.add('show');
};

async function eliminarViaje(idViaje) {
  try {
    el.modalConfirm.classList.remove('show');
    
    const response = await fetch(`/api/viajes/${idViaje}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error al eliminar el viaje');
    }
    
    mostrarExito('Viaje eliminado exitosamente');
    await cargarViajes();
    
  } catch (error) {
    console.error('[VIAJES] Error eliminando viaje:', error);
    mostrarError(error.message || 'Error al eliminar el viaje');
  }
}

// ============================================
// MODALES DE FEEDBACK
// ============================================
function mostrarExito(mensaje) {
  document.getElementById('result-icon').innerHTML = '<i class="fa-solid fa-circle-check" style="color:#10b981;"></i>';
  document.getElementById('result-title').textContent = '¡Éxito!';
  document.getElementById('result-message').textContent = mensaje;
  el.modalResult.classList.add('show');
}

function mostrarError(mensaje) {
  document.getElementById('result-icon').innerHTML = '<i class="fa-solid fa-circle-xmark" style="color:#ef4444;"></i>';
  document.getElementById('result-title').textContent = 'Error';
  document.getElementById('result-message').textContent = mensaje;
  el.modalResult.classList.add('show');
}
