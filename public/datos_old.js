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
  const perfilFechaNacimiento = document.getElementById('perfil-fecha-nacimiento');
  const perfilCiudad = document.getElementById('perfil-ciudad');

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
    
    console.log('[DATOS.JS] mostrarPerfil llamado con:', datos);
    
    // Para admin: usar nombres, apellido_paterno, apellido_materno
    // Para trabajador: usar nombres, apellidos
    if (datos.isAdmin) {
      const nombres = datos.nombres || '';
      const apellidoP = datos.apellido_paterno || '';
      const apellidoM = datos.apellido_materno || '';
      const fullName = (nombres + ' ' + apellidoP + ' ' + apellidoM).trim();
      
      console.log('[DATOS.JS] Admin detectado. Nombre completo:', fullName);
      
      perfilNombre.textContent = fullName || (datos.rut || datos.RUT || 'Administrador');
      perfilRut.textContent = datos.rut || datos.RUT || '---';
      perfilEmail.textContent = datos.email || '---';
      perfilTelefono.textContent = '---'; // Admins no tienen teléfono en la tabla
      perfilCargo.textContent = 'Administrador';
      perfilGrupo.textContent = 'Administrador';
      perfilFechaNacimiento.parentElement.style.display = 'none';
      perfilCiudad.parentElement.style.display = 'none';
      // Remover clase profile-badge para admins
      perfilGrupo.classList.remove('profile-badge');
      perfilGrupo.style.backgroundColor = '#dc2626';
      perfilGrupo.style.color = '#fff';
      perfilGrupo.style.display = 'inline-block';
      perfilGrupo.style.padding = '4px 8px';
      perfilGrupo.style.borderRadius = '4px';
      perfilGrupo.style.fontSize = '0.875rem';
      perfilGrupo.style.fontWeight = '600';
    } else {
      perfilNombre.textContent = ((datos.nombres || '') + ' ' + (datos.apellidos || '')).trim();
      perfilRut.textContent = datos.RUT || '';
      perfilTelefono.textContent = datos.telefono || '';
      perfilEmail.textContent = datos.email || '';
      perfilCargo.textContent = datos.cargo || '';
      // Mostrar ciudad y fecha de nacimiento
      perfilFechaNacimiento.textContent = datos.fecha_nacimiento || '---';
      perfilCiudad.textContent = datos.ciudad || '---';
      perfilFechaNacimiento.parentElement.style.display = '';
      perfilCiudad.parentElement.style.display = '';
      // Cambiar texto del grupo a "Sin grupo asignado" cuando sea null/vacío
      const grupoText = datos.grupo ? ('Grupo: ' + datos.grupo) : 'Sin grupo asignado';
      perfilGrupo.textContent = grupoText;
      // Asegurar que tiene la clase profile-badge para trabajadores
      perfilGrupo.classList.add('profile-badge');
      perfilGrupo.style.backgroundColor = '';
      perfilGrupo.style.color = '';
    }
    
    if (modalDatos) modalDatos.classList.remove('show');
    perfilCard.style.display = 'block';
  }

  // Verificar si es admin logeado en gestionar.html
  function verificarAdminLogeado() {
    const adminRut = localStorage.getItem('userRUT');
    const adminDataStr = localStorage.getItem('adminData');
    
    console.log('[DATOS.JS] verificarAdminLogeado - userRUT:', adminRut);
    console.log('[DATOS.JS] verificarAdminLogeado - adminData:', adminDataStr);
    
    if (adminRut && adminDataStr) {
      try {
        const adminData = JSON.parse(adminDataStr);
        // Asegurar que tiene el flag isAdmin
        adminData.isAdmin = true;
        
        console.log('[DATOS.JS] Admin data parsed:', adminData);
        
        // Mostrar datos del admin
        mostrarPerfil(adminData);
        return true;
      } catch(e) {
        console.error('[DATOS.JS] Error parsing adminData:', e);
      }
    }
    
    return false;
  }

  // Verificar sesión previa (trabajador o admin)
  async function verificarSesionTrabajador() {
    try {
      const s = localStorage.getItem('usuarioActivo');
      if (s) {
        const u = JSON.parse(s);
        
        console.log('[DATOS.JS] verificarSesionTrabajador - usuarioActivo:', u);
        
        if (u.isAdmin || u.rol === 'admin') {
          console.log('[DATOS.JS] Es admin - intentando recuperar datos completos');
          
          // Primero intentar recuperar adminData si está disponible
          const adminDataStr = localStorage.getItem('adminData');
          if (adminDataStr) {
            try {
              const adminData = JSON.parse(adminDataStr);
              adminData.isAdmin = true;
              console.log('[DATOS.JS] Admin data encontrada en localStorage:', adminData);
              mostrarPerfil(adminData);
              return true;
            } catch(e) {
              console.error('[DATOS.JS] Error parsing adminData:', e);
            }
          }
          
          // Si no hay adminData pero tenemos el nombre en usuarioActivo
          console.log('[DATOS.JS] Usando datos de usuarioActivo para mostrar perfil');
          
          // Construir objeto admin con los datos disponibles
          const adminInfo = {
            isAdmin: true,
            rut: u.rut || u.nombre, // Si nombre es el RUT, usarlo
            nombres: null,
            apellido_paterno: null,
            apellido_materno: null,
            email: null
          };
          
          // Si el nombre NO es un RUT (tiene letras o espacios), entonces es un nombre real
          if (u.nombre && u.nombre !== u.rut && !/^\d+$/.test(u.nombre.replace(/[kK\-]/g, ''))) {
            // Es un nombre real, no un RUT
            const nombreParts = u.nombre.trim().split(/\s+/);
            if (nombreParts.length >= 3) {
              adminInfo.nombres = nombreParts[0];
              adminInfo.apellido_paterno = nombreParts[1];
              adminInfo.apellido_materno = nombreParts.slice(2).join(' ');
            } else if (nombreParts.length === 2) {
              adminInfo.nombres = nombreParts[0];
              adminInfo.apellido_paterno = nombreParts[1];
            } else {
              adminInfo.nombres = u.nombre;
            }
          }
          
          console.log('[DATOS.JS] Mostrando perfil con adminInfo:', adminInfo);
          mostrarPerfil(adminInfo);
          return true;
        } else if (u.nombre || u.rut) {
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
      console.error('[DATOS.JS] Error verificando sesión:', e);
    }
    
    return false;
  }

  // Secuencia de verificación al cargar
  console.log('[DATOS.JS] Iniciando verificación de sesión...');
  const adminLogged = verificarAdminLogeado();
  console.log('[DATOS.JS] Admin logged:', adminLogged);
  
  if (!adminLogged) {
    const trabajadorLogged = verificarSesionTrabajador();
    console.log('[DATOS.JS] Trabajador logged:', trabajadorLogged);
    
    if (!trabajadorLogged) {
      // No hay sesión, mostrar modal de login
      console.log('[DATOS.JS] No hay sesión, mostrando modal de login');
      if (modalDatos) modalDatos.classList.add('show');
    }
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
