// Shared navbar control: actualizarInterfaz and access guards
(function(){
  function redirectToIndex() {
    window.location.href = '/index.html';
  }

  function actualizarInterfaz() {
    console.log('Ejecutando actualizarInterfaz...');
    try {
      const s = localStorage.getItem('usuarioActivo');
      const navInicio = document.getElementById('nav-inicio');
      const navGestionar = document.getElementById('nav-gestionar');
      const navInforme = document.getElementById('nav-informe');
      const navViajes = document.getElementById('nav-viajes');
      const navDatos = document.getElementById('nav-datos');
      const usuarioContainer = document.getElementById('usuario-container');
      const navLoginBtn = document.getElementById('nav-login-btn');
      const userToggle = document.getElementById('user-toggle');

      if (!navInicio || !usuarioContainer) {
        console.warn('Elementos críticos no encontrados');
        return;
      }

      console.log('Sesión:', s ? 'Existente' : 'No existe');

      // Paso 1: Ocultar por defecto todos los elementos protegidos
      if (navGestionar) navGestionar.style.display = 'none';
      if (navInforme) navInforme.style.display = 'none';
      if (navViajes) navViajes.style.display = 'none';
      if (navDatos) navDatos.style.display = 'none';

      // Paso 2: INVITADO (sin sesión)
      if (!s) {
        navInicio.style.display = '';  // Mostrar Inicio

        // Mostrar botón Iniciar Sesión (inyectar si no existe)
        if (navLoginBtn) {
          navLoginBtn.style.display = '';
        } else {
          // Inyectar botón si no existe
          const btnHTML = '<button id="nav-login-btn" class="btn btn-login-nav" onclick="abrirLogin()"><i class="fa-solid fa-user"></i> Iniciar Sesión</button>';
          usuarioContainer.insertAdjacentHTML('afterbegin', btnHTML);
          const newBtn = document.getElementById('nav-login-btn');
          if (newBtn) newBtn.addEventListener('click', () => { const dm = document.getElementById('dual-login-modal'); if (dm) dm.classList.add('show'); });
        }

        // Ocultar avatar/menú de usuario
        if (userToggle) userToggle.style.display = 'none';
        console.log('Interfaz actualizada: MODO INVITADO');
        return;
      }

      // Paso 3: USUARIO LOGUEADO
      let u = null;
      try { u = JSON.parse(s); } catch(e) { u = null; }

      // Mostrar elementos básicos para usuario genérico
      if (navInicio) navInicio.style.display = '';
      if (navInforme) navInforme.style.display = '';
      if (navViajes) navViajes.style.display = '';
      if (navDatos) navDatos.style.display = '';

      // Ocultar botón login, mostrar avatar
      if (navLoginBtn) navLoginBtn.style.display = 'none';
      if (userToggle) userToggle.style.display = '';

      // Paso 4: ADMINISTRADOR
      if (u && u.rol === 'admin') {
        if (navGestionar) navGestionar.style.display = '';
        console.log('Interfaz actualizada: MODO ADMIN');
      } else {
        if (navGestionar) navGestionar.style.display = 'none';
        console.log('Interfaz actualizada: MODO USUARIO GENÉRICO');
      }
    } catch (err) {
      console.error('Error en actualizarInterfaz:', err);
    }
  }

  // Guard: if accessing protected pages without session, redirect
  function guardAccess() {
    try {
      const s = localStorage.getItem('usuarioActivo');
      const path = (location.pathname || '').toLowerCase();
      const protectedPages = ['/informe.html','/viajes.html','/datos.html'];
      const adminOnly = ['/gestionar.html'];

      // If trying to access protected pages and not logged in -> redirect
      if (!s) {
        if (protectedPages.some(p => path.endsWith(p))) {
          redirectToIndex();
        }
      } else {
        // logged in: if accessing admin-only and not admin -> redirect
        const u = JSON.parse(s);
        if (adminOnly.some(p => path.endsWith(p))) {
          if (!(u && u.rol === 'admin')) {
            redirectToIndex();
          }
        }
      }
    } catch(e) { console.error('Guard error', e); }
  }

  // Expose globally
  window.actualizarInterfaz = actualizarInterfaz;
  window.guardAccess = guardAccess;

  // Función para abrir el modal de login
  function abrirLoginModal() {
    const dm = document.getElementById('dual-login-modal');
    if (dm) dm.classList.add('show');
  }
  window.abrirLoginModal = abrirLoginModal;

  // Run on DOMContentLoaded (if script loaded in page head/body after menu injection, caller may call again)
  document.addEventListener('DOMContentLoaded', () => {
    // run guard first
    guardAccess();
    // run interfaz update (pages should call again after menu injection)
    setTimeout(actualizarInterfaz, 30);
  });
})();
