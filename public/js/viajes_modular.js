(async function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const monthYearEl = document.getElementById('month-year');
      const prevBtn = document.getElementById('prev-month');
      const nextBtn = document.getElementById('next-month');
      const btnHoy = document.getElementById('btn-hoy');
      const fechaHoy = document.getElementById('fecha-hoy');

      const now = new Date();
      if (fechaHoy) {
        fechaHoy.textContent = now.toLocaleDateString('es-CL');
      }

      const calendar = new window.BasaltoCalendar('days-grid', {
        monthLabelId: 'month-year',
        initialDate: now
      });

      await calendar.draw(now.getFullYear(), now.getMonth() + 1);

      if (prevBtn) prevBtn.addEventListener('click', () => calendar.prevMonth());
      if (nextBtn) nextBtn.addEventListener('click', () => calendar.nextMonth());
      if (btnHoy) {
        btnHoy.addEventListener('click', async () => {
          const today = new Date();
          await calendar.draw(today.getFullYear(), today.getMonth() + 1);
          if (monthYearEl) monthYearEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    } catch (error) {
      console.error('[CALENDAR] Error al inicializar calendario modular:', error);
    }
  });
})();
