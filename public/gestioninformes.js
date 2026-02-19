// ============================================
// GESTIÓN DE INFORMES - Sistema de Administración
// ============================================

let informes = [];
let trabajadores = [];
let informeEditando = null;
let accionPendiente = null;

// Elementos del DOM
const el = {
  accordionInformes: null,
  sinInformes: null,
  filtroOperador: null,
  filtroFechaDesde: null,
  filtroFechaHasta: null,
  filtroEstado: null,
  btnAplicarFiltros: null,
  modalEditarInforme: null,
  modalConfirmar: null,
  btnGuardarEdicion: null,
  btnConfirmarAccion: null
};

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[INFORMES] Iniciando aplicación...');
  
  // Obtener referencias a elementos del DOM
  el.accordionInformes = document.getElementById('accordion-informes');
  el.sinInformes = document.getElementById('sin-informes');
  el.filtroOperador = document.getElementById('filtro-operador');
  el.filtroFechaDesde = document.getElementById('filtro-fecha-desde');
  el.filtroFechaHasta = document.getElementById('filtro-fecha-hasta');
  el.filtroEstado = document.getElementById('filtro-estado');
  el.btnAplicarFiltros = document.getElementById('btn-aplicar-filtros');
  el.btnGuardarEdicion = document.getElementById('btn-guardar-edicion');
  el.btnConfirmarAccion = document.getElementById('btn-confirmar-accion');
  
  // Inicializar modales de Bootstrap
  el.modalEditarInforme = new bootstrap.Modal(document.getElementById('modal-editar-informe'));
  el.modalConfirmar = new bootstrap.Modal(document.getElementById('modal-confirmar'));
  
  // Cargar datos iniciales
  await Promise.all([
    cargarTrabajadores(),
    cargarInformes()
  ]);
  
  // Event listeners
  el.btnAplicarFiltros.addEventListener('click', () => cargarInformes());
  el.btnGuardarEdicion.addEventListener('click', guardarEdicionInforme);
  el.btnConfirmarAccion.addEventListener('click', ejecutarAccionPendiente);
  
  // Filtro en tiempo real para operador
  el.filtroOperador.addEventListener('input', () => cargarInformes());
  
  console.log('[INFORMES] Aplicación lista');
});

// ============================================
// CARGAR DATOS
// ============================================
async function cargarTrabajadores() {
  try {
    const response = await fetch('/datos');
    if (!response.ok) throw new Error('Error al cargar trabajadores');
    trabajadores = await response.json();
    console.log('[INFORMES] Trabajadores cargados:', trabajadores.length);
  } catch (error) {
    console.error('[INFORMES] Error cargando trabajadores:', error);
    mostrarError('Error al cargar la lista de trabajadores');
  }
}

async function cargarInformes() {
  try {
    // Construir URL con filtros
    let url = '/api/informes';
    const params = new URLSearchParams();
    
    if (el.filtroOperador && el.filtroOperador.value.trim()) {
      params.append('operador', el.filtroOperador.value.trim());
    }
    
    if (el.filtroFechaDesde && el.filtroFechaDesde.value) {
      params.append('desde', el.filtroFechaDesde.value);
    }
    
    if (el.filtroFechaHasta && el.filtroFechaHasta.value) {
      params.append('hasta', el.filtroFechaHasta.value);
    }
    
    if (el.filtroEstado) {
      params.append('estado', el.filtroEstado.value);
    }
    
    if (params.toString()) {
      url += '?' + params.toString();
    }
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al cargar informes');
    informes = await response.json();
    console.log('[INFORMES] Informes cargados:', informes.length);
    renderInformes();
  } catch (error) {
    console.error('[INFORMES] Error cargando informes:', error);
    mostrarError('Error al cargar la lista de informes');
  }
}

// ============================================
// RENDERIZAR INFORMES
// ============================================
function renderInformes() {
  if (!el.accordionInformes) return;
  
  el.accordionInformes.innerHTML = '';
  
  if (informes.length === 0) {
    el.sinInformes.style.display = 'block';
    return;
  }
  
  el.sinInformes.style.display = 'none';
  
  informes.forEach((informe, index) => {
    const accordionItem = crearAccordionItem(informe, index);
    el.accordionInformes.appendChild(accordionItem);
  });
}

