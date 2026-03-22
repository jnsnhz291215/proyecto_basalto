// ============================================
// COMMON.JS - Utilities y Lógica Compartida
// ============================================

(function() {
  'use strict';

  const BODY_MODAL_LOCK_CLASS = 'overflow-hidden';
  let openManagedModalCount = 0;

  function syncBodyModalLock() {
    const shouldLock = openManagedModalCount > 0;
    document.body.classList.toggle(BODY_MODAL_LOCK_CLASS, shouldLock);
    document.body.classList.toggle('modal-open', shouldLock);
  }

  function lockBodyScroll() {
    openManagedModalCount += 1;
    syncBodyModalLock();
  }

  function unlockBodyScroll() {
    openManagedModalCount = Math.max(0, openManagedModalCount - 1);
    syncBodyModalLock();
  }

  function openManagedModal(modalElement, options = {}) {
    if (!modalElement) return false;

    const { showClass = 'show' } = options;
    if (modalElement.dataset.bodyScrollLocked !== 'true') {
      modalElement.dataset.bodyScrollLocked = 'true';
      lockBodyScroll();
    }

    modalElement.classList.add(showClass);
    modalElement.setAttribute('aria-hidden', 'false');
    return true;
  }

  function closeManagedModal(modalElement, options = {}) {
    if (!modalElement) return false;

    const { showClass = 'show' } = options;
    modalElement.classList.remove(showClass);
    modalElement.setAttribute('aria-hidden', 'true');

    if (modalElement.dataset.bodyScrollLocked === 'true') {
      delete modalElement.dataset.bodyScrollLocked;
      unlockBodyScroll();
    }

    return true;
  }

  window.lockBodyScroll = lockBodyScroll;
  window.unlockBodyScroll = unlockBodyScroll;
  window.basaltoModal = {
    lockBodyScroll,
    unlockBodyScroll,
    open: openManagedModal,
    close: closeManagedModal,
    syncBodyModalLock
  };

  // ============================================
  // NAVBAR ACTIVE STATE - Lógica excluyente
  // ============================================
  function syncNavbarActiveState() {
    const currentPath = window.location.pathname;
    const navAnchors = document.querySelectorAll('.nav-item a, .dropdown-menu a, .nav-link.dropdown-toggle');

    if (!navAnchors.length) return;

    // Limpiar todos los activos
    navAnchors.forEach(anchor => anchor.classList.remove('active'));

    // REGLA 1: Páginas de Gestión (gestionar.html, gestionviajes.html, gestioninformes.html, dashboard.html)
    // El botón padre 'Gestionar' debe mantener activo en TODAS las subsecciones
    const paginasGestion = ['gestionar.html', 'gestionviajes.html', 'gestioninformes.html', 'dashboard.html', 'gestioncargos.html'];
    const esPaginaGestion = paginasGestion.some(pagina => currentPath.endsWith(pagina));

    if (esPaginaGestion) {
      // Marcar el botón padre 'Gestionar' como activo (púrpura corporativo)
      const gestionarToggle = document.getElementById('navbarDropdownGestionar');
      if (gestionarToggle) gestionarToggle.classList.add('active');

      // Marcar el ítem interno específico según la página actual
      if (currentPath.endsWith('gestionviajes.html')) {
        const gestionViajesLink = document.querySelector('.dropdown-menu a[href="gestionviajes.html"], .dropdown-menu a[href="/gestionviajes.html"]');
        if (gestionViajesLink) gestionViajesLink.classList.add('active');
      } else if (currentPath.endsWith('gestioninformes.html')) {
        const gestionInformesLink = document.querySelector('.dropdown-menu a[href="gestioninformes.html"], .dropdown-menu a[href="/gestioninformes.html"]');
        if (gestionInformesLink) gestionInformesLink.classList.add('active');
      } else if (currentPath.endsWith('dashboard.html')) {
        const dashboardLink = document.querySelector('.dropdown-menu a[href="dashboard.html"], .dropdown-menu a[href="/dashboard.html"]');
        if (dashboardLink) dashboardLink.classList.add('active');
      } else if (currentPath.endsWith('gestionar.html')) {
        const gestionarLink = document.querySelector('.dropdown-menu a[href="gestionar.html"], .dropdown-menu a[href="/gestionar.html"]');
        if (gestionarLink) gestionarLink.classList.add('active');
      }

      // IMPORTANTE: Asegurar que el link de 'Viajes' (calendario) NO esté activo
      const viajesLink = document.querySelector('#nav-viajes > a, nav-viajes a, [href="viajes.html"], [href="/viajes.html"]');
      if (viajesLink) viajesLink.classList.remove('active');
      return;
    }

    // REGLA 2: Para otros links, buscar coincidencia simple
    const normalizeHref = (href) => href ? href.replace(/^\//, '') : '';
    const currentPage = currentPath.split('/').pop() || 'index.html';

    const matchLink = Array.from(navAnchors)
      .find(anchor => {
        const href = anchor.getAttribute('href');
        return normalizeHref(href) === currentPage;
      });

    if (matchLink) matchLink.classList.add('active');
  }

  // Exponer función globalmente
  window.syncNavbarActiveState = syncNavbarActiveState;

  // Ejecutar cuando DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncNavbarActiveState);
  } else {
    syncNavbarActiveState();
  }

  // Re-ejecutar periódicamente por navegación dinámica
  setInterval(syncNavbarActiveState, 1000);

})();

