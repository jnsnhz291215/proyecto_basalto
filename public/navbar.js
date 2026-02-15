// ============================================
// NAVBAR - Funcionalidad del menú (SIMPLIFICADO)
// La autenticación es manejada por auth_guard.js
// ============================================
(function(){
  
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
  });

})();
