// IMPORTAR CONFIGURACIÓN
// NOTA: Para cambiar la fecha de inicio del ciclo, modifica FECHA_BASE en config.js
// La fecha de inicio por defecto es 2 de enero de 2026
// Los trabajadores trabajan 14 días consecutivos (de lunes a domingo) y descansan 14 días
// Los turnos cambian cada 14 días consecutivos
import { FECHA_BASE, GRUPOS, COLORES } from './config.js';

// Configuración y estado global
let trabajadores = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let today = new Date();
today.setHours(0, 0, 0, 0);

// Fecha de inicio del ciclo de turnos (modificable en config.js)
const FECHA_INICIO_CICLO = new Date(FECHA_BASE);
FECHA_INICIO_CICLO.setHours(0, 0, 0, 0);

// Días por ciclo (14 días consecutivos, de lunes a domingo)
const DIAS_POR_CICLO = 14;
const DIAS_POR_CICLO_COMPLETO = DIAS_POR_CICLO * 2; // 28 días = 1 ciclo completo

// Secuencia de turnos (cada ciclo de 14 días consecutivos)
// Ciclo 1 (días 1-14): A mañana, B tarde
// Ciclo 2 (días 15-28): C mañana, D tarde  
// Ciclo 3 (días 29-42): B mañana, A tarde
// Ciclo 4 (días 43-56): D mañana, C tarde
// Y se repite...

// Nombres de meses en español
const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Nombres de días de la semana
const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Feriados nacionales chilenos e irrenunciables 2026
const feriados2026 = [
  '2026-01-01', // Año Nuevo
  '2026-04-18', // Viernes Santo
  '2026-04-19', // Sábado Santo
  '2026-05-01', // Día del Trabajador
  '2026-05-21', // Día de las Glorias Navales
  '2026-06-29', // San Pedro y San Pablo
  '2026-07-16', // Virgen del Carmen
  '2026-08-15', // Asunción de la Virgen
  '2026-09-18', // Independencia Nacional
  '2026-09-19', // Día del Ejército
  '2026-10-12', // Encuentro de Dos Mundos
  '2026-10-31', // Día de las Iglesias Evangélicas y Protestantes
  '2026-11-01', // Todos los Santos
  '2026-12-08', // Inmaculada Concepción
  '2026-12-25', // Navidad
  '2026-12-31', // Fiestas Patrias (móvil puede variar)
];

// Días de la semana en español para comparación
const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];


// Función para contar días consecutivos entre dos fechas (incluye todos los días de la semana)
function contarDiasConsecutivos(desde, hasta) {
  let contador = 0;
  const fechaActual = new Date(desde);
  const fechaFin = new Date(hasta);
  
  while (fechaActual <= fechaFin) {
    contador++;
    fechaActual.setDate(fechaActual.getDate() + 1);
  }
  
  return contador;
}

// Función para determinar qué grupos trabajan en una fecha específica
function obtenerGruposDelDia(fecha) {
  const fechaCopy = new Date(fecha);
  fechaCopy.setHours(0, 0, 0, 0);
  
  // Fecha de inicio del ciclo (2 de enero de 2026)
  const fechaInicio = new Date(FECHA_INICIO_CICLO);
  fechaInicio.setHours(0, 0, 0, 0);
  
  // Contar días consecutivos desde el inicio hasta la fecha actual
  const diasTranscurridos = contarDiasConsecutivos(fechaInicio, fechaCopy);
  
  // Determinar en qué subciclo de 14 días estamos
  const subciclo = Math.floor(diasTranscurridos / DIAS_POR_CICLO) % 4;
  
  // Determinar qué grupos trabajan según el subciclo
  let grupoManana, grupoTarde;
  switch (subciclo) {
    case 0: // Días 0-13 (primeros 14 días consecutivos)
      grupoManana = 'A';
      grupoTarde = 'B';
      break;
    case 1: // Días 14-27 (siguientes 14 días consecutivos)
      grupoManana = 'C';
      grupoTarde = 'D';
      break;
    case 2: // Días 28-41 (siguientes 14 días consecutivos)
      grupoManana = 'B';
      grupoTarde = 'A';
      break;
    case 3: // Días 42-55 (siguientes 14 días consecutivos)
      grupoManana = 'D';
      grupoTarde = 'C';
      break;
  }
  
  return { manana: grupoManana, tarde: grupoTarde };
}

