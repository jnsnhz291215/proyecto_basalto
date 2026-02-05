// Script for datos.html: simple login using nombre+primerApellido as usuario and RUT as clave
(async function(){
  const loginUsuario = document.getElementById('login-usuario');
  const loginClave = document.getElementById('login-clave');
  const btnLogin = document.getElementById('btn-login');
  const btnClear = document.getElementById('btn-clear');
  const loginError = document.getElementById('login-error');
  const loginCard = document.getElementById('login-card');
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
    return String(s||'').replace(/\./g,'').trim().toUpperCase();
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

  btnClear.addEventListener('click', ()=>{
    loginUsuario.value = '';
    loginClave.value = '';
    loginError.style.display = 'none';
  });

  btnLogin.addEventListener('click', ()=>{
    loginError.style.display = 'none';
    const userInput = loginUsuario.value || '';
    const claveInput = loginClave.value || '';
    if (!userInput || !claveInput){
      loginError.textContent = 'Ingrese usuario y clave';
      loginError.style.display = 'block';
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
          loginError.textContent = data && data.error ? data.error : 'Error de autenticación';
          loginError.style.display = 'block';
          return;
        }

        const found = data.trabajador;
        if (!found) {
          loginError.textContent = 'Respuesta inesperada del servidor';
          loginError.style.display = 'block';
          return;
        }

        perfilNombre.textContent = (found.nombres || '') + ' ' + (found.apellidos || '');
        perfilRut.textContent = found.RUT || '';
        perfilTelefono.textContent = found.telefono || '';
        perfilEmail.textContent = found.email || '';
        perfilGrupo.textContent = found.grupo || '';
        perfilCargo.textContent = found.cargo || '';

        loginCard.style.display = 'none';
        perfilCard.style.display = 'block';
      }catch(e){
        console.error('Error al autenticar:', e);
        loginError.textContent = 'Error de conexión al servidor';
        loginError.style.display = 'block';
      }
    })();
  });

  btnLogout.addEventListener('click', ()=>{
    perfilCard.style.display = 'none';
    loginCard.style.display = 'block';
    loginUsuario.value = '';
    loginClave.value = '';
    loginError.style.display = 'none';
  });

})();
