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
  
  // Elementos de estado de turno
  const estadoTurnoBadge = document.getElementById('estado-turno-badge');
  const proximaJornadaSection = document.getElementById('proxima-jornada-section');
  const proximaJornadaContenido = document.getElementById('proxima-jornada-contenido');
  
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
      
      // Formatear fecha de nacimiento
      let fechaNacimientoFormateada = '---';
      if (perfil.fecha_nacimiento) {
        try {
          const fecha = new Date(perfil.fecha_nacimiento);
          fechaNacimientoFormateada = fecha.toLocaleDateString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        } catch(e) {
          fechaNacimientoFormateada = perfil.fecha_nacimiento;
        }
      }
      perfilFechaNacimiento.textContent = fechaNacimientoFormateada;
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
    
    // Cargar estado del turno (solo para trabajadores)
    await cargarEstadoTurno();
  }

  // ============================================
  // Cargar estado del turno
  // ============================================
  async function cargarEstadoTurno() {
    try {
      console.log('[DATOS] Cargando estado de turno para RUT:', userRut);
      
      const response = await fetch(`/api/estado-turno/${userRut}`);
      
      if (!response.ok) {
        throw new Error('Error al obtener estado del turno');
      }
      
      const estadoTurno = await response.json();
      console.log('[DATOS] Estado de turno recibido:', estadoTurno);
      
      mostrarEstadoTurno(estadoTurno);
      
    } catch (error) {
      console.error('[DATOS] Error cargando estado de turno:', error);
      // No mostrar el badge si hay error
      if (estadoTurnoBadge) estadoTurnoBadge.style.display = 'none';
      if (proximaJornadaSection) proximaJornadaSection.style.display = 'none';
    }
  }

  // ============================================
  // Mostrar estado del turno en la UI
  // ============================================
  function mostrarEstadoTurno(estadoTurno) {
    if (!estadoTurnoBadge || !proximaJornadaSection) return;
    
    // Si no tiene grupo o es grupo no reconocido, no mostrar nada
    if (estadoTurno.estado === 'sin_grupo' || estadoTurno.estado === 'sin_datos') {
      estadoTurnoBadge.style.display = 'none';
      proximaJornadaSection.style.display = 'none';
      return;
    }
    
    // Configurar badge de estado
    let badgeColor = '#6b7280'; // Gris por defecto
    let badgeIcon = 'fa-circle';
    let badgeText = estadoTurno.mensaje;
    
    if (estadoTurno.estado === 'en_turno') {
      badgeColor = '#10b981'; // Verde
      badgeIcon = 'fa-circle-check';
      badgeText = '● En Turno';
    } else if (estadoTurno.estado === 'proximo_turno') {
      badgeColor = '#f59e0b'; // Amarillo
      badgeIcon = 'fa-clock';
      badgeText = `● Próximo a Turno (${estadoTurno.dias_restantes} día${estadoTurno.dias_restantes !== 1 ? 's' : ''})`;
    } else if (estadoTurno.estado === 'en_descanso') {
      badgeColor = '#6b7280'; // Gris
      badgeIcon = 'fa-moon';
      badgeText = '● En Descanso';
    }
    
    estadoTurnoBadge.innerHTML = `<i class="fa-solid ${badgeIcon}"></i> ${badgeText}`;
    estadoTurnoBadge.style.backgroundColor = badgeColor;
    estadoTurnoBadge.style.color = '#ffffff';
    estadoTurnoBadge.style.display = 'inline-block';
    estadoTurnoBadge.style.padding = '6px 12px';
    estadoTurnoBadge.style.borderRadius = '6px';
    estadoTurnoBadge.style.fontSize = '14px';
    estadoTurnoBadge.style.fontWeight = '600';
    
    // Configurar sección de próxima jornada
    if (estadoTurno.proxima_jornada && estadoTurno.turno_tipo !== 'semanal') {
      let contenidoHTML = '';
      
      if (estadoTurno.estado === 'en_turno') {
        // Está trabajando - mostrar cuántos días le quedan y su próximo turno después del descanso
        contenidoHTML = `
          <p style="margin:0 0 8px 0;"><strong>Turno Actual:</strong> ${estadoTurno.dias_restantes} día${estadoTurno.dias_restantes !== 1 ? 's' : ''} restante${estadoTurno.dias_restantes !== 1 ? 's' : ''}</p>
          <p style="margin:0;"><strong>Próximo Turno (después del descanso):</strong><br>
          Del ${estadoTurno.proxima_jornada.inicio} al ${estadoTurno.proxima_jornada.fin}</p>
        `;
      } else {
        // Está descansando - mostrar próximo turno
        contenidoHTML = `
          <p style="margin:0;"><strong>Próximo Turno:</strong><br>
          Del ${estadoTurno.proxima_jornada.inicio} al ${estadoTurno.proxima_jornada.fin}</p>
          <p style="margin:8px 0 0 0;font-size:13px;color:#6b7280;">Faltan ${estadoTurno.dias_restantes} día${estadoTurno.dias_restantes !== 1 ? 's' : ''}</p>
        `;
      }
      
      if (estadoTurno.horario) {
        contenidoHTML += `<p style="margin:8px 0 0 0;font-size:13px;color:#6b7280;"><i class="fa-solid fa-clock"></i> ${estadoTurno.horario}</p>`;
      }
      
      proximaJornadaContenido.innerHTML = contenidoHTML;
      proximaJornadaSection.style.display = 'block';
    } else if (estadoTurno.turno_tipo === 'semanal') {
      // Grupos semanales - mostrar horario semanal
      const diasTrabajo = estadoTurno.grupo === 'J' ? 'Lunes a Jueves' : 'Martes a Viernes';
      proximaJornadaContenido.innerHTML = `
        <p style="margin:0;"><strong>Horario Semanal:</strong> ${diasTrabajo}</p>
        <p style="margin:8px 0 0 0;font-size:13px;color:#6b7280;">Turno continuo de lunes a viernes</p>
      `;
      proximaJornadaSection.style.display = 'block';
    } else {
      proximaJornadaSection.style.display = 'none';
    }
  }

})();