// Elementos DOM (se inicializan después de que el DOM esté listo)
let monthYearEl, daysGridEl, prevMonthBtn, nextMonthBtn, btnHoy, fechaHoyEl;
let gruposLeyendaEl, modalEl, closeModalEl, modalDateTitleEl, modalDateSubtitleEl;
let trabajadoresDiaEl, btnGuardar, btnGestionar, btnAgregar, btnRecargar, btnSalir;
let confirmModalEl, confirmTitleEl, confirmMessageEl, confirmOkBtn, confirmCancelBtn;
let addWorkerModalEl, formAgregarTrabajador, closeAddModalEl, cancelAddBtn;

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Iniciando aplicación...');
    
    // Inicializar referencias a elementos DOM
    monthYearEl = document.getElementById('month-year');
    daysGridEl = document.getElementById('days-grid');
    prevMonthBtn = document.getElementById('prev-month');
    nextMonthBtn = document.getElementById('next-month');
    btnHoy = document.getElementById('btn-hoy');
    fechaHoyEl = document.getElementById('fecha-hoy');
    gruposLeyendaEl = document.getElementById('grupos-leyenda');
    modalEl = document.getElementById('day-modal');
    closeModalEl = document.querySelector('#day-modal .close-modal');
    modalDateTitleEl = document.getElementById('modal-date-title');
    modalDateSubtitleEl = document.getElementById('modal-date-subtitle');
    trabajadoresDiaEl = document.getElementById('trabajadores-del-dia');
    btnGuardar = document.getElementById('btn-guardar');
    btnGestionar = document.getElementById('btn-gestionar');
    btnAgregar = document.getElementById('btn-agregar');
    btnRecargar = document.getElementById('btn-recargar');
    btnSalir = document.getElementById('btn-salir');
    confirmModalEl = document.getElementById('confirm-modal');
    confirmTitleEl = document.getElementById('confirm-title');
    confirmMessageEl = document.getElementById('confirm-message');
    confirmOkBtn = document.getElementById('confirm-ok');
    confirmCancelBtn = document.getElementById('confirm-cancel');
    addWorkerModalEl = document.getElementById('add-worker-modal');
    formAgregarTrabajador = document.getElementById('form-agregar-trabajador');
    closeAddModalEl = document.getElementById('close-add-modal');
    cancelAddBtn = document.getElementById('cancel-add');

    // Verificar que todos los elementos existan
    const elementosFaltantes = [];
    if (!monthYearEl) elementosFaltantes.push('month-year');
    if (!daysGridEl) elementosFaltantes.push('days-grid');
    if (!btnGuardar) elementosFaltantes.push('btn-guardar');
    if (!btnAgregar) elementosFaltantes.push('btn-agregar');
    
    if (elementosFaltantes.length > 0) {
      console.error('Error: No se pudieron encontrar algunos elementos del DOM:', elementosFaltantes);
      alert('Error: No se pudieron encontrar algunos elementos del DOM. Ver la consola para más detalles.');
      return;
    }

    console.log('Elementos DOM cargados correctamente');
    
    await cargarTrabajadores();
    console.log('Trabajadores cargados:', trabajadores.length);
    
    actualizarFechaHoy();
    console.log('Fecha actualizada');
    
    renderCalendar();
    console.log('Calendario renderizado');
    
    renderLeyenda();
    console.log('Leyenda renderizada');
    
    setupEventListeners();
    console.log('Event listeners configurados');
    
    console.log('Aplicación iniciada correctamente');
  } catch (error) {
    console.error('Error al inicializar la aplicación:', error);
    console.error('Stack trace:', error.stack);
    alert('Error al inicializar la aplicación: ' + error.message + '. Ver la consola para más detalles.');
  }
});

