// ============================================
// PÁGINA DE DATOS PERSONALES - Sistema Unificado
// ============================================

(async function() {
  'use strict';

  // Elementos del DOM
  const perfilCard = document.getElementById('perfil-card');
  const perfilNombre = document.getElementById('perfil-nombre');
  const perfilRut = document.getElementById('perfil-rut');
  const perfilTelefono = document.getElementById('perfil-telefono');
  const perfilEmail = document.getElementById('perfil-email');
  const perfilGrupo = document.getElementById('perfil-grupo');
  const perfilCargo = document.getElementById('perfil-cargo');
  const perfilFechaNacimiento = document.getElementById('perfil-fecha-nacimiento');
  const perfilCiudad = document.getElementById('perfil-ciudad');
  
  // Obtener datos de sesión
  const userRole = localStorage.getItem('user_role');
  const userRut = localStorage.getItem('user_rut');
  const userName = localStorage.getItem('user_name');

  console.log('[DATOS] Sesión actual:', { userRole, userRut, userName });

  // Si no hay sesión, redirigir (el auth_guard ya debería hacerlo, pero por seguridad)
  if (!userRole || !userRut) {
    console.log('[DATOS] No hay sesión, redirigiendo a index.html');
    window.location.href = '/index.html';
    return;
  }

  // Cargar datos del perfil
  await cargarPerfil();

  // ============================================
  // Función para cargar datos del perfil
  // ============================================
  async function cargarPerfil() {
    try {
      console.log('[DATOS] Cargando perfil para RUT:', userRut);

      if (userRole === 'admin') {
        // Para admin, mostrar datos básicos
        mostrarPerfilAdmin();
      } else {
        // Para trabajadores, obtener datos completos del servidor
        await mostrarPerfilTrabajador();
      }
    } catch (error) {
      console.error('[DATOS] Error cargando perfil:', error);
      alert('Error al cargar los datos del perfil');
    }
  }

  // ============================================
  // Mostrar perfil de Admin
  // ============================================
  function mostrarPerfilAdmin() {
    console.log('[DATOS] Mostrando perfil de admin');
    
    // Intentar obtener datos completos del admin si están disponibles
    const adminDataStr = localStorage.getItem('adminData');
    let adminData = null;
    
    if (adminDataStr) {
      try {
        adminData = JSON.parse(adminDataStr);
      } catch(e) {
        console.error('[DATOS] Error parsing adminData:', e);
      }
    }

    const nombres = adminData?.nombres || '';
    const apellidoP = adminData?.apellido_paterno || '';
    const apellidoM = adminData?.apellido_materno || '';
    const fullName = (nombres + ' ' + apellidoP + ' ' + apellidoM).trim() || userName || userRut;

    perfilNombre.textContent = fullName;
    perfilRut.textContent = adminData?.rut || userRut;
    perfilEmail.textContent = adminData?.email || '---';
    perfilTelefono.textContent = '---';
    perfilCargo.textContent = 'Administrador';
    perfilGrupo.textContent = 'Administrador';
    
    // Ocultar campos no aplicables
    if (perfilFechaNacimiento && perfilFechaNacimiento.parentElement) {
      perfilFechaNacimiento.parentElement.style.display = 'none';
    }
    if (perfilCiudad && perfilCiudad.parentElement) {
      perfilCiudad.parentElement.style.display = 'none';
    }

    // Estilos del badge de admin
    perfilGrupo.classList.remove('profile-badge');
    perfilGrupo.style.backgroundColor = '#dc2626';
    perfilGrupo.style.color = '#fff';
    perfilGrupo.style.display = 'inline-block';
    perfilGrupo.style.padding = '4px 8px';
    perfilGrupo.style.borderRadius = '4px';
    perfilGrupo.style.fontSize = '0.875rem';
    perfilGrupo.style.fontWeight = '600';

    perfilCard.style.display = 'block';
  }

  // ============================================
  // Mostrar perfil de Trabajador
  // ============================================
  async function mostrarPerfilTrabajador() {
    try {
      console.log('[DATOS] Consultando datos del trabajador - RUT:', userRut);
      
      const response = await fetch(`/api/perfil/${userRut}`);
      
      if (!response.ok) {
        throw new Error('Error al obtener datos del perfil');
      }

      const perfil = await response.json();
      console.log('[DATOS] Datos del perfil recibidos:', perfil);

      // Mostrar datos en la UI
      const nombreCompleto = `${perfil.nombres || ''} ${perfil.apellidos || ''}`.trim() || userName;
      
      perfilNombre.textContent = nombreCompleto;
      perfilRut.textContent = perfil.rut || userRut;
      perfilTelefono.textContent = perfil.telefono || '---';
      perfilEmail.textContent = perfil.email || '---';
      perfilCargo.textContent = perfil.cargo || '---';
      perfilFechaNacimiento.textContent = perfil.fecha_nacimiento || '---';
      perfilCiudad.textContent = perfil.ciudad || '---';

      //Grupo
      const grupoText = perfil.grupo ? `Grupo: ${perfil.grupo}` : 'Sin grupo asignado';
      perfilGrupo.textContent = grupoText;
      perfilGrupo.classList.add('profile-badge');
      perfilGrupo.style.backgroundColor = '';
      perfilGrupo.style.color = '';

      // Mostrar todos los campos
      if (perfilFechaNacimiento && perfilFechaNacimiento.parentElement) {
        perfilFechaNacimiento.parentElement.style.display = '';
      }
      if (perfilCiudad && perfilCiudad.parentElement) {
        perfilCiudad.parentElement.style.display = '';
      }

      perfilCard.style.display = 'block';
      
    } catch (error) {
      console.error('[DATOS] Error obteniendo perfil del trabajador:', error);
      
      // Fallback: mostrar datos básicos de la sesión
      perfilNombre.textContent = userName || userRut;
      perfilRut.textContent = userRut;
      perfilEmail.textContent = '---';
      perfilTelefono.textContent = '---';
      perfilCargo.textContent = '---';
      perfilGrupo.textContent = 'Sin datos';
      
      perfilCard.style.display = 'block';
      
      alert('No se pudieron cargar todos los datos del perfil. Mostrando información básica.');
    }
  }

})();
