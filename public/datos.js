// Script for datos.html: login usando nombre+primerApellido como usuario y RUT como clave
// Soporta tanto trabajadores como administradores
(async function(){
  const loginUsuario = document.getElementById('login-usuario');
  const loginClave = document.getElementById('login-clave');
  const btnLogin = document.getElementById('btn-login');
  const btnClear = document.getElementById('btn-clear');
  const loginError = document.getElementById('login-error');
  const modalDatos = document.getElementById('modal-datos');
  const perfilCard = document.getElementById('perfil-card');

  const perfilNombre = document.getElementById('perfil-nombre');
  const perfilRut = document.getElementById('perfil-rut');
  const perfilTelefono = document.getElementById('perfil-telefono');
  const perfilEmail = document.getElementById('perfil-email');
  const perfilGrupo = document.getElementById('perfil-grupo');
  const perfilCargo = document.getElementById('perfil-cargo');

  function capitalizeWord(w){
    if (!w) return '';
    return String(w).charAt(0).toUpperCase() + String(w).slice(1).toLowerCase();
  }

  function normalizeRut(s){
    return String(s||'').replace(/[.\-\s]/g,'').trim().toUpperCase();
  }

  let trabajadores = [];
  async function loadTrabajadores(){
    try{
      const res = await fetch('/datos');
      if (!res.ok) throw new Error('Error fetching trabajadores');
      trabajadores = await res.json();
    }catch(e){
      console.error('No se pudo cargar lista de trabajadores:', e);
      trabajadores = [];
    }
  }

  await loadTrabajadores();

  // Función para mostrar perfil con datos
  function mostrarPerfil(datos) {
    if (!datos) return;
    
    perfilNombre.textContent = ((datos.nombres || '') + ' ' + (datos.apellidos || '')).trim();
    perfilRut.textContent = datos.RUT || '';
    perfilTelefono.textContent = datos.telefono || '';
    perfilEmail.textContent = datos.email || '';
    
    if (datos.isAdmin) {
      perfilCargo.textContent = 'Administrador';
      perfilGrupo.textContent = 'Sistema';
      perfilGrupo.style.backgroundColor = '#dc2626';
      perfilGrupo.style.color = '#fff';
    } else {
      perfilCargo.textContent = datos.cargo || '';
      perfilGrupo.textContent = datos.grupo ? ('Grupo: ' + datos.grupo) : 'Sin Grupo';
      perfilGrupo.style.backgroundColor = '';
      perfilGrupo.style.color = '';
    }
    
    if (modalDatos) modalDatos.classList.remove('show');
    perfilCard.style.display = 'block';
  }

  // Verificar si es admin logeado en gestionar.html
  function verificarAdminLogeado() {
    const adminRut = localStorage.getItem('userRUT');
    const adminNombre = localStorage.getItem('userName');
    
    if (adminRut && adminNombre) {
      // Buscar datos del admin en la lista de trabajadores
      const adminData = trabajadores.find(t => normalizeRut(t.RUT) === normalizeRut(adminRut));
      
      if (adminData) {
        // Persistir sesión como admin
        try {
          localStorage.setItem('usuarioActivo', JSON.stringify({
            rol: 'admin',
            nombre: (adminData.nombres || '') + ' ' + (adminData.apellidos || ''),
            rut: adminRut,
            isAdmin: true
          }));
        } catch(e){}
        
        // Mostrar datos del admin
        const adminInfo = { ...adminData, isAdmin: true };
        mostrarPerfil(adminInfo);
        return true;
      }
    }
    
    return false;
  }

  // Verificar sesión previa (trabajador)
  function verificarSesionTrabajador() {
    try {
      const s = localStorage.getItem('usuarioActivo');
      if (s) {
        const u = JSON.parse(s);
        
        if (u.isAdmin && u.rut) {
          // Es admin, buscar sus datos en trabajadores
          const adminData = trabajadores.find(t => normalizeRut(t.RUT) === normalizeRut(u.rut));
          if (adminData) {
            const adminInfo = { ...adminData, isAdmin: true };
            mostrarPerfil(adminInfo);
            return true;
          }
        } else if (u.nombre) {
          // Es trabajador normal
          const found = trabajadores.find(t => 
            normalizeRut(t.RUT) === normalizeRut(u.rut) || 
            ((t.nombres || '') + ' ' + (t.apellidos || '')).trim() === u.nombre
          );
          
          if (found) {
            mostrarPerfil(found);
            return true;
          } else {
            // Sesión pero sin datos en BD, mostrar solo nombre
            if (modalDatos) modalDatos.classList.remove('show');
            perfilCard.style.display = 'block';
            perfilNombre.textContent = u.nombre;
            return true;
          }
        }
      }
    } catch (e) {
      console.error('Error verificando sesión:', e);
    }
    
    return false;
  }

  // Secuencia de verificación al cargar
  if (!verificarAdminLogeado() && !verificarSesionTrabajador()) {
    // No hay sesión, mostrar modal de login
    if (modalDatos) modalDatos.classList.add('show');
  }

  btnClear.addEventListener('click', ()=>{
    loginUsuario.value = '';
    loginClave.value = '';
    loginError.style.display = 'none';
  });

  // Hide error when user starts typing again
  if (loginUsuario) loginUsuario.addEventListener('input', () => { loginError.style.display = 'none'; });
  if (loginClave) loginClave.addEventListener('input', () => { loginError.style.display = 'none'; });

  // Visual error helper: show message and animate inputs/button/card
  function showLoginError(msg) {
    if (loginError) {
      loginError.textContent = msg || 'Error';
      loginError.style.display = 'block';
    }
    const loginCardEl = document.querySelector('#modal-datos .login-card');
    if (loginCardEl) loginCardEl.classList.add('has-error');
    if (loginUsuario) loginUsuario.classList.add('input-error');
    if (loginClave) loginClave.classList.add('input-error');
    if (btnLogin) btnLogin.classList.add('btn-error');
    setTimeout(() => {
      if (loginCardEl) loginCardEl.classList.remove('has-error');
      if (loginUsuario) loginUsuario.classList.remove('input-error');
      if (loginClave) loginClave.classList.remove('input-error');
      if (btnLogin) btnLogin.classList.remove('btn-error');
    }, 1800);
  }

  btnLogin.addEventListener('click', ()=>{
    loginError.style.display = 'none';
    const userInput = loginUsuario.value || '';
    const claveInput = loginClave.value || '';
    if (!userInput || !claveInput){
      showLoginError('Ingrese usuario y clave');
      return;
    }

    // Call server for validation
    (async () => {
      try{
        // send clave without dots or hyphen
        const payload = { usuario: String(userInput).replace(/\s+/g, ''), clave: String(claveInput).replace(/[.\-]/g, '') };
        const resp = await fetch('/login', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(payload) 
        });
        
        const data = await resp.json().catch(()=>({}));
        if (!resp.ok) {
          showLoginError(data && data.error ? data.error : 'Error de autenticación');
          return;
        }

        const found = data.trabajador;
        if (!found) {
          showLoginError('Respuesta inesperada del servidor');
          return;
        }
        
        // Persist session
        try { 
          localStorage.setItem('usuarioActivo', JSON.stringify({ 
            rol: 'user', 
            nombre: (found.nombres || '') + ' ' + (found.apellidos || ''),
            rut: found.RUT,
            isAdmin: false
          })); 
        } catch(e){}

        mostrarPerfil(found);
      }catch(e){
        console.error('Error al autenticar:', e);
        showLoginError('Error de conexión al servidor');
      }
    })();
  });

})();