function crearAccordionItem(informe, index) {
  const div = document.createElement('div');
  div.className = 'accordion-item';
  
  // Obtener nombre del operador
  const operador = trabajadores.find(t => t.RUT === informe.operador_rut);
  const nombreOperador = operador 
    ? `${operador.nombres} ${operador.apellido_paterno || ''} ${operador.apellido_materno || ''}`.trim()
    : informe.operador_rut || 'N/A';
  
  // Formatear fecha
  const fecha = informe.fecha ? new Date(informe.fecha).toLocaleDateString('es-CL') : 'N/A';
  
  // Estado
  const estadoBadge = informe.estado === 'activo' || informe.estado === 1
    ? '<span class="badge-activo">Activo</span>'
    : '<span class="badge-inactivo">Inactivo</span>';
  
  // Turno icon
  const turnoIcon = informe.turno === 'Día' 
    ? '<i class="fa-solid fa-sun" style="color: #f59e0b;"></i>' 
    : '<i class="fa-solid fa-moon" style="color: #6366f1;"></i>';
  
  div.innerHTML = `
    <h2 class="accordion-header" id="heading-${index}">
      <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${index}" aria-expanded="false" aria-controls="collapse-${index}">
        <div style="display: flex; align-items: center; gap: 16px; width: 100%;">
          <span>📅 ${fecha}</span>
          <span>👷 ${nombreOperador}</span>
          <span>${turnoIcon} ${informe.turno || 'N/A'}</span>
          <span style="margin-left: auto;">${estadoBadge}</span>
        </div>
      </button>
    </h2>
    <div id="collapse-${index}" class="accordion-collapse collapse" aria-labelledby="heading-${index}" data-bs-parent="#accordion-informes">
      <div class="accordion-body">
        <div id="detalles-informe-${informe.id_informe}">
          <div class="text-center">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Cargando...</span>
            </div>
          </div>
        </div>
        
        <!-- Botones de Acción -->
        <div style="display: flex; gap: 12px; margin-top: 20px; padding-top: 16px; border-top: 2px solid #e5e7eb;">
          <button class="btn-editar" onclick="editarInforme(${informe.id_informe})">
            <i class="fa-solid fa-edit"></i> Editar
          </button>
          ${informe.estado === 'activo' || informe.estado === 1
            ? `<button class="btn-soft-delete" onclick="confirmarSoftDelete(${informe.id_informe})">
                <i class="fa-solid fa-trash-can"></i> Mover a Papelera
               </button>`
            : `<button class="btn-restaurar" onclick="confirmarRestaurar(${informe.id_informe})">
                <i class="fa-solid fa-trash-restore"></i> Restaurar
               </button>
               <button class="btn-hard-delete" onclick="confirmarHardDelete(${informe.id_informe})">
                <i class="fa-solid fa-trash"></i> Eliminar Permanente
               </button>`
          }
        </div>
      </div>
    </div>
  `;
  
  // Agregar listener para cargar detalles cuando se expande
  const collapseElement = div.querySelector(`#collapse-${index}`);
  collapseElement.addEventListener('show.bs.collapse', () => {
    cargarDetallesInforme(informe.id_informe);
  });
  
  return div;
}

