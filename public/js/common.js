// ============================================
// COMMON.JS - Utilities y Lógica Compartida
// ============================================

(function() {
  'use strict';

  const BODY_MODAL_LOCK_CLASS = 'overflow-hidden';
  let openManagedModalCount = 0;
  const modalFocusOriginMap = new WeakMap();

  function moveFocusOutsideModal(modalElement) {
    if (!modalElement) return;

    const activeElement = document.activeElement;
    if (activeElement && modalElement.contains(activeElement)) {
      if (typeof activeElement.blur === 'function') activeElement.blur();

      // Fallback seguro para navegadores que mantienen foco virtual tras blur.
      if (document.body && typeof document.body.focus === 'function') {
        document.body.setAttribute('tabindex', '-1');
        document.body.focus({ preventScroll: true });
      }
    }
  }

  function restoreFocusAfterClose(modalElement) {
    if (!modalElement) return;

    const originElement = modalFocusOriginMap.get(modalElement);
    if (originElement && document.contains(originElement) && typeof originElement.focus === 'function') {
      originElement.focus({ preventScroll: true });
    }

    if (document.body?.getAttribute('tabindex') === '-1') {
      document.body.removeAttribute('tabindex');
    }

    modalFocusOriginMap.delete(modalElement);
  }

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
    modalFocusOriginMap.set(modalElement, document.activeElement);

    if (modalElement.dataset.bodyScrollLocked !== 'true') {
      modalElement.dataset.bodyScrollLocked = 'true';
      lockBodyScroll();
    }

    modalElement.inert = false;
    modalElement.classList.add(showClass);
    modalElement.setAttribute('aria-hidden', 'false');
    return true;
  }

  function closeManagedModal(modalElement, options = {}) {
    if (!modalElement) return false;

    const { showClass = 'show' } = options;

    moveFocusOutsideModal(modalElement);
    modalElement.classList.remove(showClass);
    modalElement.setAttribute('aria-hidden', 'true');
    modalElement.inert = true;

    if (modalElement.dataset.bodyScrollLocked === 'true') {
      delete modalElement.dataset.bodyScrollLocked;
      unlockBodyScroll();
    }

    restoreFocusAfterClose(modalElement);

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

  function ensureGlobalFeedbackModal() {
    let modal = document.getElementById('global-feedback-modal');
    if (modal) return modal;

    if (!document.getElementById('global-feedback-style')) {
      const style = document.createElement('style');
      style.id = 'global-feedback-style';
      style.textContent = `
        #global-feedback-modal .feedback-content { border-top: 4px solid #64748b; }
        #global-feedback-modal .feedback-title { display: flex; align-items: center; gap: 8px; }
        #global-feedback-modal .feedback-icon { font-size: 18px; line-height: 1; }
        #global-feedback-modal .feedback-btn { min-width: 120px; }
        #global-feedback-modal.feedback-success .feedback-content { border-top-color: #16a34a; }
        #global-feedback-modal.feedback-success .feedback-title { color: #166534; }
        #global-feedback-modal.feedback-success .feedback-btn { background: #16a34a; color: #fff; border: none; }
        #global-feedback-modal.feedback-error .feedback-content { border-top-color: #dc2626; }
        #global-feedback-modal.feedback-error .feedback-title { color: #991b1b; }
        #global-feedback-modal.feedback-error .feedback-btn { background: #dc2626; color: #fff; border: none; }
        #global-feedback-modal.feedback-warning .feedback-content { border-top-color: #d97706; }
        #global-feedback-modal.feedback-warning .feedback-title { color: #92400e; }
        #global-feedback-modal.feedback-warning .feedback-btn { background: #d97706; color: #fff; border: none; }
        #global-feedback-modal.feedback-info .feedback-content { border-top-color: #2563eb; }
        #global-feedback-modal.feedback-info .feedback-title { color: #1e3a8a; }
        #global-feedback-modal.feedback-info .feedback-btn { background: #2563eb; color: #fff; border: none; }
      `;
      document.head.appendChild(style);
    }

    modal = document.createElement('div');
    modal.id = 'global-feedback-modal';
    modal.className = 'modal-overlay feedback-info';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="modal-content feedback-content" style="max-width:520px;">
        <div class="modal-header">
          <h2 id="global-feedback-title" class="feedback-title"><span class="feedback-icon">ℹ</span><span class="feedback-title-text">Mensaje</span></h2>
          <button class="modal-close" id="global-feedback-close" type="button" aria-label="Cerrar ventana">&times;</button>
        </div>
        <div class="modal-body" style="padding: 18px 20px;">
          <p id="global-feedback-message" style="margin:0; color:#374151; line-height:1.5;"></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-modal feedback-btn" id="global-feedback-accept">Entendido</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#global-feedback-close');
    const acceptBtn = modal.querySelector('#global-feedback-accept');

    const closeModal = () => {
      if (window.basaltoModal?.close) window.basaltoModal.close(modal);
      else {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
      }
    };

    closeBtn?.addEventListener('click', closeModal);
    acceptBtn?.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });

    return modal;
  }

  function getFeedbackContextLabel() {
    const page = String(window.location.pathname || '').toLowerCase();
    if (page.endsWith('/gestionadmins.html')) return 'Administradores';
    if (page.endsWith('/gestionar.html')) return 'Trabajadores';
    if (page.endsWith('/gestioninformes.html') || page.endsWith('/informe.html')) return 'Informes';
    if (page.endsWith('/gestionviajes.html')) return 'Viajes';
    if (page.endsWith('/gestioncargos.html')) return 'Cargos';
    if (page.endsWith('/datos.html')) return 'Perfil';
    if (page.endsWith('/dashboard.html')) return 'Dashboard';
    if (page.endsWith('/index.html')) return 'Inicio';
    return 'Sistema';
  }

  function inferFeedbackTitle(type, message) {
    const normalizedType = String(type || 'info').toLowerCase();
    const text = String(message || '').toLowerCase();
    const context = getFeedbackContextLabel();

    if (normalizedType === 'success') return `${context}: operacion exitosa`;
    if (normalizedType === 'warning') return `${context}: atencion`;
    if (normalizedType === 'error') {
      if (text.includes('acceso denegado') || text.includes('no tiene permisos')) return `${context}: acceso denegado`;
      if (text.includes('rut')) return `${context}: RUT invalido o duplicado`;
      if (text.includes('email') || text.includes('correo')) return `${context}: correo invalido o duplicado`;
      if (text.includes('cargar')) return `${context}: error al cargar datos`;
      if (text.includes('guardar') || text.includes('crear') || text.includes('actualizar') || text.includes('eliminar')) return `${context}: error de operacion`;
      return `${context}: error`;
    }

    return context;
  }

  function showGlobalFeedback(message, type = 'info', customTitle = '') {
    const modal = ensureGlobalFeedbackModal();
    const titleEl = modal.querySelector('#global-feedback-title');
    const messageEl = modal.querySelector('#global-feedback-message');

    const normalizedType = String(type || 'info').toLowerCase();
    const iconMap = {
      success: '✓',
      error: '⚠',
      warning: '!',
      info: 'ℹ'
    };
    const safeType = ['success', 'error', 'warning', 'info'].includes(normalizedType) ? normalizedType : 'info';
    const titleText = String(customTitle || '').trim() || inferFeedbackTitle(normalizedType, message);

    modal.classList.remove('feedback-success', 'feedback-error', 'feedback-warning', 'feedback-info');
    modal.classList.add(`feedback-${safeType}`);
    titleEl.innerHTML = `<span class="feedback-icon">${iconMap[safeType]}</span><span class="feedback-title-text"></span>`;
    const titleTextEl = titleEl.querySelector('.feedback-title-text');
    if (titleTextEl) titleTextEl.textContent = titleText;
    messageEl.textContent = String(message || '').trim() || 'Sin detalles disponibles.';

    if (window.basaltoModal?.open) window.basaltoModal.open(modal);
    else {
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  window.basaltoFeedback = {
    show: showGlobalFeedback,
    success: (message, title = '') => showGlobalFeedback(message, 'success', title),
    error: (message, title = '') => showGlobalFeedback(message, 'error', title),
    warning: (message, title = '') => showGlobalFeedback(message, 'warning', title),
    info: (message, title = '') => showGlobalFeedback(message, 'info', title)
  };

  const nativeAlert = window.alert ? window.alert.bind(window) : null;
  window.alert = function patchedAlert(message) {
    try {
      const text = String(message || '').trim();
      const lower = text.toLowerCase();
      const isError = lower.startsWith('error') || text.includes('❌');
      const isSuccess = lower.startsWith('exito') || text.includes('✅');

      if (isError) window.basaltoFeedback.error(text);
      else if (isSuccess) window.basaltoFeedback.success(text);
      else window.basaltoFeedback.info(text);
    } catch (_err) {
      if (nativeAlert) nativeAlert(message);
    }
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

    // REGLA 1: Páginas de Gestión (gestionar.html, gestionviajes.html, gestioninformes.html, dashboard.html, gestioncargos.html, gestionadmins.html)
    // El botón padre 'Gestionar' debe mantener activo en TODAS las subsecciones
    const paginasGestion = ['gestionar.html', 'gestionviajes.html', 'gestioninformes.html', 'dashboard.html', 'gestioncargos.html', 'gestionadmins.html'];
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
      } else if (currentPath.endsWith('gestionadmins.html')) {
        const gestionAdminsLink = document.querySelector('.dropdown-menu a[href="gestionadmins.html"], .dropdown-menu a[href="/gestionadmins.html"]');
        if (gestionAdminsLink) gestionAdminsLink.classList.add('active');
      } else if (currentPath.endsWith('gestioncargos.html')) {
        const gestionCargosLink = document.querySelector('.dropdown-menu a[href="gestioncargos.html"], .dropdown-menu a[href="/gestioncargos.html"]');
        if (gestionCargosLink) gestionCargosLink.classList.add('active');
      }

      // IMPORTANTE: Asegurar que el link de 'Viajes' (calendario) NO esté activo
      const viajesLink = document.querySelector('#nav-viajes > a, nav-viajes a');
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

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  const shortMonths = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

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

  // Comprueba si un grupo está de turno, contemplando ventanas de horas (gracia)
  function isGrupoOnShift(idGrupo, fechaParam) {
     const g = String(idGrupo || '').toUpperCase().trim();
     if (!g) return false;

     const now = fechaParam ? new Date(fechaParam) : new Date();
     const h = now.getHours();
     const m = now.getMinutes();
     const timeValue = h + (m / 60); // Decimal (ej: 8.5 = 08:30)
     
     const gruposHoy = obtenerGruposDelDia(now);
     let isDiaHoy = false;
     let isNocheHoy = false;

     if (gruposHoy.pista1) {
       if (gruposHoy.pista1.manana === g || gruposHoy.pista1.doble === g) isDiaHoy = true;
       if (gruposHoy.pista1.tarde === g) isNocheHoy = true;
     }
     if (gruposHoy.pista2) {
       if (gruposHoy.pista2.manana === g || gruposHoy.pista2.doble === g) isDiaHoy = true;
       if (gruposHoy.pista2.tarde === g) isNocheHoy = true;
     }
     if (gruposHoy.semanales && gruposHoy.semanales.includes(g)) isDiaHoy = true;

     let resultadoFinal = false;

     // Escenario Día: Permitir reportes durante luz (ej. desde 07:00 am hasta las 20:30 pm)
     if (isDiaHoy) {
       if (timeValue >= 6.0 && timeValue <= 20.5) resultadoFinal = true; 
     }

     // Escenario Noche HOY (inicia típicamente a las 20:00)
     if (!resultadoFinal && isNocheHoy) {
       // Escenario A: Es el día calendario de su turno y son más de las 19:00 hrs
       if (timeValue >= 19.0) resultadoFinal = true; 
     }

     // Chequear turnos de la NOCHE DE AYER (Escenario traslape madrugada)
     const ayer = new Date(now);
     ayer.setDate(ayer.getDate() - 1);
     const gruposAyer = obtenerGruposDelDia(ayer);
     
     let isNocheAyer = false;
     if (gruposAyer.pista1 && gruposAyer.pista1.tarde === g) isNocheAyer = true;
     if (gruposAyer.pista2 && gruposAyer.pista2.tarde === g) isNocheAyer = true;

     if (!resultadoFinal && isNocheAyer) {
       // Escenario B: Día siguiente a su turno y son menos de las 08:30 AM
       if (timeValue <= 8.5) resultadoFinal = true;
     }

     console.log('[SHIFT_MATH] Hora actual:', h + ':' + m);
     console.log('[SHIFT_MATH] ID Grupo recibido:', idGrupo);
     console.log('[SHIFT_MATH] ¿Está en ventana de gracia?:', resultadoFinal);

     return resultadoFinal;
  }

  window.basaltoShiftUtils = {
    obtenerGruposDelDia,
    isGrupoOnShift,
    INICIO_CD,
    INICIO_EFGH,
    CICLO_COMPLETO,
    MS_PER_DAY,
    monthNames,
    shortMonths,
    dayNames,
    diasSemana,
    feriados2026
  };
})();
