(function () {
  'use strict';

  const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
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

      if (!this.container) {
        throw new Error(`[CALENDAR] No existe el contenedor con id ${containerId}`);
      }

      this.ensureModal();
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
      if (m > 12) {
        m = 1;
        y += 1;
      }
      await this.draw(y, m);
    }

    async prevMonth() {
      let y = this.currentYear;
      let m = this.currentMonth - 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
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

      const calendarContainer = document.createElement('div');
      calendarContainer.className = 'calendar-container';

      for (let d = 1; d <= monthEnd.getDate(); d++) {
        const dateObj = new Date(payload.anio, payload.mes - 1, d);
        const dateKey = toISODate(dateObj);
        const data = byDate.get(dateKey) || { fecha: dateKey, dia: [], noche: [] };

        const card = document.createElement('article');
        card.className = 'calendar-day-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        const header = document.createElement('header');
        header.className = 'card-header';
        header.textContent = formatHeaderDate(dateObj);

        const body = document.createElement('div');
        body.className = 'card-body';

        const dayCol = document.createElement('section');
        dayCol.className = 'turno-col turno-dia';
        dayCol.innerHTML = '<h4>DIA</h4>';
        this.renderGroupRows(dayCol, data.dia || []);

        const nightCol = document.createElement('section');
        nightCol.className = 'turno-col turno-noche';
        nightCol.innerHTML = '<h4>NOCHE</h4>';
        this.renderGroupRows(nightCol, data.noche || []);

        body.appendChild(dayCol);
        body.appendChild(nightCol);

        card.appendChild(header);
        card.appendChild(body);

        card.addEventListener('click', () => this.openDayDetail(dateKey));
        card.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter' || evt.key === ' ') {
            evt.preventDefault();
            this.openDayDetail(dateKey);
          }
        });

        calendarContainer.appendChild(card);
      }

      this.container.appendChild(calendarContainer);
    }

    renderGroupRows(columnEl, groups) {
      if (!groups.length) {
        const empty = document.createElement('div');
        empty.className = 'group-row group-empty';
        empty.innerHTML = '<span class="icon-slot"></span><span>-</span>';
        columnEl.appendChild(empty);
        return;
      }

      for (const group of groups) {
        const row = document.createElement('div');
        row.className = 'group-row';

        const icon = document.createElement('span');
        icon.className = 'icon-slot';
        icon.textContent = group.avion_estado || '';

        const name = document.createElement('span');
        name.className = 'group-name';
        name.textContent = group.grupo;

        row.appendChild(icon);
        row.appendChild(name);
        columnEl.appendChild(row);
      }
    }

    ensureModal() {
      this.modal = document.getElementById('day-modal');
      this.modalTitle = document.getElementById('modal-date-title');
      this.modalBody = document.getElementById('trabajadores-del-dia');
      const closeBtn = this.modal ? this.modal.querySelector('.close-modal') : null;

      if (!this.modal || !this.modalTitle || !this.modalBody) return;

      if (closeBtn) {
        closeBtn.onclick = () => this.closeModal();
      }

      this.modal.addEventListener('click', (evt) => {
        if (evt.target === this.modal) this.closeModal();
      });
    }

    openModal() {
      if (!this.modal) return;
      this.modal.style.display = 'flex';
    }

    closeModal() {
      if (!this.modal) return;
      this.modal.style.display = 'none';
    }

    renderLoadingState() {
      if (!this.modalBody) return;
      this.modalBody.innerHTML = '<div class="calendar-loading">Cargando personal...</div>';
    }

    renderBookView(payload) {
      if (!this.modalBody) return;

      const renderWorkers = (list) => {
        if (!Array.isArray(list) || list.length === 0) {
          return '<div class="worker-item"><span class="worker-cargo">Sin personal asignado</span></div>';
        }

        return list.map((worker) => (
          `<div class="worker-item">` +
            `<strong>${escapeHtml(worker.nombre_completo)}</strong>` +
            `<span class="worker-cargo">${escapeHtml(worker.cargo)}</span>` +
          `</div>`
        )).join('');
      };

      this.modalBody.innerHTML =
        `<div class="modal-book-view">` +
          `<section class="book-page">` +
            `<h3 class="page-title">Turnos de Día (8:00 a 20:00)</h3>` +
            `${renderWorkers(payload.dia)}` +
          `</section>` +
          `<section class="book-page">` +
            `<h3 class="page-title">Turnos de Noche (20:00 a 8:00)</h3>` +
            `${renderWorkers(payload.noche)}` +
          `</section>` +
        `</div>`;
    }

    async openDayDetail(fecha) {
      if (!this.modal || !this.modalTitle) return;

      this.modalTitle.textContent = `Detalle del horario dia ${fecha}`;
      this.openModal();
      this.renderLoadingState();

      try {
        const response = await fetch(`/api/calendario/detalle/${fecha}`);
        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }
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
