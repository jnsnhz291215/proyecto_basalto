// ============================================
// GESTIÓN DE VIAJES - Sistema de Transporte
// ============================================

let trabajadores = [];
let ciudades = [];

function titleCase(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
let viajes = [];
let trabajadorSeleccionado = null;
let tramoCounter = 0;
let viajeEditando = null; // Para modo edición
let sugerenciasPeriodoActual = null;
let instanciasDisponibles = [];

function tipoMovimientoPorDefecto(index) {
  return index % 2 === 0 ? 'ida' : 'vuelta';
}

function obtenerFechaSugeridaPorTipo(tipoMovimiento) {
  if (!sugerenciasPeriodoActual) return '';
  if (tipoMovimiento === 'ida') return sugerenciasPeriodoActual.fecha_ida_sugerida || '';
  if (tipoMovimiento === 'vuelta') return sugerenciasPeriodoActual.fecha_vuelta_sugerida || '';
  return '';
}

const canViewViajes = () => (window.hasAdminPermission ? window.hasAdminPermission('viajes_ver') : true);
const canManageViajes = () => (window.hasAdminPermission ? window.hasAdminPermission('viajes_editar') : true);
const canSoftDeleteViajes = () => (window.hasAdminPermission ? window.hasAdminPermission('viajes_soft_delete') : false);
const isSuperAdminSession = () => localStorage.getItem('user_super_admin') === '1';

// Elementos del DOM
const el = {
  viajesLista: null,
  sinViajes: null,
  permissionBanner: null,
  modalNuevoViaje: null,
  formNuevoViaje: null,
  btnNuevoViaje: null,
  btnGuardarViaje: null,
  btnCancelViaje: null,
  selectGrupoTrabajador: null,
  inputTrabajador: null,
  datalistTrabajadores: null,
  selectInstanciaTrabajo: null,
  trabajadorInfo: null,
  tramosContainer: null,
  btnAgregarTramo: null,
  modalConfirm: null,
  modalResult: null,
  filtroTipo: null,
  filtroMes: null,
  filtroGrupo: null,
  filtroBusqueda: null,
  btnLimpiarFiltros: null
};

function openManagedModal(modalElement) {
  if (!modalElement) return;
  if (window.basaltoModal?.open) {
    window.basaltoModal.open(modalElement);
    return;
  }

  modalElement.inert = false;
  modalElement.classList.add('show');
  modalElement.setAttribute('aria-hidden', 'false');
  document.body.classList.add('overflow-hidden', 'modal-open');
}

function closeManagedModal(modalElement) {
  if (!modalElement) return;
  if (window.basaltoModal?.close) {
    window.basaltoModal.close(modalElement);
    return;
  }

  const activeElement = document.activeElement;
  if (activeElement && modalElement.contains(activeElement)) {
    if (typeof activeElement.blur === 'function') activeElement.blur();
    if (document.body && typeof document.body.focus === 'function') {
      document.body.setAttribute('tabindex', '-1');
      document.body.focus({ preventScroll: true });
      document.body.removeAttribute('tabindex');
    }
  }

  modalElement.classList.remove('show');
  modalElement.setAttribute('aria-hidden', 'true');
  modalElement.inert = true;
  document.body.classList.remove('overflow-hidden', 'modal-open');
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[VIAJES] Iniciando aplicación...');

  if (!canViewViajes()) {
    alert('Acceso denegado. No tiene permisos para ver viajes.');
    window.location.href = '/gestionar.html';
    return;
  }
  
  // Obtener referencias a elementos del DOM
  el.viajesLista = document.getElementById('viajes-lista');
  el.sinViajes = document.getElementById('sin-viajes');
  el.permissionBanner = document.getElementById('viajes-permission-banner');
  el.modalNuevoViaje = document.getElementById('modal-nuevo-viaje');
  el.formNuevoViaje = document.getElementById('form-nuevo-viaje');
  el.btnNuevoViaje = document.getElementById('btn-nuevo-viaje');
  el.btnGuardarViaje = document.getElementById('guardar-nuevo-viaje');
  el.btnCancelViaje = document.getElementById('cancel-nuevo-viaje');
  el.selectGrupoTrabajador = document.getElementById('nuevo-viaje-grupo');
  el.inputTrabajador = document.getElementById('nuevo-viaje-trabajador');
  el.datalistTrabajadores = document.getElementById('trabajadores-datalist');
  el.selectInstanciaTrabajo = document.getElementById('nuevo-viaje-instancia');
  el.trabajadorInfo = document.getElementById('trabajador-info');
  el.tramosContainer = document.getElementById('tramos-container');
  el.btnAgregarTramo = document.getElementById('btn-agregar-tramo');
  el.modalConfirm = document.getElementById('modal-confirm');
  el.modalResult = document.getElementById('modal-result');
  el.filtroTipo = document.getElementById('filtro-tipo');
  el.filtroMes = document.getElementById('filtro-mes');
  el.filtroGrupo = document.getElementById('filtro-grupo');
  el.filtroBusqueda = document.getElementById('filtro-busqueda');
  el.btnLimpiarFiltros = document.getElementById('btn-limpiar-filtros');
  
  // Cargar datos iniciales
  await Promise.all([
    cargarTrabajadores(),
    cargarCiudades(),
    cargarViajes()
  ]);

  if (el.btnNuevoViaje) {
    el.btnNuevoViaje.style.display = canManageViajes() ? '' : 'none';
  }
  if (el.permissionBanner) {
    el.permissionBanner.classList.toggle('visible', canViewViajes() && !canManageViajes());
  }
  
  // Event listeners
  el.btnNuevoViaje.addEventListener('click', prepararNuevoViaje);
  el.btnCancelViaje.addEventListener('click', cerrarModalNuevoViaje);
  el.btnGuardarViaje.addEventListener('click', guardarViaje);
  el.btnAgregarTramo.addEventListener('click', agregarTramo);
  el.inputTrabajador.addEventListener('input', buscarTrabajador);
  el.inputTrabajador.addEventListener('change', seleccionarTrabajador);
  if (el.selectGrupoTrabajador) {
    el.selectGrupoTrabajador.addEventListener('change', aplicarFiltroGrupoTrabajador);
  }
  if (el.filtroTipo) el.filtroTipo.addEventListener('change', () => cargarViajes());
  if (el.filtroMes) el.filtroMes.addEventListener('change', () => cargarViajes());
  if (el.filtroGrupo) el.filtroGrupo.addEventListener('change', () => cargarViajes());
  if (el.filtroBusqueda) {
    el.filtroBusqueda.addEventListener('input', () => cargarViajes());
  }
  if (el.btnLimpiarFiltros) {
    el.btnLimpiarFiltros.addEventListener('click', limpiarFiltrosViajes);
  }
  
  // Cerrar modales al hacer click en el fondo
  el.modalNuevoViaje.addEventListener('click', (e) => {
    if (e.target === el.modalNuevoViaje) cerrarModalNuevoViaje();
  });
  
  document.getElementById('result-ok').addEventListener('click', () => {
    closeManagedModal(el.modalResult);
  });
  
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    closeManagedModal(el.modalConfirm);
  });
  
  console.log('[VIAJES] Aplicación lista');
});