// Event listeners
function setupEventListeners() {
  prevMonthBtn.addEventListener('click', () => cambiarMes(-1));
  nextMonthBtn.addEventListener('click', () => cambiarMes(1));
  btnHoy.addEventListener('click', volverAHoy);
  closeModalEl.addEventListener('click', cerrarModal);
  
  // Cerrar modal al hacer clic fuera
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) cerrarModal();
  });

  // Botones del sidebar
  btnGuardar.addEventListener('click', guardarCambios);
  btnRecargar.addEventListener('click', recargarDatos);
  btnSalir.addEventListener('click', salirYcerrar);
  btnAgregar.addEventListener('click', abrirModalAgregarTrabajador);
  
  // Modal agregar trabajador
  closeAddModalEl.addEventListener('click', cerrarModalAgregar);
  cancelAddBtn.addEventListener('click', cerrarModalAgregar);
  addWorkerModalEl.addEventListener('click', (e) => {
    if (e.target === addWorkerModalEl) cerrarModalAgregar();
  });
  formAgregarTrabajador.addEventListener('submit', handleAgregarTrabajador);
  
  // Validación en tiempo real para RUT (solo números, máximo 9 dígitos)
  const rutInput = document.getElementById('rut');
  if (rutInput) {
    rutInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 9);
    });
  }
  
  // Validación en tiempo real para teléfono (solo números, máximo 9 dígitos)
  const telefonoInput = document.getElementById('telefono');
  if (telefonoInput) {
    telefonoInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 9);
    });
  }
}

// Funciones de carga de datos
async function cargarTrabajadores() {
  try {
    const response = await fetch('/datos');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    trabajadores = await response.json();
    if (!Array.isArray(trabajadores)) {
      console.warn('Los trabajadores no son un array, inicializando como array vacío');
      trabajadores = [];
    }
  } catch (error) {
    console.error('Error al cargar trabajadores:', error);
    trabajadores = [];
  }
}

function actualizarFechaHoy() {
  if (!fechaHoyEl) {
    console.error('Error: fechaHoyEl no está definido');
    return;
  }
  
  const dia = today.getDate();
  const mes = today.getMonth() + 1;
  const año = today.getFullYear();
  fechaHoyEl.textContent = `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${año}`;
}

// Navegación del calendario
function cambiarMes(delta) {
  currentMonth += delta;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  } else if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar();
}

function volverAHoy() {
  currentMonth = today.getMonth();
  currentYear = today.getFullYear();
  renderCalendar();
}

// Renderizar calendario
function renderCalendar() {
  if (!monthYearEl || !daysGridEl) {
    console.error('Error: monthYearEl o daysGridEl no están definidos');
    return;
  }
  
  monthYearEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;
  daysGridEl.innerHTML = '';

  // Primer día del mes y día de la semana
  const firstDay = new Date(currentYear, currentMonth, 1);
  const firstDayWeek = firstDay.getDay(); // 0 = Domingo, 1 = Lunes, etc.
  
  // Ajustar para que la semana empiece en Lunes (1)
  let startDay = firstDayWeek === 0 ? 6 : firstDayWeek - 1;

  // Último día del mes
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Días del mes anterior
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

  // Agregar días del mes anterior
  for (let i = startDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    crearDiaCelda(day, prevMonth, prevYear, true);
  }

  // Agregar días del mes actual
  for (let day = 1; day <= daysInMonth; day++) {
    crearDiaCelda(day, currentMonth, currentYear, false);
  }

  // Completar con días del mes siguiente
  const totalCells = daysGridEl.children.length;
  const remainingCells = 42 - totalCells; // 6 semanas * 7 días
  if (remainingCells > 0) {
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    for (let day = 1; day <= remainingCells; day++) {
      crearDiaCelda(day, nextMonth, nextYear, true);
    }
  }
}