// ============================================
// CARGAR DETALLES DEL INFORME
// ============================================
async function cargarDetallesInforme(idInforme) {
  const contenedor = document.getElementById(`detalles-informe-${idInforme}`);
  if (!contenedor) return;
  
  try {
    const response = await fetch(`/api/informes/${idInforme}/detalles`);
    if (!response.ok) throw new Error('Error al cargar detalles');
    
    const detalles = await response.json();
    
    // Renderizar información general
    let html = '<div class="info-grid">';
    html += crearInfoItem('Número de Informe', detalles.informe.numero_informe);
    html += crearInfoItem('Faena', detalles.informe.faena);
    html += crearInfoItem('Lugar', detalles.informe.lugar);
    html += crearInfoItem('Equipo', detalles.informe.equipo);
    html += crearInfoItem('Pozo Número', detalles.informe.pozo_numero);
    html += crearInfoItem('Sector', detalles.informe.sector);
    html += crearInfoItem('Horas Trabajadas', detalles.informe.horas_trabajadas);
    html += crearInfoItem('Metros Perforados', detalles.informe.mts_perforados);
    html += '</div>';
    
    // Actividades
    if (detalles.actividades && detalles.actividades.length > 0) {
      html += '<div class="section-title">Actividades del Turno</div>';
      html += '<table class="table table-detail table-striped">';
      html += '<thead><tr><th>Hora Desde</th><th>Hora Hasta</th><th>Detalle</th><th>Hrs BD</th><th>Hrs Cliente</th></tr></thead>';
      html += '<tbody>';
      detalles.actividades.forEach(act => {
        html += `<tr>
          <td>${act.hora_desde || '-'}</td>
          <td>${act.hora_hasta || '-'}</td>
          <td>${act.detalle || '-'}</td>
          <td>${act.hrs_bd || '-'}</td>
          <td>${act.hrs_cliente || '-'}</td>
        </tr>`;
      });
      html += '</tbody></table>';
    }
    
    // Herramientas
    if (detalles.herramientas && detalles.herramientas.length > 0) {
      html += '<div class="section-title">Herramientas Utilizadas</div>';
      html += '<table class="table table-detail table-striped">';
      html += '<thead><tr><th>Tipo Elemento</th><th>Diámetro</th><th>Número Serie</th><th>Desde (mts)</th><th>Hasta (mts)</th><th>Detalle</th></tr></thead>';
      html += '<tbody>';
      detalles.herramientas.forEach(herr => {
        html += `<tr>
          <td>${herr.tipo_elemente || '-'}</td>
          <td>${herr.diametro || '-'}</td>
          <td>${herr.numero_serie || '-'}</td>
          <td>${herr.desde_mts || '-'}</td>
          <td>${herr.hasta_mts || '-'}</td>
          <td>${herr.detalle_extra || '-'}</td>
        </tr>`;
      });
      html += '</tbody></table>';
    }
    
    // Perforaciones
    if (detalles.perforaciones && detalles.perforaciones.length > 0) {
      html += '<div class="section-title">Perforaciones</div>';
      html += '<table class="table table-detail table-striped">';
      html += '<thead><tr><th>Desde (mts)</th><th>Hasta (mts)</th><th>Mts Perforados</th><th>Recuperación</th><th>Tipo Roca</th><th>Dureza</th></tr></thead>';
      html += '<tbody>';
      detalles.perforaciones.forEach(perf => {
        html += `<tr>
          <td>${perf.desde_mts || '-'}</td>
          <td>${perf.hasta_mts || '-'}</td>
          <td>${perf.mts_perforados || '-'}</td>
          <td>${perf.recuperacion || '-'}</td>
          <td>${perf.tipo_rocka || '-'}</td>
          <td>${perf.dureza || '-'}</td>
        </tr>`;
      });
      html += '</tbody></table>';
    }
    
    // Observaciones
    if (detalles.informe.observaciones) {
      html += '<div class="section-title">Observaciones</div>';
      html += `<div style="background-color: #f9fafb; padding: 12px; border-radius: 6px; border-left: 4px solid #4f46e5;">
        <p style="margin: 0; white-space: pre-wrap;">${detalles.informe.observaciones}</p>
      </div>`;
    }
    
    contenedor.innerHTML = html;
  } catch (error) {
    console.error('[INFORMES] Error cargando detalles:', error);
    contenedor.innerHTML = '<div class="alert alert-danger">Error al cargar los detalles del informe</div>';
  }
}

function crearInfoItem(label, value) {
  return `
    <div class="info-item">
      <span class="label">${label}:</span>
      <span class="value">${value || '-'}</span>
    </div>
  `;
}

