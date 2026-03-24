// ============================================
// NAVBAR - Funcionalidad del menú (SIMPLIFICADO)
// La autenticación es manejada por auth_guard.js
// ============================================
(function(){
  'use strict';

  let menuObserver = null;
  let navbarInitialized = false;

  function ensureNavbarStylesheet() {
    if (document.querySelector('link[data-basalto-navbar-css="1"]')) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/navbar.css';
    link.setAttribute('data-basalto-navbar-css', '1');
    document.head.appendChild(link);
  }

  function bindMobileMenuHandlers() {
    const navToggle = document.getElementById('nav-toggle');
    const navItems = document.getElementById('nav-items');
    const navRight = document.getElementById('usuario-container');

    if (!navToggle || !navItems || navToggle.dataset.boundMenuToggle === '1') return;

    navToggle.dataset.boundMenuToggle = '1';
    navToggle.addEventListener('click', () => {
      navItems.classList.toggle('show');
      if (navRight) navRight.classList.toggle('show');
    });

    const navLinks = navItems.querySelectorAll('a');
    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        navItems.classList.remove('show');
        if (navRight) navRight.classList.remove('show');
      });
    });
  }

  async function ensureSharedMenuLoaded() {
    const placeholder = document.getElementById('shared-menu-placeholder');
    if (!placeholder) return false;

    const page = window.location.pathname.split('/').pop() || 'index.html';
    console.log(`[NAVBAR_LOADER] Verificando carga en ${page}.`);

    if (document.querySelector('.top-menu')) {
      ensureNavbarStylesheet();
      bindMobileMenuHandlers();
      console.log(`[NAVBAR_LOADER] Navbar ya presente en ${page}.`);
      if (!window.__basaltoMenuReady) {
        window.__basaltoMenuReady = true;
        window.dispatchEvent(new CustomEvent('basalto:menu-ready'));
      }
      return true;
    }

    if (window.__basaltoMenuLoaderPromise) {
      return window.__basaltoMenuLoaderPromise;
    }

    window.__basaltoMenuLoaderPromise = (async () => {
      ensureNavbarStylesheet();
      const response = await fetch('menu.html');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} cargando menu.html`);
      }

      const html = await response.text();
      placeholder.innerHTML = html;
      bindMobileMenuHandlers();
      console.log(`[NAVBAR_LOADER] Navbar inyectado correctamente en ${page}.`);

      try { if (window.syncNavbarActive) window.syncNavbarActive(); } catch (_e) {}
      try { if (window.actualizarInterfaz) window.actualizarInterfaz(); } catch (_e) {}

      window.__basaltoMenuReady = true;
      window.dispatchEvent(new CustomEvent('basalto:menu-ready'));
      return true;
    })().catch((error) => {
      console.error('[NAVBAR] No se pudo cargar el menú compartido:', error?.message || error);
      return false;
    }).finally(() => {
      window.__basaltoMenuLoaderPromise = null;
    });

    return window.__basaltoMenuLoaderPromise;
  }

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

    // KPIs Dashboard Check
    const permisosStr = localStorage.getItem('user_permisos');
    const hasKpiPerms = valor === '1' || (permisosStr && permisosStr.includes('admin_v_kpis'));
    const dashboardMenuItem = menu.querySelector('#nav-dashboard');
    if (dashboardMenuItem) {
      menu.appendChild(dashboardMenuItem);
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

  function renderShiftIndicator() {
    const nameEl = document.querySelector('.user-name');
    if (!nameEl || !window.basaltoShiftUtils) return false;
    
    // Evitar over-rendering
    if (nameEl.parentNode.querySelector('.shift-status-badge')) return true;

    const usuarioActivoRaw = localStorage.getItem('usuarioActivo');
    if (!usuarioActivoRaw) return false;
    
    try {
      const usuario = JSON.parse(usuarioActivoRaw);
      if (!usuario || !usuario.grupo) return false;
      
      const isEnTurno = window.basaltoShiftUtils.isGrupoOnShift(usuario.grupo);
      
      const badge = document.createElement('span');
      badge.className = 'shift-status-badge';
      badge.style.display = 'inline-flex';
      badge.style.alignItems = 'center';
      badge.style.marginLeft = '8px';
      badge.style.padding = '2px 8px';
      badge.style.borderRadius = '12px';
      badge.style.fontSize = '11px';
      badge.style.fontWeight = '700';
      badge.style.color = 'white';
      
      const dot = document.createElement('span');
      dot.style.width = '6px';
      dot.style.height = '6px';
      dot.style.backgroundColor = 'white';
      dot.style.borderRadius = '50%';
      dot.style.display = 'inline-block';
      dot.style.marginRight = '5px';
      
      badge.appendChild(dot);
      
      if (isEnTurno) {
        badge.style.backgroundColor = '#10b981'; // Valid Green
        badge.appendChild(document.createTextNode('EN TURNO'));
      } else {
        badge.style.backgroundColor = '#ef4444'; // Rest Red
        badge.appendChild(document.createTextNode('DESCANSO'));
      }
      
      nameEl.parentNode.insertBefore(badge, nameEl.nextSibling);
      return true;
    } catch(e) {
      console.error('[NAVBAR] Error rendering Shift Indicator:', e);
      return false;
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
      renderShiftIndicator();
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

  async function bootNavbar() {
    if (window.__basaltoNavbarBooting) return;
    window.__basaltoNavbarBooting = true;

    try {
      await ensureSharedMenuLoaded();
      whenAuthReady(initializeNavbar);
    } finally {
      window.__basaltoNavbarBooting = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bootNavbar();
  });

  if (document.readyState !== 'loading') {
    bootNavbar();
  }

})();
