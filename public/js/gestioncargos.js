(function() {
  'use strict';

  const SECTION_KEYS = [
    { key: 'antecedentes', label: 'Antecedentes', r: 22, w: 12 },
    { key: 'operacion', label: 'Operación', r: 23, w: 13 },
    { key: 'materiales', label: 'Materiales', r: 24, w: 14 },
    { key: 'actividades', label: 'Actividades', r: 26, w: 27 },
    { key: 'cierre', label: 'Cierre', r: 25, w: 15 }
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

  function openManagedModal(modalElement) {
    if (window.basaltoModal?.open) {
      window.basaltoModal.open(modalElement);
      return;
    }

    modalElement?.classList.add('show');
    modalElement?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overflow-hidden', 'modal-open');
  }

  function closeManagedModal(modalElement) {
    if (window.basaltoModal?.close) {
      window.basaltoModal.close(modalElement);
      return;
    }

    modalElement?.classList.remove('show');
    modalElement?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overflow-hidden', 'modal-open');
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
        ? permisos.map((permiso) => {
            const isKpi = Number(permiso.id_permiso) === 21 || permiso.clave_permiso === 'admin_v_kpis';
            if (isKpi) {
              return `<span class="chip operacion" style="font-weight: 800; background: #dcfce7; color: #15803d;">Admin V Kpis</span>`;
            }
            return `<span class="chip gestion">${humanizeKey(permiso.clave_permiso || permiso.nombre_permiso)}</span>`;
          }).join('')
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

  function renderSectionMatrix(selectedSet) {
    if (!el.permisosOperacion) return;
    el.permisosOperacion.innerHTML = '';

    SECTION_KEYS.forEach((section) => {
      const wrap = document.createElement('div');
      wrap.className = 'section-permission-card';

      const title = document.createElement('div');
      title.className = 'section-permission-header';
      title.innerHTML = `<strong>${section.label}</strong><small>Define si la sección queda oculta, en solo lectura o con escritura.</small>`;
      wrap.appendChild(title);

      const radios = document.createElement('div');
      radios.className = 'section-permission-options';

      let selectedLevel = 'none';
      if (selectedSet.has(section.w)) {
        selectedLevel = 'w';
      } else if (selectedSet.has(section.r)) {
        selectedLevel = 'r';
      }

      ACCESS_LEVELS.forEach((level) => {
        const radioId = `section-${section.key}-${level.key}`;
        const checked = selectedLevel === level.key ? 'checked' : '';
        const option = document.createElement('label');
        option.className = 'section-permission-option';
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
    renderSectionMatrix(selectedSet);
    
    const kpiPermiso = state.permisos.find(p => p.clave_permiso === 'admin_v_kpis' || Number(p.id_permiso) === 21);
    const checkKpis = document.getElementById('checkAdminKpis');
    if (checkKpis) {
      const kpiId = kpiPermiso ? Number(kpiPermiso.id_permiso) : 21;
      checkKpis.value = kpiId;
      checkKpis.checked = selectedSet.has(21) || selectedSet.has(kpiId);
    }

    const checkResponsable = document.getElementById('chk-responsable-turno');
    const responsableActivo = Boolean(cargo?.permisos?.some((permiso) => permiso.clave_permiso === 'responsable_turno'));
    if (checkResponsable) {
      checkResponsable.checked = responsableActivo;
    }

    console.log('[MODAL_CARGOS] Cargando permisos para:', cargo?.nombre_cargo || 'Nuevo cargo', '| Responsable:', responsableActivo);
  }

  function openModal(cargoId = null) {
    state.editingCargoId = cargoId;
    clearNotification();
    const cargo = cargoId ? state.cargos.find((item) => Number(item.id_cargo) === Number(cargoId)) : null;
    el.modalTitle.textContent = cargo ? 'Editar cargo' : 'Nuevo cargo';
    renderModal(cargo || null);
    openManagedModal(el.modal);
  }

  function closeModal() {
    state.editingCargoId = null;
    el.cargoNombre.value = '';
    if (el.permisosOperacion) el.permisosOperacion.innerHTML = '';
    const checkKpis = document.getElementById('checkAdminKpis');
    const checkResponsable = document.getElementById('chk-responsable-turno');
    if (checkKpis) checkKpis.checked = false;
    if (checkResponsable) checkResponsable.checked = false;
    clearNotification();
    closeManagedModal(el.modal);
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
      
      if (level === 'r') ids.add(section.r);
      if (level === 'w') ids.add(section.w);
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
      responsable_turno: Boolean(document.getElementById('chk-responsable-turno')?.checked),
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

      closeModal();
      await loadCargos();
      notify('Cargo guardado exitosamente', 'success');
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
