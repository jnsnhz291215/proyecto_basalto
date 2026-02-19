// ============================================
// COMMON.JS - Utilities y Lógica Compartida
// ============================================

(function() {
  'use strict';

  // ============================================
  // NAVBAR ACTIVE STATE - Lógica excluyente
  // ============================================
  function syncNavbarActiveState() {
    const currentPath = window.location.pathname;
    const navAnchors = document.querySelectorAll('.nav-item a, .dropdown-menu a, .nav-link.dropdown-toggle');

    if (!navAnchors.length) return;

    // Limpiar todos los activos
    navAnchors.forEach(anchor => anchor.classList.remove('active'));

    // REGLA 1: Páginas de Gestión (gestionar.html, gestionviajes.html, gestioninformes.html)
    // El botón padre 'Gestionar' debe mantener activo en TODAS las subsecciones
    const paginasGestion = ['gestionar.html', 'gestionviajes.html', 'gestioninformes.html'];
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
