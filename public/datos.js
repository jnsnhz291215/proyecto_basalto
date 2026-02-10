// Script for datos.html: simple login using nombre+primerApellido as usuario and RUT as clave
(async function(){
  const loginUsuario = document.getElementById('login-usuario');
  const loginClave = document.getElementById('login-clave');
  const btnLogin = document.getElementById('btn-login');
  const btnClear = document.getElementById('btn-clear');
  const loginError = document.getElementById('login-error');
  const modalDatos = document.getElementById('modal-datos');
  const perfilCard = document.getElementById('perfil-card');
  const btnLogout = document.getElementById('btn-logout');

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

  // We'll validate on server-side via POST /login. Keep local array only for optional client checks.
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

  // verificar sesión previa
  try {
    const s = localStorage.getItem('usuarioActivo');
    if (s) {
      const u = JSON.parse(s);
      if (modalDatos) modalDatos.classList.remove('show');
      if (perfilCard) perfilCard.style.display = 'block';
      if (u && u.nombre && perfilNombre) perfilNombre.textContent = u.nombre;
    }
  } catch (e) { }

  btnClear.addEventListener('click', ()=>{
    loginUsuario.value = '';
    loginClave.value = '';
    loginError.style.display = 'none';
  });

  // hide error when user starts typing again
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
        // send clave without dots or hyphen as requested
        const payload = { usuario: String(userInput).replace(/\s+/g, ''), clave: String(claveInput).replace(/[.\-]/g, '') };
        const resp = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
        // persist session
        try { localStorage.setItem('usuarioActivo', JSON.stringify({ rol: 'user', nombre: (found.nombres || '') + ' ' + (found.apellidos || '') })); } catch(e){}

        perfilNombre.textContent = (found.nombres || '') + ' ' + (found.apellidos || '');
        perfilRut.textContent = found.RUT || '';
        perfilTelefono.textContent = found.telefono || '';
        perfilEmail.textContent = found.email || '';
        perfilGrupo.textContent = (found.grupo ? ('Grupo: ' + found.grupo) : '');
        perfilCargo.textContent = found.cargo || '';

        if (modalDatos) modalDatos.classList.remove('show');
        perfilCard.style.display = 'block';
      }catch(e){
        console.error('Error al autenticar:', e);
        showLoginError('Error de conexión al servidor');
      }
    })();
  });

  if (btnLogout) {
    btnLogout.addEventListener('click', ()=>{
      // clear session and reload to show login
      try { localStorage.removeItem('usuarioActivo'); } catch(e){}
      location.href = '/index.html';
    });
  }

})();