// Crear celda de día
function crearDiaCelda(day, month, year, isOutsideMonth) {
  const date = new Date(year, month, day);
  date.setHours(0, 0, 0, 0);
  
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const isHoliday = feriados2026.includes(dateStr);
  const isToday = !isOutsideMonth && date.getTime() === today.getTime();
  const dayOfWeek = date.getDay();
  const nombreDia = diasSemana[dayOfWeek];

  // Obtener trabajadores del día según la lógica de turnos
  const trabajadoresDelDia = obtenerTrabajadoresDelDia(date);

  // Crear celda
  const dayCell = document.createElement('div');
  dayCell.className = 'day-cell split';
  if (isOutsideMonth) {
    dayCell.classList.add('outside-month');
  } else {
    dayCell.classList.add('inside-month');
    if (isHoliday) {
      dayCell.classList.add('holiday');
    }
  }

  // Parte izquierda (número del día)
  const dayLeft = document.createElement('div');
  dayLeft.className = 'day-left';
  
  const dayNumber = document.createElement('span');
  dayNumber.className = 'day-number';
  dayNumber.textContent = day;
  dayLeft.appendChild(dayNumber);

  // Badge "HOY"
  if (isToday) {
    const hoyBadge = document.createElement('span');
    hoyBadge.className = 'hoy-badge';
    hoyBadge.textContent = 'HOY';
    dayLeft.appendChild(hoyBadge);
  }

  // Click en parte izquierda abre modal (solo si es del mes actual)
  if (!isOutsideMonth) {
    dayLeft.addEventListener('click', () => abrirModalDia(date, nombreDia, trabajadoresDelDia));
  }

  // Parte derecha (bloques de grupos)
  const dayRight = document.createElement('div');
  dayRight.className = 'day-right';

  if (!isOutsideMonth && trabajadoresDelDia.length > 0) {
    // Ordenar trabajadores por horario (mañana primero, luego tarde)
    const trabajadoresOrdenados = [...trabajadoresDelDia].sort((a, b) => {
      if (a.horario === 'manana' && b.horario === 'tarde') return -1;
      if (a.horario === 'tarde' && b.horario === 'manana') return 1;
      return 0;
    });
    
    // Mostrar bloques por grupo (mañana arriba, tarde abajo)
    const gruposDelDia = obtenerGruposDelDia(date);
    
    if (gruposDelDia.manana) {
      const grupoBlock = document.createElement('div');
      grupoBlock.className = 'grupo-block manana';
      grupoBlock.style.backgroundColor = COLORES[gruposDelDia.manana];
      grupoBlock.textContent = gruposDelDia.manana;
      dayRight.appendChild(grupoBlock);
    }
    
    if (gruposDelDia.tarde) {
      const grupoBlock = document.createElement('div');
      grupoBlock.className = 'grupo-block tarde';
      grupoBlock.style.backgroundColor = COLORES[gruposDelDia.tarde];
      grupoBlock.textContent = gruposDelDia.tarde;
      dayRight.appendChild(grupoBlock);
    }
  }

  dayCell.appendChild(dayLeft);
  dayCell.appendChild(dayRight);
  daysGridEl.appendChild(dayCell);
}

// Obtener trabajadores que trabajan en un día específico según la lógica de turnos
function obtenerTrabajadoresDelDia(fecha) {
  const gruposDelDia = obtenerGruposDelDia(fecha);
  const trabajadoresDelDia = [];
  
  // Si no es día laborable, no hay trabajadores
  if (!gruposDelDia.manana && !gruposDelDia.tarde) {
    return [];
  }
  
  // Buscar trabajadores del grupo de la mañana
  if (gruposDelDia.manana) {
    const trabajadoresManana = trabajadores.filter(t => t.grupo === gruposDelDia.manana);
    trabajadoresManana.forEach(t => {
      trabajadoresDelDia.push({
        ...t,
        horario: 'manana',
        color: COLORES[gruposDelDia.manana]
      });
    });
  }
  
  // Buscar trabajadores del grupo de la tarde
  if (gruposDelDia.tarde) {
    const trabajadoresTarde = trabajadores.filter(t => t.grupo === gruposDelDia.tarde);
    trabajadoresTarde.forEach(t => {
      trabajadoresDelDia.push({
        ...t,
        horario: 'tarde',
        color: COLORES[gruposDelDia.tarde]
      });
    });
  }
  
  return trabajadoresDelDia;
}

