// ============================================
// NAVBAR - Funcionalidad del menú (SIMPLIFICADO)
// La autenticación es manejada por auth_guard.js
// ============================================
(function(){
  'use strict';

  let menuObserver = null;
  let navbarInitialized = false;

  // Función para abrir el modal de login (para compatibilidad con menu.html)
  function abrirLoginModal() {
    const dm = document.getElementById('dual-login-modal');
    if (dm) {
      dm.classList.add('show');
    } else {
      // Si no hay modal dual, redirigir a index.html
      if (!window.location.pathname.includes('index.html')) {
        window.location.href = '/index.html';
      }
    }
  }
  window.abrirLoginModal = abrirLoginModal;

  function isGestionAdminsPage() {
    return window.location.pathname.endsWith('gestionadmins.html');
  }

  function getGestionarMenuContainer() {
    const gestionarToggle = document.getElementById('navbarDropdownGestionar');
    const nextMenu = gestionarToggle?.nextElementSibling;

    if (nextMenu && nextMenu.classList.contains('dropdown-menu')) {
      return nextMenu;
    }

    return document.querySelector('#nav-gestionar-parent .dropdown-menu');
  }

  function ensureAdminDivider(menu) {
    let dividerLi = menu.querySelector('#nav-admins');
    if (!dividerLi) {
      dividerLi = document.createElement('li');
      dividerLi.id = 'nav-admins';

      const divider = document.createElement('hr');
      divider.className = 'dropdown-divider';
      dividerLi.appendChild(divider);
      menu.appendChild(dividerLi);
    }
    return dividerLi;
  }

  function ensureAdminItem(menu) {
    let itemLi = menu.querySelector('#nav-admins-item');
    if (!itemLi) {
      itemLi = document.createElement('li');
      itemLi.id = 'nav-admins-item';
      menu.appendChild(itemLi);
    }

    let link = itemLi.querySelector('a[href="gestionadmins.html"], a[href="/gestionadmins.html"]');
    if (!link) {
      link = document.createElement('a');
      link.className = 'dropdown-item super-admin-only';
      link.href = 'gestionadmins.html';

      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-shield-alt';
      link.appendChild(icon);
      link.appendChild(document.createTextNode(' Administradores'));

      itemLi.innerHTML = '';
      itemLi.appendChild(link);
    }

    return itemLi;
  }

  function renderAdminLink() {
    const menu = getGestionarMenuContainer();
    if (!menu) {
      return false;
    }

    const valor = localStorage.getItem('user_super_admin');
    console.log('[NAVBAR] Valor detectado:', valor);
    
    // KPIs Dashboard Check
    const permisosStr = localStorage.getItem('user_permisos');
    const hasKpiPerms = valor === '1' || (permisosStr && permisosStr.includes('admin_v_kpis'));
    const dashboardMenuItem = menu.querySelector('#nav-dashboard');
    if (dashboardMenuItem) {
      dashboardMenuItem.style.display = hasKpiPerms ? 'block' : 'none';
      const kpiLink = dashboardMenuItem.querySelector('a');
      if (kpiLink) {
        if (window.location.pathname.endsWith('dashboard.html')) {
          kpiLink.classList.add('active');
        } else {
          kpiLink.classList.remove('active');
        }
      }
    }

    const forceVisible = valor === '1' || isGestionAdminsPage();
    const dividerLi = ensureAdminDivider(menu);
    const itemLi = ensureAdminItem(menu);
    const link = itemLi.querySelector('a[href="gestionadmins.html"], a[href="/gestionadmins.html"]');

    dividerLi.style.display = forceVisible ? 'block' : 'none';
    itemLi.style.display = forceVisible ? 'block' : 'none';

    if (link) {
      if (isGestionAdminsPage()) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    }

    return true;
  }

  function stopMenuObserver() {
    if (!menuObserver) return;
    menuObserver.disconnect();
    menuObserver = null;
  }

  function syncNavbarAfterRender() {
    if (window.syncNavbarActive) {
      window.syncNavbarActive();
    }
    if (window.syncNavbarActiveState) {
      window.syncNavbarActiveState();
    }
    if (window.actualizarInterfaz) {
      window.actualizarInterfaz();
    }
  }

  function initSuperAdminOption() {
    if (navbarInitialized) return;

    const rendered = renderAdminLink();
    if (rendered) {
      navbarInitialized = true;
      stopMenuObserver();
      syncNavbarAfterRender();
    }
  }

  function startMenuObserver() {
    if (menuObserver) return;

    menuObserver = new MutationObserver(() => {
      initSuperAdminOption();
    });

    menuObserver.observe(document.body, { childList: true, subtree: true });
  }

  function waitForNavbarAndInit(retries = 0) {
    if (navbarInitialized) return;

    if (renderAdminLink()) {
      navbarInitialized = true;
      window.__basaltoMenuReady = true;
      stopMenuObserver();
      syncNavbarAfterRender();
      window.dispatchEvent(new CustomEvent('basalto:menu-ready'));
      return;
    }

    if (retries >= 80) {
      return;
    }

    setTimeout(() => waitForNavbarAndInit(retries + 1), 50);
  }

  function initializeNavbar() {
    waitForNavbarAndInit();
    startMenuObserver();
  }

  function whenAuthReady(callback) {
    if (window.__basaltoAuthReady) {
      callback();
      return;
    }

    let resolved = false;

    const resolveOnce = () => {
      if (resolved) return;
      resolved = true;
      callback();
    };

    const onAuthReady = () => {
      window.removeEventListener('basalto:auth-ready', onAuthReady);
      resolveOnce();
    };

    window.addEventListener('basalto:auth-ready', onAuthReady);
    setTimeout(() => {
      window.removeEventListener('basalto:auth-ready', onAuthReady);
      resolveOnce();
    }, 600);
  }

  // Funcionalidad del menú móvil (toggle hamburguesa)
  document.addEventListener('DOMContentLoaded', () => {
    const navToggle = document.getElementById('nav-toggle');
    const navItems = document.getElementById('nav-items');
    
    if (navToggle && navItems) {
      navToggle.addEventListener('click', function() {
        navItems.classList.toggle('show');
      });
    }
    
    // Toggle del menú de usuario
    const userToggle = document.getElementById('user-toggle');
    const userMenu = document.querySelector('.user-menu');
    
    if (userToggle && userMenu) {
      userToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        userMenu.classList.toggle('show');
        const isExpanded = userMenu.classList.contains('show');
        userToggle.setAttribute('aria-expanded', isExpanded);
        userMenu.setAttribute('aria-hidden', !isExpanded);
      });
      
      // Cerrar menú al hacer click fuera
      document.addEventListener('click', function(e) {
        if (!userToggle.contains(e.target) && !userMenu.contains(e.target)) {
          userMenu.classList.remove('show');
          userToggle.setAttribute('aria-expanded', 'false');
          userMenu.setAttribute('aria-hidden', 'true');
        }
      });
    }

    // Esperar validación de sesión y luego renderizar el link en el dropdown correcto.
    whenAuthReady(initializeNavbar);
  });

  if (document.readyState !== 'loading') {
    whenAuthReady(initializeNavbar);
  }

})();