// ============================================
// SHIFT-DATE LOGIC - Fecha Contable del Turno
// ============================================
// Si la hora actual es entre 00:00 y 07:59, el turno de noche pertenece
// al día anterior (ej: turno 20:00-08:00 quedará bajo la fecha de inicio).
window.getShiftDate = function getShiftDate() {
  var now = new Date();
  if (now.getHours() < 8) {
    var prev = new Date(now);
    prev.setDate(prev.getDate() - 1);
    return prev;
  }
  return new Date(now);
};

window.getShiftDateISO = function getShiftDateISO() {
  var d = window.getShiftDate();
  var y = d.getFullYear();
  var mo = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + mo + '-' + day;
};

// ============================================
// THEME TOGGLE LOGIC
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const icon = themeToggle.querySelector('i');
    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark-theme');
      if (icon) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
      }
    }
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      const isDark = document.body.classList.contains('dark-theme');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      if (icon) {
        icon.classList.remove('fa-moon', 'fa-sun');
        icon.classList.add(isDark ? 'fa-sun' : 'fa-moon');
      }
    });
  }
});

// ============================================
// UNIVERSAL SECURITY: DOBLE FACTOR HUMANO
// ============================================
window.basaltoSecurity = {
  requireHardDelete: function(options) {
    const { 
      title = "Eliminar Definitivamente", 
      message = "Esta acción borrará el registro de forma permanente.", 
      onConfirm 
    } = options;
    
    // Remover modal existente si quedó pegado
    const existing = document.getElementById('universal-hard-delete-modal');
    if (existing) existing.remove();

    // Inyectar HTML
    const modalHtml = `
      <div id="universal-hard-delete-modal" class="modal">
        <div class="modal-content modal-card" style="max-width: 480px;">
          <div class="modal-header">
            <h3 class="modal-title">
              <i class="fa-solid fa-trash highlight-icon" style="color: #dc2626;"></i> ${title}
            </h3>
          </div>

          <div class="modal-body">
            <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; background-color: #fee2e2; border-radius: 8px; border-left: 4px solid #dc2626; margin-bottom: 16px;">
              <i class="fa-solid fa-circle-exclamation" style="color: #dc2626; margin-top: 2px;"></i>
              <div>
                <p style="margin: 0; font-weight: 700; color: #7f1d1d; font-size: 14px;">⚠️ ADVERTENCIA</p>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #991b1b; line-height: 1.5;">${message}</p>
              </div>
            </div>

            <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; margin-top: 16px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
              <input type="checkbox" id="universal-delete-checkbox" style="margin-top: 4px; width: 16px; height: 16px; accent-color: #dc2626; cursor: pointer;">
              <span style="font-size: 14px; color: #374151; line-height: 1.4; font-weight: 500;">
                Entiendo que esta acción es permanente, borrará registros relacionados y NO se puede revertir
              </span>
            </label>
          </div>

          <div class="modal-footer" style="margin-top: 18px; display: flex; justify-content: flex-end; gap: 12px;">
            <button type="button" id="universal-delete-cancel" class="btn-cancel">Cancelar</button>
            <button type="button" id="universal-delete-confirm" class="btn btn-danger" disabled style="opacity: 0.5; cursor: not-allowed; transition: all 0.3s ease;">
              <i class="fa-solid fa-trash"></i> Confirmar Eliminación
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('universal-hard-delete-modal');
    const btnConfirm = document.getElementById('universal-delete-confirm');
    const btnCancel = document.getElementById('universal-delete-cancel');
    const checkbox = document.getElementById('universal-delete-checkbox');
    let timer = null;

    function resetModalState() {
      if (timer) clearInterval(timer);
      checkbox.checked = false;
      btnConfirm.disabled = true;
      btnConfirm.style.opacity = '0.5';
      btnConfirm.style.cursor = 'not-allowed';
      btnConfirm.innerHTML = '<i class="fa-solid fa-trash"></i> Confirmar Eliminación';
    }

    function closeModal() {
      resetModalState();
      if (window.basaltoModal && typeof window.basaltoModal.close === 'function') {
        window.basaltoModal.close(modal);
      } else {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('overflow-hidden', 'modal-open');
      }
      setTimeout(() => modal.remove(), 300);
    }

    checkbox.addEventListener('change', (e) => {
      if (timer) clearInterval(timer);
      
      if (e.target.checked) {
        let timeLeft = 5;
        btnConfirm.disabled = true;
        btnConfirm.style.opacity = '0.8';
        btnConfirm.style.cursor = 'wait';
        btnConfirm.innerHTML = `<i class="fa-solid fa-hourglass-start"></i> Confirmar eliminación (${timeLeft}s)...`;
        
        timer = setInterval(() => {
          timeLeft--;
          if (timeLeft > 0) {
            btnConfirm.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> Confirmar eliminación (${timeLeft}s)...`;
          } else {
            clearInterval(timer);
            btnConfirm.disabled = false;
            btnConfirm.style.opacity = '1';
            btnConfirm.style.cursor = 'pointer';
            btnConfirm.innerHTML = '<i class="fa-solid fa-trash"></i> Confirmar Eliminación Permanente';
          }
        }, 1000);
      } else {
        resetModalState();
      }
    });

    btnCancel.addEventListener('click', closeModal);
    modal.addEventListener('click', (ev) => {
      if (ev.target === modal) closeModal();
    });

    btnConfirm.addEventListener('click', async () => {
      if (!btnConfirm.disabled) {
        closeModal();
        if (typeof onConfirm === 'function') {
          await onConfirm();
        }
      }
    });

    // Abrir modal
    if (window.basaltoModal && typeof window.basaltoModal.open === 'function') {
      window.basaltoModal.open(modal);
    } else {
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('overflow-hidden', 'modal-open');
    }
  }
};

