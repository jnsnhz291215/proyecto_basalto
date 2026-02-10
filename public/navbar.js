// Shared navbar control: actualizarInterfaz and access guards
(function(){
  function redirectToIndex() {
    window.location.href = '/index.html';
  }

  function actualizarInterfaz() {
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

      // quick safety: if elements missing, exit
      if (!navInicio || !usuarioContainer) return;

      // default hide everything except inicio
      if (navGestionar) navGestionar.style.display = 'none';
      if (navInforme) navInforme.style.display = 'none';
      if (navViajes) navViajes.style.display = 'none';
      if (navDatos) navDatos.style.display = 'none';

      // Guest: show only Inicio and login button
      if (!s) {
        // show Inicio
        navInicio.style.display = '';
        // user container: show login button, hide avatar
        if (navLoginBtn) navLoginBtn.style.display = '';
        if (userToggle) userToggle.style.display = 'none';
        // hide protected links (already hidden)
        return;
      }

      // Logged-in: parse user
      let u = null;
      try { u = JSON.parse(s); } catch(e) { u = null; }
      // Estado Usuario Generico: show Inicio, Informe, Viajes, Datos
      if (navInicio) navInicio.style.display = '';
      if (navInforme) navInforme.style.display = '';
      if (navViajes) navViajes.style.display = '';
      if (navDatos) navDatos.style.display = '';
      // show avatar and hide login
      if (navLoginBtn) navLoginBtn.style.display = 'none';
      if (userToggle) userToggle.style.display = '';

      // Estado Admin: additionally show Gestionar
      if (u && u.rol === 'admin') {
        if (navGestionar) navGestionar.style.display = '';
      } else {
        if (navGestionar) navGestionar.style.display = 'none';
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

  // Run on DOMContentLoaded (if script loaded in page head/body after menu injection, caller may call again)
  document.addEventListener('DOMContentLoaded', () => {
    // run guard first
    guardAccess();
    // run interfaz update (pages should call again after menu injection)
    setTimeout(actualizarInterfaz, 30);
  });
})();
