// IMPORTAR CONFIGURACIÓN
// Turnos de 14 días trabajo + 14 días descanso, empezando en sábado
// Referencia: sábado 17 enero 2026 = día 0
// Pista 1: AB (0-13), CD (14-27), BA (28-41), DC (42-55), luego se repite
// Pista 2 (desplazada 7 días): EF (7-20), HG (21-34), FE (35-48), GH (49-62), luego se repite
import { FECHA_BASE, GRUPOS, COLORES } from './config.js';

// Configuración y estado global
let trabajadores = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let today = new Date();
today.setHours(0, 0, 0, 0);

// Inicio del ciclo: sábado 17 enero 2026 (día 0)
const INICIO_CICLO = new Date(2026, 0, 17);
INICIO_CICLO.setHours(0, 0, 0, 0);

const MS_PER_DAY = 86400000;
const DIAS_POR_BLOQUE = 14;
const CICLO_COMPLETO = DIAS_POR_BLOQUE * 4; // 56 días (4 bloques de 14)

function obtenerTurnoABCDEFGH(fecha) {
  const t = new Date(fecha);
  t.setHours(0, 0, 0, 0);
  const dias = Math.floor((t - INICIO_CICLO) / MS_PER_DAY);
  
  let manana = null;
  let tarde = null;
  
  // Pista 1: ciclo de 56 días
  const ciclo1 = ((dias % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO; // manejar negativos
  if (ciclo1 >= 0 && ciclo1 < DIAS_POR_BLOQUE) {
    // Días 0-13: AB
    manana = 'A';
    tarde = 'B';
  } else if (ciclo1 >= DIAS_POR_BLOQUE && ciclo1 < DIAS_POR_BLOQUE * 2) {
    // Días 14-27: CD
    manana = 'C';
    tarde = 'D';
  } else if (ciclo1 >= DIAS_POR_BLOQUE * 2 && ciclo1 < DIAS_POR_BLOQUE * 3) {
    // Días 28-41: BA (invertido)
    manana = 'B';
    tarde = 'A';
  } else if (ciclo1 >= DIAS_POR_BLOQUE * 3 && ciclo1 < CICLO_COMPLETO) {
    // Días 42-55: DC (invertido)
    manana = 'D';
    tarde = 'C';
  }
  
  // Pista 2: ciclo de 56 días, desplazado 7 días
  // Cuando hay solapamiento, la pista 2 tiene prioridad (se muestra primero)
  const dias2 = dias - 7;
  if (dias2 >= 0) {
    const ciclo2 = ((dias2 % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO;
    if (ciclo2 >= 0 && ciclo2 < DIAS_POR_BLOQUE) {
      // Días 7-20: EF
      // Si hay solapamiento, mostrar EF primero (pista 2 tiene prioridad)
      if (manana && tarde) {
        // Ya hay pista 1, mantener pista 1 como manana/tarde
        // La pista 2 se mostrará como bloques adicionales si es necesario
      } else {
        manana = 'E';
        tarde = 'F';
      }
    } else if (ciclo2 >= DIAS_POR_BLOQUE && ciclo2 < DIAS_POR_BLOQUE * 2) {
      // Días 21-34: HG
      if (!manana) manana = 'H';
      if (!tarde) tarde = 'G';
    } else if (ciclo2 >= DIAS_POR_BLOQUE * 2 && ciclo2 < DIAS_POR_BLOQUE * 3) {
          item.textContent = `${trabajador.nombres} ${trabajador.apellidos}`;
      if (!manana) manana = 'F';
      if (!tarde) tarde = 'E';
    } else if (ciclo2 >= DIAS_POR_BLOQUE * 3 && ciclo2 < CICLO_COMPLETO) {
      // Días 49-62: GH (invertido)
      if (!manana) manana = 'G';
      if (!tarde) tarde = 'H';
    }
  }
  
  // Si no hay turno asignado (días negativos antes de pista 2), usar AB
  if (!manana || !tarde) {
    manana = manana || 'A';
    tarde = tarde || 'B';
  }
  
  return { manana, tarde };
}

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
// Devuelve { pista1: {manana, tarde}, pista2: {manana, tarde} o null, semanales }
// Pista 1: días 0-55 repetidos (AB, CD, BA, DC)
// Pista 2: días 7+ repetidos desplazados (EF, HG, FE, GH)
function obtenerGruposDelDia(fecha) {
  const fechaCopy = new Date(fecha);
  fechaCopy.setHours(0, 0, 0, 0);
  
  const t = new Date(fechaCopy);
  t.setHours(0, 0, 0, 0);
  const dias = Math.floor((t - INICIO_CICLO) / MS_PER_DAY);
  
  // PISTA 1: ciclo de 56 días (AB → CD → BA → DC, repetido)
  const ciclo1 = ((dias % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO;
  let grupo1Manana = null;
  let grupo1Tarde = null;
  
  if (ciclo1 >= 0 && ciclo1 < DIAS_POR_BLOQUE) {
    // Días 0-13: A mañana, B tarde
    grupo1Manana = 'A';
    grupo1Tarde = 'B';
  } else if (ciclo1 >= DIAS_POR_BLOQUE && ciclo1 < DIAS_POR_BLOQUE * 2) {
    // Días 14-27: C mañana, D tarde
    grupo1Manana = 'C';
    grupo1Tarde = 'D';
  } else if (ciclo1 >= DIAS_POR_BLOQUE * 2 && ciclo1 < DIAS_POR_BLOQUE * 3) {
    // Días 28-41: B mañana, A tarde
    grupo1Manana = 'B';
    grupo1Tarde = 'A';
  } else if (ciclo1 >= DIAS_POR_BLOQUE * 3 && ciclo1 < CICLO_COMPLETO) {
    // Días 42-55: D mañana, C tarde
    grupo1Manana = 'D';
    grupo1Tarde = 'C';
  }
  
  // PISTA 2: ciclo de 56 días desplazado 7 días (EF → HG → FE → GH, repetido)
  const dias2 = dias - 7;
  let grupo2Manana = null;
  let grupo2Tarde = null;
  
  if (dias2 >= 0) {
    const ciclo2 = ((dias2 % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO;
    
    if (ciclo2 >= 0 && ciclo2 < DIAS_POR_BLOQUE) {
      // Días 7-20: E mañana, F tarde
      grupo2Manana = 'E';
      grupo2Tarde = 'F';
    } else if (ciclo2 >= DIAS_POR_BLOQUE && ciclo2 < DIAS_POR_BLOQUE * 2) {
      // Días 21-34: H mañana, G tarde
      grupo2Manana = 'H';
      grupo2Tarde = 'G';
    } else if (ciclo2 >= DIAS_POR_BLOQUE * 2 && ciclo2 < DIAS_POR_BLOQUE * 3) {
      // Días 35-48: F mañana, E tarde
      grupo2Manana = 'F';
      grupo2Tarde = 'E';
    } else if (ciclo2 >= DIAS_POR_BLOQUE * 3 && ciclo2 < CICLO_COMPLETO) {
      // Días 49-62: G mañana, H tarde
      grupo2Manana = 'G';
      grupo2Tarde = 'H';
    }
  }
  
  // Retornar ambas pistas por separado
  const pista1 = (grupo1Manana && grupo1Tarde) ? { manana: grupo1Manana, tarde: grupo1Tarde } : null;
  const pista2 = (grupo2Manana && grupo2Tarde) ? { manana: grupo2Manana, tarde: grupo2Tarde } : null;
  
  // Grupos semanales: J (Lun–Jue), K (Mar–Vie), todas las semanas
  const semanales = [];
  const dia = fechaCopy.getDay(); // 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sab
  if ([1, 2, 3, 4].includes(dia)) semanales.push('J');
  if ([2, 3, 4, 5].includes(dia)) semanales.push('K');
  
  return { pista1, pista2, semanales };
}

// Elementos DOM (se inicializan después de que el DOM esté listo)
let monthYearEl, daysGridEl, prevMonthBtn, nextMonthBtn, btnHoy, fechaHoyEl;
let gruposLeyendaEl, modalEl, closeModalEl, modalDateTitleEl, modalDateSubtitleEl;
let trabajadoresDiaEl;
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
  if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => cambiarMes(-1));
  if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => cambiarMes(1));
  if (btnHoy) btnHoy.addEventListener('click', volverAHoy);
  if (closeModalEl) closeModalEl.addEventListener('click', cerrarModal);
  
  // Cerrar modal al hacer clic fuera
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) cerrarModal();
  });

  // El menú superior maneja la navegación; no hay listeners de sidebar aquí.
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

  // Ahora la parte clickeable es la sección de grupos (dayRight), no el número

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
    
    // Pista 1 (grupos AB/CD/BA/DC)
    if (gruposDelDia.pista1) {
      const grupoBlock = document.createElement('div');
      grupoBlock.className = 'grupo-block manana';
      grupoBlock.style.backgroundColor = COLORES[gruposDelDia.pista1.manana];
      grupoBlock.textContent = gruposDelDia.pista1.manana;
      dayRight.appendChild(grupoBlock);
      
      const grupoBlockTarde = document.createElement('div');
      grupoBlockTarde.className = 'grupo-block tarde';
      grupoBlockTarde.style.backgroundColor = COLORES[gruposDelDia.pista1.tarde];
      grupoBlockTarde.textContent = gruposDelDia.pista1.tarde;
      dayRight.appendChild(grupoBlockTarde);
    }
    
    // Pista 2 (grupos EF/HG/FE/GH) - si existe y es diferente a pista 1
    if (gruposDelDia.pista2) {
      const grupoBlock = document.createElement('div');
      grupoBlock.className = 'grupo-block manana';
      grupoBlock.style.backgroundColor = COLORES[gruposDelDia.pista2.manana];
      grupoBlock.textContent = gruposDelDia.pista2.manana;
      dayRight.appendChild(grupoBlock);
      
      const grupoBlockTarde = document.createElement('div');
      grupoBlockTarde.className = 'grupo-block tarde';
      grupoBlockTarde.style.backgroundColor = COLORES[gruposDelDia.pista2.tarde];
      grupoBlockTarde.textContent = gruposDelDia.pista2.tarde;
      dayRight.appendChild(grupoBlockTarde);
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

  // Hacer clic en la zona de grupos abre el modal (si es del mes actual)
  if (!isOutsideMonth) {
    dayRight.addEventListener('click', () => abrirModalDia(date, nombreDia, trabajadoresDelDia));
  }

  dayCell.appendChild(dayLeft);
  dayCell.appendChild(dayRight);
  daysGridEl.appendChild(dayCell);
}

// Obtener trabajadores que trabajan en un día específico según la lógica de turnos
function obtenerTrabajadoresDelDia(fecha) {
  // Si estamos en la vista "Viajes", no mostrar trabajadores (vista vacía)
  if (typeof window !== 'undefined' && window.__VIAJES) return [];
  const gruposDelDia = obtenerGruposDelDia(fecha);
  const trabajadoresDelDia = [];
  
  // Si no hay grupos asignados, no hay trabajadores
  const haySemanales = gruposDelDia.semanales && gruposDelDia.semanales.length > 0;
  if (!gruposDelDia.pista1 && !gruposDelDia.pista2 && !haySemanales) {
    return [];
  }
  
  // Pista 1: grupos de mañana y tarde
  if (gruposDelDia.pista1) {
    // Trabajadores del grupo de mañana (pista 1)
    const trabajadoresManana = trabajadores.filter(t => t.grupo === gruposDelDia.pista1.manana);
    trabajadoresManana.forEach(t => {
      trabajadoresDelDia.push({
        ...t,
        horario: 'manana',
        grupo: gruposDelDia.pista1.manana,
        color: COLORES[gruposDelDia.pista1.manana],
        pista: 1
      });
    });
    
    // Trabajadores del grupo de tarde (pista 1)
    const trabajadoresTarde = trabajadores.filter(t => t.grupo === gruposDelDia.pista1.tarde);
    trabajadoresTarde.forEach(t => {
      trabajadoresDelDia.push({
        ...t,
        horario: 'tarde',
        grupo: gruposDelDia.pista1.tarde,
        color: COLORES[gruposDelDia.pista1.tarde],
        pista: 1
      });
    });
  }
  
  // Pista 2: grupos de mañana y tarde
  if (gruposDelDia.pista2) {
    // Trabajadores del grupo de mañana (pista 2)
    const trabajadoresManana = trabajadores.filter(t => t.grupo === gruposDelDia.pista2.manana);
    trabajadoresManana.forEach(t => {
      trabajadoresDelDia.push({
        ...t,
        horario: 'manana',
        grupo: gruposDelDia.pista2.manana,
        color: COLORES[gruposDelDia.pista2.manana],
        pista: 2
      });
    });
    
    // Trabajadores del grupo de tarde (pista 2)
    const trabajadoresTarde = trabajadores.filter(t => t.grupo === gruposDelDia.pista2.tarde);
    trabajadoresTarde.forEach(t => {
      trabajadoresDelDia.push({
        ...t,
        horario: 'tarde',
        grupo: gruposDelDia.pista2.tarde,
        color: COLORES[gruposDelDia.pista2.tarde],
        pista: 2
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
          grupo: g,
          color: COLORES[g],
          pista: 0
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
    // Separar por pista, horario y grupo
    const pista1 = trabajadoresDelDia.filter(t => t.pista === 1);
    const pista2 = trabajadoresDelDia.filter(t => t.pista === 2);
    const semanales = trabajadoresDelDia.filter(t => t.pista === 0);
    
    // Mostrar PISTA 1 (grupos AB/CD/BA/DC)
    if (pista1.length > 0) {
      const pistaLabel = document.createElement('div');
      pistaLabel.className = 'horario-label';
      pistaLabel.textContent = 'PISTA 1';
      pistaLabel.style.marginTop = '10px';
      pistaLabel.style.marginBottom = '10px';
      pistaLabel.style.fontWeight = '700';
      pistaLabel.style.color = '#1f2937';
      trabajadoresDiaEl.appendChild(pistaLabel);
      
      // Grupo de mañana (pista 1)
      const manana = pista1.filter(t => t.horario === 'manana');
      if (manana.length > 0) {
        const horarioLabel = document.createElement('div');
        horarioLabel.className = 'horario-label';
        horarioLabel.textContent = `  Turno Mañana - Grupo ${manana[0].grupo}`;
        horarioLabel.style.marginTop = '5px';
        horarioLabel.style.marginBottom = '5px';
        horarioLabel.style.fontSize = '14px';
        trabajadoresDiaEl.appendChild(horarioLabel);
        
        manana.forEach(trabajador => {
          const item = document.createElement('div');
          item.className = 'trabajador-item manana';
          item.style.backgroundColor = trabajador.color;
          item.textContent = `${trabajador.nombres} ${trabajador.apellidos}`;
          item.style.fontSize = '14px';
          item.style.marginLeft = '10px';
          trabajadoresDiaEl.appendChild(item);
        });
      }
      
      // Grupo de tarde (pista 1)
      const tarde = pista1.filter(t => t.horario === 'tarde');
      if (tarde.length > 0) {
        const horarioLabel = document.createElement('div');
        horarioLabel.className = 'horario-label';
        horarioLabel.textContent = `  Turno Tarde - Grupo ${tarde[0].grupo}`;
        horarioLabel.style.marginTop = '8px';
        horarioLabel.style.marginBottom = '5px';
        horarioLabel.style.fontSize = '14px';
        trabajadoresDiaEl.appendChild(horarioLabel);
        
        tarde.forEach(trabajador => {
          const item = document.createElement('div');
          item.className = 'trabajador-item tarde';
          item.style.backgroundColor = trabajador.color;
          item.textContent = `${trabajador.nombres} ${trabajador.apellidos}`;
          item.style.fontSize = '14px';
          item.style.marginLeft = '10px';
          trabajadoresDiaEl.appendChild(item);
        });
      }
    }
    
    // Mostrar PISTA 2 (grupos EF/HG/FE/GH)
    if (pista2.length > 0) {
      const pistaLabel = document.createElement('div');
      pistaLabel.className = 'horario-label';
      pistaLabel.textContent = 'PISTA 2';
      pistaLabel.style.marginTop = '15px';
      pistaLabel.style.marginBottom = '10px';
      pistaLabel.style.fontWeight = '700';
      pistaLabel.style.color = '#1f2937';
      trabajadoresDiaEl.appendChild(pistaLabel);
      
      // Grupo de mañana (pista 2)
      const manana = pista2.filter(t => t.horario === 'manana');
      if (manana.length > 0) {
        const horarioLabel = document.createElement('div');
        horarioLabel.className = 'horario-label';
        horarioLabel.textContent = `  Turno Mañana - Grupo ${manana[0].grupo}`;
        horarioLabel.style.marginTop = '5px';
        horarioLabel.style.marginBottom = '5px';
        horarioLabel.style.fontSize = '14px';
        trabajadoresDiaEl.appendChild(horarioLabel);
        
        manana.forEach(trabajador => {
          const item = document.createElement('div');
          item.className = 'trabajador-item manana';
          item.style.backgroundColor = trabajador.color;
          item.textContent = `${trabajador.nombres} ${trabajador.apellidos}`;
          item.style.fontSize = '14px';
          item.style.marginLeft = '10px';
          trabajadoresDiaEl.appendChild(item);
        });
      }
      
      // Grupo de tarde (pista 2)
      const tarde = pista2.filter(t => t.horario === 'tarde');
      if (tarde.length > 0) {
        const horarioLabel = document.createElement('div');
        horarioLabel.className = 'horario-label';
        horarioLabel.textContent = `  Turno Tarde - Grupo ${tarde[0].grupo}`;
        horarioLabel.style.marginTop = '8px';
        horarioLabel.style.marginBottom = '5px';
        horarioLabel.style.fontSize = '14px';
        trabajadoresDiaEl.appendChild(horarioLabel);
        
        tarde.forEach(trabajador => {
          const item = document.createElement('div');
          item.className = 'trabajador-item tarde';
          item.style.backgroundColor = trabajador.color;
          item.textContent = `${trabajador.nombres} ${trabajador.apellidos}`;
          item.style.fontSize = '14px';
          item.style.marginLeft = '10px';
          trabajadoresDiaEl.appendChild(item);
        });
      }
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
          item.textContent = `${trabajador.nombres} ${trabajador.apellidos}`;
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

