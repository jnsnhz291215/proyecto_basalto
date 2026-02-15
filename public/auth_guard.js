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
    window.location.href = '/inicio.html';
    return;
  }

  // ============================================
  // 3. ACTUALIZAR INTERFAZ: Mostrar nombre y ocultar elementos
  // ============================================
  document.addEventListener('DOMContentLoaded', function() {
    // Actualizar nombre de usuario en el navbar
    updateUserName();

    // Ocultar elementos solo para admin si es user
    hideAdminElements();

    // Manejar cierre de sesión
    setupLogout();
  });

  // Función para actualizar el nombre del usuario en el navbar
  function updateUserName() {
    if (userName) {
      // Buscar el elemento del nombre de usuario en el navbar
      const userNameElement = document.querySelector('.user-name');
      if (userNameElement) {
        userNameElement.textContent = userName;
        console.log('[AUTH_GUARD] Nombre de usuario actualizado:', userName);
      }

      // También actualizar el usuario en el toggle si existe
      const userToggle = document.querySelector('.user-toggle');
      if (userToggle) {
        const nameSpan = userToggle.querySelector('.user-name');
        if (nameSpan) {
          nameSpan.textContent = userName;
        }
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
    // Buscar todos los botones de logout
    const logoutButtons = document.querySelectorAll('.logout-btn, [data-action="logout"], .user-menu .danger');
    
    logoutButtons.forEach(button => {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        
        console.log('[AUTH_GUARD] Cerrando sesión');
        
        // Limpiar localStorage
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_rut');
        localStorage.removeItem('user_name');
        localStorage.removeItem('usuarioActivo');
        localStorage.removeItem('userRUT');
        localStorage.removeItem('userName');
        localStorage.removeItem('adminData');
        
        // Redirigir a inicio
        window.location.href = '/index.html';
      });
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
