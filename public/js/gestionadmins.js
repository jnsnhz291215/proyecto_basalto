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
  let currentEditAdminRut = null;
  let pageInitialized = false;
  const ADMIN_PERMISSION_MATRIX = [
    {
      id: 'trabajadores',
      label: 'Trabajadores',
      viewKeys: ['admin_v_trabajadores', 'admin_trabajadores_v'],
      editKeys: ['admin_trabajadores_e'],
      softDeleteKeys: ['admin_trabajadores_d']
    },
    {
      id: 'viajes',
      label: 'Viajes',
      viewKeys: ['admin_v_viajes', 'admin_viajes_v'],
      editKeys: ['admin_viajes_g', 'admin_viajes_e'],
      softDeleteKeys: ['admin_viajes_d']
    },
    {
      id: 'informes',
      label: 'Informes (Gestión + Turno)',
      viewKeys: ['admin_v_informes', 'admin_informes_v', 'informes_ver'],
      editKeys: ['informes_editar', 'admin_informes_e'],
      softDeleteKeys: ['informes_soft_delete', 'admin_informes_d']
    },
    {
      id: 'cargos',
      label: 'Cargos',
      viewKeys: ['gestionar_cargos', 'admin_v_cargos'],
      editKeys: ['admin_cargos_e'],
      softDeleteKeys: ['admin_cargos_d']
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      viewKeys: ['admin_v_kpis'],
      editKeys: [],
      softDeleteKeys: []
    }
  ];

  const ADMIN_PERMISSION_ALLOWED_KEYS = new Set(
    ADMIN_PERMISSION_MATRIX.flatMap((module) => [
      ...module.viewKeys,
      ...module.editKeys,
      ...module.softDeleteKeys
    ])
  );

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
  const crearAdminErrorModal = document.getElementById('crearAdminErrorModal');
  const createAdminErrorTitle = document.getElementById('createAdminErrorTitle');
  const btnCloseCreateErrorModal = document.getElementById('btnCloseCreateErrorModal');
  const btnAcceptCreateErrorModal = document.getElementById('btnAcceptCreateErrorModal');
  const createAdminErrorMessage = document.getElementById('createAdminErrorMessage');
  const editarAdminModal = document.getElementById('editarAdminModal');
  const editAdminForm = document.getElementById('editAdminForm');
  const btnCloseEditModal = document.getElementById('btnCloseEditModal');
  const btnCancelEditModal = document.getElementById('btnCancelEditModal');
  const btnSaveEditAdmin = document.getElementById('btnSaveEditAdmin');
  const editAdminRutOriginalInput = document.getElementById('editAdminRutOriginal');
  const editAdminRutInput = document.getElementById('editAdminRut');
  const editAdminNombresInput = document.getElementById('editAdminNombres');
  const editAdminApellidosInput = document.getElementById('editAdminApellidos');
  const editAdminEmailInput = document.getElementById('editAdminEmail');
  const adminRutInput = document.getElementById('adminRut');
  const adminNombresInput = document.getElementById('adminNombres');
  const adminApellidosInput = document.getElementById('adminApellidos');
  const adminEmailInput = document.getElementById('adminEmail');
  const createPermissionsList = document.getElementById('createPermissionsList');
  
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
      <div>Clave inicial para ${formatearRUT(rutAdmin) || rutAdmin}: usa los ultimos 4 digitos del RUT sin DV.</div>
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

      const error = new Error(obtenerMensajeError(defaultMessage, response.status, payload || { message: backendMessage }));
      error.status = response.status;
      error.payload = payload;
      throw error;
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
    // Conserva solo dígitos y K para tolerar guiones Unicode u otros separadores pegados/copypaste.
    return String(rut || '').replace(/[^0-9kK]/g, '').trim().toUpperCase();
  }

  function forceSafeCloseFallback(modalElement) {
    if (!modalElement) return;

    const activeElement = document.activeElement;
    if (activeElement && modalElement.contains(activeElement)) {
      if (typeof activeElement.blur === 'function') activeElement.blur();
      if (document.body && typeof document.body.focus === 'function') {
        document.body.setAttribute('tabindex', '-1');
        document.body.focus({ preventScroll: true });
        document.body.removeAttribute('tabindex');
      }
    }

    modalElement.classList.remove('show');
    modalElement.setAttribute('aria-hidden', 'true');
    modalElement.inert = true;
    document.body.classList.remove('overflow-hidden', 'modal-open');
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

  function getPermissionByKeys(keys = []) {
    const aliasSet = new Set(keys);
    return permisosDisponibles.find((permiso) => aliasSet.has(String(permiso.clave_permiso || ''))) || null;
  }

  function hasPermissionKey(keySet, keys = []) {
    return keys.some((key) => keySet.has(String(key)));
  }

  function currentPermissionIdSet() {
    return new Set((currentAdminPermisos || []).map(String));
  }

  function currentPermissionKeySet() {
    const selectedIds = currentPermissionIdSet();
    return new Set(
      permisosDisponibles
        .filter((permiso) => selectedIds.has(String(permiso.id_permiso)))
        .map((permiso) => String(permiso.clave_permiso || ''))
    );
  }

  function selectedPermissionIdsFromContainer(container) {
    if (!container) return [];

    const selectedPermissions = new Set();

    container.querySelectorAll('.admin-module-card').forEach((card) => {
      const viewCheckbox = card.querySelector('[data-role="view"]');
      const editCheckbox = card.querySelector('[data-role="edit"]');
      const softDeleteCheckbox = card.querySelector('[data-role="softdelete"]');

      if (!viewCheckbox?.checked) return;

      const viewPermission = getPermissionByKeys(
        String(viewCheckbox.dataset.permissionKeys || '').split('|').filter(Boolean)
      );
      if (viewPermission) selectedPermissions.add(Number(viewPermission.id_permiso));

      if (editCheckbox?.checked) {
        const editPermission = getPermissionByKeys(
          String(editCheckbox.dataset.permissionKeys || '').split('|').filter(Boolean)
        );
        if (editPermission) selectedPermissions.add(Number(editPermission.id_permiso));
      }

      if (softDeleteCheckbox?.checked) {
        const softDeletePermission = getPermissionByKeys(
          String(softDeleteCheckbox.dataset.permissionKeys || '').split('|').filter(Boolean)
        );
        if (softDeletePermission) selectedPermissions.add(Number(softDeletePermission.id_permiso));
      }
    });

    return Array.from(selectedPermissions);
  }

  function getAdminModuleAccessSummary(permisos = []) {
    const keys = new Set((permisos || []).map((permiso) => String(permiso.clave || permiso.clave_permiso || '')));

    return ADMIN_PERMISSION_MATRIX
      .filter((module) => hasPermissionKey(keys, module.viewKeys))
      .map((module) => {
        const tieneEditar = hasPermissionKey(keys, module.editKeys);
        const tieneSoftDelete = hasPermissionKey(keys, module.softDeleteKeys);
        let nivel = 'Lectura';
        if (tieneSoftDelete) nivel = 'Edición/SoftDelete';
        else if (tieneEditar) nivel = 'Edición';

        return {
          modulo: module.label,
          nivel
        };
      });
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
            <button class="btn-icon btn-edit-admin" data-rut="${admin.rut}" title="Editar datos" ${admin.es_super_admin ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn-icon btn-permissions" data-rut="${admin.rut}" title="Administrar permisos" ${admin.es_super_admin ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
              <i class="fas fa-key"></i>
            </button>
            ${isSuperAdmin && admin.rut !== userRut && !admin.es_super_admin ? `
            <button class="btn-icon btn-hard-delete" data-rut="${admin.rut}" title="Eliminar definitivamente" style="color: #dc2626; margin-left: 8px;">
              <i class="fas fa-trash"></i>
            </button>
            ` : ''}
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

      row.querySelector('.btn-edit-admin')?.addEventListener('click', () => {
        if (admin.es_super_admin) {
          showNotification('Los datos de una cuenta Superadministrador no se editan desde esta vista', 'error');
          return;
        }
        openEditAdminModal(admin);
      });

      // Agregar event listener al botón de delete físico
      const btnDelete = row.querySelector('.btn-hard-delete');
      if (btnDelete) {
        btnDelete.addEventListener('click', () => {
          if (window.basaltoSecurity && window.basaltoSecurity.requireHardDelete) {
            window.basaltoSecurity.requireHardDelete({
              title: "Eliminar Administrador",
              message: `¿Está seguro de eliminar físicamente la cuenta de "${admin.nombre_completo}"? Esta acción no se puede deshacer y borrará sus permisos.`,
              onConfirm: async () => {
                try {
                  const response = await fetch(`/api/admins/${admin.rut}`, {
                    method: 'DELETE',
                    headers: buildRequestHeaders()
                  });
                  const result = await parseApiResponse(response, "Error al eliminar administrador", "Eliminar Administrador");
                  showNotification(result.message, 'success');
                  await loadAdmins();
                } catch (error) {
                  showNotification(error.message || 'No se pudo eliminar el administrador', 'error');
                }
              }
            });
          }
        });
      }

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
      if (window.basaltoModal?.open) window.basaltoModal.open(permisosModal);
      else {
        permisosModal.inert = false;
        permisosModal.classList.add('show');
        permisosModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('overflow-hidden', 'modal-open');
      }

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

      const clavesPermitidas = ADMIN_PERMISSION_ALLOWED_KEYS;
      permisosDisponibles = (result.data || [])
        .filter((permiso) => clavesPermitidas.has(permiso.clave_permiso))
        .sort((a, b) => String(a.clave_permiso || '').localeCompare(String(b.clave_permiso || '')));
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
  function renderAdminPermissionMatrix(targetContainer, selectedKeys = new Set(), idPrefix = 'perm-admin') {
    if (!targetContainer) return;
    targetContainer.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'permission-matrix';

    const title = document.createElement('div');
    title.className = 'permission-group-title';
    title.textContent = 'Permisos por módulo';
    wrap.appendChild(title);

    const help = document.createElement('p');
    help.className = 'permission-modules-help';
    help.textContent = 'Cada módulo habilita Ver, Editar y SoftDelete. SoftDelete requiere Editar.';
    wrap.appendChild(help);

    const modulesGrid = document.createElement('div');
    modulesGrid.className = 'permission-modules-grid';

    ADMIN_PERMISSION_MATRIX.forEach((module) => {
      const hasViewPermission = module.viewKeys.some((key) => ADMIN_PERMISSION_ALLOWED_KEYS.has(key));
      if (!hasViewPermission) return;

      const moduleCard = document.createElement('div');
      moduleCard.className = 'permission-module-option admin-module-card';
      moduleCard.dataset.moduleId = module.id;

      const viewChecked = hasPermissionKey(selectedKeys, module.viewKeys);
      const editChecked = hasPermissionKey(selectedKeys, module.editKeys);
      const softDeleteChecked = hasPermissionKey(selectedKeys, module.softDeleteKeys);

      moduleCard.innerHTML = `
        <div class="permission-module-title">${module.label}</div>
        <div class="permission-module-flags">
          <label>
            <input type="checkbox" data-role="view" data-permission-keys="${module.viewKeys.join('|')}" ${viewChecked ? 'checked' : ''}>
            Ver
          </label>
          ${module.editKeys.length ? `
          <label>
            <input type="checkbox" data-role="edit" data-permission-keys="${module.editKeys.join('|')}" ${editChecked ? 'checked' : ''}>
            Editar
          </label>` : ''}
          ${module.softDeleteKeys.length ? `
          <label>
            <input type="checkbox" data-role="softdelete" data-permission-keys="${module.softDeleteKeys.join('|')}" ${softDeleteChecked ? 'checked' : ''}>
            SoftDelete
          </label>` : ''}
        </div>
      `;

      const viewCheckbox = moduleCard.querySelector('[data-role="view"]');
      const editCheckbox = moduleCard.querySelector('[data-role="edit"]');
      const softDeleteCheckbox = moduleCard.querySelector('[data-role="softdelete"]');

      function syncModuleDependencies() {
        if (!viewCheckbox) return;

        if (!viewCheckbox.checked) {
          if (editCheckbox) editCheckbox.checked = false;
          if (softDeleteCheckbox) softDeleteCheckbox.checked = false;
        }

        if (editCheckbox) {
          editCheckbox.disabled = !viewCheckbox.checked;
          if (!editCheckbox.checked && softDeleteCheckbox) {
            softDeleteCheckbox.checked = false;
          }
        }

        if (softDeleteCheckbox) {
          const editReady = editCheckbox ? editCheckbox.checked : viewCheckbox.checked;
          softDeleteCheckbox.disabled = !viewCheckbox.checked || !editReady;
          if (softDeleteCheckbox.disabled) {
            softDeleteCheckbox.checked = false;
          }
        }
      }

      viewCheckbox?.addEventListener('change', syncModuleDependencies);
      editCheckbox?.addEventListener('change', syncModuleDependencies);
      softDeleteCheckbox?.addEventListener('change', syncModuleDependencies);

      syncModuleDependencies();
      modulesGrid.appendChild(moduleCard);
    });

    wrap.appendChild(modulesGrid);
    targetContainer.appendChild(wrap);
  }

  function renderPermisosCheckboxes() {
    renderAdminPermissionMatrix(permissionsList, currentPermissionKeySet(), 'perm-admin-edit');
  }

  function renderCreatePermissions() {
    renderAdminPermissionMatrix(createPermissionsList, new Set(), 'perm-admin-create');
  }

  // ============================================
  // GUARDAR PERMISOS
  // ============================================
  async function savePermissions() {
    try {
      btnSavePermissions.disabled = true;
      btnSavePermissions.innerHTML = '<span class="loading-spinner"></span> Guardando...';

      // Obtener permisos seleccionados
      const selectedPermissions = selectedPermissionIdsFromContainer(permissionsList);

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
    if (window.basaltoModal?.close) window.basaltoModal.close(permisosModal);
    else forceSafeCloseFallback(permisosModal);
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
    renderCreatePermissions();
    btnSaveCreateAdmin.disabled = false;
    btnSaveCreateAdmin.innerHTML = '<i class="fas fa-user-plus"></i> Crear administrador';
    clearNotification();
  }

  async function openCreateModal() {
    if (permisosDisponibles.length === 0) {
      await loadPermisosDisponibles();
    }
    resetCreateAdminForm();
    if (window.basaltoModal?.open) window.basaltoModal.open(crearAdminModal);
    else {
      crearAdminModal.inert = false;
      crearAdminModal.classList.add('show');
      crearAdminModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('overflow-hidden', 'modal-open');
    }
  }

  function closeCreateModal() {
    if (window.basaltoModal?.close) window.basaltoModal.close(crearAdminModal);
    else forceSafeCloseFallback(crearAdminModal);
    resetCreateAdminForm();
  }

  function showCreateAdminErrorModal(message, title = 'No se pudo crear el administrador') {
    if (!crearAdminErrorModal || !createAdminErrorMessage) {
      showNotification(message || 'No se pudo crear el administrador', 'error');
      return;
    }

    if (createAdminErrorTitle) {
      createAdminErrorTitle.innerHTML = `<i class="fas fa-triangle-exclamation" style="color:#dc2626;"></i> ${title}`;
    }
    createAdminErrorMessage.textContent = message || 'No se pudo crear el administrador';
    if (window.basaltoModal?.open) window.basaltoModal.open(crearAdminErrorModal);
    else {
      crearAdminErrorModal.inert = false;
      crearAdminErrorModal.classList.add('show');
      crearAdminErrorModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('overflow-hidden', 'modal-open');
    }
  }

  function closeCreateAdminErrorModal() {
    if (!crearAdminErrorModal) return;
    if (window.basaltoModal?.close) window.basaltoModal.close(crearAdminErrorModal);
    else forceSafeCloseFallback(crearAdminErrorModal);
  }

  function resetEditAdminForm() {
    if (!editAdminForm) return;
    editAdminForm.reset();
    currentEditAdminRut = null;
    if (editAdminRutOriginalInput) editAdminRutOriginalInput.value = '';
    if (btnSaveEditAdmin) {
      btnSaveEditAdmin.disabled = false;
      btnSaveEditAdmin.innerHTML = '<i class="fas fa-save"></i> Guardar cambios';
    }
  }

  function openEditAdminModal(admin) {
    if (!editarAdminModal || !editAdminForm) return;

    currentEditAdminRut = sanitizarRUT(admin?.rut || '');
    const apellidoPaterno = String(admin?.apellido_paterno || '').trim();
    const apellidoMaterno = String(admin?.apellido_materno || '').trim();
    const apellidos = [apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ').trim();

    if (editAdminRutOriginalInput) editAdminRutOriginalInput.value = admin?.rut || '';
    if (editAdminRutInput) editAdminRutInput.value = formatearRUT(admin?.rut || '');
    if (editAdminNombresInput) editAdminNombresInput.value = String(admin?.nombres || '').trim();
    if (editAdminApellidosInput) editAdminApellidosInput.value = apellidos;
    if (editAdminEmailInput) editAdminEmailInput.value = String(admin?.email || '').trim();

    if (window.basaltoModal?.open) window.basaltoModal.open(editarAdminModal);
    else {
      editarAdminModal.inert = false;
      editarAdminModal.classList.add('show');
      editarAdminModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('overflow-hidden', 'modal-open');
    }
  }

  function closeEditAdminModal() {
    if (!editarAdminModal) return;
    if (window.basaltoModal?.close) window.basaltoModal.close(editarAdminModal);
    else forceSafeCloseFallback(editarAdminModal);
    resetEditAdminForm();
  }

  function getEditAdminErrorTitle(error) {
    const status = Number(error?.status || 0);
    if (status === 409) return 'RUT o correo ya registrado';
    if (status === 400) return 'Datos inválidos';
    if (status === 401 || status === 403) return 'Acceso denegado';
    if (status === 404) return 'Administrador no encontrado';
    if (status >= 500) return 'Error interno del servidor';
    return 'No se pudo actualizar el administrador';
  }

  async function saveAdminBasicData(event) {
    event.preventDefault();
    if (!currentEditAdminRut) {
      showNotification('No se encontró el administrador a editar', 'error');
      return;
    }

    const rutOriginal = String(editAdminRutInput?.value || '').trim();
    const nombres = String(editAdminNombresInput?.value || '').trim();
    const apellidosRaw = String(editAdminApellidosInput?.value || '').trim().replace(/\s+/g, ' ');
    const apellidosParts = apellidosRaw.split(' ').filter(Boolean);
    const apellidoPaterno = apellidosParts[0] || '';
    const apellidoMaterno = apellidosParts.slice(1).join(' ') || null;
    const email = String(editAdminEmailInput?.value || '').trim().toLowerCase();

    if (!rutOriginal || !nombres || !apellidosRaw || !email) {
      showNotification('Complete todos los campos obligatorios para editar', 'error');
      return;
    }

    if (!validarEmail(email)) {
      showNotification('El formato de Email no es válido', 'error');
      return;
    }

    btnSaveEditAdmin.disabled = true;
    btnSaveEditAdmin.innerHTML = '<span class="loading-spinner"></span> Guardando...';

    try {
      const response = await fetch(`/api/admins/${encodeURIComponent(currentEditAdminRut)}`, {
        method: 'PUT',
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

      await parseApiResponse(response, 'Error al actualizar administrador', 'Error actualizando admin');

      closeEditAdminModal();
      await loadAdmins();
      showNotification('Datos del administrador actualizados exitosamente', 'success');
    } catch (error) {
      console.error('[GESTIONADMINS] Error actualizando admin:', error);
      showCreateAdminErrorModal(error.message || 'No se pudo actualizar el administrador', getEditAdminErrorTitle(error));
    } finally {
      btnSaveEditAdmin.disabled = false;
      btnSaveEditAdmin.innerHTML = '<i class="fas fa-save"></i> Guardar cambios';
    }
  }

  function getCreateAdminErrorTitle(error) {
    const status = Number(error?.status || 0);
    if (status === 409) return 'RUT o correo ya registrado';
    if (status === 400) return 'Datos inválidos';
    if (status === 401 || status === 403) return 'Acceso denegado';
    if (status >= 500) return 'Error interno del servidor';
    return 'No se pudo crear el administrador';
  }

  async function createAdmin(event) {
    event.preventDefault();

    const rutOriginal = adminRutInput.value.trim();
    const nombres = adminNombresInput.value.trim();
    const apellidosRaw = adminApellidosInput.value.trim().replace(/\s+/g, ' ');
    const apellidosParts = apellidosRaw.split(' ').filter(Boolean);
    const apellidoPaterno = apellidosParts[0] || '';
    const apellidoMaterno = apellidosParts.slice(1).join(' ') || null;
    const email = adminEmailInput.value.trim().toLowerCase();
    const idPermisos = selectedPermissionIdsFromContainer(createPermissionsList);
    if (!rutOriginal || !nombres || !apellidosRaw || !email) {
      showCreateAdminErrorModal('Complete todos los campos obligatorios', 'Datos incompletos');
      return;
    }

    // No bloquear por DV en frontend: el backend define el nivel de validación según entorno.

    if (!validarEmail(email)) {
      showCreateAdminErrorModal('El formato de Email no es válido', 'Correo inválido');
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
          id_permisos: idPermisos,
          rut_solicitante: getRutSolicitante()
        })
      });

      const result = await parseApiResponse(response, 'Error al crear administrador', 'Error creando admin');

      closeCreateModal();
      await loadAdmins();
      showInitialPasswordNotification(result.password_inicial || sanitizarRUT(rutOriginal), rutOriginal);
    } catch (error) {
      console.error('[GESTIONADMINS] Error creando admin:', error);
      showCreateAdminErrorModal(error.message || 'Error al crear administrador', getCreateAdminErrorTitle(error));
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

    btnCloseEditModal?.addEventListener('click', closeEditAdminModal);
    btnCancelEditModal?.addEventListener('click', closeEditAdminModal);
    editAdminForm?.addEventListener('submit', saveAdminBasicData);
    editAdminRutInput?.addEventListener('blur', () => {
      editAdminRutInput.value = formatearRUT(editAdminRutInput.value);
    });

    btnCloseCreateErrorModal?.addEventListener('click', closeCreateAdminErrorModal);
    btnAcceptCreateErrorModal?.addEventListener('click', closeCreateAdminErrorModal);

    crearAdminModal.addEventListener('click', (e) => {
      if (e.target === crearAdminModal) {
        closeCreateModal();
      }
    });

    crearAdminErrorModal?.addEventListener('click', (e) => {
      if (e.target === crearAdminErrorModal) {
        closeCreateAdminErrorModal();
      }
    });

    editarAdminModal?.addEventListener('click', (e) => {
      if (e.target === editarAdminModal) {
        closeEditAdminModal();
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
    closeCreateModal,
    closeEditAdminModal
  };

})();
