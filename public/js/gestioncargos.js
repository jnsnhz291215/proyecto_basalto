(function() {
  'use strict';

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
    }, 2500);
  }

  function sanitizeRut(rut) {
    return String(rut || '').replace(/[.\-\s]/g, '').trim().toUpperCase();
  }

  function classifyPermiso(permiso) {
    const txt = String(permiso?.nombre_permiso || '').toLowerCase();
    const gestion = ['admin', 'trabajador', 'viaje', 'informe', 'editar', 'borrar', 'eliminar', 'gestionar', 'cargo'];
    return gestion.some((w) => txt.includes(w)) ? 'gestion' : 'operacion';
  }

  function buildHeaders() {
    const rut = sanitizeRut(localStorage.getItem('user_rut'));
    return {
      'Content-Type': 'application/json',
      ...(rut ? { rut_solicitante: rut } : {})
    };
  }

  async function loadPermisos() {
    try {
      const res = await fetch('/api/permisos', { headers: buildHeaders() });
      const data = await res.json();
      if (res.ok && data?.success && Array.isArray(data.data)) {
        state.permisos = data.data;
        return;
      }
    } catch (_error) {}

    const fallback = [];
    state.cargos.forEach((cargo) => {
      (cargo.permisos || []).forEach((permiso) => {
        if (!fallback.some((p) => p.id_permiso === permiso.id_permiso)) {
          fallback.push({
            id_permiso: permiso.id_permiso,
            nombre_permiso: permiso.nombre_permiso,
            descripcion: permiso.descripcion || ''
          });
        }
      });
    });

    state.permisos = fallback;
  }

  async function loadCargos() {
    const res = await fetch('/api/cargos');
    const data = await res.json();
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
        ? permisos.map((p) => `<span class="chip ${classifyPermiso(p)}">${p.nombre_permiso}</span>`).join('')
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

      row.querySelector('.btn-icon')?.addEventListener('click', () => {
        openModal(cargo.id_cargo);
      });

      el.cargosBody.appendChild(row);
    });
  }

  function selectedPermisos() {
    return Array.from(document.querySelectorAll('input[name="cargo_permiso"]:checked'))
      .map((node) => parseInt(node.value, 10))
      .filter(Number.isInteger);
  }

  function renderPermisosCheckboxes(selected = []) {
    const selectedSet = new Set((selected || []).map((v) => Number(v)));
    const grouped = {
      gestion: state.permisos.filter((p) => classifyPermiso(p) === 'gestion'),
      operacion: state.permisos.filter((p) => classifyPermiso(p) !== 'gestion')
    };

    function renderGroup(container, list) {
      if (!container) return;
      container.innerHTML = '';

      list.forEach((permiso) => {
        const id = `permiso-${permiso.id_permiso}`;
        const checked = selectedSet.has(Number(permiso.id_permiso)) ? 'checked' : '';

        const item = document.createElement('label');
        item.className = 'perm-item';
        item.setAttribute('for', id);
        item.innerHTML = `
          <input id="${id}" type="checkbox" name="cargo_permiso" value="${permiso.id_permiso}" ${checked}>
          <span>
            <strong>${permiso.nombre_permiso}</strong>
            <small>${permiso.descripcion || 'Sin descripción'}</small>
          </span>
        `;
        container.appendChild(item);
      });
    }

    renderGroup(el.permisosGestion, grouped.gestion);
    renderGroup(el.permisosOperacion, grouped.operacion);
  }

  function openModal(cargoId = null) {
    state.editingCargoId = cargoId;
    const cargo = cargoId ? state.cargos.find((c) => Number(c.id_cargo) === Number(cargoId)) : null;

    el.modalTitle.textContent = cargo ? 'Editar cargo' : 'Nuevo cargo';
    el.cargoNombre.value = cargo?.nombre_cargo || '';
    renderPermisosCheckboxes((cargo?.id_permisos || []).map(Number));

    el.modal.classList.add('show');
    el.modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    state.editingCargoId = null;
    el.modal.classList.remove('show');
    el.modal.setAttribute('aria-hidden', 'true');
  }

  async function saveCargo() {
    const nombre = String(el.cargoNombre.value || '').trim();
    const id_permisos = selectedPermisos();

    if (!nombre) {
      notify('Debes ingresar el nombre del cargo', 'error');
      return;
    }

    const payload = {
      nombre_cargo: nombre,
      id_permisos,
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
      await loadPermisos();
    } catch (error) {
      notify(error.message || 'No se pudo guardar', 'error');
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
      }, 1000);
      return false;
    }
    return true;
  }

  async function init() {
    if (!verificarAcceso()) return;

    try {
      await loadCargos();
      await loadPermisos();
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
