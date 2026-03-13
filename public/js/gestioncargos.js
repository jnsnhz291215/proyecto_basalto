(function() {
  'use strict';

  const SECTION_KEYS = [
    { key: 'antecedentes', label: 'Antecedentes' },
    { key: 'operacion', label: 'Operación' },
    { key: 'materiales', label: 'Materiales' },
    { key: 'actividades', label: 'Actividades' },
    { key: 'cierre', label: 'Cierre' }
  ];

  const ACCESS_LEVELS = [
    { key: 'none', label: 'Sin acceso' },
    { key: 'r', label: 'Solo lectura' },
    { key: 'w', label: 'Escritura' }
  ];

  const state = {
    cargos: [],
    permisos: [],
    editingCargoId: null
  };

  const el = {
    cargosBody: document.getElementById('cargosBody'),
    cargoCount: document.getElementById('cargoCount'),
    btnNuevoCargo: document.getElementById('btnNuevoCargo'),
    modal: document.getElementById('cargoModal'),
    modalTitle: document.getElementById('cargoModalTitle'),
    closeModal: document.getElementById('closeCargoModal'),
    cancelModal: document.getElementById('cancelCargoModal'),
    saveModal: document.getElementById('saveCargoModal'),
    cargoNombre: document.getElementById('cargoNombre'),
    permisosGestion: document.getElementById('permisosGestion'),
    permisosOperacion: document.getElementById('permisosOperacion'),
    notification: document.getElementById('notification')
  };

  function notify(message, type = 'success') {
    if (!el.notification) return;
    el.notification.textContent = message;
    el.notification.className = `notification show ${type}`;
    setTimeout(() => {
      el.notification.classList.remove('show');
    }, 3000);
  }

  function clearNotification() {
    if (!el.notification) return;
    el.notification.textContent = '';
    el.notification.className = 'notification';
  }

  function sanitizeRut(rut) {
    return String(rut || '').replace(/[.\-\s]/g, '').trim().toUpperCase();
  }

  function humanizeKey(clave) {
    return String(clave || '')
      .replace(/^inf_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function buildHeaders() {
    const rut = sanitizeRut(localStorage.getItem('user_rut'));
    return {
      'Content-Type': 'application/json',
      ...(rut ? { rut_solicitante: rut } : {})
    };
  }

  function getSectionPermissionKey(section, level) {
    if (level === 'none') return null;
    return `inf_seccion_${section}_${level}`;
  }

  function getAuxiliaryOperationalPermissions() {
    return state.permisos.filter((permiso) => {
      const key = String(permiso.clave_permiso || '');
      if (!key.startsWith('inf_')) return false;
      if (/^inf_seccion_[a-z_]+_[rw]$/.test(key)) return false;
      return true;
    });
  }

  async function loadPermisos() {
    const res = await fetch('/api/permisos', { headers: buildHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success || !Array.isArray(data.data)) {
      throw new Error(data?.message || 'No fue posible cargar los permisos');
    }

    state.permisos = data.data;
  }

  async function loadCargos() {
    const res = await fetch('/api/cargos');
    const data = await res.json().catch(() => ([]));
    if (!res.ok || !Array.isArray(data)) {
      throw new Error('No fue posible cargar los cargos');
    }

    state.cargos = data;
    renderCargos();
  }

  function renderCargos() {
    if (!el.cargosBody) return;

    el.cargosBody.innerHTML = '';
    el.cargoCount.textContent = `${state.cargos.length} cargo${state.cargos.length !== 1 ? 's' : ''}`;

    state.cargos.forEach((cargo) => {
      const row = document.createElement('tr');
      const permisos = cargo.permisos || [];
      const chips = permisos.length
        ? permisos.map((permiso) => `<span class="chip operacion">${humanizeKey(permiso.clave_permiso || permiso.nombre_permiso)}</span>`).join('')
        : '<span style="color:#6b7280">Sin permisos</span>';

      row.innerHTML = `
        <td><strong>${cargo.nombre_cargo}</strong></td>
        <td><div class="chips">${chips}</div></td>
        <td>
          <button class="btn-icon" data-id="${cargo.id_cargo}" title="Editar cargo" data-permission="gestionar_cargos">
            <i class="fa-solid fa-pen"></i>
          </button>
        </td>
      `;

      row.querySelector('.btn-icon')?.addEventListener('click', () => openModal(cargo.id_cargo));
      el.cargosBody.appendChild(row);
    });
  }

  function renderAuxiliaryPermissions(selectedSet) {
    const list = getAuxiliaryOperationalPermissions();
    if (!el.permisosGestion) return;

    if (list.length === 0) {
      el.permisosGestion.innerHTML = '<p style="margin:0;color:#6b7280;font-size:13px;">No hay permisos operativos adicionales configurados.</p>';
      return;
    }

    el.permisosGestion.innerHTML = '';
    list.forEach((permiso) => {
      const id = `cargo-perm-${permiso.id_permiso}`;
      const checked = selectedSet.has(Number(permiso.id_permiso)) ? 'checked' : '';
      const item = document.createElement('label');
      item.className = 'perm-item';
      item.setAttribute('for', id);
      item.innerHTML = `
        <input id="${id}" type="checkbox" name="cargo_permiso_aux" value="${permiso.id_permiso}" ${checked}>
        <span>
          <strong>${humanizeKey(permiso.clave_permiso)}</strong>
          <small>${permiso.descripcion || humanizeKey(permiso.clave_permiso)}</small>
        </span>
      `;
      el.permisosGestion.appendChild(item);
    });
  }

  function renderSectionMatrix(selectedSet) {
    if (!el.permisosOperacion) return;
    el.permisosOperacion.innerHTML = '';

    SECTION_KEYS.forEach((section) => {
      const wrap = document.createElement('div');
      wrap.className = 'perm-item';
      wrap.style.display = 'block';

      const title = document.createElement('div');
      title.innerHTML = `<strong>${section.label}</strong><small style="display:block; margin-top:4px; color:#6b7280;">Define si la sección queda oculta, en solo lectura o con escritura.</small>`;
      wrap.appendChild(title);

      const radios = document.createElement('div');
      radios.style.display = 'flex';
      radios.style.gap = '12px';
      radios.style.marginTop = '10px';
      radios.style.flexWrap = 'wrap';

      const selectedLevel = ACCESS_LEVELS.find((level) => {
        const permissionKey = getSectionPermissionKey(section.key, level.key);
        if (!permissionKey) return false;
        const permiso = state.permisos.find((item) => item.clave_permiso === permissionKey);
        return permiso ? selectedSet.has(Number(permiso.id_permiso)) : false;
      })?.key || 'none';

      ACCESS_LEVELS.forEach((level) => {
        const radioId = `section-${section.key}-${level.key}`;
        const checked = selectedLevel === level.key ? 'checked' : '';
        const option = document.createElement('label');
        option.style.display = 'inline-flex';
        option.style.alignItems = 'center';
        option.style.gap = '6px';
        option.innerHTML = `
          <input type="radio" id="${radioId}" name="section_${section.key}" value="${level.key}" ${checked}>
          <span>${level.label}</span>
        `;
        radios.appendChild(option);
      });

      wrap.appendChild(radios);
      el.permisosOperacion.appendChild(wrap);
    });
  }

  function renderModal(cargo) {
    const selectedSet = new Set((cargo?.id_permisos || []).map(Number));
    el.cargoNombre.value = cargo?.nombre_cargo || '';
    renderAuxiliaryPermissions(selectedSet);
    renderSectionMatrix(selectedSet);
  }

  function openModal(cargoId = null) {
    state.editingCargoId = cargoId;
    clearNotification();
    const cargo = cargoId ? state.cargos.find((item) => Number(item.id_cargo) === Number(cargoId)) : null;
    el.modalTitle.textContent = cargo ? 'Editar cargo' : 'Nuevo cargo';
    renderModal(cargo || null);
    el.modal.classList.add('show');
    el.modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    state.editingCargoId = null;
    el.cargoNombre.value = '';
    if (el.permisosGestion) el.permisosGestion.innerHTML = '';
    if (el.permisosOperacion) el.permisosOperacion.innerHTML = '';
    clearNotification();
    el.modal.classList.remove('show');
    el.modal.setAttribute('aria-hidden', 'true');
  }

  function collectSelectedPermissionIds() {
    const ids = new Set(
      Array.from(document.querySelectorAll('input[name="cargo_permiso_aux"]:checked'))
        .map((node) => parseInt(node.value, 10))
        .filter(Number.isInteger)
    );

    SECTION_KEYS.forEach((section) => {
      const selected = document.querySelector(`input[name="section_${section.key}"]:checked`);
      const level = selected?.value || 'none';
      const permissionKey = getSectionPermissionKey(section.key, level);
      if (!permissionKey) return;

      const permiso = state.permisos.find((item) => item.clave_permiso === permissionKey);
      if (permiso) ids.add(Number(permiso.id_permiso));
    });

    return Array.from(ids);
  }

  async function saveCargo() {
    const nombre = String(el.cargoNombre.value || '').trim();
    if (!nombre) {
      notify('No se puede guardar un cargo sin nombre', 'error');
      return;
    }

    const payload = {
      nombre_cargo: nombre,
      id_permisos: collectSelectedPermissionIds(),
      ...(state.editingCargoId ? { id_cargo: state.editingCargoId } : {})
    };

    try {
      el.saveModal.disabled = true;
      el.saveModal.textContent = 'Guardando...';

      const res = await fetch('/api/cargos', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.error || `Error HTTP ${res.status}`);
      }

      notify('Cargo guardado exitosamente', 'success');
      closeModal();
      await loadCargos();
    } catch (error) {
      notify(error.message || 'No se pudo guardar el cargo', 'error');
    } finally {
      el.saveModal.disabled = false;
      el.saveModal.textContent = 'Guardar Cargo';
    }
  }

  function verificarAcceso() {
    const isSuperAdmin = localStorage.getItem('user_super_admin') === '1';
    if (!isSuperAdmin) {
      notify('Solo Super Administradores pueden gestionar cargos', 'error');
      setTimeout(() => {
        window.location.href = '/gestionar.html';
      }, 1200);
      return false;
    }
    return true;
  }

  async function init() {
    if (!verificarAcceso()) return;

    try {
      await loadPermisos();
      await loadCargos();
    } catch (error) {
      notify(error.message || 'Error inicializando la vista', 'error');
    }

    el.btnNuevoCargo?.addEventListener('click', () => openModal());
    el.closeModal?.addEventListener('click', closeModal);
    el.cancelModal?.addEventListener('click', closeModal);
    el.saveModal?.addEventListener('click', saveCargo);
    el.modal?.addEventListener('click', (ev) => {
      if (ev.target === el.modal) closeModal();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
