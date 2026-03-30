// ============================================
// NAVBAR CORE - Sistema Robusto de Usuario
// ============================================
// Este script usa delegación de eventos para funcionar
// independientemente del orden de carga de otros scripts

(function() {
  'use strict';

  let userNameApplied = false;

  // ============================================
  // DELEGACIÓN DE EVENTOS GLOBAL
  // ============================================
  document.addEventListener('click', (e) => {
    const toggleBtn = document.getElementById('user_toggle_btn');
    const menu = document.getElementById('user_dropdown_menu');

    // ============================================
    // 1. TOGGLE DEL MENÚ DE USUARIO
    // ============================================
    if (toggleBtn && toggleBtn.contains(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      
      if (menu) {
        const isShown = menu.classList.contains('show');
        menu.classList.toggle('show');
        console.log('[NAVBAR_CORE] Toggle menú usuario:', !isShown);
      }
    } 
    // ============================================
    // 2. CERRAR MENÚ SI SE HACE CLIC FUERA
    // ============================================
    else if (menu && menu.classList.contains('show') && !menu.contains(e.target)) {
      menu.classList.remove('show');
      console.log('[NAVBAR_CORE] Cerrar menú usuario (click fuera)');
    }

    // ============================================
    // 3. LÓGICA DE LOGOUT (DELEGADA)
    // ============================================
    if (e.target.id === 'btn_logout' || e.target.closest('#btn_logout')) {
      e.preventDefault();
      console.log('[NAVBAR_CORE] Cerrando sesión');

      // Limpiar localStorage completo
      localStorage.clear();

      // Redirigir al inicio
      window.location.href = '/index.html';
    }
  });

  // ============================================
  // ACTUALIZAR NOMBRE DE USUARIO
  // ============================================
  function updateUserName() {
    const userNameElement = document.getElementById('user_name_span');

    if (!userNameElement || userNameApplied) {
      return;
    }

    const userName = localStorage.getItem('user_name');
    if (!userName) return;

    if (userNameElement.textContent !== userName) {
      userNameElement.textContent = userName;
    }
    userNameApplied = true;
  }

  // ============================================
  // NAVBAR ACTIVE STATE
  // ============================================
  function normalizeHref(href) {
    if (!href) return '';
    return href.replace(/^\//, '');
  }

  function syncNavbarActive() {
    const currentPath = window.location.pathname;
    const currentPage = currentPath.split('/').pop() || 'index.html';
    const navAnchors = document.querySelectorAll('.nav-item a, .dropdown-menu a, .nav-link.dropdown-toggle');

    if (!navAnchors.length) return;

    navAnchors.forEach(anchor => anchor.classList.remove('active'));

    // Páginas de Gestión: marcar el botón padre 'Gestionar' en TODAS (púrpura corporativo #4f46e5)
    const paginasGestion = ['gestionar.html', 'gestionviajes.html', 'gestioninformes.html', 'gestionadmins.html', 'gestioncargos.html'];
    const esPaginaGestion = paginasGestion.some(pagina => currentPath.endsWith(pagina));

    if (esPaginaGestion) {
      const gestionarToggle = document.getElementById('navbarDropdownGestionar');
      if (gestionarToggle) gestionarToggle.classList.add('active');

      // Marcar el ítem interno específico
      if (currentPath.endsWith('gestionviajes.html')) {
        const gestionViajesLink = document.querySelector('.dropdown-menu a[href="gestionviajes.html"], .dropdown-menu a[href="/gestionviajes.html"]');
        if (gestionViajesLink) gestionViajesLink.classList.add('active');
      } else if (currentPath.endsWith('gestioninformes.html')) {
        const gestionInformesLink = document.querySelector('.dropdown-menu a[href="gestioninformes.html"], .dropdown-menu a[href="/gestioninformes.html"]');
        if (gestionInformesLink) gestionInformesLink.classList.add('active');
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

      // No marcar 'Viajes' (calendario)
      const viajesLink = document.querySelector('#nav-viajes > a');
      if (viajesLink) viajesLink.classList.remove('active');
      return;
    }

    const matchLink = Array.from(document.querySelectorAll('.nav-item a, .dropdown-menu a'))
      .find(anchor => normalizeHref(anchor.getAttribute('href')) === currentPage);

    if (matchLink) matchLink.classList.add('active');
  }

  window.syncNavbarActive = syncNavbarActive;

  // ============================================
  // TOGGLE DE UI (LOGIN vs USUARIO)
  // ============================================
  function toggleAuthUI() {
    const userRole = localStorage.getItem('user_role');
    const loginBtn = document.getElementById('nav-login-btn');
    const userDropdown = document.getElementById('user-dropdown');
    
    if (userRole) {
      // Usuario autenticado
      if (loginBtn) loginBtn.style.display = 'none';
      if (userDropdown) userDropdown.style.display = 'block';
    } else {
      // No autenticado
      if (loginBtn) loginBtn.style.display = 'inline-block';
      if (userDropdown) userDropdown.style.display = 'none';
    }
  }

  // ============================================
  // OCULTAR ELEMENTOS SOLO-ADMIN
  // ============================================
  function toggleAdminElements() {
    const userRole = localStorage.getItem('user_role');
    const isAdmin = userRole === 'admin';
    
    // Ocultar todos los elementos .admin-only si no es admin
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    adminOnlyElements.forEach(element => {
      if (isAdmin) {
        element.style.display = '';
      } else {
        element.style.display = 'none';
      }
    });
    
    // Gestión especial para super-admin-only
    const isSuperAdmin = localStorage.getItem('user_super_admin') === '1';
    const superAdminElements = document.querySelectorAll('.super-admin-only');
    superAdminElements.forEach(element => {
      if (isSuperAdmin) {
        element.style.display = '';
        // Mostrar también el contenedor padre si está oculto
        const parentLi = element.closest('li');
        if (parentLi && parentLi.id === 'nav-admins-item') {
          parentLi.style.display = '';
          // Mostrar el divider también
          const divider = document.getElementById('nav-admins');
          if (divider) divider.style.display = '';
        }
      } else {
        element.style.display = 'none';
      }
    });
    
    // Dashboard KPIs: mostrar solo si tiene permiso admin_v_kpis
    const dashboardLink = document.getElementById('nav-dashboard');
    if (dashboardLink) {
      const permisosAdmin = localStorage.getItem('user_permisos');
      const hasKPIPermission = permisosAdmin && permisosAdmin.includes('admin_v_kpis');
      dashboardLink.style.display = (isAdmin && hasKPIPermission) ? '' : 'none';
    }
  }

  function refreshNavbarState() {
    updateUserName();
    toggleAuthUI();
    toggleAdminElements();
    syncNavbarActive();
  }

  // ============================================
  // INICIALIZACIÓN
  // ============================================
  // Ejecutar inmediatamente
  refreshNavbarState();

  // Ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      refreshNavbarState();
    });
  }

  window.addEventListener('basalto:menu-ready', () => {
    refreshNavbarState();
  });

  window.addEventListener('basalto:auth-ready', () => {
    refreshNavbarState();
  });
})();
