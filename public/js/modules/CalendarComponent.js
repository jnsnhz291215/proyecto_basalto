(function () {
  'use strict';

  const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
  const GRID_DAY_NAMES = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
  const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatHeaderDate(date) {
    const dayName = DAY_NAMES[date.getDay()];
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${dayName} ${day}/${month}`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function usesSevenColumnLayout() {
    if (typeof window === 'undefined') return true;
    return window.innerWidth > 1400;
  }

  class BasaltoCalendar {
    constructor(containerId, options = {}) {
      this.container = document.getElementById(containerId);
      this.monthLabel = options.monthLabelId ? document.getElementById(options.monthLabelId) : null;
      this.currentDate = options.initialDate || new Date();
      this.currentYear = this.currentDate.getFullYear();
      this.currentMonth = this.currentDate.getMonth() + 1;
      this.lastPayload = null;
      this.modal = null;
      this.modalTitle = null;
      this.modalBody = null;
      this._escapeListener = null;

      if (!this.container) {
        throw new Error(`[CALENDAR] No existe el contenedor con id ${containerId}`);
      }

      this.ensureModal();
      this.ensureLegendHelp();
    }

    async draw(year = this.currentYear, month = this.currentMonth) {
      this.currentYear = year;
      this.currentMonth = month;

      const response = await fetch(`/api/calendario/mes/${year}/${month}`);
      if (!response.ok) {
        throw new Error(`No se pudo obtener calendario: ${response.status}`);
      }

      const payload = await response.json();
      this.lastPayload = payload;

      this.render(payload);
      console.log(`[CALENDAR] Dibujando mes ${month} con ${payload.total_instancias_activas || 0} instancias activas.`);
    }

    async nextMonth() {
      let y = this.currentYear;
      let m = this.currentMonth + 1;
      if (m > 12) { m = 1; y += 1; }
      await this.draw(y, m);
    }

    async prevMonth() {
      let y = this.currentYear;
      let m = this.currentMonth - 1;
      if (m < 1) { m = 12; y -= 1; }
      await this.draw(y, m);
    }

    render(payload) {
      this.container.innerHTML = '';

      if (this.monthLabel) {
        this.monthLabel.textContent = `${MONTH_NAMES[payload.mes - 1]} ${payload.anio}`;
      }

      const monthStart = new Date(payload.anio, payload.mes - 1, 1);
      const monthEnd = new Date(payload.anio, payload.mes, 0);
      const byDate = new Map((payload.fechas || []).map((f) => [f.fecha, f]));
      const todayKey = toISODate(new Date());

      const leadingEmptySlots = usesSevenColumnLayout()
        ? (monthStart.getDay() + 6) % 7
        : 0;
      for (let slot = 0; slot < leadingEmptySlots; slot++) {
        const emptyCard = document.createElement('div');
        emptyCard.className = 'calendar-day-card';
        emptyCard.setAttribute('aria-hidden', 'true');
        this.container.appendChild(emptyCard);
      }

      for (let d = 1; d <= monthEnd.getDate(); d++) {
        const dateObj = new Date(payload.anio, payload.mes - 1, d);
        const dateKey = toISODate(dateObj);
        const data = byDate.get(dateKey) || { fecha: dateKey, dia: [], noche: [] };

        const card = document.createElement('div');
        card.className = 'calendar-day-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        const header = document.createElement('div');
        header.className = 'card-header';
        if (dateKey === todayKey) {
          header.innerHTML = `${formatHeaderDate(dateObj)}<span class="badge-hoy">HOY</span>`;
        } else {
          header.textContent = formatHeaderDate(dateObj);
        }

        const logisticsBar = this.createLogisticsBar(dateKey, data);

        const body = document.createElement('div');
        body.className = 'card-body';

        const dayCol = document.createElement('div');
        dayCol.className = 'turno-col turno-dia';
        dayCol.innerHTML = '<h4>DIA</h4>';
        this.renderGroupRows(dayCol, data.dia || []);

        const nightCol = document.createElement('div');
        nightCol.className = 'turno-col turno-noche';
        nightCol.innerHTML = '<h4>NOCHE</h4>';
        this.renderGroupRows(nightCol, data.noche || []);

        body.appendChild(dayCol);
        body.appendChild(nightCol);
        card.appendChild(header);
        if (logisticsBar) {
          card.appendChild(logisticsBar);
        }
        card.appendChild(body);

        card.addEventListener('click', () => this.openDayDetail(dateKey));
        card.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter' || evt.key === ' ') {
            evt.preventDefault();
            this.openDayDetail(dateKey);
          }
        });

        this.container.appendChild(card);
      }
    }

    ensureLegendHelp() {
      const trigger = document.getElementById('btn-referencia');
      if (!trigger) return;
      if (trigger.dataset.boundLegendHelp === '1') return;
      trigger.dataset.boundLegendHelp = '1';

      trigger.addEventListener('click', () => {
        this.openLegendHelpModal();
      });
    }

    openLegendHelpModal() {
      const existing = document.getElementById('help-leyenda-modal');
      if (existing) {
        existing.classList.add('show');
        existing.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        return;
      }

      const modal = document.createElement('div');
      modal.id = 'help-leyenda-modal';
      modal.className = 'modal help-leyenda-modal show';
      modal.setAttribute('aria-hidden', 'false');

      modal.innerHTML =
        '<div class="modal-content help-leyenda-content">' +
          '<span class="close-modal" aria-label="Cerrar">&times;</span>' +
          '<h2>Ayuda / Leyenda</h2>' +
          '<div class="help-leyenda-list">' +
            '<p><strong>Turnos:</strong> DIA (08:00-20:00) y NOCHE (20:00-08:00).</p>' +
            '<p><strong>Pistas:</strong> P1 agrupa A-D y P2 agrupa E-H.</p>' +
            '<p><strong>Badges:</strong> la letra indica el grupo activo del turno.</p>' +
            '<p><strong>Logistica:</strong> 🛫 indica Subida, 🛬 indica Bajada.</p>' +
            '<p><strong>Semaforo:</strong> verde completo, amarillo parcial, rojo sin pasajes.</p>' +
          '</div>' +
        '</div>';

      const close = () => {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
      };

      const closeBtn = modal.querySelector('.close-modal');
      if (closeBtn) {
        closeBtn.addEventListener('click', close);
      }

      modal.addEventListener('click', (evt) => {
        if (evt.target === modal) close();
      });

      document.body.appendChild(modal);
      document.body.classList.add('modal-open');
    }

    createLogisticsBar(dateKey, data) {
      const PISTA1 = new Set(['A', 'B', 'C', 'D', 'AB', 'CD']);
      const PISTA2 = new Set(['E', 'F', 'G', 'H', 'EF', 'GH']);
      const ORDER_P1 = ['A', 'B', 'C', 'D', 'AB', 'CD'];
      const ORDER_P2 = ['E', 'F', 'G', 'H', 'EF', 'GH'];

      const allGroups = [...(data.dia || []), ...(data.noche || [])];
      const uniqueByGroup = new Map();
      for (const item of allGroups) {
        const key = String(item.grupo || '').toUpperCase().trim();
        if (!key || key === 'DESCANSO') continue;
        if (!uniqueByGroup.has(key)) uniqueByGroup.set(key, item);
      }

      const entriesP1 = [];
      const entriesP2 = [];
      let hasSubida = false;
      let hasBajada = false;

      for (const group of uniqueByGroup.values()) {
        const groupName = String(group.grupo || '').toUpperCase().trim();
        const isP1 = PISTA1.has(groupName);
        const isP2 = PISTA2.has(groupName);
        if (!isP1 && !isP2) continue;

        const isSubida = dateKey === String(group.fecha_ida || '');
        const isBajada = dateKey === String(group.fecha_vuelta || '');
        if (!isSubida && !isBajada) continue;

        const total = Number(group.total_trabajadores || 0);
        const done = isSubida ? Number(group.ida_count || 0) : Number(group.vuelta_count || 0);

        let statusClass = 'status-ready';
        if (done <= 0) {
          statusClass = 'status-danger';
        } else if (total > 0 && done < total) {
          statusClass = 'status-warning';
        }

        const row = {
          group: groupName,
          done,
          total,
          statusClass
        };

        if (isP1) entriesP1.push(row);
        if (isP2) entriesP2.push(row);

        hasSubida = hasSubida || isSubida;
        hasBajada = hasBajada || isBajada;
      }

      if (!entriesP1.length && !entriesP2.length) return null;

      const sortByOrder = (list, order) => {
        const rank = new Map(order.map((g, idx) => [g, idx]));
        return list.sort((a, b) => {
          const ra = rank.has(a.group) ? rank.get(a.group) : 999;
          const rb = rank.has(b.group) ? rank.get(b.group) : 999;
          return ra - rb;
        });
      };

      sortByOrder(entriesP1, ORDER_P1);
      sortByOrder(entriesP2, ORDER_P2);

      const bar = document.createElement('div');
      bar.className = 'logistics-bar';

      const hitoIcon = document.createElement('span');
      hitoIcon.className = 'logistics-hitos';
      hitoIcon.textContent = hasSubida && hasBajada ? '🛫🛬' : (hasSubida ? '🛫' : '🛬');
      bar.appendChild(hitoIcon);

      const renderCol = (entries) => {
        const col = document.createElement('div');
        col.className = 'logistics-col';
        for (const item of entries) {
          const row = document.createElement('span');
          row.className = 'logistics-item';

          const dot = document.createElement('span');
          dot.className = `status-dot ${item.statusClass}`;

          const label = document.createElement('span');
          label.textContent = `${item.group} (${item.done}/${item.total})`;

          row.appendChild(dot);
          row.appendChild(label);
          col.appendChild(row);
        }
        return col;
      };

      bar.appendChild(renderCol([...entriesP1, ...entriesP2]));
      return bar;
    }

    renderGroupRows(columnEl, groups) {
      const PISTA1 = new Set(['A', 'B', 'C', 'D', 'AB', 'CD']);
      const PISTA2 = new Set(['E', 'F', 'G', 'H', 'EF', 'GH', 'J', 'K']);

      const normalize = (g) => String(g.grupo || '').toUpperCase().trim();
      const isActiveGroup = (item) => {
        const groupName = normalize(item);
        if (!groupName || groupName === 'DESCANSO') return false;

        const jornada = String(item.tipo_jornada || item.estado_turno || '').toUpperCase().trim();
        if (jornada === 'DESCANSO') return false;

        return true;
      };

      const activeGroups = (groups || []).filter(isActiveGroup);

      if (!activeGroups.length) {
        const empty = document.createElement('div');
        empty.className = 'group-empty';
        empty.textContent = '-';
        columnEl.appendChild(empty);
        return;
      }

      const dedupeByGroup = (list) => {
        const used = new Set();
        const out = [];
        for (const item of list) {
          const key = normalize(item);
          if (used.has(key)) continue;
          used.add(key);
          out.push(item);
        }
        return out;
      };

      const uniqueGroups = dedupeByGroup(activeGroups);
      const p1  = uniqueGroups.filter((g) => PISTA1.has(normalize(g)));
      const p2  = uniqueGroups.filter((g) => PISTA2.has(normalize(g)));

      const renderSection = (list, labelText) => {
        const section = document.createElement('div');
        section.className = 'pista-section';

        const label = document.createElement('span');
        label.className = 'pista-label';
        label.textContent = labelText;
        section.appendChild(label);

        const badgesWrap = document.createElement('div');
        badgesWrap.className = 'pista-badges';

        if (!list.length) {
          const empty = document.createElement('span');
          empty.className = 'group-empty';
          empty.textContent = '-';
          badgesWrap.appendChild(empty);
        } else {
          for (const group of list) {
            const badge = document.createElement('span');
            badge.className = 'group-badge';
            badge.textContent = String(group.grupo || '').trim();
            badgesWrap.appendChild(badge);
          }
        }

        section.appendChild(badgesWrap);
        columnEl.appendChild(section);
      };

      renderSection(p1, 'Pista 1');
      renderSection(p2, 'Pista 2');
    }

    ensureModal() {
      this.modal = document.getElementById('day-modal');
      this.modalTitle = document.getElementById('modal-date-title');
      this.modalBody = document.getElementById('trabajadores-del-dia');
      const closeBtn = this.modal ? this.modal.querySelector('.close-modal') : null;

      if (!this.modal || !this.modalTitle || !this.modalBody) return;

      if (closeBtn && closeBtn.dataset.boundDayModalClose !== '1') {
        closeBtn.addEventListener('click', () => this.closeModal());
        closeBtn.dataset.boundDayModalClose = '1';
      }

      if (this.modal.dataset.boundDayModalOverlay !== '1') {
        this.modal.addEventListener('click', (evt) => {
          if (evt.target === this.modal) this.closeModal();
        });
        this.modal.dataset.boundDayModalOverlay = '1';
      }

      if (!this._escapeListener) {
        this._escapeListener = (evt) => {
          if (evt.key === 'Escape' && this.modal.classList.contains('show')) {
            this.closeModal();
          }
        };
        document.addEventListener('keydown', this._escapeListener);
      }
    }

    openModal() {
      if (!this.modal) return;
      this.modal.classList.add('show');
      this.modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
    }

    closeModal() {
      if (!this.modal) return;
      this.modal.classList.remove('show');
      this.modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
    }

    renderLoadingState() {
      if (!this.modalBody) return;
      this.modalBody.innerHTML = '<div class="calendar-loading">Cargando personal...</div>';
    }

    renderBookView(payload) {
      if (!this.modalBody) return;

      const pistaLabel = {
        P1: 'Pista 1',
        P2: 'Pista 2',
        SEM: 'Semanales',
        OTROS: 'Otros'
      };

      const renderWorkers = (list) => {
        if (!Array.isArray(list) || list.length === 0) {
          return '<div class="worker-item"><span class="worker-cargo">Sin personal asignado</span></div>';
        }

        const grouped = new Map();
        for (const worker of list) {
          const pista = String(worker.pista || 'OTROS').toUpperCase();
          const grupo = String(worker.grupo || 'SG').toUpperCase();
          if (!grouped.has(pista)) grouped.set(pista, new Map());
          const groupsMap = grouped.get(pista);
          if (!groupsMap.has(grupo)) groupsMap.set(grupo, []);
          groupsMap.get(grupo).push(worker);
        }

        const pistaOrder = ['P1', 'P2', 'SEM', 'OTROS'];
        let html = '';

        for (const key of pistaOrder) {
          if (!grouped.has(key)) continue;
          html += '<section class="turno-pista-block">';
          html += '<h4 class="turno-pista-title">' + escapeHtml(pistaLabel[key] || key) + '</h4>';

          const byGroup = grouped.get(key);
          const groupKeys = Array.from(byGroup.keys()).sort();
          for (const groupKey of groupKeys) {
            html += '<div class="turno-group-block">';
            html += '<div class="turno-group-header"><span class="group-badge">' + escapeHtml(groupKey) + '</span></div>';

            const workers = byGroup.get(groupKey);
            for (const worker of workers) {
              html += '<div class="worker-item">';
              html += '<div class="worker-name-row">';
              html += '<strong>' + escapeHtml(worker.nombre_completo) + '</strong>';
              html += '<span class="worker-group-mini">' + escapeHtml(groupKey) + '</span>';
              html += '</div>';
              html += '<span class="worker-cargo">' + escapeHtml(worker.cargo) + '</span>';
              html += '</div>';
            }

            html += '</div>';
          }

          html += '</section>';
        }

        return html;
      };

      this.modalBody.innerHTML =
        '<div class="modal-book-view">' +
          '<section class="book-page">' +
            '<h3 class="page-title">Turnos de Día (8:00 a 20:00)</h3>' +
            renderWorkers(payload.dia) +
          '</section>' +
          '<section class="book-page">' +
            '<h3 class="page-title">Turnos de Noche (20:00 a 8:00)</h3>' +
            renderWorkers(payload.noche) +
          '</section>' +
        '</div>';
    }

    async openDayDetail(fecha) {
      if (!this.modal || !this.modalTitle) return;

      this.modalTitle.textContent = 'Detalle del horario dia ' + fecha;
      this.openModal();
      this.renderLoadingState();

      try {
        const response = await fetch('/api/calendario/detalle/' + fecha);
        if (!response.ok) throw new Error('Error ' + response.status);
        const payload = await response.json();
        this.renderBookView(payload);
      } catch (error) {
        if (this.modalBody) {
          this.modalBody.innerHTML = '<div class="calendar-loading">No se pudo cargar el personal del dia.</div>';
        }
      }
    }
  }

  window.BasaltoCalendar = BasaltoCalendar;
})();
