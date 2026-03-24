// ============================================
// NAVBAR - Cargador del header compartido (SIMPLIFICADO)
// La autenticación es manejada por auth_guard.js
// ============================================
(function(){
  'use strict';

  let navbarObserver = null;
  let navbarInitialized = false;

  function ensureNavbarStylesheet() {
    if (document.querySelector('link[data-basalto-navbar-css="1"]')) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/navbar.css';
    link.setAttribute('data-basalto-navbar-css', '1');
    document.head.appendChild(link);
  }

  function bindMobileNavbarHandlers() {
    const navToggle = document.getElementById('nav-toggle');
    const navItems = document.getElementById('nav-items');
    const navRight = document.getElementById('usuario-container');

    if (!navToggle || !navItems || navToggle.dataset.boundNavbarToggle === '1') return;

    navToggle.dataset.boundNavbarToggle = '1';
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

  function dispatchNavbarReady() {
    window.__basaltoNavbarReady = true;
    window.__basaltoMenuReady = true;
    window.dispatchEvent(new CustomEvent('basalto:navbar-ready'));
    window.dispatchEvent(new CustomEvent('basalto:menu-ready'));
  }

  async function ensureSharedNavbarLoaded() {
    const placeholder = document.getElementById('shared-menu-placeholder');
    if (!placeholder) return false;

    const page = window.location.pathname.split('/').pop() || 'index.html';
    console.log(`[NAVBAR_LOADER] Verificando carga en ${page}.`);

    if (document.querySelector('.top-menu')) {
      ensureNavbarStylesheet();
      bindMobileNavbarHandlers();
      console.log(`[NAVBAR_LOADER] Navbar ya presente en ${page}.`);
      if (!window.__basaltoNavbarReady) {
        dispatchNavbarReady();
      }
      return true;
    }

    if (window.__basaltoNavbarLoaderPromise) {
      return window.__basaltoNavbarLoaderPromise;
    }

    window.__basaltoNavbarLoaderPromise = (async () => {
      ensureNavbarStylesheet();
      const response = await fetch('navbar.html');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} cargando navbar.html`);
      }

      const html = await response.text();
      placeholder.innerHTML = html;
      bindMobileNavbarHandlers();
      console.log(`[NAVBAR_LOADER] Navbar inyectado correctamente en ${page}.`);

      try { if (window.syncNavbarActive) window.syncNavbarActive(); } catch (_e) {}
      try { if (window.actualizarInterfaz) window.actualizarInterfaz(); } catch (_e) {}

      dispatchNavbarReady();
      return true;
    })().catch((error) => {
      console.error('[NAVBAR] No se pudo cargar el menú compartido:', error?.message || error);
      return false;
    }).finally(() => {
      window.__basaltoNavbarLoaderPromise = null;
    });

    return window.__basaltoNavbarLoaderPromise;
  }

  // Función para abrir el modal de login (para compatibilidad con navbar.html)
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

  function getGestionarNavbarContainer() {
    const gestionarToggle = document.getElementById('navbarDropdownGestionar');
    const nextMenu = gestionarToggle?.nextElementSibling;

    if (nextMenu && nextMenu.classList.contains('dropdown-menu')) {
      return nextMenu;
    }

    return document.querySelector('#nav-gestionar-parent .dropdown-menu');
  }

  function ensureAdminDivider(navbarContainer) {
    let dividerLi = navbarContainer.querySelector('#nav-admins');
    if (!dividerLi) {
      dividerLi = document.createElement('li');
      dividerLi.id = 'nav-admins';

      const divider = document.createElement('hr');
      divider.className = 'dropdown-divider';
      dividerLi.appendChild(divider);
      navbarContainer.appendChild(dividerLi);
    }
    return dividerLi;
  }

  function ensureAdminItem(navbarContainer) {
    let itemLi = navbarContainer.querySelector('#nav-admins-item');
    if (!itemLi) {
      itemLi = document.createElement('li');
      itemLi.id = 'nav-admins-item';
      navbarContainer.appendChild(itemLi);
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
    const navbarContainer = getGestionarNavbarContainer();
    if (!navbarContainer) {
      return false;
    }

    const valor = localStorage.getItem('user_super_admin');

    // KPIs Dashboard Check
    const permisosStr = localStorage.getItem('user_permisos');
    const hasKpiPerms = valor === '1' || (permisosStr && permisosStr.includes('admin_v_kpis'));
    const dashboardMenuItem = navbarContainer.querySelector('#nav-dashboard');
    if (dashboardMenuItem) {
      navbarContainer.appendChild(dashboardMenuItem);
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
    const dividerLi = ensureAdminDivider(navbarContainer);
    const itemLi = ensureAdminItem(navbarContainer);
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

  function stopNavbarObserver() {
    if (!navbarObserver) return;
    navbarObserver.disconnect();
    navbarObserver = null;
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
      stopNavbarObserver();
      syncNavbarAfterRender();
    }
  }

  function startNavbarObserver() {
    if (navbarObserver) return;

    navbarObserver = new MutationObserver(() => {
      initSuperAdminOption();
    });

    navbarObserver.observe(document.body, { childList: true, subtree: true });
  }

  function waitForNavbarAndInit(retries = 0) {
    if (navbarInitialized) return;

    if (renderAdminLink()) {
      navbarInitialized = true;
      renderShiftIndicator();
      dispatchNavbarReady();
      stopNavbarObserver();
      syncNavbarAfterRender();
      return;
    }

    if (retries >= 80) {
      return;
    }

    setTimeout(() => waitForNavbarAndInit(retries + 1), 50);
  }

  function initializeNavbar() {
    waitForNavbarAndInit();
    startNavbarObserver();
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
      await ensureSharedNavbarLoaded();
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