// Modal de detalle del día
function abrirModalDia(date, nombreDia, trabajadoresDelDia) {
  const dia = date.getDate();
  const mes = monthNames[date.getMonth()];
  const año = date.getFullYear();
  
  modalDateTitleEl.textContent = `${nombreDia}, ${dia} de ${mes} de ${año}`;
  modalDateSubtitleEl.textContent = `Trabajadores asignados para este día`;

  trabajadoresDiaEl.innerHTML = '';

  if (trabajadoresDelDia.length === 0) {
    trabajadoresDiaEl.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 20px;">No hay trabajadores asignados para este día</p>';
  } else {
    // Separar por horario
    const manana = trabajadoresDelDia.filter(t => t.horario === 'manana');
    const tarde = trabajadoresDelDia.filter(t => t.horario === 'tarde');
    
    // Mostrar grupo de la mañana
    if (manana.length > 0) {
      const horarioLabel = document.createElement('div');
      horarioLabel.className = 'horario-label';
      horarioLabel.textContent = `Turno Mañana - Grupo ${manana[0].grupo}`;
      horarioLabel.style.marginTop = '10px';
      horarioLabel.style.marginBottom = '10px';
      trabajadoresDiaEl.appendChild(horarioLabel);
      
      manana.forEach(trabajador => {
        const item = document.createElement('div');
        item.className = 'trabajador-item manana';
        item.style.backgroundColor = trabajador.color;
        
        const nombre = document.createElement('div');
        nombre.style.fontSize = '16px';
        nombre.textContent = `${trabajador.nombre} ${trabajador.apellido}`;
        item.appendChild(nombre);

        const info = document.createElement('div');
        info.style.fontSize = '12px';
        info.style.opacity = '0.9';
        info.style.marginTop = '5px';
        info.textContent = `RUT: ${trabajador.rut} | Email: ${trabajador.email} | Tel: ${trabajador.telefono}`;
        item.appendChild(info);

        trabajadoresDiaEl.appendChild(item);
      });
    }
    
    // Mostrar grupo de la tarde
    if (tarde.length > 0) {
      const horarioLabel = document.createElement('div');
      horarioLabel.className = 'horario-label';
      horarioLabel.textContent = `Turno Tarde - Grupo ${tarde[0].grupo}`;
      horarioLabel.style.marginTop = '20px';
      horarioLabel.style.marginBottom = '10px';
      trabajadoresDiaEl.appendChild(horarioLabel);
      
      tarde.forEach(trabajador => {
        const item = document.createElement('div');
        item.className = 'trabajador-item tarde';
        item.style.backgroundColor = trabajador.color;
        
        const nombre = document.createElement('div');
        nombre.style.fontSize = '16px';
        nombre.textContent = `${trabajador.nombre} ${trabajador.apellido}`;
        item.appendChild(nombre);

        const info = document.createElement('div');
        info.style.fontSize = '12px';
        info.style.opacity = '0.9';
        info.style.marginTop = '5px';
        info.textContent = `RUT: ${trabajador.rut} | Email: ${trabajador.email} | Tel: ${trabajador.telefono}`;
        item.appendChild(info);

        trabajadoresDiaEl.appendChild(item);
      });
    }
  }

  modalEl.classList.add('show');
}

function cerrarModal() {
  modalEl.classList.remove('show');
}

// Renderizar leyenda de grupos
function renderLeyenda() {
  if (!gruposLeyendaEl) {
    console.error('Error: gruposLeyendaEl no está definido');
    return;
  }
  
  gruposLeyendaEl.innerHTML = '';
  
  // Mostrar grupos en orden A, B, C, D
  GRUPOS.forEach(grupo => {
    // Contar trabajadores del grupo
    const totalTrabajadores = trabajadores.filter(t => t.grupo === grupo).length;
    
    const grupoItem = document.createElement('div');
    grupoItem.className = 'grupo-item';
    
    const colorBox = document.createElement('div');
    colorBox.className = 'grupo-color';
    colorBox.style.backgroundColor = COLORES[grupo];
    
    const nombre = document.createElement('span');
    nombre.textContent = `Grupo ${grupo}: ${totalTrabajadores} trabajador${totalTrabajadores !== 1 ? 'es' : ''}`;
    
    grupoItem.appendChild(colorBox);
    grupoItem.appendChild(nombre);
    gruposLeyendaEl.appendChild(grupoItem);
  });
}

// Funciones de botones
async function guardarCambios() {
  try {
    const response = await fetch('/guardar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trabajadores)
    });
    const result = await response.text();
    mostrarConfirmacion(
      'Cambios guardados',
      result || 'Cambios guardados exitosamente',
      () => {},
      'primary'
    );
  } catch (error) {
    console.error('Error al guardar:', error);
    mostrarConfirmacion(
      'Error',
      'Error al guardar los cambios',
      () => {},
      'danger'
    );
  }
}

