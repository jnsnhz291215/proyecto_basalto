// IMPORTAR CONFIGURACIÓN
// Nueva lógica de turnos 2026
// Pista 1 (A-B-C-D + AB, CD): Referencia C-D empiezan 21/02/2026
// Pista 2 (E-F-G-H + EF, GH): Mismo patrón que Pista 1 pero con desfase de 7 días
// Grupos J, K: Mantienen lógica semanal antigua
import { FECHA_BASE, GRUPOS, COLORES } from './config.js';

// Configuración y estado global
let trabajadores = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let today = new Date();
today.setHours(0, 0, 0, 0);

// Fechas de referencia para las 2 pistas
const INICIO_CD = new Date(2026, 1, 21); // 21 de febrero 2026 (Pista 1: C-D)
INICIO_CD.setHours(0, 0, 0, 0);

const INICIO_EFGH = new Date(2026, 1, 14); // 14 de febrero 2026 (Pista 2: G-H, 7 días antes)
INICIO_EFGH.setHours(0, 0, 0, 0);

const MS_PER_DAY = 86400000;
const DIAS_POR_BLOQUE = 14;
const CICLO_COMPLETO = DIAS_POR_BLOQUE * 4; // 56 días (4 bloques de 14)

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
// Devuelve { pista1: {manana, tarde, doble}, pista2: {manana, tarde, doble}, semanales }
// Pista 1: A-B-C-D + AB, CD (referencia C-D = 21/02/2026)
// Pista 2: E-F-G-H + EF, GH (mismo patrón que Pista 1 pero desfase de 7 días)
function obtenerGruposDelDia(fecha) {
  const fechaCopy = new Date(fecha);
  fechaCopy.setHours(0, 0, 0, 0);
  
  // ===== PISTA 1: A-B-C-D + grupos dobles AB, CD =====
  const diasCD = Math.floor((fechaCopy - INICIO_CD) / MS_PER_DAY);
  const cicloCD = ((diasCD % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO;
  
  let pista1 = null;
  
  if (cicloCD >= 0 && cicloCD < 14) {
    // C-D trabajando, turno normal
    pista1 = { manana: 'C', tarde: 'D', doble: 'CD' };
  } else if (cicloCD >= 14 && cicloCD < 28) {
    // A-B trabajando, turno normal
    pista1 = { manana: 'A', tarde: 'B', doble: 'AB' };
  } else if (cicloCD >= 28 && cicloCD < 42) {
    // C-D trabajando, turno INVERTIDO
    pista1 = { manana: 'D', tarde: 'C', doble: 'CD' };
  } else if (cicloCD >= 42 && cicloCD < 56) {
    // A-B trabajando, turno INVERTIDO
    pista1 = { manana: 'B', tarde: 'A', doble: 'AB' };
  }
  
  // ===== PISTA 2: E-F-G-H + grupos dobles EF, GH =====
  // Misma lógica que Pista 1 pero con G-H en lugar de C-D y E-F en lugar de A-B
  const diasEFGH = Math.floor((fechaCopy - INICIO_EFGH) / MS_PER_DAY);
  const cicloEFGH = ((diasEFGH % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO;
  
  let pista2 = null;
  
  if (cicloEFGH >= 0 && cicloEFGH < 14) {
    // G-H trabajando, turno normal
    pista2 = { manana: 'G', tarde: 'H', doble: 'GH' };
  } else if (cicloEFGH >= 14 && cicloEFGH < 28) {
    // E-F trabajando, turno normal
    pista2 = { manana: 'E', tarde: 'F', doble: 'EF' };
  } else if (cicloEFGH >= 28 && cicloEFGH < 42) {
    // G-H trabajando, turno INVERTIDO
    pista2 = { manana: 'H', tarde: 'G', doble: 'GH' };
  } else if (cicloEFGH >= 42 && cicloEFGH < 56) {
    // E-F trabajando, turno INVERTIDO
    pista2 = { manana: 'F', tarde: 'E', doble: 'EF' };
  }
  
  // ===== GRUPOS SEMANALES J, K (lógica antigua) =====
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

    // Mostrar bloques por grupo (mañana arriba, tarde abajo) SOLO si hay trabajadores de ese grupo
    const gruposDelDia = obtenerGruposDelDia(date);

    // Pista 1 (mostrar solo si hay trabajadores asignados a ese grupo y pista)
    if (gruposDelDia.pista1) {
      const gManana1 = gruposDelDia.pista1.manana;
      const gTarde1 = gruposDelDia.pista1.tarde;
      const gDoble1 = gruposDelDia.pista1.doble;
      
      const tieneManana1 = trabajadoresDelDia.some(t => t.grupo === gManana1 && t.pista === 1);
      const tieneTarde1 = trabajadoresDelDia.some(t => t.grupo === gTarde1 && t.pista === 1);
      const tieneDoble1 = trabajadoresDelDia.some(t => t.grupo === gDoble1 && t.pista === 1);
      
      if (tieneManana1) {
        const grupoBlock = document.createElement('div');
        grupoBlock.className = 'grupo-block manana';
        grupoBlock.style.backgroundColor = COLORES[gManana1];
        grupoBlock.textContent = gManana1;
        dayRight.appendChild(grupoBlock);
      }
      if (tieneTarde1) {
        const grupoBlockTarde = document.createElement('div');
        grupoBlockTarde.className = 'grupo-block tarde';
        grupoBlockTarde.style.backgroundColor = COLORES[gTarde1];
        grupoBlockTarde.textContent = gTarde1;
        dayRight.appendChild(grupoBlockTarde);
      }
      if (tieneDoble1) {
        const grupoBlockDoble = document.createElement('div');
        grupoBlockDoble.className = 'grupo-block manana doble';
        grupoBlockDoble.style.backgroundColor = COLORES[gDoble1];
        grupoBlockDoble.textContent = gDoble1;
        dayRight.appendChild(grupoBlockDoble);
      }
    }

    // Pista 2 (mostrar solo si hay trabajadores asignados a ese grupo y pista)
    if (gruposDelDia.pista2) {
      const gManana2 = gruposDelDia.pista2.manana;
      const gTarde2 = gruposDelDia.pista2.tarde;
      const gDoble2 = gruposDelDia.pista2.doble;
      
      const tieneManana2 = trabajadoresDelDia.some(t => t.grupo === gManana2 && t.pista === 2);
      const tieneTarde2 = trabajadoresDelDia.some(t => t.grupo === gTarde2 && t.pista === 2);
      const tieneDoble2 = trabajadoresDelDia.some(t => t.grupo === gDoble2 && t.pista === 2);
      
      if (tieneManana2) {
        const grupoBlock = document.createElement('div');
        grupoBlock.className = 'grupo-block manana';
        grupoBlock.style.backgroundColor = COLORES[gManana2];
        grupoBlock.textContent = gManana2;
        dayRight.appendChild(grupoBlock);
      }
      if (tieneTarde2) {
        const grupoBlockTarde = document.createElement('div');
        grupoBlockTarde.className = 'grupo-block tarde';
        grupoBlockTarde.style.backgroundColor = COLORES[gTarde2];
        grupoBlockTarde.textContent = gTarde2;
        dayRight.appendChild(grupoBlockTarde);
      }
      if (tieneDoble2) {
        const grupoBlockDoble = document.createElement('div');
        grupoBlockDoble.className = 'grupo-block manana doble';
        grupoBlockDoble.style.backgroundColor = COLORES[gDoble2];
        grupoBlockDoble.textContent = gDoble2;
        dayRight.appendChild(grupoBlockDoble);
      }
    }

    // Grupos semanales J (Lun–Jue) y K (Mar–Vie): mostrar solo si hay trabajadores semanales de ese grupo
    if (gruposDelDia.semanales && gruposDelDia.semanales.length > 0) {
      const semanalesPresentes = [...new Set(trabajadoresDelDia.filter(t => t.pista === 0).map(t => t.grupo))];
      for (const g of semanalesPresentes) {
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
  
  // PISTA 1: A-B-C-D + AB/CD
  if (gruposDelDia.pista1) {
    // Trabajadores del grupo de mañana
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
    
    // Trabajadores del grupo de tarde
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
    
    // Grupo doble (AB o CD) - siempre turno mañana
    if (gruposDelDia.pista1.doble) {
      const trabajadoresDoble = trabajadores.filter(t => t.grupo === gruposDelDia.pista1.doble);
      trabajadoresDoble.forEach(t => {
        trabajadoresDelDia.push({
          ...t,
          horario: 'manana',
          grupo: gruposDelDia.pista1.doble,
          color: COLORES[gruposDelDia.pista1.doble],
          pista: 1
        });
      });
    }
  }
  
  // PISTA 2: E-F + EF
  if (gruposDelDia.pista2) {
    // Trabajadores del grupo de mañana
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
    
    // Trabajadores del grupo de tarde
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
    
    // Grupo doble EF - siempre turno mañana
    if (gruposDelDia.pista2.doble) {
      const trabajadoresDoble = trabajadores.filter(t => t.grupo === gruposDelDia.pista2.doble);
      trabajadoresDoble.forEach(t => {
        trabajadoresDelDia.push({
          ...t,
          horario: 'manana',
          grupo: gruposDelDia.pista2.doble,
          color: COLORES[gruposDelDia.pista2.doble],
          pista: 2
        });
      });
    }
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
    
    // Mostrar turnos de PISTA 1 (grupos AB/CD/BA/DC)
    if (pista1.length > 0) {
      // Grupo de mañana (pista 1)
      const manana = pista1.filter(t => t.horario === 'manana');
      if (manana.length > 0) {
        const horarioLabel = document.createElement('div');
        horarioLabel.className = 'horario-label';
        horarioLabel.textContent = `Grupo ${manana[0].grupo} - Turno de mañana (8:00 a 20:00)`;
        horarioLabel.style.marginTop = '10px';
        horarioLabel.style.marginBottom = '8px';
        horarioLabel.style.fontSize = '15px';
        horarioLabel.style.fontWeight = '600';
        trabajadoresDiaEl.appendChild(horarioLabel);
        
        manana.forEach(trabajador => {
          const item = document.createElement('div');
          item.className = 'trabajador-item manana';
          item.style.backgroundColor = trabajador.color;
          const cargo = trabajador.cargo ? ` - ${trabajador.cargo}` : '';
          item.textContent = `${trabajador.nombres} ${trabajador.apellidos}${cargo}`;
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
        horarioLabel.textContent = `Grupo ${tarde[0].grupo} - Turno de noche (20:00 a 8:00)`;
        horarioLabel.style.marginTop = '15px';
        horarioLabel.style.marginBottom = '8px';
        horarioLabel.style.fontSize = '15px';
        horarioLabel.style.fontWeight = '600';
        trabajadoresDiaEl.appendChild(horarioLabel);
        
        tarde.forEach(trabajador => {
          const item = document.createElement('div');
          item.className = 'trabajador-item tarde';
          item.style.backgroundColor = trabajador.color;
          const cargo = trabajador.cargo ? ` - ${trabajador.cargo}` : '';
          item.textContent = `${trabajador.nombres} ${trabajador.apellidos}${cargo}`;
          item.style.fontSize = '14px';
          item.style.marginLeft = '10px';
          trabajadoresDiaEl.appendChild(item);
        });
      }
    }
    
    // Mostrar turnos de PISTA 2 (grupos EF/HG/FE/GH)
    if (pista2.length > 0) {
      // Grupo de mañana (pista 2)
      const manana = pista2.filter(t => t.horario === 'manana');
      if (manana.length > 0) {
        const horarioLabel = document.createElement('div');
        horarioLabel.className = 'horario-label';
        horarioLabel.textContent = `Grupo ${manana[0].grupo} - Turno de mañana (8:00 a 20:00)`;
        horarioLabel.style.marginTop = '15px';
        horarioLabel.style.marginBottom = '8px';
        horarioLabel.style.fontSize = '15px';
        horarioLabel.style.fontWeight = '600';
        trabajadoresDiaEl.appendChild(horarioLabel);
        
        manana.forEach(trabajador => {
          const item = document.createElement('div');
          item.className = 'trabajador-item manana';
          item.style.backgroundColor = trabajador.color;
          const cargo = trabajador.cargo ? ` - ${trabajador.cargo}` : '';
          item.textContent = `${trabajador.nombres} ${trabajador.apellidos}${cargo}`;
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
        horarioLabel.textContent = `Grupo ${tarde[0].grupo} - Turno de noche (20:00 a 8:00)`;
        horarioLabel.style.marginTop = '15px';
        horarioLabel.style.marginBottom = '8px';
        horarioLabel.style.fontSize = '15px';
        horarioLabel.style.fontWeight = '600';
        trabajadoresDiaEl.appendChild(horarioLabel);
        
        tarde.forEach(trabajador => {
          const item = document.createElement('div');
          item.className = 'trabajador-item tarde';
          item.style.backgroundColor = trabajador.color;
          const cargo = trabajador.cargo ? ` - ${trabajador.cargo}` : '';
          item.textContent = `${trabajador.nombres} ${trabajador.apellidos}${cargo}`;
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
        horarioLabel.style.fontSize = '15px';
        horarioLabel.style.fontWeight = '600';
        trabajadoresDiaEl.appendChild(horarioLabel);
        
        trabajadoresGrupo.forEach(trabajador => {
          const item = document.createElement('div');
          item.className = 'trabajador-item semanal';
          item.style.backgroundColor = trabajador.color;
          const cargo = trabajador.cargo ? ` - ${trabajador.cargo}` : '';
          item.textContent = `${trabajador.nombres} ${trabajador.apellidos}${cargo}`;
          item.style.fontSize = '14px';
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

