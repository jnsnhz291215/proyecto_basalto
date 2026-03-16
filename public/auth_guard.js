// ============================================
// AUTH GUARD - Protección de Rutas y Sesión
// ============================================

(function() {
  'use strict';

  let authReadyDispatched = false;
  let userNameApplied = false;

  function parseJSONList(key) {
    try {
      const raw = localStorage.getItem(key);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (_error) {
      return [];
    }
  }

  function normalizePermissionName(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  // Obtener datos de sesión
  const userRole = localStorage.getItem('user_role');
  const userRut = localStorage.getItem('user_rut');
  const userName = localStorage.getItem('user_name');
  const isSuperAdmin = localStorage.getItem('user_super_admin') === '1';
  const userPermisos = parseJSONList('user_permisos');
  const cargoPermisos = parseJSONList('user_permissions_cargo');
  const currentPath = window.location.pathname;

  const permisosAdminNormalizados = new Set(
    userPermisos
      .map(normalizePermissionName)
      .filter(Boolean)
  );

  const permisosCargoNormalizados = new Set(
    cargoPermisos
      .map(normalizePermissionName)
      .filter(Boolean)
  );

  const hasAnyAdminPermissionData = permisosAdminNormalizados.size > 0;
  const hasAnyCargoPermissionData = permisosCargoNormalizados.size > 0;

  const permissionAliases = {
    gestionar_trabajadores: ['trabajadores_ver', 'trabajadores_editar', 'trabajadores_soft_delete', 'gestionar_trabajadores', 'admin_trabajadores_v'],
    editar_trabajadores: ['trabajadores_editar', 'editar_trabajadores', 'modificar_trabajadores'],
    borrar_trabajadores: ['trabajadores_soft_delete', 'borrar_trabajadores', 'eliminar_trabajadores', 'admin_softdelete'],
    gestionar_viajes: ['viajes_ver', 'viajes_editar', 'viajes_soft_delete', 'gestionar_viajes', 'admin_viajes_v', 'admin_v_viajes'],
    gestionar_informes: ['informes_ver', 'informes_editar', 'informes_soft_delete', 'gestionar_informes', 'admin_informes_v'],
    crear_informe_turno: ['crear_informe_turno', 'crear_informe', 'informe_turno'],
    editar_informe_propio: ['editar_informe_propio', 'editar_informes'],
    cerrar_turno: ['cerrar_turno', 'finalizar_turno'],
    ver_historial: ['ver_historial', 'historial'],
    gestionar_cargos: ['gestionar_cargos', 'cargos', 'administrar_cargos']
  };

  const adminModuleAliases = {
    admin_trabajadores_v: ['admin_trabajadores_v'],
    admin_viajes_v: ['admin_viajes_v', 'admin_v_viajes'],
    admin_informes_v: ['admin_informes_v']
  };

  function hasAdminModuleView(moduleKey) {
    const aliases = adminModuleAliases[moduleKey] || [moduleKey];
    return aliases.some((alias) => permisosAdminNormalizados.has(normalizePermissionName(alias)));
  }

  function hasAdminSoftDeleteFlag() {
    return permisosAdminNormalizados.has('admin_softdelete');
  }

  function matchesPermission(permisosSet, permissionKey) {
    const target = normalizePermissionName(permissionKey);
    const aliases = permissionAliases[target] || [target];

    return aliases.some((alias) => {
      const normalizedAlias = normalizePermissionName(alias);
      if (!normalizedAlias) return false;

      return Array.from(permisosSet).some((perm) => (
        perm === normalizedAlias || perm.includes(normalizedAlias) || normalizedAlias.includes(perm)
      ));
    });
  }

  function hasAdminPermission(permissionKey) {
    if (!userRole) return false;
    if (isSuperAdmin) return true;
    if (!hasAnyAdminPermissionData) return userRole === 'admin';

    const normalized = normalizePermissionName(permissionKey);
    if (['trabajadores_editar', 'trabajadores_soft_delete', 'borrar_trabajadores'].includes(normalized)) {
      return hasAdminModuleView('admin_trabajadores_v') && hasAdminSoftDeleteFlag();
    }
    if (['viajes_editar', 'viajes_soft_delete'].includes(normalized)) {
      return hasAdminModuleView('admin_viajes_v') && hasAdminSoftDeleteFlag();
    }
    if (['informes_editar', 'informes_soft_delete'].includes(normalized)) {
      return hasAdminModuleView('admin_informes_v') && hasAdminSoftDeleteFlag();
    }
    if (['trabajadores_ver', 'gestionar_trabajadores'].includes(normalized)) {
      return hasAdminModuleView('admin_trabajadores_v');
    }
    if (['viajes_ver', 'gestionar_viajes'].includes(normalized)) {
      return hasAdminModuleView('admin_viajes_v');
    }
    if (['informes_ver', 'gestionar_informes'].includes(normalized)) {
      return hasAdminModuleView('admin_informes_v');
    }

    return matchesPermission(permisosAdminNormalizados, permissionKey);
  }

  function hasCargoPermission(permissionKey) {
    if (!userRole) return false;
    if (isSuperAdmin) return true;
    if (!hasAnyCargoPermissionData) return true;
    return matchesPermission(permisosCargoNormalizados, permissionKey);
  }

  console.log('[AUTH_GUARD] Sesión actual:', {
    userRole,
    userRut,
    userName,
    isSuperAdmin,
    currentPath,
    permisosIndividuales: userPermisos,
    permisosCargo: cargoPermisos
  });

  // Páginas que requieren autenticación
  const authRequiredPages = [
    'gestionar.html',
    'gestionviajes.html',
    'viajes.html',
    'informe.html',
    'datos.html',
    'gestionadmins.html',
    'gestioncargos.html'
  ];

  // Páginas solo para admin
  const adminOnlyPages = [
    'gestionar.html',
    'gestionviajes.html',
    'gestionadmins.html',
    'gestioncargos.html'
  ];

  // Páginas solo para Super Admin
  const superAdminOnlyPages = [
    'gestionadmins.html',
    'gestioncargos.html'
  ];

  // Verificar si la página actual requiere autenticación
  const requiresAuth = authRequiredPages.some(page => currentPath.includes(page));
  const requiresAdmin = adminOnlyPages.some(page => currentPath.includes(page));

  // ============================================
  // 1. REDIRECCIÓN: Si no hay sesión y requiere auth
  // ============================================
  if (requiresAuth && !userRole) {
    console.log('[AUTH_GUARD] No hay sesión, redirigiendo a index.html');
    window.location.href = '/index.html';
    return;
  }

  // ============================================
  // 2. PROTECCIÓN: Si es página solo admin y usuario no es admin
  // ============================================
  if (requiresAdmin && userRole !== 'admin') {
    console.log('[AUTH_GUARD] Acceso denegado - Solo administradores');
    alert('Acceso denegado. Solo administradores pueden acceder a esta página.');
    window.location.href = '/index.html';
    return;
  }

  // ============================================
  // 2.5. PROTECCIÓN: Si es página solo Super Admin y usuario no es Super Admin
  // ============================================
  const requiresSuperAdmin = superAdminOnlyPages.some(page => currentPath.includes(page));
  if (requiresSuperAdmin && !isSuperAdmin) {
    console.log('[AUTH_GUARD] Acceso denegado - Solo Super Administradores');
    alert('Acceso denegado. Solo Super Administradores pueden acceder a esta página.');
    window.location.href = '/index.html';
    return;
  }

  function markAuthReady() {
    if (authReadyDispatched) return;
    authReadyDispatched = true;
    window.__basaltoAuthReady = true;
    window.dispatchEvent(new CustomEvent('basalto:auth-ready', {
      detail: { role: userRole, rut: userRut, isSuperAdmin: isSuperAdmin }
    }));
    console.log('[AUTH_GUARD] Evento basalto:auth-ready emitido');
  }

  // La sesion ya fue validada por este guard y puede ser consumida por el navbar.
  markAuthReady();
  window.hasPermission = hasAdminPermission;
  window.hasAdminPermission = hasAdminPermission;
  window.hasCargoPermission = hasCargoPermission;

  // ============================================
  // 3. ACTUALIZAR INTERFAZ: Mostrar nombre y ocultar elementos
  // ============================================
  
  // Ejecutar toggleAuthUI cuando los elementos estén disponibles
  function initAuthUI() {
    if (!initAuthUI.attempts) initAuthUI.attempts = 0;

    const loginBtn = document.getElementById('nav-login-btn');
    const userToggleBtn = document.getElementById('user_toggle_btn');
    const userDropdown = document.getElementById('user-dropdown');
    
    if (loginBtn || userToggleBtn || userDropdown) {
      // Elementos encontrados, ejecutar toggleAuthUI
      toggleAuthUI();
      return;
    } else {
      // Elementos no encontrados, esperar un poco y reintentar
      initAuthUI.attempts += 1;
      if (initAuthUI.attempts <= 60) {
        setTimeout(initAuthUI, 50);
      }
    }
  }
  
  // Intentar inmediatamente (para páginas sin inyección dinámica)
  initAuthUI();
  
  document.addEventListener('DOMContentLoaded', function() {
    // Actualizar nombre de usuario en el navbar
    updateUserName();

    // Ocultar elementos solo para admin si es user
    hideAdminElements();

    // Manejar cierre de sesión
    setupLogout();

    // Control manual del dropdown
    setupUserDropdown();
    
    // Control del dropdown de Gestionar
    setupGestionarDropdown();
    
    // Asegurar que la UI de auth esté correcta
    toggleAuthUI();
    applyPermissionVisibility();

    const permissionObserver = new MutationObserver(() => {
      applyPermissionVisibility();
    });

    permissionObserver.observe(document.body, { childList: true, subtree: true });
  });

  // Función para mostrar/ocultar botones de autenticación
  function toggleAuthUI() {
    const loginBtn = document.getElementById('nav-login-btn');
    const userDropdown = document.getElementById('user-dropdown');
    const userMenu = document.getElementById('user_dropdown_menu');
    
    if (userRole && userRut) {
      // Usuario autenticado: ocultar login, mostrar user toggle
      if (loginBtn) loginBtn.style.display = 'none';
      if (userDropdown) userDropdown.style.display = 'block';
      console.log('[AUTH_GUARD] UI: Usuario autenticado');
    } else {
      // No autenticado: mostrar login, ocultar user toggle
      if (loginBtn) loginBtn.style.display = 'inline-block';
      if (userDropdown) userDropdown.style.display = 'none';
      if (userMenu) userMenu.classList.remove('show');
      console.log('[AUTH_GUARD] UI: Usuario no autenticado');
    }
  }

  // Función para actualizar el nombre del usuario en el navbar
  function updateUserName() {
    if (userNameApplied) return;

    if (userName) {
      // Buscar el elemento del nombre de usuario en el navbar
      const userNameElement = document.getElementById('user_name_span');
      if (userNameElement) {
        userNameElement.textContent = userName;
        userNameApplied = true;
        console.log('[AUTH_GUARD] Nombre de usuario actualizado:', userName);
      }
    }
  }

  // Función para ocultar elementos según el rol del usuario
  function hideAdminElements() {
    // Si no hay sesión: ocultar todo excepto Inicio y Viajes
    if (!userRole) {
      const adminElements = document.querySelectorAll('.admin-only');
      adminElements.forEach(element => {
        element.style.setProperty('display', 'none', 'important');
        console.log('[AUTH_GUARD] Ocultando elemento admin-only (sin sesión)');
      });

      // Ocultar elementos no permitidos para invitados
      const navInforme = document.getElementById('nav-informe');
      if (navInforme) {
        navInforme.style.setProperty('display', 'none', 'important');
        console.log('[AUTH_GUARD] Ocultando "Informe de turno" (sin sesión)');
      }

      const navDatos = document.getElementById('nav-datos');
      if (navDatos) {
        navDatos.style.setProperty('display', 'none', 'important');
        console.log('[AUTH_GUARD] Ocultando "Mi Perfil" (sin sesión)');
      }

      const navGestionarParent = document.getElementById('nav-gestionar-parent');
      if (navGestionarParent) {
        navGestionarParent.style.setProperty('display', 'none', 'important');
        console.log('[AUTH_GUARD] Ocultando menú Gestionar (sin sesión)');
      }
    } 
    // Si es usuario normal (no admin): ocultar solo opciones admin
    else if (userRole === 'user') {
      const adminElements = document.querySelectorAll('.admin-only');
      adminElements.forEach(element => {
        element.style.setProperty('display', 'none', 'important');
        console.log('[AUTH_GUARD] Ocultando elemento admin-only (user)');
      });

      const navGestionarParent = document.getElementById('nav-gestionar-parent');
      if (navGestionarParent) {
        navGestionarParent.style.setProperty('display', 'none', 'important');
        console.log('[AUTH_GUARD] Ocultando menú dropdown Gestionar (user)');
      }
    }

    const navGestionTrabajadores = document.querySelector('.dropdown-menu a[href="gestionar.html"]')?.closest('li');
    if (navGestionTrabajadores && !hasAdminPermission('gestionar_trabajadores')) {
      navGestionTrabajadores.style.setProperty('display', 'none', 'important');
    }

    const navGestionViajes = document.querySelector('.dropdown-menu a[href="gestionviajes.html"]')?.closest('li');
    if (navGestionViajes && !hasAdminPermission('gestionar_viajes')) {
      navGestionViajes.style.setProperty('display', 'none', 'important');
    }

    const navGestionInformes = document.querySelector('.dropdown-menu a[href="gestioninformes.html"]')?.closest('li');
    if (navGestionInformes && !hasAdminPermission('gestionar_informes')) {
      navGestionInformes.style.setProperty('display', 'none', 'important');
    }

    const navGestionCargos = document.querySelector('.dropdown-menu a[href="gestioncargos.html"]')?.closest('li');
    if (navGestionCargos && !hasAdminPermission('gestionar_cargos')) {
      navGestionCargos.style.setProperty('display', 'none', 'important');
    }

    const gestionParent = document.getElementById('nav-gestionar-parent');
    if (gestionParent) {
      const visibleChild = gestionParent.querySelector('li:not([style*="display: none"])');
      if (!visibleChild) {
        gestionParent.style.setProperty('display', 'none', 'important');
      }
    }

    applyPermissionVisibility();
  }

  function applyPermissionVisibility() {
    const nodes = document.querySelectorAll('[data-permission]');
    nodes.forEach((node) => {
      const required = node.getAttribute('data-permission');
      if (!required) return;

      if (!hasAdminPermission(required)) {
        const mode = node.getAttribute('data-permission-mode') || 'hide';
        if (mode === 'disable') {
          node.setAttribute('disabled', 'disabled');
          node.classList.add('is-disabled-by-permission');
        } else {
          node.style.setProperty('display', 'none', 'important');
        }
      }
    });
  }

  // Función para configurar el cierre de sesión
  function setupLogout() {
    const logoutBtn = document.getElementById('btn_logout');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();

      console.log('[AUTH_GUARD] Cerrando sesión');

      // Limpiar localStorage de forma explícita
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_rut');
      localStorage.removeItem('user_name');
      localStorage.removeItem('usuarioActivo');
      localStorage.removeItem('userRUT');
      localStorage.removeItem('userName');
      localStorage.removeItem('adminData');
      localStorage.removeItem('user_permissions_cargo');
      localStorage.removeItem('user_permissions_cargo_ids');
      localStorage.removeItem('user_permissions_total');
      localStorage.removeItem('user_cargo_name');
      localStorage.removeItem('user_cargo_id');
      localStorage.clear();

      // Redirigir al login
      window.location.href = '/index.html';
    });
  }

  function setupUserDropdown() {
    const toggleBtn = document.getElementById('user_toggle_btn');
    const menu = document.getElementById('user_dropdown_menu');
    if (!toggleBtn || !menu) return;

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!toggleBtn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('show');
      }
    });
  }

  // Función para configurar el dropdown de Gestionar (móviles)
  function setupGestionarDropdown() {
    const gestionarToggle = document.getElementById('navbarDropdownGestionar');
    const gestionarMenu = gestionarToggle?.nextElementSibling;
    
    if (!gestionarToggle || !gestionarMenu) return;

    // Solo agregar click handler en móviles
    gestionarToggle.addEventListener('click', (e) => {
      // Verificar si es móvil (menos de 992px)
      if (window.innerWidth < 992) {
        e.preventDefault();
        e.stopPropagation();
        gestionarMenu.classList.toggle('show');
      }
    });

    // Cerrar al hacer click fuera
    document.addEventListener('click', (e) => {
      if (!gestionarToggle.contains(e.target) && !gestionarMenu.contains(e.target)) {
        gestionarMenu.classList.remove('show');
      }
    });
  }

  // Función global para actualizar la interfaz (puede ser llamada desde otros scripts)
  window.actualizarInterfaz = function() {
    updateUserName();
    hideAdminElements();
  };

  // Función global para verificar si el usuario está autenticado
  window.isAuthenticated = function() {
    return !!userRole;
  };

  // Función global para verificar si el usuario es admin
  window.isAdmin = function() {
    return userRole === 'admin';
  };

  // Función global para verificar si el usuario es Super Admin
  window.isSuperAdmin = function() {
    return isSuperAdmin;
  };

  // Función global para obtener datos de sesión
  window.getSession = function() {
    return {
      role: userRole,
      rut: userRut,
      name: userName,
      isSuperAdmin: isSuperAdmin,
      permisos: userPermisos,
      permisosCargo: cargoPermisos,
      permisosTotales: {
        admin: Array.from(permisosAdminNormalizados),
        cargo: Array.from(permisosCargoNormalizados)
      }
    };
  };

})();
  // Función global para obtener datos de sesión
  window.getSession = function() {
    return {
      role: userRole,
      rut: userRut,
      name: userName,
      isSuperAdmin: isSuperAdmin,
      permisos: userPermisos,
      permisosCargo: cargoPermisos,
      permisosTotales: {
        admin: Array.from(permisosAdminNormalizados),
        cargo: Array.from(permisosCargoNormalizados)
      }
    };
  };

  // ============================================
  // RESTRICCIÓN TURNO ACTIVO (solo informe.html)
  // Si el usuario es 'user' (no admin) y no está en turno activo,
  // se muestra un overlay bloqueante en lugar de redirigir.
  // ============================================
  if (currentPath.includes('informe.html') && userRut && !isSuperAdmin && userRole !== 'admin') {
    fetch('/api/estado-turno/' + encodeURIComponent(userRut))
      .then(function(r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function(data) {
        if (data.estado && data.estado !== 'en_turno') {
          var overlay = document.createElement('div');
          overlay.id = 'shift-access-denied-overlay';
          overlay.setAttribute('style',
            'position:fixed;inset:0;z-index:9000;background:rgba(15,23,42,0.93);' +
            'display:flex;align-items:center;justify-content:center;'
          );
          overlay.innerHTML =
            '<div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:2.5rem 2rem;' +
            'max-width:420px;width:90%;text-align:center;color:#f8fafc;box-shadow:0 25px 50px rgba(0,0,0,0.5);">' +
              '<div style="font-size:3rem;margin-bottom:1rem;">&#x1F512;</div>' +
              '<h2 style="font-size:1.35rem;font-weight:700;margin:0 0 0.6rem;">Fuera de Turno</h2>' +
              '<p style="color:#94a3b8;margin:0 0 0.4rem;">Usted no se encuentra en turno activo.</p>' +
              '<p style="color:#64748b;font-size:0.85rem;margin:0 0 1.5rem;">' +
                (data.mensaje ? data.mensaje.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '') + '</p>' +
              '<p style="color:#64748b;font-size:0.85rem;margin:0 0 1.5rem;">Acceso denegado.</p>' +
              '<a href="/menu.html" style="display:inline-block;padding:0.6rem 1.4rem;background:#3b82f6;' +
              'color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.95rem;">' +
              '\u2190 Volver al men\u00fa</a>' +
            '</div>';
          document.body.appendChild(overlay);
          // Ocultar contenido principal para que no sea accesible detrás del overlay
          var main = document.querySelector('main');
          if (main) main.setAttribute('aria-hidden', 'true');
          console.log('[AUTH_GUARD] Acceso bloqueado: usuario fuera de turno activo');
        }
      })
      .catch(function() { /* API no disponible: no bloquear */ });
  }

})();
