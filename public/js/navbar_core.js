// ============================================
// NAVBAR CORE - Sistema Robusto de Usuario
// ============================================
// Este script usa delegación de eventos para funcionar
// independientemente del orden de carga de otros scripts

(function() {
  'use strict';

  console.log('[NAVBAR_CORE] Inicializando...');

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
    const userName = localStorage.getItem('user_name');
    const userNameElement = document.getElementById('user_name_span');
    
    if (userName && userNameElement) {
      userNameElement.textContent = userName;
      console.log('[NAVBAR_CORE] Nombre actualizado:', userName);
    }
  }

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
  // INICIALIZACIÓN
  // ============================================
  // Ejecutar inmediatamente
  updateUserName();
  toggleAuthUI();

  // Ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      updateUserName();
      toggleAuthUI();
    });
  }

  // Re-ejecutar periódicamente por seguridad (para vistas dinámicas)
  setInterval(() => {
    updateUserName();
    toggleAuthUI();
  }, 1000);

  console.log('[NAVBAR_CORE] Listo');
})();
