// ============================================
// PÁGINA CALENDARIO DE VIAJES
// ============================================

(async function() {
  'use strict';

  // Elementos del DOM
  const monthYearEl = document.getElementById('month-year');
  const daysGridEl = document.getElementById('days-grid');
  const prevMonthBtn = document.getElementById('prev-month');
  const nextMonthBtn = document.getElementById('next-month');
  const btnHoy = document.getElementById('btn-hoy');
  const fechaHoySpan = document.getElementById('fecha-hoy');
  const modalDayDetail = document.getElementById('day-modal');
  const closeModalBtn = modalDayDetail?.querySelector('.close-modal');
  const modalDateTitle = document.getElementById('modal-date-title');
  const modalDateSubtitle = document.getElementById('modal-date-subtitle');
  const trabajadoresDelDiaList = document.getElementById('trabajadores-del-dia');

  // Validar que existan elementos críticos
  if (!monthYearEl || !daysGridEl) {
    console.error('[VIAJES] Error: No se encontraron elementos del calendario');
    return;
  }

  // Estado global del calendario
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  let today = new Date();
  today.setHours(0, 0, 0, 0);

  let viajesData = [];

  // Nombres de meses en español
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Nombres de días de la semana
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // Feriados 2026
  const feriados2026 = [
    '2026-01-01', '2026-04-18', '2026-04-19', '2026-05-01',
    '2026-06-29', '2026-07-16', '2026-08-15', '2026-09-18',
    '2026-09-19', '2026-10-12', '2026-10-31', '2026-11-01',
    '2026-12-08', '2026-12-25', '2026-12-31'
  ];

  // ============================================
  // Cargar viajes desde el servidor
  // ============================================
  async function cargarViajes() {
    try {
      console.log('[VIAJES] Cargando viajes del calendario...');
      
      const response = await fetch('/api/viajes/calendario');
      
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      viajesData = await response.json();
      console.log('[VIAJES] Viajes cargados:', viajesData.length);

      // Renderizar calendario
      renderCalendar();

    } catch (error) {
      console.error('[VIAJES] Error cargando viajes:', error);
      alert('Error al cargar el calendario de viajes');
    }
  }

  // ============================================
  // Obtener viajes de un día específico
  // ============================================
  function getViajesDia(date) {
    const dateStr = date.toISOString().split('T')[0];
    return viajesData.filter(viaje => {
      const viajeDate = viaje.fecha_salida.split('T')[0];
      return viajeDate === dateStr;
    });
  }

  // ============================================
  // Renderizar calendario
  // ============================================
  function renderCalendar() {
    if (!monthYearEl || !daysGridEl) {
      console.error('[VIAJES] Error: monthYearEl o daysGridEl no están definidos');
      return;
    }

    monthYearEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    daysGridEl.innerHTML = '';

    // Primer día del mes
    const firstDay = new Date(currentYear, currentMonth, 1);
    const firstDayWeek = firstDay.getDay();
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
    const remainingCells = 42 - totalCells;
    if (remainingCells > 0) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      for (let day = 1; day <= remainingCells; day++) {
        crearDiaCelda(day, nextMonth, nextYear, true);
      }
    }
  }

  // ============================================
  // Crear celda de día
  // ============================================
  function crearDiaCelda(day, month, year, isOutsideMonth) {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isHoliday = feriados2026.includes(dateStr);
    const isToday = !isOutsideMonth && date.getTime() === today.getTime();
    const dayOfWeek = date.getDay();

    // Obtener viajes del día
    const viajesDia = getViajesDia(date);

    // Crear celda
    const dayCell = document.createElement('div');
    dayCell.className = 'day-cell split';
    if (isOutsideMonth) {
      dayCell.classList.add('outside-month');
    } else {
      dayCell.classList.add('inside-month');
      if (isHoliday) dayCell.classList.add('holiday');
    }

    // Parte izquierda (número del día)
    const dayLeft = document.createElement('div');
    dayLeft.className = 'day-left';

    const dayNumber = document.createElement('span');
    dayNumber.className = 'day-number';
    dayNumber.textContent = day;
    dayLeft.appendChild(dayNumber);

    if (isToday) {
      const hoyBadge = document.createElement('span');
      hoyBadge.className = 'hoy-badge';
      hoyBadge.textContent = 'HOY';
      dayLeft.appendChild(hoyBadge);
    }

    // Parte derecha (viajes)
    const dayRight = document.createElement('div');
    dayRight.className = 'day-right';

    if (!isOutsideMonth && viajesDia.length > 0) {
      viajesDia.forEach(viaje => {
        const viajeBlock = document.createElement('div');
        viajeBlock.className = 'viaje-block';
        viajeBlock.style.cursor = 'pointer';
        viajeBlock.style.padding = '4px 6px';
        viajeBlock.style.marginBottom = '2px';
        viajeBlock.style.backgroundColor = '#e5e7eb';
        viajeBlock.style.borderLeft = '3px solid #4f46e5';
        viajeBlock.style.borderRadius = '3px';
        viajeBlock.style.fontSize = '11px';
        viajeBlock.style.lineHeight = '1.2';
        viajeBlock.style.color = '#1f2937';

        // Formato: [Nombre] [Apellido] - [Cargo]. [Origen] - [Destino]; salida [Hora]
        const hora = viaje.hora_salida.substring(0, 5); // HH:MM
        const nombreCompleto = `${viaje.nombres} ${viaje.apellidos}`;
        const texto = `${nombreCompleto} - ${viaje.cargo}. ${viaje.ciudad_origen || 'N/A'} → ${viaje.ciudad_destino || 'N/A'}; sal. ${hora}`;

        viajeBlock.textContent = texto;
        viajeBlock.title = texto;
        
        viajeBlock.addEventListener('click', (e) => {
          e.stopPropagation();
          mostrarDetalleViade(date, viaje);
        });

        dayRight.appendChild(viajeBlock);
      });
    }

    // Agregar event listener al día para mostrar detalles
    if (!isOutsideMonth && viajesDia.length > 0) {
      dayCell.style.cursor = 'pointer';
      dayCell.addEventListener('click', () => {
        mostrarDetallesDia(date);
      });
    }

    dayCell.appendChild(dayLeft);
    dayCell.appendChild(dayRight);
    daysGridEl.appendChild(dayCell);
  }

  // ============================================
  // Mostrar detalles de viaje individual
  // ============================================
  function mostrarDetalleViade(date, viaje) {
    if (!modalDayDetail || !modalDateTitle) return;

    const dateStr = date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    modalDateTitle.textContent = `Viaje - ${dateStr}`;

    if (modalDateSubtitle) {
      modalDateSubtitle.innerHTML = `
        <div style="padding: 12px; background-color: #f3f4f6; border-radius: 6px; margin-top: 8px;">
          <p style="margin: 0 0 8px 0; font-weight: 600;">
            ${viaje.nombres} ${viaje.apellidos} - ${viaje.cargo}
          </p>
          <p style="margin: 4px 0;">
            <strong>Código de pasaje:</strong> ${viaje.codigo_pasaje || 'N/A'}
          </p>
          <p style="margin: 4px 0;">
            <strong>Ruta:</strong> ${viaje.ciudad_origen || 'N/A'} → ${viaje.ciudad_destino || 'N/A'}
          </p>
          <p style="margin: 4px 0;">
            <strong>Salida:</strong> ${viaje.hora_salida.substring(0, 5)}
          </p>
          <p style="margin: 4px 0;">
            <strong>Estado:</strong> <span style="color: #059669;">${viaje.estado}</span>
          </p>
        </div>
      `;
    }

    if (trabajadoresDelDiaList) trabajadoresDelDiaList.innerHTML = '';

    modalDayDetail.style.display = 'flex';
  }

  // ============================================
  // Mostrar detalles del día (todos los viajes)
  // ============================================
  function mostrarDetallesDia(date) {
    if (!modalDayDetail || !modalDateTitle) return;

    const dateStr = date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const viajesDia = getViajesDia(date);

    modalDateTitle.textContent = `Viajes del ${dateStr}`;

    if (modalDateSubtitle) {
      modalDateSubtitle.innerHTML = `<p style="margin: 0; color: #6b7280;">Total: ${viajesDia.length} viaje(s)</p>`;
    }

    if (trabajadoresDelDiaList) {
      trabajadoresDelDiaList.innerHTML = '';

      viajesDia.forEach(viaje => {
        const viajeItem = document.createElement('div');
        viajeItem.style.padding = '12px';
        viajeItem.style.marginBottom = '8px';
        viajeItem.style.backgroundColor = '#f9fafb';
        viajeItem.style.borderLeft = '4px solid #4f46e5';
        viajeItem.style.borderRadius = '4px';

        const hora = viaje.hora_salida.substring(0, 5);
        viajeItem.innerHTML = `
          <div style="font-weight: 600; color: #1f2937; margin-bottom: 6px;">
            ${viaje.nombres} ${viaje.apellidos}
          </div>
          <div style="font-size: 13px; color: #4b5563;">
            <p style="margin: 2px 0;"><strong>Cargo:</strong> ${viaje.cargo}</p>
            <p style="margin: 2px 0;"><strong>Ruta:</strong> ${viaje.ciudad_origen || 'N/A'} → ${viaje.ciudad_destino || 'N/A'}</p>
            <p style="margin: 2px 0;"><strong>Hora de salida:</strong> ${hora}</p>
            <p style="margin: 2px 0;"><strong>Código:</strong> ${viaje.codigo_pasaje || 'N/A'}</p>
            <p style="margin: 2px 0; color: #059669;"><strong>Estado:</strong> ${viaje.estado}</p>
          </div>
        `;

        trabajadoresDelDiaList.appendChild(viajeItem);
      });
    }

    modalDayDetail.style.display = 'flex';
  }

  // ============================================
  // Event Listeners
  // ============================================
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      renderCalendar();
    });
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      renderCalendar();
    });
  }

  if (btnHoy) {
    btnHoy.addEventListener('click', () => {
      const ahora = new Date();
      currentMonth = ahora.getMonth();
      currentYear = ahora.getFullYear();
      renderCalendar();
    });
  }

  // Actualizar fecha "hoy"
  if (fechaHoySpan) {
    const hoyFormatted = today.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    fechaHoySpan.textContent = hoyFormatted;
  }

  // Cerrar modal
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      if (modalDayDetail) modalDayDetail.style.display = 'none';
    });
  }

  if (modalDayDetail) {
    modalDayDetail.addEventListener('click', (e) => {
      if (e.target === modalDayDetail) {
        modalDayDetail.style.display = 'none';
      }
    });
  }

  // ============================================
  // Inicialización
  // ============================================
  console.log('[VIAJES] Inicializando página de calendario de viajes...');
  await cargarViajes();

})();