// ============================================
// EDITAR INFORME
// ============================================
async function editarInforme(idInforme) {
  try {
    const response = await fetch(`/api/informes/${idInforme}`);
    if (!response.ok) throw new Error('Error al cargar informe');
    
    const informe = await response.json();
    informeEditando = informe;
    
    // Cargar datos en el formulario
    document.getElementById('edit-id-informe').value = informe.id_informe;
    document.getElementById('edit-numero-informe').value = informe.numero_informe || '';
    document.getElementById('edit-fecha').value = informe.fecha ? informe.fecha.split('T')[0] : '';
    document.getElementById('edit-turno').value = informe.turno || 'Día';
    document.getElementById('edit-horas-trabajadas').value = informe.horas_trabajadas || '';
    document.getElementById('edit-faena').value = informe.faena || '';
    document.getElementById('edit-lugar').value = informe.lugar || '';
    document.getElementById('edit-equipo').value = informe.equipo || '';
    document.getElementById('edit-operador-rut').value = informe.operador_rut || '';
    document.getElementById('edit-ayudante-1').value = informe.ayudante_1 || '';
    document.getElementById('edit-ayudante-2').value = informe.ayudante_2 || '';
    document.getElementById('edit-pozo-numero').value = informe.pozo_numero || '';
    document.getElementById('edit-sector').value = informe.sector || '';
    document.getElementById('edit-diametro').value = informe.diametro || '';
    document.getElementById('edit-inclinacion').value = informe.inclinacion || '';
    document.getElementById('edit-profundidad-inicial').value = informe.profundidad_inicial || '';
    document.getElementById('edit-profundidad-final').value = informe.profundidad_final || '';
    document.getElementById('edit-mts-perforados').value = informe.mts_perforados || '';
    document.getElementById('edit-pull-down').value = informe.pull_down || '';
    document.getElementById('edit-rpm').value = informe.rpm || '';
    document.getElementById('edit-horometro-inicial').value = informe.horometro_inicial || '';
    document.getElementById('edit-horometro-final').value = informe.horometro_final || '';
    document.getElementById('edit-horometro-hrs').value = informe.horometro_hrs || '';
    document.getElementById('edit-insumo-petroleo').value = informe.insumo_petroleo || '';
    document.getElementById('edit-insumo-lubricantes').value = informe.insumo_lubricantes || '';
    document.getElementById('edit-observaciones').value = informe.observaciones || '';
    
    // Mostrar modal
    el.modalEditarInforme.show();
  } catch (error) {
    console.error('[INFORMES] Error al cargar informe para editar:', error);
    mostrarError('Error al cargar el informe para edición');
  }
}

