// ============================================
// GESTIÓN DE ADMINISTRADORES
// ============================================

(function() {
  'use strict';

  // ============================================
  // ESTADO Y CONSTANTES
  // ============================================
  let adminsData = [];
  let permisosDisponibles = [];
  let currentAdminRut = null;
  let currentAdminPermisos = [];
  let pageInitialized = false;

  const userRut = localStorage.getItem('user_rut');
  const isSuperAdmin = localStorage.getItem('user_super_admin') === '1';

  // ============================================
  // DOM ELEMENTS
  // ============================================
  const tableLoadingState = document.getElementById('tableLoadingState');
  const tableEmptyState = document.getElementById('tableEmptyState');
  const adminsTable = document.getElementById('adminsTable');
  const adminsTableBody = document.getElementById('adminsTableBody');
  const adminCount = document.getElementById('adminCount');
  
  const btnNuevoAdmin = document.getElementById('btnNuevoAdmin');

  const permisosModal = document.getElementById('permisosModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const btnSavePermissions = document.getElementById('btnSavePermissions');

  const crearAdminModal = document.getElementById('crearAdminModal');
  const createAdminForm = document.getElementById('createAdminForm');
  const btnCloseCreateModal = document.getElementById('btnCloseCreateModal');
  const btnCancelCreateModal = document.getElementById('btnCancelCreateModal');
  const btnSaveCreateAdmin = document.getElementById('btnSaveCreateAdmin');
  const adminRutInput = document.getElementById('adminRut');
  const adminNombresInput = document.getElementById('adminNombres');
  const adminApellidoPaternoInput = document.getElementById('adminApellidoPaterno');
  const adminApellidoMaternoInput = document.getElementById('adminApellidoMaterno');
  const adminEmailInput = document.getElementById('adminEmail');
  const adminPasswordInput = document.getElementById('adminPassword');
  const adminEsSuperInput = document.getElementById('adminEsSuper');
  
  const notification = document.getElementById('notification');
  const infoAdminName = document.getElementById('infoAdminName');
  const infoAdminRut = document.getElementById('infoAdminRut');
  const permissionsList = document.getElementById('permissionsList');
  const permisosLoadingState = document.getElementById('permisosLoadingState');
  const permissionsContainer = document.getElementById('permissionsContainer');

  // ============================================
  // VERIFICACIÓN DE ACCESO
  // ============================================
  function verificarAcceso() {
    if (!isSuperAdmin) {
      showNotification('Acceso denegado. Solo Super Administradores pueden acceder.', 'error');
      setTimeout(() => {
        window.location.href = '/gestionar.html';
      }, 2000);
      return false;
    }
    return true;
  }

  // ============================================
  // NOTIFICACIONES
  // ============================================
  function showNotification(message, type = 'info') {
    notification.textContent = message;
    notification.className = `notification show ${type}`;

    setTimeout(() => {
      notification.classList.remove('show');
    }, 4000);
  }

  function obtenerMensajeError(defaultMessage, status, payload) {
    if (payload && typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
    return `${defaultMessage}${status ? ` (HTTP ${status})` : ''}`;
  }

  async function parseApiResponse(response, defaultMessage, contextLabel) {
    let payload = null;
    let rawText = '';

    try {
      rawText = await response.text();
      payload = rawText ? JSON.parse(rawText) : null;
    } catch (_error) {
      payload = null;
    }

    if (!response.ok || !payload?.success) {
      const backendMessage = payload?.message || rawText || defaultMessage;
      console.error(`[GESTIONADMINS] ${contextLabel}:`, {
        status: response.status,
        message: backendMessage,
        payload
      });

      throw new Error(obtenerMensajeError(defaultMessage, response.status, payload || { message: backendMessage }));
    }

    return payload;
  }

  function getRutSolicitante() {
    return sanitizarRUT(localStorage.getItem('user_rut'));
  }

  function buildApiUrl(path, includeRutQuery = false) {
    const url = new URL(path, window.location.origin);
    const rutSolicitante = getRutSolicitante();

    if (includeRutQuery && rutSolicitante) {
      url.searchParams.set('rut_solicitante', rutSolicitante);
    }

    return url.toString();
  }

  function buildRequestHeaders(extraHeaders = {}) {
    const rutSolicitante = getRutSolicitante();

    return {
      'Content-Type': 'application/json',
      ...(rutSolicitante ? { rut_solicitante: rutSolicitante } : {}),
      ...extraHeaders
    };
  }

  function waitForNavbarReady() {
    return new Promise((resolve) => {
      if (window.__basaltoMenuReady || document.getElementById('nav-gestionar-parent')) {
        resolve();
        return;
      }

      const onMenuReady = () => {
        window.removeEventListener('basalto:menu-ready', onMenuReady);
        resolve();
      };

      window.addEventListener('basalto:menu-ready', onMenuReady);
      setTimeout(() => {
        window.removeEventListener('basalto:menu-ready', onMenuReady);
        resolve();
      }, 1500);
    });
  }

  function sanitizarRUT(rut) {
    return String(rut || '').replace(/[.\-\s]/g, '').trim().toUpperCase();
  }

  function formatearRUT(rut) {
    const rutLimpio = sanitizarRUT(rut);
    if (rutLimpio.length < 2) return rutLimpio;

    const cuerpo = rutLimpio.slice(0, -1);
    const dv = rutLimpio.slice(-1);
    const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `${cuerpoFormateado}-${dv}`;
  }

  function validarRUTChileno(rut) {
    const rutLimpio = sanitizarRUT(rut);

    if (!/^\d{7,8}[\dK]$/.test(rutLimpio)) {
      return false;
    }

    const cuerpo = rutLimpio.slice(0, -1);
    const dvIngresado = rutLimpio.slice(-1);

    let suma = 0;
    let multiplicador = 2;

    for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
      suma += Number(cuerpo[i]) * multiplicador;
      multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }

    const resto = 11 - (suma % 11);
    let dvEsperado = '';

    if (resto === 11) dvEsperado = '0';
    else if (resto === 10) dvEsperado = 'K';
    else dvEsperado = String(resto);

    return dvIngresado === dvEsperado;
  }

  function validarEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(String(email || '').trim());
  }

  // ============================================
  // CARGAR LISTA DE ADMINISTRADORES
  // ============================================
  async function loadAdmins() {
    try {
      tableLoadingState.style.display = 'block';
      adminsTable.style.display = 'none';
      tableEmptyState.style.display = 'none';

      const rutSolicitante = getRutSolicitante();
      const response = await fetch(buildApiUrl('/api/admins', true), {
        method: 'GET',
        headers: buildRequestHeaders()
      });

      const result = await parseApiResponse(response, 'Error al cargar administradores', 'Error cargando admins');

      adminsData = result.data;
      console.log('[GESTIONADMINS] Administradores cargados con rut_solicitante:', rutSolicitante);
      renderAdminsTable();
      tableLoadingState.style.display = 'none';

    } catch (error) {
      console.error('[GESTIONADMINS] Error cargando admins:', error);
      tableLoadingState.style.display = 'none';
      tableEmptyState.style.display = 'block';
      showNotification('Error al cargar administradores: ' + error.message, 'error');
    }
  }

  // ============================================
  // RENDERIZAR TABLA DE ADMINISTRADORES
  // ============================================
  function renderAdminsTable() {
    if (adminsData.length === 0) {
      tableEmptyState.style.display = 'block';
      adminsTable.style.display = 'none';
      adminCount.textContent = '';
      return;
    }

    tableEmptyState.style.display = 'none';
    adminsTable.style.display = 'table';
    adminCount.textContent = `${adminsData.length} administrador${adminsData.length !== 1 ? 'es' : ''}`;

    adminsTableBody.innerHTML = '';

    adminsData.forEach((admin) => {
      const row = document.createElement('tr');
      
      const badgeClass = admin.es_super_admin ? 'badge-super-admin' : 'badge-regular-admin';
      const badgeText = admin.es_super_admin ? 'Super Admin' : 'Administrador';
      
      const permisosCount = admin.permisos.length;
      const permisosText = permisosCount > 0 
        ? `${permisosCount} permiso${permisosCount !== 1 ? 's' : ''}`
        : 'Sin permisos';

      const adminActivo = Number(admin.activo) === 0 ? 0 : 1;
      const checkedAttr = adminActivo ? 'checked' : '';
      const estadoTexto = adminActivo ? 'Activo' : 'Inactivo';
      const disableSwitch = sanitizarRUT(admin.rut) === sanitizarRUT(userRut) ? 'disabled' : '';

      row.innerHTML = `
        <td><strong>${admin.rut}</strong></td>
        <td>
          <div class="admin-name">${admin.nombre_completo} <span class="${badgeClass}">${badgeText}</span></div>
          <div class="admin-email">${admin.email || 'No especificado'}</div>
        </td>
        <td>${admin.email || '-'}</td>
        <td>
          <div class="estado-toggle">
            <label class="switch">
              <input type="checkbox" class="admin-estado-switch" data-rut="${admin.rut}" ${checkedAttr} ${disableSwitch}>
              <span class="slider"></span>
            </label>
            <span class="estado-label">${estadoTexto}</span>
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${permisosText}</div>
        </td>
        <td style="text-align: center;">
          <div class="action-buttons">
            <button class="btn-icon btn-permissions" data-rut="${admin.rut}" title="Administrar permisos">
              <i class="fas fa-key"></i>
            </button>
          </div>
        </td>
      `;

      // Agregar event listener al botón de permisos
      row.querySelector('.btn-permissions').addEventListener('click', () => {
        openPermisosModal(admin.rut, admin.nombre_completo, admin.permisos);
      });

      const estadoSwitch = row.querySelector('.admin-estado-switch');
      if (estadoSwitch) {
        estadoSwitch.addEventListener('change', async (event) => {
          const nuevoEstado = event.target.checked ? 1 : 0;
          const label = row.querySelector('.estado-label');

          try {
            await updateAdminEstado(admin.rut, nuevoEstado);
            if (label) {
              label.textContent = nuevoEstado === 1 ? 'Activo' : 'Inactivo';
            }
          } catch (error) {
            event.target.checked = !event.target.checked;
            if (label) {
              label.textContent = event.target.checked ? 'Activo' : 'Inactivo';
            }
            showNotification(error.message || 'No se pudo actualizar el estado', 'error');
          }
        });
      }

      adminsTableBody.appendChild(row);
    });
  }

  async function updateAdminEstado(rutAdmin, activo) {
    const response = await fetch('/api/admins/estado', {
      method: 'POST',
      headers: buildRequestHeaders(),
      body: JSON.stringify({
        rut_admin: rutAdmin,
        activo,
        rut_solicitante: getRutSolicitante()
      })
    });

    const result = await parseApiResponse(response, 'Error al actualizar estado', 'Error actualizando estado');

    showNotification(result.message || 'Estado actualizado', 'success');
    await loadAdmins();
  }

  // ============================================
  // ABRIR MODAL DE PERMISOS
  // ============================================
  async function openPermisosModal(rut, nombreCompleto, permisosActuales) {
    try {
      currentAdminRut = rut;
      currentAdminPermisos = permisosActuales.map(p => String(p.id));

      infoAdminName.textContent = nombreCompleto;
      infoAdminRut.textContent = `RUT: ${rut}`;

      // Cargar permisos disponibles si no están cargados
      if (permisosDisponibles.length === 0) {
        await loadPermisosDisponibles();
      }

      renderPermisosCheckboxes();
      permisosModal.classList.add('show');

    } catch (error) {
      console.error('[GESTIONADMINS] Error abriendo modal:', error);
      showNotification('Error al abrir modal de permisos', 'error');
    }
  }

  // ============================================
  // CARGAR PERMISOS DISPONIBLES
  // ============================================
  async function loadPermisosDisponibles() {
    try {
      permisosLoadingState.style.display = 'block';
      permissionsContainer.style.display = 'none';

      const response = await fetch('/api/permisos', {
        method: 'GET',
        headers: buildRequestHeaders()
      });

      const result = await parseApiResponse(response, 'Error al cargar permisos', 'Error cargando permisos');

      permisosDisponibles = result.data;
      permisosLoadingState.style.display = 'none';
      permissionsContainer.style.display = 'block';

    } catch (error) {
      console.error('[GESTIONADMINS] Error cargando permisos:', error);
      permisosLoadingState.style.display = 'none';
      showNotification('Error al cargar permisos: ' + error.message, 'error');
    }
  }

  // ============================================
  // RENDERIZAR CHECKBOXES DE PERMISOS
  // ============================================
  function renderPermisosCheckboxes() {
    permissionsList.innerHTML = '';

    permisosDisponibles.forEach((permiso) => {
      const isChecked = currentAdminPermisos.includes(String(permiso.id_permiso));

      const permissionDiv = document.createElement('div');
      permissionDiv.className = 'permission-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `permiso-${permiso.id_permiso}`;
      checkbox.value = permiso.id_permiso;
      checkbox.checked = isChecked;
      checkbox.dataset.permisoId = permiso.id_permiso;

      const label = document.createElement('label');
      label.className = 'permission-label';
      label.htmlFor = `permiso-${permiso.id_permiso}`;

      const nameDiv = document.createElement('div');
      nameDiv.className = 'permission-name';
      nameDiv.textContent = permiso.nombre_permiso;

      const descDiv = document.createElement('div');
      descDiv.className = 'permission-description';
      descDiv.textContent = permiso.descripcion || 'Sin descripción';

      label.appendChild(nameDiv);
      label.appendChild(descDiv);

      permissionDiv.appendChild(checkbox);
      permissionDiv.appendChild(label);

      // Click en todo el div para toggle del checkbox
      permissionDiv.addEventListener('click', (e) => {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
      });

      permissionsList.appendChild(permissionDiv);
    });
  }

  // ============================================
  // GUARDAR PERMISOS
  // ============================================
  async function savePermissions() {
    try {
      btnSavePermissions.disabled = true;
      btnSavePermissions.innerHTML = '<span class="loading-spinner"></span> Guardando...';

      // Obtener permisos seleccionados
      const checkboxes = permissionsList.querySelectorAll('input[type="checkbox"]:checked');
      const selectedPermissions = Array.from(checkboxes).map(cb => parseInt(cb.value));

      const response = await fetch('/api/admins/permisos', {
        method: 'POST',
        headers: buildRequestHeaders(),
        body: JSON.stringify({
          rut_admin: currentAdminRut,
          rut_solicitante: getRutSolicitante(),
          id_permisos: selectedPermissions
        })
      });

      const result = await parseApiResponse(response, 'Error al guardar permisos', 'Error guardando permisos');

      showNotification('Permisos actualizados exitosamente', 'success');
      closePermisosModal();
      await loadAdmins(); // Recargar tabla

    } catch (error) {
      console.error('[GESTIONADMINS] Error guardando permisos:', error);
      showNotification('Error al guardar permisos: ' + error.message, 'error');
    } finally {
      btnSavePermissions.disabled = false;
      btnSavePermissions.innerHTML = '<i class="fas fa-save"></i> Guardar Permisos';
    }
  }

  // ============================================
  // CERRAR MODAL
  // ============================================
  function closePermisosModal() {
    permisosModal.classList.remove('show');
    currentAdminRut = null;
    currentAdminPermisos = [];
  }

  // ============================================
  // CREACIÓN DE ADMINISTRADORES
  // ============================================
  function openCreateModal() {
    createAdminForm.reset();
    crearAdminModal.classList.add('show');
  }

  function closeCreateModal() {
    crearAdminModal.classList.remove('show');
  }

  async function createAdmin(event) {
    event.preventDefault();

    const rutOriginal = adminRutInput.value.trim();
    const nombres = adminNombresInput.value.trim();
    const apellidoPaterno = adminApellidoPaternoInput.value.trim();
    const apellidoMaterno = adminApellidoMaternoInput.value.trim();
    const email = adminEmailInput.value.trim().toLowerCase();
    const password = adminPasswordInput.value.trim();
    const esSuperAdminNuevo = adminEsSuperInput.checked ? 1 : 0;

    if (!rutOriginal || !nombres || !email || !password) {
      showNotification('Complete todos los campos obligatorios', 'error');
      return;
    }

    if (!validarRUTChileno(rutOriginal)) {
      showNotification('El RUT ingresado no es válido', 'error');
      return;
    }

    if (!validarEmail(email)) {
      showNotification('El formato de Email no es válido', 'error');
      return;
    }

    if (password.length < 4) {
      showNotification('La contraseña debe tener al menos 4 caracteres', 'error');
      return;
    }

    btnSaveCreateAdmin.disabled = true;
    btnSaveCreateAdmin.innerHTML = '<span class="loading-spinner"></span> Creando...';

    try {
      const response = await fetch('/api/admins/crear', {
        method: 'POST',
        headers: buildRequestHeaders(),
        body: JSON.stringify({
          rut: sanitizarRUT(rutOriginal),
          nombres,
          apellido_paterno: apellidoPaterno,
          apellido_materno: apellidoMaterno,
          email,
          password,
          es_super_admin: esSuperAdminNuevo,
          rut_solicitante: getRutSolicitante()
        })
      });

      const result = await parseApiResponse(response, 'Error al crear administrador', 'Error creando admin');

      showNotification('Administrador creado exitosamente', 'success');
      closeCreateModal();
      await loadAdmins();
    } catch (error) {
      console.error('[GESTIONADMINS] Error creando admin:', error);
      showNotification(error.message || 'Error al crear administrador', 'error');
    } finally {
      btnSaveCreateAdmin.disabled = false;
      btnSaveCreateAdmin.innerHTML = '<i class="fas fa-user-plus"></i> Crear Admin';
    }
  }

  async function initPage() {
    if (pageInitialized) return;
    pageInitialized = true;

    if (!verificarAcceso()) {
      return;
    }

    await waitForNavbarReady();

    if (adminRutInput) {
      adminRutInput.addEventListener('blur', () => {
        adminRutInput.value = formatearRUT(adminRutInput.value);
      });
    }

    await loadAdmins();

    btnCloseModal.addEventListener('click', closePermisosModal);
    btnCancelModal.addEventListener('click', closePermisosModal);
    btnSavePermissions.addEventListener('click', savePermissions);

    permisosModal.addEventListener('click', (e) => {
      if (e.target === permisosModal) {
        closePermisosModal();
      }
    });

    btnNuevoAdmin.addEventListener('click', openCreateModal);

    btnCloseCreateModal.addEventListener('click', closeCreateModal);
    btnCancelCreateModal.addEventListener('click', closeCreateModal);
    createAdminForm.addEventListener('submit', createAdmin);

    crearAdminModal.addEventListener('click', (e) => {
      if (e.target === crearAdminModal) {
        closeCreateModal();
      }
    });
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================
  document.addEventListener('DOMContentLoaded', () => {
    initPage().catch((error) => {
      console.error('[GESTIONADMINS] Error inicializando página:', error);
      showNotification(error.message || 'No se pudo inicializar la página', 'error');
    });
  });

  // Exponer funciones globales
  window.gestionadmins = {
    loadAdmins,
    closePermisosModal,
    closeCreateModal
  };

})();
