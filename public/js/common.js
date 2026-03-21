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