async function guardarEdicionInforme() {
  try {
    const idInforme = document.getElementById('edit-id-informe').value;
    
    const datosActualizados = {
      numero_informe: document.getElementById('edit-numero-informe').value,
      fecha: document.getElementById('edit-fecha').value,
      turno: document.getElementById('edit-turno').value,
      horas_trabajadas: document.getElementById('edit-horas-trabajadas').value || null,
      faena: document.getElementById('edit-faena').value,
      lugar: document.getElementById('edit-lugar').value,
      equipo: document.getElementById('edit-equipo').value,
      operador_rut: document.getElementById('edit-operador-rut').value,
      ayudante_1: document.getElementById('edit-ayudante-1').value,
      ayudante_2: document.getElementById('edit-ayudante-2').value,
      pozo_numero: document.getElementById('edit-pozo-numero').value,
      sector: document.getElementById('edit-sector').value,
      diametro: document.getElementById('edit-diametro').value,
      inclinacion: document.getElementById('edit-inclinacion').value,
      profundidad_inicial: document.getElementById('edit-profundidad-inicial').value || null,
      profundidad_final: document.getElementById('edit-profundidad-final').value || null,
      mts_perforados: document.getElementById('edit-mts-perforados').value || null,
      pull_down: document.getElementById('edit-pull-down').value,
      rpm: document.getElementById('edit-rpm').value,
      horometro_inicial: document.getElementById('edit-horometro-inicial').value || null,
      horometro_final: document.getElementById('edit-horometro-final').value || null,
      horometro_hrs: document.getElementById('edit-horometro-hrs').value || null,
      insumo_petroleo: document.getElementById('edit-insumo-petroleo').value,
      insumo_lubricantes: document.getElementById('edit-insumo-lubricantes').value,
      observaciones: document.getElementById('edit-observaciones').value
    };
    
    const response = await fetch(`/api/informes/${idInforme}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datosActualizados)
    });
    
    if (!response.ok) throw new Error('Error al actualizar informe');
    
    // Cerrar modal y recargar
    el.modalEditarInforme.hide();
    await cargarInformes();
    mostrarExito('Informe actualizado correctamente');
  } catch (error) {
    console.error('[INFORMES] Error al guardar edición:', error);
    mostrarError('Error al guardar los cambios');
  }
}

// ============================================
// ELIMINACIÓN (SOFT/HARD DELETE)
// ============================================
function confirmarSoftDelete(idInforme) {
  accionPendiente = {
    tipo: 'soft-delete',
    idInforme: idInforme
  };
  
  document.getElementById('modal-confirmar-titulo').textContent = 'Mover a Papelera';
  document.getElementById('modal-confirmar-mensaje').textContent = '¿Estás seguro de que deseas mover este informe a la papelera? Podrás restaurarlo más tarde.';
  
  el.modalConfirmar.show();
}

function confirmarHardDelete(idInforme) {
  accionPendiente = {
    tipo: 'hard-delete',
    idInforme: idInforme
  };
  
  document.getElementById('modal-confirmar-titulo').textContent = 'Eliminar Permanentemente';
  document.getElementById('modal-confirmar-mensaje').textContent = '⚠️ Esta acción es IRREVERSIBLE. ¿Estás seguro de que deseas eliminar permanentemente este informe?';
  
  el.modalConfirmar.show();
}

function confirmarRestaurar(idInforme) {
  accionPendiente = {
    tipo: 'restaurar',
    idInforme: idInforme
  };
  
  document.getElementById('modal-confirmar-titulo').textContent = 'Restaurar Informe';
  document.getElementById('modal-confirmar-mensaje').textContent = '¿Deseas restaurar este informe desde la papelera?';
  
  el.modalConfirmar.show();
}

async function ejecutarAccionPendiente() {
  if (!accionPendiente) return;
  
  try {
    const { tipo, idInforme } = accionPendiente;
    
    if (tipo === 'soft-delete') {
      await softDeleteInforme(idInforme);
    } else if (tipo === 'hard-delete') {
      await hardDeleteInforme(idInforme);
    } else if (tipo === 'restaurar') {
      await restaurarInforme(idInforme);
    }
    
    el.modalConfirmar.hide();
    accionPendiente = null;
    await cargarInformes();
  } catch (error) {
    console.error('[INFORMES] Error al ejecutar acción:', error);
    mostrarError('Error al ejecutar la acción');
  }
}

async function softDeleteInforme(idInforme) {
  const response = await fetch(`/api/informes/${idInforme}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: 'inactivo' })
  });
  
  if (!response.ok) throw new Error('Error al mover a papelera');
  mostrarExito('Informe movido a la papelera');
}

async function hardDeleteInforme(idInforme) {
  const response = await fetch(`/api/informes/${idInforme}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) throw new Error('Error al eliminar permanentemente');
  mostrarExito('Informe eliminado permanentemente');
}

async function restaurarInforme(idInforme) {
  const response = await fetch(`/api/informes/${idInforme}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado: 'activo' })
  });
  
  if (!response.ok) throw new Error('Error al restaurar');
  mostrarExito('Informe restaurado correctamente');
}

// ============================================
// UTILIDADES
// ============================================
function mostrarError(mensaje) {
  alert('❌ ' + mensaje);
}

function mostrarExito(mensaje) {
  alert('✅ ' + mensaje);
}