// ============================================
// ALGORITMO MAESTRO DE TURNOS (Fórmula Compartida)
// ============================================
(function() {
  const INICIO_CD = new Date(2026, 1, 21); // 21 de febrero 2026 (Pista 1: C-D)
  INICIO_CD.setHours(0, 0, 0, 0);

  const INICIO_EFGH = new Date(2026, 1, 14); // 14 de febrero 2026 (Pista 2: G-H, 7 días antes)
  INICIO_EFGH.setHours(0, 0, 0, 0);

  const MS_PER_DAY = 86400000;
  const DIAS_POR_BLOQUE = 14;
  const CICLO_COMPLETO = DIAS_POR_BLOQUE * 4;

  // Devuelve { pista1: {manana, tarde, doble}, pista2: {manana, tarde, doble}, semanales }
  function obtenerGruposDelDia(fecha) {
    const fechaCopy = new Date(fecha);
    fechaCopy.setHours(0, 0, 0, 0);
    
    // ===== PISTA 1: A-B-C-D + grupos dobles AB, CD =====
    const diasCD = Math.floor((fechaCopy - INICIO_CD) / MS_PER_DAY);
    const cicloCD = ((diasCD % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO;
    
    let pista1 = null;
    
    if (cicloCD >= 0 && cicloCD < 14) {
      pista1 = { manana: 'C', tarde: 'D', doble: 'CD' };
    } else if (cicloCD >= 14 && cicloCD < 28) {
      pista1 = { manana: 'A', tarde: 'B', doble: 'AB' };
    } else if (cicloCD >= 28 && cicloCD < 42) {
      pista1 = { manana: 'D', tarde: 'C', doble: 'CD' };
    } else if (cicloCD >= 42 && cicloCD < 56) {
      pista1 = { manana: 'B', tarde: 'A', doble: 'AB' };
    }
    
    // ===== PISTA 2: E-F-G-H + grupos dobles EF, GH =====
    const diasEFGH = Math.floor((fechaCopy - INICIO_EFGH) / MS_PER_DAY);
    const cicloEFGH = ((diasEFGH % CICLO_COMPLETO) + CICLO_COMPLETO) % CICLO_COMPLETO;
    
    let pista2 = null;
    
    if (cicloEFGH >= 0 && cicloEFGH < 14) {
      pista2 = { manana: 'G', tarde: 'H', doble: 'GH' };
    } else if (cicloEFGH >= 14 && cicloEFGH < 28) {
      pista2 = { manana: 'E', tarde: 'F', doble: 'EF' };
    } else if (cicloEFGH >= 28 && cicloEFGH < 42) {
      pista2 = { manana: 'H', tarde: 'G', doble: 'GH' };
    } else if (cicloEFGH >= 42 && cicloEFGH < 56) {
      pista2 = { manana: 'F', tarde: 'E', doble: 'EF' };
    }
    
    // ===== GRUPOS SEMANALES J, K =====
    const semanales = [];
    const dia = fechaCopy.getDay(); // 0=Dom, 1=Lun...
    if ([1, 2, 3, 4].includes(dia)) semanales.push('J');
    if ([2, 3, 4, 5].includes(dia)) semanales.push('K');
    
    return { pista1, pista2, semanales };
  }

  // Comprueba si un grupo en particular está de turno en la fecha dada
  function isGrupoOnShift(idGrupo, fecha = new Date()) {
     const gruposActivos = obtenerGruposDelDia(fecha);
     const g = String(idGrupo || '').toUpperCase().trim();
     if (!g) return false;

     if (gruposActivos.pista1) {
       if (gruposActivos.pista1.manana === g || gruposActivos.pista1.tarde === g || gruposActivos.pista1.doble === g) return true;
     }

     if (gruposActivos.pista2) {
       if (gruposActivos.pista2.manana === g || gruposActivos.pista2.tarde === g || gruposActivos.pista2.doble === g) return true;
     }

     if (gruposActivos.semanales && gruposActivos.semanales.includes(g)) return true;

     return false;
  }

  window.basaltoShiftUtils = {
    obtenerGruposDelDia,
    isGrupoOnShift,
    INICIO_CD,
    INICIO_EFGH,
    CICLO_COMPLETO,
    MS_PER_DAY
  };
})();