async function recargarDatos() {
  mostrarConfirmacion(
    'Recargar base de datos',
    '¿Está seguro que desea recargar la base de datos? Los cambios no guardados se perderán.',
    async () => {
      await cargarTrabajadores();
      renderCalendar();
      renderLeyenda();
      mostrarConfirmacion(
        'Base de datos recargada',
        'La base de datos ha sido recargada exitosamente',
        () => {},
        'primary'
      );
    },
    'primary'
  );
}

// Función de confirmación con modal
function mostrarConfirmacion(titulo, mensaje, onConfirm, tipoBoton = 'danger') {
  confirmTitleEl.textContent = titulo;
  confirmMessageEl.textContent = mensaje;
  confirmOkBtn.className = `confirm-btn confirm-btn-${tipoBoton}`;
  
  confirmModalEl.classList.add('show');
  
  const handleConfirm = () => {
    confirmModalEl.classList.remove('show');
    confirmOkBtn.removeEventListener('click', handleConfirm);
    confirmCancelBtn.removeEventListener('click', handleCancel);
    if (onConfirm) onConfirm();
  };
  
  const handleCancel = () => {
    confirmModalEl.classList.remove('show');
    confirmOkBtn.removeEventListener('click', handleConfirm);
    confirmCancelBtn.removeEventListener('click', handleCancel);
  };
  
  confirmOkBtn.addEventListener('click', handleConfirm);
  confirmCancelBtn.addEventListener('click', handleCancel);
  
  // Cerrar al hacer clic fuera del modal
  confirmModalEl.addEventListener('click', (e) => {
    if (e.target === confirmModalEl) {
      handleCancel();
    }
  });
}

async function salirYcerrar() {
  mostrarConfirmacion(
    'Cerrar aplicación',
    '¿Está seguro que desea salir y cerrar la aplicación?',
    async () => {
      try {
        await fetch('/cerrar', { method: 'POST' });
        // Intentar cerrar la ventana de múltiples formas
        if (window.opener) {
          window.close();
        } else {
          // Si no se puede cerrar por seguridad del navegador,
          // redirigir a una página en blanco
          window.location.href = 'about:blank';
          setTimeout(() => {
            try {
              window.close();
            } catch (e) {
              // Si falla, mostrar mensaje
              alert('Por favor, cierre esta ventana manualmente');
            }
          }, 100);
        }
      } catch (error) {
        console.error('Error al cerrar:', error);
        window.location.href = 'about:blank';
      }
    },
    'danger'
  );
}

// Función para gestionar trabajadores (placeholder)
btnGestionar.addEventListener('click', () => {
  alert('Función de gestión de trabajadores - Por implementar');
});

// Funciones de formateo y validación
function formatearNombre(nombre) {
  // Permitir 1 o 2 nombres, formatear con inicial mayúscula y resto minúscula
  return nombre.trim()
    .split(/\s+/)
    .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase())
    .join(' ');
}

function formatearApellido(apellido) {
  // Permitir 1 o 2 apellidos, formatear con inicial mayúscula y resto minúscula
  return apellido.trim()
    .split(/\s+/)
    .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase())
    .join(' ');
}

function formatearRUT(rut) {
  // Remover puntos y guiones, validar largo (8-9 dígitos), agregar guion antes del último dígito
  const rutLimpio = rut.replace(/[.\-]/g, '');
  
  if (rutLimpio.length < 8 || rutLimpio.length > 9) {
    return null; // RUT inválido
  }
  
  // Si tiene 8 dígitos, agregar guion antes del último
  // Si tiene 9 dígitos, agregar guion antes del último
  const cuerpo = rutLimpio.slice(0, -1);
  const digitoVerificador = rutLimpio.slice(-1);
  return `${cuerpo}-${digitoVerificador}`;
}

