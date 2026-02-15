// ============================================
// AUTH GUARD - Protección de Rutas y Sesión
// ============================================

(function() {
  'use strict';

  // Obtener datos de sesión
  const userRole = localStorage.getItem('user_role');
  const userRut = localStorage.getItem('user_rut');
  const userName = localStorage.getItem('user_name');
  const currentPath = window.location.pathname;

  console.log('[AUTH_GUARD] Sesión actual:', { userRole, userRut, userName, currentPath });

  // Páginas que requieren autenticación
  const authRequiredPages = [
    'gestionar.html',
    'viajes.html',
    'informe.html',
    'datos.html'
  ];

  // Páginas solo para admin
  const adminOnlyPages = [
    'gestionar.html'
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
  // 3. ACTUALIZAR INTERFAZ: Mostrar nombre y ocultar elementos
  // ============================================
  
  // Ejecutar toggleAuthUI cuando los elementos estén disponibles
  function initAuthUI() {
    const loginBtn = document.getElementById('nav-login-btn');
    const userToggleBtn = document.getElementById('user_toggle_btn');
    const userDropdown = document.getElementById('user-dropdown');
    
    if (loginBtn || userToggleBtn || userDropdown) {
      // Elementos encontrados, ejecutar toggleAuthUI
      toggleAuthUI();
    } else {
      // Elementos no encontrados, esperar un poco y reintentar
      setTimeout(initAuthUI, 50);
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
    
    // Asegurar que la UI de auth esté correcta
    toggleAuthUI();
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
    if (userName) {
      // Buscar el elemento del nombre de usuario en el navbar
      const userNameElement = document.getElementById('user_name_span');
      if (userNameElement) {
        userNameElement.textContent = userName;
        console.log('[AUTH_GUARD] Nombre de usuario actualizado:', userName);
      }
    }
  }

  // Función para ocultar elementos solo para admin
  function hideAdminElements() {
    if (userRole === 'user') {
      // Ocultar enlaces con clase .admin-only
      const adminElements = document.querySelectorAll('.admin-only');
      adminElements.forEach(element => {
        element.style.display = 'none';
        console.log('[AUTH_GUARD] Ocultando elemento admin-only');
      });

      // Ocultar el enlace de "Gestionar" en el navbar
      const navGestionar = document.querySelector('#nav-gestionar');
      if (navGestionar) {
        navGestionar.style.display = 'none';
        console.log('[AUTH_GUARD] Ocultando menú Gestionar');
      }
    }
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

  // Función global para obtener datos de sesión
  window.getSession = function() {
    return {
      role: userRole,
      rut: userRut,
      name: userName
    };
  };

})();
