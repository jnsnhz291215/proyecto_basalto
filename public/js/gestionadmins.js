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
  const ADMIN_VIEW_MODULES = [
    { label: 'Trabajadores', key: 'admin_trabajadores_v' },
    { label: 'Viajes', key: 'admin_viajes_v' },
    { label: 'Informes de Gestión', key: 'admin_informes_v' }
  ];
  const ADMIN_SOFTDELETE_KEY = 'admin_softdelete';

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
  function showNotification(message, type = 'info', options = {}) {
    const {
      html = false,
      autoHideMs = 4000,
      onRender = null
    } = options || {};

    if (html) notification.innerHTML = message;
    else notification.textContent = message;

    notification.className = `notification show ${type}`;

    if (typeof onRender === 'function') {
      onRender(notification);
    }

    setTimeout(() => {
      notification.classList.remove('show');
    }, autoHideMs);
  }

  function clearNotification() {
    notification.innerHTML = '';
    notification.className = 'notification';
  }

  async function copiarTexto(texto) {
    try {
      await navigator.clipboard.writeText(String(texto || ''));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function showInitialPasswordNotification(passwordInicial, rutAdmin) {
    const clave = String(passwordInicial || '').trim();
    const html = `
      <div class="notification-title">Administrador creado correctamente</div>
      <div>Clave inicial para ${formatearRUT(rutAdmin) || rutAdmin}: usa el RUT normalizado sin puntos ni guión.</div>
      <div class="notification-copy-row">
        <span class="notification-code">${clave}</span>
        <button type="button" class="notification-copy-btn" data-copy-password="${clave}">
          <i class="fas fa-copy"></i> Copiar clave
        </button>
      </div>
    `;

    showNotification(html, 'success', {
      html: true,
      autoHideMs: 9000,
      onRender: (container) => {
        const copyBtn = container.querySelector('[data-copy-password]');
        copyBtn?.addEventListener('click', async () => {
          const copied = await copiarTexto(clave);
          copyBtn.textContent = copied ? 'Copiada' : 'No se pudo copiar';
        }, { once: false });
      }
    });
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

  function humanizarClavePermiso(clave, descripcion = '') {
    if (descripcion && descripcion.trim()) return descripcion.trim();
    if (clave === 'admin_softdelete') return 'Borrar / Soft Delete';
    if (clave === 'admin_trabajadores_v') return 'Ver Trabajadores';
    if (clave === 'admin_viajes_v') return 'Ver Viajes';
    if (clave === 'admin_informes_v') return 'Ver Informes de Gestión';
    return String(clave || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function obtenerOrdenClave(clave) {
    const orden = [
      ...ADMIN_VIEW_MODULES.map((item) => item.key),
      ADMIN_SOFTDELETE_KEY
    ];
    const index = orden.indexOf(clave);
    return index === -1 ? 999 : index;
  }

  function getAdminPermissionByKey(clave) {
    return permisosDisponibles.find((permiso) => permiso.clave_permiso === clave) || null;
  }

  function currentPermissionIdSet() {
    return new Set((currentAdminPermisos || []).map(String));
  }

  function currentPermissionKeySet() {
    const selectedIds = currentPermissionIdSet();
    return new Set(
      permisosDisponibles
        .filter((permiso) => selectedIds.has(String(permiso.id_permiso)))
        .map((permiso) => permiso.clave_permiso)
    );
  }

  function getAdminModuleAccessSummary(permisos = []) {
    const keys = new Set((permisos || []).map((permiso) => String(permiso.clave || permiso.clave_permiso || '')));
    const softDeleteActivo = keys.has(ADMIN_SOFTDELETE_KEY);

    return ADMIN_VIEW_MODULES
      .filter((module) => keys.has(module.key))
      .map((module) => ({
        modulo: module.label,
        nivel: softDeleteActivo ? 'Edición/SoftDelete' : 'Lectura'
      }));
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
      
      const resumenPermisos = getAdminModuleAccessSummary(admin.permisos || []);
      const badgesPermisos = resumenPermisos.length > 0
        ? resumenPermisos.map((permiso) => (
            `<span class="badge-regular-admin" style="margin: 4px 6px 0 0;">${permiso.modulo}: ${permiso.nivel}</span>`
          )).join('')
        : '<span style="font-size: 12px; color: #6b7280;">Sin permisos</span>';

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
          <div style="margin-top: 6px; display: flex; flex-wrap: wrap;">${badgesPermisos}</div>
        </td>
        <td style="text-align: center;">
          <div class="action-buttons">
            <button class="btn-icon btn-permissions" data-rut="${admin.rut}" title="Administrar permisos" ${admin.es_super_admin ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
              <i class="fas fa-key"></i>
            </button>
          </div>
        </td>
      `;

      // Agregar event listener al botón de permisos
      row.querySelector('.btn-permissions').addEventListener('click', () => {
        if (admin.es_super_admin) {
          showNotification('Los permisos de una cuenta Superadministrador no se pueden modificar', 'error');
          return;
        }
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
      clearNotification();

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

      const clavesPermitidas = [
        ...ADMIN_VIEW_MODULES.map((item) => item.key),
        ADMIN_SOFTDELETE_KEY
      ];
      permisosDisponibles = (result.data || [])
        .filter((permiso) => clavesPermitidas.includes(permiso.clave_permiso))
        .sort((a, b) => obtenerOrdenClave(a.clave_permiso) - obtenerOrdenClave(b.clave_permiso));
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

    const currentKeys = currentPermissionKeySet();
    const hasViewAccess = ADMIN_VIEW_MODULES.some((module) => currentKeys.has(module.key));
    const hasSoftDelete = currentKeys.has(ADMIN_SOFTDELETE_KEY);

    const generalWrap = document.createElement('div');
    generalWrap.style.marginBottom = '16px';

    const title = document.createElement('div');
    title.textContent = 'Permisos Generales de Admin';
    title.style.fontWeight = '700';
    title.style.fontSize = '13px';
    title.style.color = '#374151';
    title.style.marginBottom = '10px';
    generalWrap.appendChild(title);

    function createSwitchRow(id, name, description, checked) {
      const row = document.createElement('div');
      row.className = 'permission-item';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = id;
      input.checked = checked;
      input.style.display = 'none';

      const switchLabel = document.createElement('label');
      switchLabel.className = 'switch';
      switchLabel.htmlFor = id;

      const slider = document.createElement('span');
      slider.className = 'slider';
      switchLabel.appendChild(input);
      switchLabel.appendChild(slider);

      const textLabel = document.createElement('label');
      textLabel.className = 'permission-label';
      textLabel.htmlFor = id;

      const nameDiv = document.createElement('div');
      nameDiv.className = 'permission-name';
      nameDiv.textContent = name;

      const descDiv = document.createElement('div');
      descDiv.className = 'permission-description';
      descDiv.textContent = description;

      textLabel.appendChild(nameDiv);
      textLabel.appendChild(descDiv);
      row.appendChild(switchLabel);
      row.appendChild(textLabel);

      row.addEventListener('click', (event) => {
        if (input.disabled) return;
        if (event.target === input) return;
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change'));
      });

      return { row, input };
    }

    const verToggle = createSwitchRow(
      'perm-admin-ver',
      'Ver',
      'Habilita los módulos que el administrador puede visualizar.',
      hasViewAccess
    );
    const borrarToggle = createSwitchRow(
      'perm-admin-borrar',
      'Borrar',
      'Si está activo, habilita edición y soft delete en los módulos visibles.',
      hasSoftDelete
    );

    generalWrap.appendChild(verToggle.row);
    generalWrap.appendChild(borrarToggle.row);

    const modulesWrap = document.createElement('div');
    modulesWrap.id = 'admin-view-modules-wrap';
    modulesWrap.style.display = hasViewAccess ? 'block' : 'none';
    modulesWrap.style.margin = '8px 0 0 54px';
    modulesWrap.style.padding = '12px';
    modulesWrap.style.border = '1px solid #e5e7eb';
    modulesWrap.style.borderRadius = '10px';
    modulesWrap.style.background = '#f8fafc';

    const modulesTitle = document.createElement('div');
    modulesTitle.textContent = 'Vistas disponibles';
    modulesTitle.style.fontWeight = '700';
    modulesTitle.style.fontSize = '12px';
    modulesTitle.style.color = '#475569';
    modulesTitle.style.marginBottom = '10px';
    modulesWrap.appendChild(modulesTitle);

    ADMIN_VIEW_MODULES.forEach((module) => {
      const permiso = getAdminPermissionByKey(module.key);
      if (!permiso) return;

      const item = document.createElement('label');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '10px';
      item.style.fontSize = '14px';
      item.style.color = '#334155';
      item.style.marginBottom = '8px';
      item.innerHTML = `
        <input type="checkbox" class="admin-view-checkbox" value="${permiso.id_permiso}" data-clave="${module.key}" ${currentKeys.has(module.key) ? 'checked' : ''}>
        <span>${module.label}</span>
      `;
      modulesWrap.appendChild(item);
    });

    const softDeletePermiso = getAdminPermissionByKey(ADMIN_SOFTDELETE_KEY);
    if (softDeletePermiso) {
      borrarToggle.input.dataset.permissionId = softDeletePermiso.id_permiso;
    }

    function syncConditionalState() {
      const hasVer = verToggle.input.checked;
      const moduleCheckboxes = modulesWrap.querySelectorAll('.admin-view-checkbox');
      modulesWrap.style.display = hasVer ? 'block' : 'none';

      if (!hasVer) {
        moduleCheckboxes.forEach((checkbox) => { checkbox.checked = false; });
        borrarToggle.input.checked = false;
      }

      const hasAnyModuleSelected = Array.from(moduleCheckboxes).some((checkbox) => checkbox.checked);
      borrarToggle.input.disabled = !hasVer || !hasAnyModuleSelected;
      borrarToggle.row.style.opacity = borrarToggle.input.disabled ? '0.65' : '1';
      if (borrarToggle.input.disabled) {
        borrarToggle.input.checked = false;
      }
    }

    verToggle.input.addEventListener('change', syncConditionalState);
    modulesWrap.querySelectorAll('.admin-view-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) verToggle.input.checked = true;
        syncConditionalState();
      });
    });
    borrarToggle.input.addEventListener('change', syncConditionalState);

    generalWrap.appendChild(modulesWrap);
    permissionsList.appendChild(generalWrap);
    syncConditionalState();
  }

  // ============================================
  // GUARDAR PERMISOS
  // ============================================
  async function savePermissions() {
    try {
      btnSavePermissions.disabled = true;
      btnSavePermissions.innerHTML = '<span class="loading-spinner"></span> Guardando...';

      // Obtener permisos seleccionados
      const selectedPermissions = [];
      permissionsList.querySelectorAll('.admin-view-checkbox:checked').forEach((checkbox) => {
        const id = parseInt(checkbox.value, 10);
        if (Number.isInteger(id)) selectedPermissions.push(id);
      });

      const softDeleteToggle = document.getElementById('perm-admin-borrar');
      if (softDeleteToggle?.checked) {
        const softDeletePermission = getAdminPermissionByKey(ADMIN_SOFTDELETE_KEY);
        if (softDeletePermission) {
          selectedPermissions.push(Number(softDeletePermission.id_permiso));
        }
      }

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

      closePermisosModal();
      await loadAdmins(); // Recargar tabla
      showNotification('Permisos actualizados exitosamente', 'success');

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
    permissionsList.innerHTML = '';
    clearNotification();
  }

  // ============================================
  // CREACIÓN DE ADMINISTRADORES
  // ============================================
  function resetCreateAdminForm() {
    createAdminForm.reset();
    btnSaveCreateAdmin.disabled = false;
    btnSaveCreateAdmin.innerHTML = '<i class="fas fa-user-plus"></i> Crear administrador';
    clearNotification();
  }

  function openCreateModal() {
    resetCreateAdminForm();
    crearAdminModal.classList.add('show');
  }

  function closeCreateModal() {
    crearAdminModal.classList.remove('show');
    resetCreateAdminForm();
  }

  async function createAdmin(event) {
    event.preventDefault();

    const rutOriginal = adminRutInput.value.trim();
    const nombres = adminNombresInput.value.trim();
    const apellidoPaterno = adminApellidoPaternoInput.value.trim();
    const apellidoMaterno = adminApellidoMaternoInput.value.trim();
    const email = adminEmailInput.value.trim().toLowerCase();
    if (!rutOriginal || !nombres || !email) {
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
          rut_solicitante: getRutSolicitante()
        })
      });

      const result = await parseApiResponse(response, 'Error al crear administrador', 'Error creando admin');

      closeCreateModal();
      await loadAdmins();
      showInitialPasswordNotification(result.password_inicial || sanitizarRUT(rutOriginal), rutOriginal);
    } catch (error) {
      console.error('[GESTIONADMINS] Error creando admin:', error);
      showNotification(error.message || 'Error al crear administrador', 'error');
    } finally {
      btnSaveCreateAdmin.disabled = false;
      btnSaveCreateAdmin.innerHTML = '<i class="fas fa-user-plus"></i> Crear administrador';
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