function validarEmail(email) {
  // Validar formato texto@texto.texto
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function formatearTelefono(telefono) {
  // Remover espacios y caracteres no numéricos, agregar +56 al inicio
  const telefonoLimpio = telefono.replace(/\D/g, '');
  
  // Si ya empieza con 56, removerlo para agregarlo después
  let numero = telefonoLimpio.startsWith('56') ? telefonoLimpio.slice(2) : telefonoLimpio;
  
  // Validar que tenga 9 dígitos después del código de país
  if (numero.length !== 9) {
    return null; // Teléfono inválido
  }
  
  return `+56${numero}`;
}

// Funciones del modal agregar trabajador
function abrirModalAgregarTrabajador() {
  formAgregarTrabajador.reset();
  addWorkerModalEl.classList.add('show');
}

function cerrarModalAgregar() {
  addWorkerModalEl.classList.remove('show');
  formAgregarTrabajador.reset();
}

async function handleAgregarTrabajador(e) {
  e.preventDefault();
  
  const formData = new FormData(formAgregarTrabajador);
  
  // Obtener valores sin formatear
  const nombreRaw = formData.get('nombre').trim();
  const apellidoRaw = formData.get('apellido').trim();
  const rutRaw = formData.get('rut').trim();
  const emailRaw = formData.get('email').trim();
  const telefonoRaw = formData.get('telefono').trim();
  const grupoRaw = formData.get('grupo');
  
  // Validar que todos los campos estén completos (no pueden estar en blanco)
  if (!nombreRaw || !apellidoRaw || !rutRaw || !emailRaw || !telefonoRaw || !grupoRaw) {
    mostrarConfirmacion(
      'Campos incompletos',
      'Por favor complete todos los campos requeridos. Ningún campo puede quedar en blanco.',
      () => {},
      'danger'
    );
    return;
  }
  
  // Formatear y validar nombre
  const nombre = formatearNombre(nombreRaw);
  if (!nombre) {
    mostrarConfirmacion(
      'Nombre inválido',
      'El nombre no puede estar vacío',
      () => {},
      'danger'
    );
    return;
  }
  
  // Formatear y validar apellido
  const apellido = formatearApellido(apellidoRaw);
  if (!apellido) {
    mostrarConfirmacion(
      'Apellido inválido',
      'El apellido no puede estar vacío',
      () => {},
      'danger'
    );
    return;
  }
  
  // Formatear y validar RUT
  const rut = formatearRUT(rutRaw);
  if (!rut) {
    mostrarConfirmacion(
      'RUT inválido',
      'El RUT debe tener entre 8 y 9 dígitos (sin puntos ni guion)',
      () => {},
      'danger'
    );
    return;
  }
  
  // Validar email
  if (!validarEmail(emailRaw)) {
    mostrarConfirmacion(
      'Email inválido',
      'El email debe tener el formato: texto@texto.texto',
      () => {},
      'danger'
    );
    return;
  }
  
  // Formatear y validar teléfono
  const telefono = formatearTelefono(telefonoRaw);
  if (!telefono) {
    mostrarConfirmacion(
      'Teléfono inválido',
      'El teléfono debe tener 9 dígitos (solo el número sin +56)',
      () => {},
      'danger'
    );
    return;
  }
  
  // Crear objeto del trabajador con datos formateados
  const nuevoTrabajador = {
    nombre: nombre,
    apellido: apellido,
    rut: rut,
    email: emailRaw.toLowerCase().trim(),
    telefono: telefono,
    grupo: grupoRaw
  };
  
  // Validar que el RUT no exista ya
  const rutExistente = trabajadores.some(t => t.rut === nuevoTrabajador.rut);
  if (rutExistente) {
    mostrarConfirmacion(
      'RUT duplicado',
      'Ya existe un trabajador con este RUT',
      () => {},
      'danger'
    );
    return;
  }
  
  try {
    const response = await fetch('/agregar-trabajador', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoTrabajador)
    });
    
    if (response.ok) {
      const result = await response.json();
      trabajadores = result.trabajadores;
      renderCalendar();
      renderLeyenda();
      cerrarModalAgregar();
      mostrarConfirmacion(
        'Trabajador agregado',
        `El trabajador ${nuevoTrabajador.nombre} ${nuevoTrabajador.apellido} ha sido agregado exitosamente`,
        () => {},
        'primary'
      );
    } else {
      throw new Error('Error al agregar trabajador');
    }
  } catch (error) {
    console.error('Error al agregar trabajador:', error);
    mostrarConfirmacion(
      'Error',
      'Error al agregar el trabajador. Por favor intente nuevamente.',
      () => {},
      'danger'
    );
  }
}
