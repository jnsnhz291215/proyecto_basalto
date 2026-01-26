// IMPORTAR CONFIGURACIÓN
// NOTA: Los turnos están definidos por fechas específicas
// A y B: 17 enero (sábado) - 30 enero (viernes)
// C y D: 31 enero (sábado) - 13 febrero (viernes)
// E y F: 24 enero (sábado) - 6 febrero (viernes)
// G y H: 7 febrero (sábado) - 20 febrero (viernes)
import { FECHA_BASE, GRUPOS, COLORES } from './config.js';

// Configuración y estado global
let trabajadores = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let today = new Date();
today.setHours(0, 0, 0, 0);

// Definición de turnos por fechas específicas
// Cada turno es de 14 días: sábado a viernes
const TURNOS = [
  {
    grupos: { manana: 'A', tarde: 'B' },
    inicio: new Date(2026, 0, 17), // 17 de enero 2026 (sábado)
    fin: new Date(2026, 0, 30)     // 30 de enero 2026 (viernes)
  },
  {
    grupos: { manana: 'C', tarde: 'D' },
    inicio: new Date(2026, 0, 31), // 31 de enero 2026 (sábado)
    fin: new Date(2026, 1, 13)      // 13 de febrero 2026 (viernes)
  },
  {
    grupos: { manana: 'E', tarde: 'F' },
    inicio: new Date(2026, 0, 24), // 24 de enero 2026 (sábado)
    fin: new Date(2026, 1, 6)       // 6 de febrero 2026 (viernes)
  },
  {
    grupos: { manana: 'G', tarde: 'H' },
    inicio: new Date(2026, 1, 7),  // 7 de febrero 2026 (sábado)
    fin: new Date(2026, 1, 20)      // 20 de febrero 2026 (viernes)
  }
];

// Normalizar fechas (establecer hora a medianoche)
TURNOS.forEach(turno => {
  turno.inicio.setHours(0, 0, 0, 0);
  turno.fin.setHours(0, 0, 0, 0);
});

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
// Devuelve { manana, tarde, semanales }. semanales: J (Lun–Jue) y K (Mar–Vie), todas las semanas
function obtenerGruposDelDia(fecha) {
  const fechaCopy = new Date(fecha);
  fechaCopy.setHours(0, 0, 0, 0);
  
  let manana = null;
  let tarde = null;
  
  // Turnos por fechas (A–H)
  for (const turno of TURNOS) {
    if (fechaCopy >= turno.inicio && fechaCopy <= turno.fin) {
      if (!manana) manana = turno.grupos.manana;
      if (!tarde) tarde = turno.grupos.tarde;
    }
  }
  
  // Grupos semanales: J (Lun–Jue), K (Mar–Vie), todas las semanas
  const semanales = [];
  const dia = fechaCopy.getDay(); // 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sab
  if ([1, 2, 3, 4].includes(dia)) semanales.push('J');
  if ([2, 3, 4, 5].includes(dia)) semanales.push('K');
  
  return { manana, tarde, semanales };
}

// Elementos DOM (se inicializan después de que el DOM esté listo)
let monthYearEl, daysGridEl, prevMonthBtn, nextMonthBtn, btnHoy, fechaHoyEl;
let gruposLeyendaEl, modalEl, closeModalEl, modalDateTitleEl, modalDateSubtitleEl;
let trabajadoresDiaEl, btnGestionar, btnSalir;
let confirmModalEl, confirmTitleEl, confirmMessageEl, confirmOkBtn, confirmCancelBtn;

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
    btnGestionar = document.getElementById('btn-gestionar');
    btnSalir = document.getElementById('btn-salir');
    confirmModalEl = document.getElementById('confirm-modal');
    confirmTitleEl = document.getElementById('confirm-title');
    confirmMessageEl = document.getElementById('confirm-message');
    confirmOkBtn = document.getElementById('confirm-ok');
    confirmCancelBtn = document.getElementById('confirm-cancel');

    // Verificar que todos los elementos existan
    const elementosFaltantes = [];
    if (!monthYearEl) elementosFaltantes.push('month-year');
    if (!daysGridEl) elementosFaltantes.push('days-grid');
    
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
  btnGestionar.addEventListener('click', () => { window.location.href = 'gestionar.html'; });
  btnSalir.addEventListener('click', salirYcerrar);
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
    // Grupos semanales J (Lun–Jue) y K (Mar–Vie)
    if (gruposDelDia.semanales && gruposDelDia.semanales.length > 0) {
      for (const g of gruposDelDia.semanales) {
        const grupoBlock = document.createElement('div');
        grupoBlock.className = 'grupo-block semanal';
        grupoBlock.style.backgroundColor = COLORES[g];
        grupoBlock.textContent = g;
        dayRight.appendChild(grupoBlock);
      }
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
  
  // Si no es día laborable (ni turnos A–H ni grupos semanales J/K), no hay trabajadores
  const haySemanales = gruposDelDia.semanales && gruposDelDia.semanales.length > 0;
  if (!gruposDelDia.manana && !gruposDelDia.tarde && !haySemanales) {
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
  
  // Grupos semanales: J (Lun–Jue), K (Mar–Vie)
  if (haySemanales) {
    for (const g of gruposDelDia.semanales) {
      const ts = trabajadores.filter(t => t.grupo === g);
      ts.forEach(t => {
        trabajadoresDelDia.push({
          ...t,
          horario: 'semanales',
          color: COLORES[g]
        });
      });
    }
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
    const semanales = trabajadoresDelDia.filter(t => t.horario === 'semanales');
    
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
        item.textContent = `${trabajador.nombre} ${trabajador.apellido}`;
        item.style.fontSize = '16px';
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
        item.textContent = `${trabajador.nombre} ${trabajador.apellido}`;
        item.style.fontSize = '16px';
        trabajadoresDiaEl.appendChild(item);
      });
    }
    
    // Mostrar grupos semanales J (Lun–Jue) y K (Mar–Vie)
    if (semanales.length > 0) {
      const gruposUnicos = [...new Set(semanales.map(t => t.grupo))];
      for (const g of gruposUnicos) {
        const trabajadoresGrupo = semanales.filter(t => t.grupo === g);
        const horarioLabel = document.createElement('div');
        horarioLabel.className = 'horario-label';
        horarioLabel.textContent = `Grupo ${g} (semanal)`;
        horarioLabel.style.marginTop = '20px';
        horarioLabel.style.marginBottom = '10px';
        trabajadoresDiaEl.appendChild(horarioLabel);
        
        trabajadoresGrupo.forEach(trabajador => {
          const item = document.createElement('div');
          item.className = 'trabajador-item semanal';
          item.style.backgroundColor = trabajador.color;
          item.textContent = `${trabajador.nombre} ${trabajador.apellido}`;
          item.style.fontSize = '16px';
          trabajadoresDiaEl.appendChild(item);
        });
      }
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

  