function limpiarFiltrosViajes() {
  if (el.filtroTipo) el.filtroTipo.value = 'proximos';
  if (el.filtroMes) el.filtroMes.value = '';
  if (el.filtroGrupo) el.filtroGrupo.value = '';
  if (el.filtroBusqueda) el.filtroBusqueda.value = '';
  void cargarViajes();
}

function getFechaReferenciaViaje() {
  const fechaInputs = Array.from(el.tramosContainer?.querySelectorAll('[data-field="fecha"]') || []);
  const fechas = fechaInputs
    .map((input) => String(input.value || '').trim())
    .filter(Boolean)
    .sort();

  if (fechas.length) return fechas[0];

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatShortDate(iso) {
  const raw = String(iso || '').trim();
  if (!raw) return '';

  const base = raw.includes('T') ? raw.split('T')[0] : raw;
  const date = new Date(`${base}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}`;
}

function mapTurnoLabel(turno) {
  const raw = String(turno || '').toUpperCase();
  if (raw === 'DIA') return 'Dia';
  if (raw === 'NOCHE') return 'Noche';
  return 'N/A';
}

function renderSelectInstancias() {
  if (!el.selectInstanciaTrabajo) return;

  const options = ['<option value="">Seleccione una instancia...</option>'];
  for (const inst of instanciasDisponibles) {
    const grupoLabel = String(inst.nombre_grupo || '').trim();
    const grupoTexto = /^grupo\s+/i.test(grupoLabel) ? grupoLabel : `Grupo ${grupoLabel}`;
    const inicio = formatShortDate(inst.fecha_inicio);
    const fin = formatShortDate(inst.fecha_fin);
    const label = `${grupoTexto} - ${mapTurnoLabel(inst.turno_inicio)} | ${inicio} al ${fin}`;
    options.push(`<option value="${inst.id_periodo_key}">${label}</option>`);
  }

  if (!instanciasDisponibles.length) {
    options.push('<option value="" disabled>No hay instancias vigentes para la fecha seleccionada</option>');
  }

  el.selectInstanciaTrabajo.innerHTML = options.join('');
}

async function cargarInstanciasDisponibles(preferida = null) {
  if (!el.selectInstanciaTrabajo) return;

  const idGrupo = Number(trabajadorSeleccionado?.id_grupo || 0);
  if (!idGrupo) {
    instanciasDisponibles = [];
    renderSelectInstancias();
    return;
  }

  try {
    const fecha = getFechaReferenciaViaje();
    const response = await fetch(`/api/viajes/instancias-disponibles?id_grupo=${idGrupo}&fecha=${fecha}`);
    if (!response.ok) {
      instanciasDisponibles = [];
      renderSelectInstancias();
      return;
    }

    const payload = await response.json();
    instanciasDisponibles = Array.isArray(payload.instancias) ? payload.instancias : [];
    renderSelectInstancias();

    if (preferida && instanciasDisponibles.some((i) => i.id_periodo_key === preferida)) {
      el.selectInstanciaTrabajo.value = preferida;
      return;
    }

    if (instanciasDisponibles.length) {
      el.selectInstanciaTrabajo.value = instanciasDisponibles[0].id_periodo_key;
    }
  } catch (error) {
    console.warn('[VIAJES] Error cargando instancias disponibles:', error.message || error);
    instanciasDisponibles = [];
    renderSelectInstancias();
  }
}

// ============================================
// CARGAR DATOS
// ============================================
async function cargarTrabajadores() {
  try {
    const response = await fetch('/datos');
    if (!response.ok) throw new Error('Error al cargar trabajadores');
    trabajadores = await response.json();
    console.log('[VIAJES] Trabajadores cargados:', trabajadores.length);
    actualizarFiltroGrupoVista();
    actualizarSelectorGruposTrabajador();
    actualizarDatalistTrabajadores();
  } catch (error) {
    console.error('[VIAJES] Error cargando trabajadores:', error);
    mostrarError('Error al cargar la lista de trabajadores');
  }
}

function actualizarFiltroGrupoVista() {
  if (!el.filtroGrupo) return;

  const valorActual = String(el.filtroGrupo.value || '');
  const gruposMap = new Map();

  trabajadores.forEach((t) => {
    const id = String(t.id_grupo || '').trim();
    if (!id) return;
    if (!gruposMap.has(id)) {
      gruposMap.set(id, t.grupo || `Grupo ${id}`);
    }
  });

  const gruposOrdenados = Array.from(gruposMap.entries()).sort((a, b) => Number(a[0]) - Number(b[0]));
  el.filtroGrupo.innerHTML = '<option value="">Todos</option>';

  const optionSinGrupo = document.createElement('option');
  optionSinGrupo.value = '15';
  optionSinGrupo.textContent = 'Sin grupo';
  el.filtroGrupo.appendChild(optionSinGrupo);

  gruposOrdenados.forEach(([id, nombre]) => {
    if (String(nombre || '').trim().toLowerCase() === 'sin grupo' || String(id) === '15') return;
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `${nombre} (${id})`;
    el.filtroGrupo.appendChild(option);
  });

  if (valorActual && (valorActual === '15' || gruposMap.has(valorActual))) {
    el.filtroGrupo.value = valorActual;
  }
}

function obtenerTrabajadoresFiltradosPorGrupo() {
  const grupoSeleccionado = String(el.selectGrupoTrabajador?.value || '').trim();
  if (!grupoSeleccionado) return trabajadores;
  return trabajadores.filter((t) => String(t.id_grupo || '') === grupoSeleccionado);
}

function actualizarSelectorGruposTrabajador() {
  if (!el.selectGrupoTrabajador) return;

  const valorActual = String(el.selectGrupoTrabajador.value || '');
  const gruposMap = new Map();

  trabajadores.forEach((t) => {
    const id = String(t.id_grupo || '').trim();
    if (!id) return;
    if (!gruposMap.has(id)) {
      gruposMap.set(id, t.grupo || `Grupo ${id}`);
    }
  });

  const gruposOrdenados = Array.from(gruposMap.entries()).sort((a, b) => Number(a[0]) - Number(b[0]));
  el.selectGrupoTrabajador.innerHTML = '<option value="">Todos los grupos</option>';

  const optionSinGrupo = document.createElement('option');
  optionSinGrupo.value = '15';
  optionSinGrupo.textContent = 'Sin grupo';
  el.selectGrupoTrabajador.appendChild(optionSinGrupo);

  gruposOrdenados.forEach(([id, nombre]) => {
    if (String(nombre || '').trim().toLowerCase() === 'sin grupo' || String(id) === '15') return;
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `${nombre} (${id})`;
    el.selectGrupoTrabajador.appendChild(option);
  });

  if (valorActual && (valorActual === '15' || gruposMap.has(valorActual))) {
    el.selectGrupoTrabajador.value = valorActual;
  }
}

function aplicarFiltroGrupoTrabajador() {
  const grupoSeleccionado = String(el.selectGrupoTrabajador?.value || '').trim();
  if (trabajadorSeleccionado && grupoSeleccionado && String(trabajadorSeleccionado.id_grupo || '') !== grupoSeleccionado) {
    trabajadorSeleccionado = null;
    sugerenciasPeriodoActual = null;
    el.inputTrabajador.value = '';
    el.trabajadorInfo.classList.remove('visible');
    instanciasDisponibles = [];
    renderSelectInstancias();
  }
  actualizarDatalistTrabajadores();
}

async function cargarCiudades() {
  try {
    const response = await fetch('/api/ciudades');
    if (!response.ok) throw new Error('Error al cargar ciudades');
    ciudades = (await response.json()).map((ciudad) => ({
      ...ciudad,
      nombre_ciudad: titleCase(ciudad.nombre_ciudad)
    }));
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

    if (el.filtroGrupo && el.filtroGrupo.value) {
      params.append('id_grupo', el.filtroGrupo.value);
    }

    const busqueda = String(el.filtroBusqueda?.value || '').trim();
    if (busqueda) {
      params.append('busqueda', busqueda);
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

  const filtrados = obtenerTrabajadoresFiltradosPorGrupo();
  filtrados.forEach(t => {
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
  const candidatos = obtenerTrabajadoresFiltradosPorGrupo();
  
  // Buscar trabajador por RUT o nombre
  const trabajador = candidatos.find(t => {
    const rutMatch = valor.includes(t.RUT);
    const nombreMatch = valor.toLowerCase().includes(t.nombres.toLowerCase()) || 
                        valor.toLowerCase().includes(t.apellidos.toLowerCase());
    return rutMatch || nombreMatch;
  });
  
  if (trabajador) {
    trabajadorSeleccionado = trabajador;
    mostrarInfoTrabajador(trabajador);
    void cargarSugerenciasPeriodoTrabajador();
    void cargarInstanciasDisponibles();
  } else {
    trabajadorSeleccionado = null;
    sugerenciasPeriodoActual = null;
    el.trabajadorInfo.classList.remove('visible');
    instanciasDisponibles = [];
    renderSelectInstancias();
  }
}

async function cargarSugerenciasPeriodoTrabajador() {
  try {
    const idGrupo = Number(trabajadorSeleccionado?.id_grupo || 0);
    if (!idGrupo) {
      sugerenciasPeriodoActual = null;
      return;
    }

    const response = await fetch(`/api/viajes/sugerir-fechas?id_grupo=${idGrupo}`);
    if (!response.ok) {
      sugerenciasPeriodoActual = null;
      return;
    }

    sugerenciasPeriodoActual = await response.json();

    // Completa automáticamente fechas sugeridas en tramos sin fecha.
    const tramos = el.tramosContainer?.querySelectorAll('.tramo-item') || [];
    tramos.forEach((tramoEl, index) => {
      const fechaInput = tramoEl.querySelector('[data-field="fecha"]') || tramoEl.querySelector('input[type="date"]');
      const tipoMovimientoEl = tramoEl.querySelector('[data-field="tipo_movimiento"]');
      const tipoMovimiento = tipoMovimientoEl?.value || tipoMovimientoPorDefecto(index);
      if (fechaInput && !fechaInput.value) {
        fechaInput.value = obtenerFechaSugeridaPorTipo(tipoMovimiento);
      }
    });

    if (trabajadorSeleccionado) {
      void cargarInstanciasDisponibles(el.selectInstanciaTrabajo?.value || null);
    }
  } catch (error) {
    console.warn('[VIAJES] No se pudieron cargar fechas sugeridas:', error.message || error);
    sugerenciasPeriodoActual = null;
  }
}

function mostrarInfoTrabajador(trabajador) {
  // NOMBRE: Concatenar nombres completos
  const nombreCompleto = `${trabajador.nombres} ${trabajador.apellido_paterno || ''} ${trabajador.apellido_materno || ''}`.trim();
  document.getElementById('info-nombre').textContent = nombreCompleto;
  
  // RUT
  document.getElementById('info-rut').textContent = trabajador.RUT || '-';
  
  // FECHA NACIMIENTO: Formatear a DD/MM/AAAA
  let fechaNacimientoFormateada = '-';
  if (trabajador.fecha_nacimiento) {
    try {
      const fecha = new Date(trabajador.fecha_nacimiento);
      const dia = String(fecha.getDate()).padStart(2, '0');
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const anio = fecha.getFullYear();
      fechaNacimientoFormateada = `${dia}/${mes}/${anio}`;
    } catch (e) {
      fechaNacimientoFormateada = '-';
    }
  }
  document.getElementById('info-fecha-nacimiento').textContent = fechaNacimientoFormateada;
  
  // CARGO
  document.getElementById('info-cargo').textContent = trabajador.cargo || 'Sin cargo';
  
  // GRUPO
  document.getElementById('info-grupo').textContent = trabajador.grupo || 'Sin grupo';
  
  el.trabajadorInfo.classList.add('visible');
}

// ============================================
// MANEJO DE TRAMOS
// ============================================
function agregarTramo() {
  tramoCounter++;
  const tramoId = tramoCounter;
  const tramoIndex = (el.tramosContainer?.querySelectorAll('.tramo-item').length || 0);
  const tramoNumeroVisible = tramoIndex + 1;
  const tipoDefault = tipoMovimientoPorDefecto(tramoIndex);
  
  const tramoDiv = document.createElement('div');
  tramoDiv.className = 'tramo-item';
  tramoDiv.dataset.tramoId = tramoId;
  
  tramoDiv.innerHTML = `
    <div class="tramo-header">
      <span class="tramo-numero"><i class="fa-solid fa-route"></i> Tramo ${tramoNumeroVisible}</span>
      <button type="button" class="btn-eliminar-tramo" onclick="eliminarTramo(${tramoId})">
        <i class="fa-solid fa-trash"></i> Eliminar
      </button>
    </div>
    
    <div class="form-grid">
      <div class="form-group">
        <label>Tipo de Transporte</label>
        <select class="modern-input plain" data-field="tipo_transporte" required>
          <option value="" disabled selected>Seleccione...</option>
          <option value="Bus">🚌 BUS</option>
          <option value="Avión">✈️ AVIÓN</option>
        </select>
      </div>

      <div class="form-group">
        <label>Tipo de Movimiento</label>
        <select class="modern-input plain" data-field="tipo_movimiento" required>
          <option value="ida" ${tipoDefault === 'ida' ? 'selected' : ''}>Ida</option>
          <option value="vuelta" ${tipoDefault === 'vuelta' ? 'selected' : ''}>Vuelta</option>
          <option value="conexion">Conexión</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>Código/Número (Opcional)</label>
        <input type="text" data-field="codigo_transporte" placeholder="Ej: LA-1234" class="modern-input plain">
      </div>
      
      <div class="form-group">
        <label>Fecha</label>
        <input type="date" data-field="fecha" class="modern-input plain" required>
      </div>
      
      <div class="form-group">
        <label>Hora</label>
        <input type="time" data-field="hora" class="modern-input plain" required>
      </div>
      
      <div class="form-group">
        <label>Origen</label>
        <select class="modern-input plain" data-field="id_ciudad_origen" required>
          <option value="">Seleccionar ciudad...</option>
          ${ciudades.map(c => `<option value="${c.id_ciudad}">${c.nombre_ciudad}</option>`).join('')}
        </select>
      </div>
      
      <div class="form-group">
        <label>Destino</label>
        <select class="modern-input plain" data-field="id_ciudad_destino" required>
          <option value="">Seleccionar ciudad...</option>
          ${ciudades.map(c => `<option value="${c.id_ciudad}">${c.nombre_ciudad}</option>`).join('')}
        </select>
      </div>
      
      <div class="form-group">
        <label>Empresa de Transporte</label>
        <input type="text" data-field="empresa_transporte" placeholder="Ej: Transportes Basalto" class="modern-input plain" required>
      </div>
    </div>
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid #e5e7eb;">
      <label style="font-size:13px;font-weight:600;color:#6b7280;display:block;margin-bottom:8px;">
        Ticket PDF <span style="font-weight:400;color:#9ca3af;">(opcional)</span>
      </label>
      <label style="cursor:pointer;display:inline-flex;align-items:center;gap:8px;padding:6px 12px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;font-size:13px;font-weight:600;">
        <i class="fa-solid fa-file-arrow-up"></i>
        <span class="ticket-upload-label">Seleccionar PDF</span>
        <input type="file" data-field="ticket_pdf" accept=".pdf" style="display:none;"
          onchange="this.previousElementSibling.textContent = this.files[0]?.name || 'Seleccionar PDF'">
      </label>
    </div>
  `;

  el.tramosContainer.appendChild(tramoDiv);

  const tipoMovimientoEl = tramoDiv.querySelector('[data-field="tipo_movimiento"]');
  const fechaInput = tramoDiv.querySelector('[data-field="fecha"]');
  if (fechaInput) {
    const fechaSugerida = obtenerFechaSugeridaPorTipo(tipoMovimientoEl?.value || tipoDefault);
    if (fechaSugerida) {
      fechaInput.value = fechaSugerida;
    }
  }

  if (tipoMovimientoEl && fechaInput) {
    tipoMovimientoEl.addEventListener('change', () => {
      if (!fechaInput.value) {
        fechaInput.value = obtenerFechaSugeridaPorTipo(tipoMovimientoEl.value);
      }
    });

    fechaInput.addEventListener('change', () => {
      if (trabajadorSeleccionado) {
        void cargarInstanciasDisponibles(el.selectInstanciaTrabajo?.value || null);
      }
    });
  }
}

window.eliminarTramo = function(tramoId) {
  const tramoDiv = document.querySelector(`[data-tramo-id="${tramoId}"]`);
  if (tramoDiv) {
    tramoDiv.remove();

    // Renumerar tramos visibles según orden actual
    const tramos = el.tramosContainer.querySelectorAll('.tramo-item');
    tramos.forEach((tramo, index) => {
      const numero = tramo.querySelector('.tramo-numero');
      if (numero) {
        numero.innerHTML = `<i class="fa-solid fa-route"></i> Tramo ${index + 1}`;
      }
    });

    if (tramos.length === 0) {
      tramoCounter = 0;
    }

    if (trabajadorSeleccionado) {
      void cargarInstanciasDisponibles(el.selectInstanciaTrabajo?.value || null);
    }
  }
};

// ============================================
// MODAL NUEVO VIAJE
// ============================================
function prepararNuevoViaje() {
  if (!canManageViajes()) {
    mostrarError('Solo tiene permiso de lectura en la vista de viajes');
    return;
  }

  viajeEditando = null; // Modo creación
  openManagedModal(el.modalNuevoViaje);
  el.formNuevoViaje.reset();
  trabajadorSeleccionado = null;
  sugerenciasPeriodoActual = null;
  instanciasDisponibles = [];
  if (el.selectGrupoTrabajador) el.selectGrupoTrabajador.value = '';
  actualizarDatalistTrabajadores();
  renderSelectInstancias();
  el.trabajadorInfo.classList.remove('visible');
  el.tramosContainer.innerHTML = '';
  tramoCounter = 0;
  
  // Actualizar título del modal
  const modalTitle = document.getElementById('modalViajeLabel');
  if (modalTitle) modalTitle.innerText = 'Crear Nuevo Viaje';
  if (el.btnGuardarViaje) el.btnGuardarViaje.innerText = 'Guardar Viaje';

  // Agregar un tramo inicial
  agregarTramo();
}

function cerrarModalNuevoViaje() {
  closeManagedModal(el.modalNuevoViaje);
  viajeEditando = null;
}

// ============================================
// GUARDAR VIAJE
// ============================================
async function guardarViaje() {
  try {
    if (!canManageViajes()) {
      mostrarError('No tiene permisos para crear o editar viajes');
      return;
    }

    // Validar trabajador
    if (!trabajadorSeleccionado) {
      mostrarError('Debe seleccionar un trabajador');
      return;
    }

    const idPeriodoSeleccionado = String(el.selectInstanciaTrabajo?.value || '').trim();
    if (!idPeriodoSeleccionado) {
      mostrarError('Debe seleccionar una instancia de trabajo vigente');
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
      const tipoTransporte = tramoEl.querySelector('[data-field="tipo_transporte"]')?.value || '';
      const tipoMovimiento = tramoEl.querySelector('[data-field="tipo_movimiento"]')?.value || '';
      const codigoTransporte = tramoEl.querySelector('[data-field="codigo_transporte"]')?.value || '';
      const fecha = tramoEl.querySelector('[data-field="fecha"]')?.value || '';
      const hora = tramoEl.querySelector('[data-field="hora"]')?.value || '';
      const idOrigen = tramoEl.querySelector('[data-field="id_ciudad_origen"]')?.value || '';
      const idDestino = tramoEl.querySelector('[data-field="id_ciudad_destino"]')?.value || '';
      const empresaTransporte = tramoEl.querySelector('[data-field="empresa_transporte"]')?.value || '';
      
      if (!tipoTransporte || !tipoMovimiento || !fecha || !hora || !idOrigen || !idDestino || !empresaTransporte) {
        mostrarError(`Tramo ${index + 1}: Complete todos los campos obligatorios`);
        error = true;
        return;
      }
      
      tramos.push({
        tipo_transporte: tipoTransporte,
        tipo_movimiento: tipoMovimiento,
        codigo_transporte: codigoTransporte,
        fecha: fecha,
        hora: hora,
        id_ciudad_origen: parseInt(idOrigen),
        id_ciudad_destino: parseInt(idDestino),
        empresa_transporte: empresaTransporte
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
          tramos: tramos,
          id_periodo_vinculo: idPeriodoSeleccionado
        })
      });
    } else {
      // CREACIÓN: POST /api/viajes
      response = await fetch('/api/viajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rut_trabajador: trabajadorSeleccionado.RUT,
          tramos: tramos,
          id_periodo_vinculo: idPeriodoSeleccionado
        })
      });
    }
    
    data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error al guardar el viaje');
    }
    
    // Éxito
    const accion = viajeEditando ? 'actualizado' : 'creado';
    const idViajeGuardado = viajeEditando ? viajeEditando.id_viaje : data.id_viaje;

    // Si hay ticket en algún tramo, subirlo
    if (el.tramosContainer && idViajeGuardado) {
      const ticketInputs = el.tramosContainer.querySelectorAll('[data-field="ticket_pdf"]');
      let ticketFile = null;
      ticketInputs.forEach(inp => {
        if (!ticketFile && inp.files && inp.files.length > 0) ticketFile = inp.files[0];
      });
      if (ticketFile) {
        try {
          const formData = new FormData();
          formData.append('ticket', ticketFile);
          const ticketRes = await fetch(`/api/viajes/${idViajeGuardado}/upload-ticket`, {
            method: 'POST',
            body: formData
          });
          if (!ticketRes.ok) {
            const td = await ticketRes.json();
            console.warn('[TICKET] Viaje guardado pero error al subir ticket:', td.error);
          }
        } catch (ticketErr) {
          console.error('[TICKET] Error subiendo ticket tras guardar:', ticketErr);
        }
      }
    }

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
    const emptyText = el.sinViajes.querySelector('p:last-child');
    if (emptyText) {
      emptyText.textContent = canManageViajes()
        ? 'Haz clic en "Nuevo Viaje" para comenzar'
        : 'Tu perfil tiene acceso de solo lectura a esta vista';
    }
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
  const puedeGestionar = canManageViajes();
  const puedeHardDelete = isSuperAdminSession();
  const puedeBorrarTicket = puedeHardDelete || canSoftDeleteViajes();
  
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
    }
    
    const codigo = tramo.codigo_transporte ? ` (${tramo.codigo_transporte})` : '';
    const fechaTramo = new Date(tramo.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
    const empresa = tramo.empresa_transporte ? `<span style="color: #4f46e5; font-weight: 600;">🏢 ${tramo.empresa_transporte}</span> | ` : '';
    
    return `
      <div class="tramo-line">
        <i class="fa-solid ${icon} tramo-icon"></i>
        <span><strong>${tramo.tipo_transporte}${codigo}:</strong> ${tramo.origen} → ${tramo.destino} | ${empresa}${fechaTramo} ${tramo.hora}</span>
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
        ${viaje.id_grupo ? `<div style="font-size:13px;color:#6b7280;margin-top:2px;"><i class="fa-solid fa-users"></i> Grupo ${viaje.id_grupo}</div>` : ''}
      </div>
      ${estadoBadge}
    </div>
    <div class="tramos-resumen">
      <strong style="display: block; margin-bottom: 8px; color: #1f2937;">
        <i class="fa-solid fa-route"></i> Tramos del viaje (${viaje.tramos.length}):
      </strong>
      ${tramosHTML}
    </div>
    <div class="viaje-ticket-section" style="margin:10px 0;padding:10px 0;border-top:1px solid #f0f0f0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      ${viaje.url_ticket ? `
        <span style="font-size:12px;color:#059669;font-weight:600;margin-right:4px;">
          <i class="fa-solid fa-file-circle-check"></i> Ticket adjunto
        </span>
        <button class="btn-accion" style="background:#dcfce7;color:#166534;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;"
          onclick="descargarTicketAdmin(${viaje.id_viaje})">
          <i class="fa-regular fa-file-pdf"></i> Descargar
        </button>
        ${puedeBorrarTicket ? `
        <button class="btn-accion" style="background:#fee2e2;color:#991b1b;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;"
          onclick="confirmarBorrarTicket(${viaje.id_viaje})">
          <i class="fa-solid fa-file-circle-xmark"></i> Quitar Ticket
        </button>
        ` : ''}
      ` : (puedeGestionar ? `
        <span style="font-size:12px;color:#9ca3af;">
          <i class="fa-regular fa-file-pdf"></i> Sin ticket
        </span>
        <label style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;background:#eff6ff;color:#1d4ed8;border:1px dashed #93c5fd;padding:5px 10px;border-radius:6px;font-size:12px;font-weight:600;">
          <i class="fa-solid fa-file-arrow-up"></i> Subir Ticket
          <input type="file" accept=".pdf" style="display:none;" onchange="uploadTicketFromCard(${viaje.id_viaje}, this)">
        </label>
      ` : '')}
    </div>
    <div class="viaje-acciones">
      ${puedeGestionar ? `
      <button class="btn-accion btn-editar" onclick="prepararEdicionViaje(${viaje.id_viaje})">
        <i class="fa-solid fa-pen"></i> Editar
      </button>
      ${viaje.estado === 'Programado' || viaje.estado === 'En curso' ? `
      <button class="btn-accion btn-ocultar" onclick="confirmarOcultarViaje(${viaje.id_viaje})">
        <i class="fa-solid fa-ban"></i> Cancelar
      </button>
      ` : ''}
      ` : '<span style="font-size:12px;color:#64748b;font-weight:600;">Modo lectura</span>'}
      ${puedeHardDelete ? `
      <button class="btn-accion btn-borrar" onclick="confirmarEliminarViaje(${viaje.id_viaje})">
        <i class="fa-solid fa-trash"></i> Borrar
      </button>
      ` : ''}
    </div>
  `;
  
  return card;
}

// ============================================
// EDITAR VIAJE
// ============================================
window.prepararEdicionViaje = async function(idViaje) {
  try {
    if (!canManageViajes()) {
      mostrarError('No tiene permisos para editar viajes');
      return;
    }

    if (!ciudades.length) {
      await cargarCiudades();
    }

    const response = await fetch(`/api/viajes/${idViaje}`);
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error al cargar el viaje');
    }

    const viaje = await response.json();
    viajeEditando = { id_viaje: viaje.id_viaje || idViaje };

    const modalTitle = document.getElementById('modalViajeLabel');
    if (modalTitle) modalTitle.innerText = 'Editar Viaje';
    if (el.btnGuardarViaje) el.btnGuardarViaje.innerText = 'Guardar Cambios';

    openManagedModal(el.modalNuevoViaje);
    el.formNuevoViaje.reset();
    el.tramosContainer.innerHTML = '';
    tramoCounter = 0;

    trabajadorSeleccionado = trabajadores.find(t => t.RUT === viaje.rut_trabajador) || null;
    if (trabajadorSeleccionado) {
      el.inputTrabajador.value = `${trabajadorSeleccionado.RUT} - ${trabajadorSeleccionado.nombres} ${trabajadorSeleccionado.apellidos}`;
      mostrarInfoTrabajador(trabajadorSeleccionado);
    } else {
      el.inputTrabajador.value = viaje.rut_trabajador || '';
      el.trabajadorInfo.classList.remove('visible');
    }

    if (Array.isArray(viaje.tramos) && viaje.tramos.length) {
      const periodoPreferido = String(viaje.tramos.find((t) => t.id_periodo_vinculo)?.id_periodo_vinculo || '').trim();
      viaje.tramos.forEach(tramo => {
        tramoCounter++;
        const tipoMovimientoEditRaw = String(tramo.tipo_movimiento || tramo.tipo_tramo || '').toLowerCase();
        const tipoMovimientoEdit = ['ida', 'vuelta', 'conexion'].includes(tipoMovimientoEditRaw)
          ? tipoMovimientoEditRaw
          : tipoMovimientoPorDefecto(tramoCounter - 1);

        const tramoDiv = document.createElement('div');
        tramoDiv.className = 'tramo-item';
        tramoDiv.dataset.tramoId = tramoCounter;

        // Formatear fecha correctamente para input date (YYYY-MM-DD)
        const fechaFormato = tramo.fecha && tramo.fecha.includes('T') 
          ? tramo.fecha.split('T')[0] 
          : tramo.fecha;

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
                <select class="modern-input plain" data-field="tipo_transporte" required>
                  <option value="" disabled>Seleccione...</option>
                  <option value="Bus" ${tramo.tipo_transporte === 'Bus' ? 'selected' : ''}>🚌 BUS</option>
                  <option value="Avión" ${tramo.tipo_transporte === 'Avión' ? 'selected' : ''}>✈️ AVIÓN</option>
                </select>
                <i class="fa-solid fa-chevron-down select-arrow"></i>
              </div>
            </div>

            <div class="form-group">
              <label>Tipo de Movimiento</label>
              <select class="modern-input plain" data-field="tipo_movimiento" required>
                <option value="ida" ${tipoMovimientoEdit === 'ida' ? 'selected' : ''}>Ida</option>
                <option value="vuelta" ${tipoMovimientoEdit === 'vuelta' ? 'selected' : ''}>Vuelta</option>
                <option value="conexion">Conexión</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Código/Número (Opcional)</label>
              <input type="text" data-field="codigo_transporte" value="${tramo.codigo_transporte || ''}" placeholder="Ej: LA-1234" class="modern-input plain">
            </div>
            
            <div class="form-group">
              <label>Fecha</label>
              <input type="date" data-field="fecha" value="${fechaFormato}" class="modern-input plain" required>
            </div>
            
            <div class="form-group">
              <label>Hora</label>
              <input type="time" data-field="hora" value="${tramo.hora}" class="modern-input plain" required>
            </div>
            
            <div class="form-group">
              <label>Origen</label>
              <select class="modern-input plain" data-field="id_ciudad_origen" required>
                <option value="">Seleccionar ciudad...</option>
                ${ciudades.map(c => `<option value="${c.id_ciudad}" ${c.id_ciudad === tramo.id_ciudad_origen ? 'selected' : ''}>${c.nombre_ciudad}</option>`).join('')}
              </select>
            </div>
            
            <div class="form-group">
              <label>Destino</label>
              <select class="modern-input plain" data-field="id_ciudad_destino" required>
                <option value="">Seleccionar ciudad...</option>
                ${ciudades.map(c => `<option value="${c.id_ciudad}" ${c.id_ciudad === tramo.id_ciudad_destino ? 'selected' : ''}>${c.nombre_ciudad}</option>`).join('')}
              </select>
            </div>
            
            <div class="form-group">
              <label>Empresa de Transporte</label>
              <input type="text" data-field="empresa_transporte" placeholder="Ej: Transportes Basalto" class="modern-input plain" value="${tramo.empresa_transporte || ''}" required>
            </div>
          </div>
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid #e5e7eb;">
            <label style="font-size:13px;font-weight:600;color:#6b7280;display:block;margin-bottom:8px;">
              Ticket PDF <span style="font-weight:400;color:#9ca3af;">(opcional)</span>
            </label>
            ${tramoCounter === 1 && viaje.url_ticket ? `
              <div style="margin-bottom:8px;padding:6px 10px;background:#dcfce7;border-radius:6px;font-size:12px;color:#166534;font-weight:600;">
                <i class="fa-solid fa-file-circle-check"></i> Ticket actual: ${viaje.url_ticket.split('/').pop()}
              </div>
            ` : ''}
            <label style="cursor:pointer;display:inline-flex;align-items:center;gap:8px;padding:6px 12px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;font-size:13px;font-weight:600;">
              <i class="fa-solid fa-file-arrow-up"></i>
              <span class="ticket-upload-label">${tramoCounter === 1 && viaje.url_ticket ? 'Reemplazar PDF' : 'Seleccionar PDF'}</span>
              <input type="file" data-field="ticket_pdf" accept=".pdf" style="display:none;"
                onchange="this.previousElementSibling.textContent = this.files[0]?.name || 'Seleccionar PDF'">
            </label>
          </div>
        `;

        el.tramosContainer.appendChild(tramoDiv);

        const fechaInputEdit = tramoDiv.querySelector('[data-field="fecha"]');
        if (fechaInputEdit) {
          fechaInputEdit.addEventListener('change', () => {
            if (trabajadorSeleccionado) {
              void cargarInstanciasDisponibles(el.selectInstanciaTrabajo?.value || null);
            }
          });
        }
      });

      if (trabajadorSeleccionado) {
        await cargarInstanciasDisponibles(periodoPreferido || null);
      }
    } else {
      agregarTramo();
      if (trabajadorSeleccionado) {
        await cargarInstanciasDisponibles();
      }
    }
  } catch (error) {
    console.error('[VIAJES] Error preparando edición:', error);
    mostrarError(error.message || 'Error al cargar el viaje');
  }
};

window.editarViaje = window.prepararEdicionViaje;

// ============================================
// OCULTAR VIAJE
// ============================================
window.confirmarOcultarViaje = function(idViaje) {
  if (!canManageViajes()) {
    mostrarError('No tiene permisos para desactivar viajes');
    return;
  }

  const viaje = viajes.find(v => v.id_viaje === idViaje);
  if (!viaje) return;
  
  document.getElementById('confirm-title').textContent = 'Ocultar Viaje';
  document.getElementById('confirm-message').textContent = 
    `¿Desea ocultar el viaje de ${viaje.nombres} ${viaje.apellidos}? El viaje no se eliminará, solo se ocultará de la vista de próximos viajes.`;
  
  document.getElementById('confirm-ok').onclick = () => ocultarViaje(idViaje);
  
  openManagedModal(el.modalConfirm);
};

async function ocultarViaje(idViaje) {
  try {
    closeManagedModal(el.modalConfirm);
    
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
// ELIMINAR VIAJE (VIA COMPONENTE UNIVERSAL)
// ============================================
window.confirmarEliminarViaje = function(idViaje) {
  if (!isSuperAdminSession()) {
    mostrarError('Solo un Super Administrador puede eliminar viajes permanentemente');
    return;
  }

  const viaje = viajes.find(v => v.id_viaje === idViaje);
  if (!viaje) return;
  
  if (window.basaltoSecurity && window.basaltoSecurity.requireHardDelete) {
    window.basaltoSecurity.requireHardDelete({
      title: "Eliminar Viaje Físicamente",
      message: `¿Está seguro de eliminar el viaje de ${viaje.nombres} ${viaje.apellidos}? Esta acción borrará todos sus tramos y no se puede deshacer.`,
      onConfirm: () => eliminarViaje(idViaje)
    });
  } else {
    mostrarError('Error interno: Componente de seguridad no disponible.');
  }
};

async function eliminarViaje(idViaje) {
  try {
    if (!isSuperAdminSession()) {
      throw new Error('Solo un Super Administrador puede eliminar viajes permanentemente');
    }

    closeManagedModal(el.modalConfirm);
    
    const rutSolicitante = localStorage.getItem('user_rut') || '';
    const response = await fetch(`/api/viajes/${idViaje}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'rut_solicitante': rutSolicitante }
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
  openManagedModal(el.modalResult);
}

function mostrarError(mensaje) {
  document.getElementById('result-icon').innerHTML = '<i class="fa-solid fa-circle-xmark" style="color:#ef4444;"></i>';
  document.getElementById('result-title').textContent = 'Error';
  document.getElementById('result-message').textContent = mensaje;
  openManagedModal(el.modalResult);
}

// ============================================
// GESTIÓN DE TICKETS PDF
// ============================================

/** Abre el endpoint de descarga en una nueva pestaña (para admins) */
window.descargarTicketAdmin = function(idViaje) {
  const rut = localStorage.getItem('user_rut') || '';
  window.open(`/api/viajes/download-ticket/${idViaje}?rut=${encodeURIComponent(rut)}`, '_blank');
};

/** Upload desde el botón inline de la tarjeta */
window.uploadTicketFromCard = async function(idViaje, inputEl) {
  if (!inputEl.files.length) return;
  const file = inputEl.files[0];
  if (file.type !== 'application/pdf') {
    mostrarError('Solo se permiten archivos PDF');
    inputEl.value = '';
    return;
  }
  try {
    const formData = new FormData();
    formData.append('ticket', file);
    const response = await fetch(`/api/viajes/${idViaje}/upload-ticket`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al subir el ticket');
    mostrarExito('Ticket subido exitosamente');
    await cargarViajes();
  } catch (error) {
    console.error('[TICKET] Error subiendo ticket:', error);
    mostrarError(error.message || 'Error al subir el ticket');
  }
};

/**
 * Confirma antes de borrar el ticket.
 * SuperAdmin → requireHardDelete (doble confirmación).
 * Admin soft_delete → modal confirm simple.
 */
window.confirmarBorrarTicket = function(idViaje) {
  const viaje = viajes.find(v => v.id_viaje === idViaje);
  if (!viaje) return;

  if (isSuperAdminSession()) {
    if (window.basaltoSecurity?.requireHardDelete) {
      window.basaltoSecurity.requireHardDelete({
        title: 'Eliminar Ticket Permanentemente',
        message: `¿Eliminar el ticket del viaje de ${viaje.nombres} ${viaje.apellidos}? El archivo se borrará del servidor y no se puede recuperar.`,
        onConfirm: () => borrarTicket(idViaje)
      });
    } else {
      mostrarError('Error interno: componente de seguridad no disponible');
    }
  } else {
    document.getElementById('confirm-title').textContent = 'Archivar Ticket';
    document.getElementById('confirm-message').textContent =
      `¿Archivar el ticket del viaje de ${viaje.nombres} ${viaje.apellidos}? El archivo se moverá a la carpeta de archivados.`;
    document.getElementById('confirm-ok').onclick = () => {
      closeManagedModal(el.modalConfirm);
      borrarTicket(idViaje);
    };
    openManagedModal(el.modalConfirm);
  }
};

async function borrarTicket(idViaje) {
  try {
    const rutSolicitante = localStorage.getItem('user_rut') || '';
    const response = await fetch(`/api/viajes/${idViaje}/ticket`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'rut_solicitante': rutSolicitante }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error al eliminar el ticket');
    mostrarExito(data.message || 'Ticket eliminado');
    await cargarViajes();
  } catch (error) {
    console.error('[TICKET] Error borrando ticket:', error);
    mostrarError(error.message || 'Error al eliminar el ticket');
  }
}
