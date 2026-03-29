// ============================================
// CALENDARIO DE VIAJES — viajes_cal.js
// ============================================
(function () {
  'use strict';

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const DIAS_CORTO = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  let currentYear, currentMonth;
  let cachedViajes = {}; // key: "YYYY-MM"
  let initialized = false;

  // ----------------------------------------
  // INIT
  // ----------------------------------------
  function init() {
    const now = new Date();
    currentYear  = now.getFullYear();
    currentMonth = now.getMonth() + 1;

    setupControls();
    updateTodayLabel();
    renderCalendar();
  }

  function setupControls() {
    document.getElementById('viajes-prev-month')?.addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 1) { currentMonth = 12; currentYear--; }
      renderCalendar();
    });

    document.getElementById('viajes-next-month')?.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 12) { currentMonth = 1; currentYear++; }
      renderCalendar();
    });

    document.getElementById('viajes-btn-hoy')?.addEventListener('click', () => {
      const now = new Date();
      currentYear  = now.getFullYear();
      currentMonth = now.getMonth() + 1;
      renderCalendar();
    });

    // Cerrar modal de detalle
    document.getElementById('viajes-modal-close')?.addEventListener('click', closeDetailModal);
    document.getElementById('viajes-day-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeDetailModal();
    });
  }

  function updateTodayLabel() {
    const el = document.getElementById('viajes-fecha-hoy');
    if (!el) return;
    const now = new Date();
    el.textContent = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  }

  // ----------------------------------------
  // FETCH VIAJES (dos endpoints: proximos + historial)
  // ----------------------------------------
  async function fetchViajesForMonth(year, month) {
    const key = `${year}-${String(month).padStart(2,'0')}`;
    if (cachedViajes[key]) return cachedViajes[key];

    const mesStr = String(month).padStart(2, '0');
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/viajes?tipo=proximos&mes=${mesStr}`),
        fetch(`/api/viajes?tipo=historial&mes=${mesStr}`)
      ]);
      const d1 = r1.ok ? await r1.json() : [];
      const d2 = r2.ok ? await r2.json() : [];

      // Merge y deduplicar por id_viaje
      const map = new Map();
      [...d1, ...d2].forEach(v => { if (!map.has(v.id_viaje)) map.set(v.id_viaje, v); });
      const all = Array.from(map.values());

      cachedViajes[key] = all;
      return all;
    } catch (err) {
      console.error('[VIAJES CAL] Error al cargar viajes:', err);
      return [];
    }
  }

  // Agrupa viajes por fecha de salida (YYYY-MM-DD)
  function groupByDate(viajes) {
    const map = {};
    viajes.forEach(v => {
      const raw = v.fecha_salida;
      if (!raw) return;
      const dateStr = String(raw).includes('T') ? raw.split('T')[0] : raw;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(v);
    });
    return map;
  }

  // ----------------------------------------
  // RENDER CALENDARIO
  // ----------------------------------------
  async function renderCalendar() {
    const grid = document.getElementById('viajes-grid');
    if (!grid) return;

    // Actualizar header
    const headerEl = document.getElementById('viajes-month-year');
    if (headerEl) headerEl.textContent = `${MESES[currentMonth - 1]} ${currentYear}`;

    // Estado de carga
    grid.innerHTML = `<div class="viajes-modal-loading" style="grid-column:1/-1">
      <i class="fa-solid fa-spinner fa-spin"></i> Cargando viajes...
    </div>`;

    const viajes = await fetchViajesForMonth(currentYear, currentMonth);
    const byDate = groupByDate(viajes);

    grid.innerHTML = '';

    // Día de la semana del primer día del mes (lunes=0 … domingo=6)
    const dow = new Date(currentYear, currentMonth - 1, 1).getDay();
    const firstWeekday = (dow === 0) ? 6 : dow - 1;
    const daysInMonth   = new Date(currentYear, currentMonth, 0).getDate();
    const now     = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    // Celdas vacías antes del día 1
    for (let i = 0; i < firstWeekday; i++) {
      const blank = document.createElement('div');
      blank.className = 'calendar-day-card viajes-day-card';
      blank.setAttribute('aria-hidden', 'true');
      grid.appendChild(blank);
    }

    // Celdas de cada día
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr   = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const dayViajes = byDate[dateStr] || [];
      const total     = dayViajes.length;

      const card = document.createElement('div');
      card.className = 'calendar-day-card viajes-day-card';
      if (dateStr === todayStr) card.classList.add('viajes-day-today');
      if (total > 0) card.setAttribute('data-has-viajes', '1');

      // Contar por grupo
      const groupCounts = {};
      dayViajes.forEach(v => {
        const g = v.id_grupo ? `G${v.id_grupo}` : 'S/G';
        groupCounts[g] = (groupCounts[g] || 0) + 1;
      });

      const groupChips = Object.entries(groupCounts)
        .map(([g, c]) => `<span class="viajes-group-chip">${g}: ${c}</span>`)
        .join('');

      card.innerHTML = `
        <div class="card-header">
          ${DIAS_CORTO[new Date(currentYear, currentMonth - 1, day).getDay()]} ${String(day).padStart(2,'0')}/${String(currentMonth).padStart(2,'0')}
        </div>
        <div class="viajes-day-body">
          ${total > 0
            ? `<div class="viajes-count-badge"><i class="fa-solid fa-plane" style="font-size:10px;margin-right:4px;"></i>${total} viaje${total !== 1 ? 's' : ''}</div>
               <div class="viajes-group-summary">${groupChips}</div>`
            : `<div class="viajes-empty-day"><i class="fa-solid fa-minus"></i></div>`
          }
        </div>
      `;

      if (total > 0) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => openDetailModal(dateStr, day, dayViajes));
      }

      grid.appendChild(card);
    }
  }

  // ----------------------------------------
  // MODAL DE DETALLE DEL DÍA
  // ----------------------------------------
  function openDetailModal(dateStr, day, viajes) {
    const modal = document.getElementById('viajes-day-modal');
    const titleEl = document.getElementById('viajes-modal-title');
    const bodyEl  = document.getElementById('viajes-modal-body');
    if (!modal || !titleEl || !bodyEl) return;

    // Título
    titleEl.innerHTML = `<i class="fa-solid fa-calendar-check"></i> ${String(day).padStart(2,'0')}/${String(currentMonth).padStart(2,'0')}/${currentYear} — ${viajes.length} viaje${viajes.length !== 1 ? 's' : ''}`;

    // Agrupar por grupo
    const groups = {};
    viajes.forEach(v => {
      const key = v.id_grupo ? `Grupo ${v.id_grupo}` : 'Sin Grupo';
      if (!groups[key]) groups[key] = [];
      groups[key].push(v);
    });

    bodyEl.innerHTML = Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }))
      .map(([groupName, gViajes]) => {
        const personas = gViajes
          .sort((a, b) => (a.apellidos || '').localeCompare(b.apellidos || '', 'es'))
          .map(v => {
            const initials = ((v.nombres || '?').charAt(0) + (v.apellidos || '?').charAt(0)).toUpperCase();
            const tramos   = v.tramos?.length || 0;
            return `
              <div class="viajes-modal-person">
                <div class="viajes-person-avatar">${initials}</div>
                <div class="viajes-person-info">
                  <div class="viajes-person-name">${v.nombres || ''} ${v.apellidos || ''}</div>
                  <div class="viajes-person-detail">${v.cargo || 'Sin cargo'} · ${groupName}</div>
                </div>
                <div class="viajes-person-tramos">${tramos} tramo${tramos !== 1 ? 's' : ''}</div>
              </div>`;
          }).join('');

        return `
          <div class="viajes-modal-group">
            <div class="viajes-modal-group-title">
              <i class="fa-solid fa-users"></i> ${groupName} (${gViajes.length})
            </div>
            ${personas}
          </div>`;
      }).join('');

    // Abrir modal
    if (window.basaltoModal?.open) {
      window.basaltoModal.open(modal);
    } else {
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('overflow-hidden', 'modal-open');
    }
  }

  function closeDetailModal() {
    const modal = document.getElementById('viajes-day-modal');
    if (!modal) return;
    if (window.basaltoModal?.close) {
      window.basaltoModal.close(modal);
    } else {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('overflow-hidden', 'modal-open');
    }
  }

  // ----------------------------------------
  // EXPOSICIÓN PÚBLICA (llamado desde tabs JS)
  // ----------------------------------------
  window.__initViajesCalendar = function () {
    if (!initialized) {
      initialized = true;
      init();
    }
  };
})();
