(function() {
  'use strict';

  const CARGO_CACHE_BUST_KEY = 'basalto:cargos:updated_at';

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
    trabajadores: [],
    permisos: [],
    editingCargoId: null,
    deletingCargo: null
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
    notification: document.getElementById('notification'),
    btnViewCargos: document.getElementById('btnViewCargos'),
    btnViewCiudades: document.getElementById('btnViewCiudades'),
    deleteModal: document.getElementById('deleteCargoModal'),
    deleteModalClose: document.getElementById('closeDeleteCargoModal'),
    deleteModalCancel: document.getElementById('cancelDeleteCargoModal'),
    deleteModalConfirm: document.getElementById('confirmDeleteCargoModal'),
    deleteCargoText: document.getElementById('deleteCargoText'),
    deleteCargoAlert: document.getElementById('deleteCargoAlert'),
    cargoWorkersModal: document.getElementById('cargoWorkersModal'),
    cargoWorkersModalTitle: document.getElementById('cargoWorkersModalTitle'),
    cargoWorkersModalBody: document.getElementById('cargoWorkersModalBody'),
    closeCargoWorkersModal: document.getElementById('closeCargoWorkersModal')
  };

  function setupViewSwitcher() {
    el.btnViewCargos?.addEventListener('click', () => {
      el.btnViewCargos.classList.add('active');
      el.btnViewCargos.setAttribute('aria-selected', 'true');
      el.btnViewCiudades?.classList.remove('active');
      el.btnViewCiudades?.setAttribute('aria-selected', 'false');
    });

    el.btnViewCiudades?.addEventListener('click', () => {
      window.location.href = '/ciudades.html';
    });
  }

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

  const PERM_MAP = {
    inf_sec_actividades_w:      { label: 'Actividades',  suffix: 'Escritura', type: 'sec-w',  icon: 'fa-pen' },
    inf_sec_antecedentes_w:     { label: 'Antecedentes', suffix: 'Escritura', type: 'sec-w',  icon: 'fa-pen' },
    inf_sec_cierre_w:           { label: 'Cierre',       suffix: 'Escritura', type: 'sec-w',  icon: 'fa-pen' },
    inf_sec_materiales_w:       { label: 'Materiales',   suffix: 'Escritura', type: 'sec-w',  icon: 'fa-pen' },
    inf_sec_operacion_w:        { label: 'Operación',    suffix: 'Escritura', type: 'sec-w',  icon: 'fa-pen' },
    inf_sec_actividades_r:      { label: 'Actividades',  suffix: 'Lectura',   type: 'sec-r',  icon: 'fa-eye' },
    inf_sec_antecedentes_r:     { label: 'Antecedentes', suffix: 'Lectura',   type: 'sec-r',  icon: 'fa-eye' },
    inf_sec_cierre_r:           { label: 'Cierre',       suffix: 'Lectura',   type: 'sec-r',  icon: 'fa-eye' },
    inf_sec_materiales_r:       { label: 'Materiales',   suffix: 'Lectura',   type: 'sec-r',  icon: 'fa-eye' },
    inf_sec_operacion_r:        { label: 'Operación',    suffix: 'Lectura',   type: 'sec-r',  icon: 'fa-eye' },
    admin_v_kpis:               { label: 'KPIs Admin',      type: 'kpi',    icon: 'fa-chart-bar' },
    responsable_turno:          { label: 'Resp. Turno',     type: 'role',   icon: 'fa-user-tie' },
    viajes_ver:                 { label: 'Viajes Ver',      type: 'viajes', icon: 'fa-bus' },
    viajes_editar:              { label: 'Viajes Editar',   type: 'viajes', icon: 'fa-bus' },
    viajes_soft_delete:         { label: 'Viajes Borrar',   type: 'viajes', icon: 'fa-bus' },
    gestionar_cargos:           { label: 'Gestión Cargos',  type: 'admin',  icon: 'fa-id-card' },
    admin_v_cargos:             { label: 'Ver Cargos',      type: 'admin',  icon: 'fa-id-card' },
    editar_informes_anteriores: { label: 'Inf. Anteriores', type: 'admin',  icon: 'fa-clock-rotate-left' },
    cerrar_turno:               { label: 'Cerrar Turno',    type: 'danger', icon: 'fa-lock' },
  };

  function chipHtml(permiso) {
    const clave = String(permiso.clave_permiso || '').toLowerCase().trim();
    const cfg = PERM_MAP[clave];
    if (cfg) {
      const suffixHtml = cfg.suffix ? ` <span style="opacity:.65;font-weight:500">${cfg.suffix}</span>` : '';
      return `<span class="chip chip--${cfg.type}"><i class="fa-solid ${cfg.icon}"></i> ${cfg.label}${suffixHtml}</span>`;
    }
    return `<span class="chip chip--default">${humanizeKey(clave)}</span>`;
  }

  function buildHeaders() {
    const rut = sanitizeRut(localStorage.getItem('user_rut'));
    return {
      'Content-Type': 'application/json',
      ...(rut ? { rut_solicitante: rut } : {})
    };
  }

  function invalidateCargoCatalogCache() {
    localStorage.setItem(CARGO_CACHE_BUST_KEY, String(Date.now()));
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

    if (modalElement) modalElement.inert = false;
    modalElement?.classList.add('show');
    modalElement?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overflow-hidden', 'modal-open');
  }

  function closeManagedModal(modalElement) {
    if (window.basaltoModal?.close) {
      window.basaltoModal.close(modalElement);
      return;
    }

    const activeElement = document.activeElement;
    if (modalElement && activeElement && modalElement.contains(activeElement)) {
      if (typeof activeElement.blur === 'function') activeElement.blur();
      if (document.body && typeof document.body.focus === 'function') {
        document.body.setAttribute('tabindex', '-1');
        document.body.focus({ preventScroll: true });
        document.body.removeAttribute('tabindex');
      }
    }

    modalElement?.classList.remove('show');
    modalElement?.setAttribute('aria-hidden', 'true');
    if (modalElement) modalElement.inert = true;
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

  async function loadTrabajadores() {
    try {
      const res = await fetch('/api/trabajadores', { headers: buildHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      state.trabajadores = data.trabajadores || (Array.isArray(data) ? data : []);
    } catch (e) {
      state.trabajadores = [];
    }
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
        ? permisos.map(chipHtml).join('')
        : '<span style="color:#6b7280;font-size:13px;">Sin permisos</span>';

      const workerCount = state.trabajadores.filter((t) => Number(t.id_cargo) === Number(cargo.id_cargo)).length;

      row.innerHTML = `
        <td><strong>${cargo.nombre_cargo}</strong></td>
        <td><div class="chips">${chips}</div></td>
        <td>
          <button class="worker-badge-btn" data-action="workers" data-id="${cargo.id_cargo}" title="Ver trabajadores con este cargo" style="border:none;background:none;padding:0;cursor:pointer;">
            <span class="worker-badge">
              <i class="fa-solid fa-users"></i>
              ${workerCount} trabajador${workerCount !== 1 ? 'es' : ''}
            </span>
          </button>
        </td>
        <td>
          <div class="actions">
            <button class="btn-action btn-edit"   data-action="edit"   data-id="${cargo.id_cargo}" data-permission="gestionar_cargos">Editar</button>
            <button class="btn-action btn-delete" data-action="delete" data-id="${cargo.id_cargo}" data-permission="gestionar_cargos">Borrar</button>
          </div>
        </td>
      `;

      row.querySelector('[data-action="edit"]')?.addEventListener('click', () => openModal(cargo.id_cargo));
      row.querySelector('[data-action="delete"]')?.addEventListener('click', () => openDeleteModal(cargo.id_cargo));
      row.querySelector('[data-action="workers"]')?.addEventListener('click', () => openCargoWorkersModal(cargo.id_cargo));
      el.cargosBody.appendChild(row);
    });
  }

  function openDeleteModal(cargoId) {
    state.deletingCargo = state.cargos.find((item) => Number(item.id_cargo) === Number(cargoId)) || null;
    if (!state.deletingCargo) return;

    if (el.deleteCargoText) {
      el.deleteCargoText.textContent = `Se eliminará el cargo ${state.deletingCargo.nombre_cargo} de forma definitiva.`;
    }

    if (el.deleteCargoAlert) {
      el.deleteCargoAlert.style.display = 'none';
      el.deleteCargoAlert.textContent = '';
    }

    openManagedModal(el.deleteModal);
  }

  function closeDeleteModal() {
    state.deletingCargo = null;
    if (el.deleteCargoAlert) {
      el.deleteCargoAlert.style.display = 'none';
      el.deleteCargoAlert.textContent = '';
    }
    closeManagedModal(el.deleteModal);
  }

  function openCargoWorkersModal(cargoId) {
    const cargo = state.cargos.find((c) => Number(c.id_cargo) === Number(cargoId));
    if (!cargo) return;

    const workers = state.trabajadores.filter((t) => Number(t.id_cargo) === Number(cargoId));

    if (el.cargoWorkersModalTitle) {
      el.cargoWorkersModalTitle.innerHTML =
        `<i class="fa-solid fa-users" style="margin-right:6px;"></i>${cargo.nombre_cargo} — ${workers.length} trabajador${workers.length !== 1 ? 'es' : ''}`;
    }

    if (el.cargoWorkersModalBody) {
      if (!workers.length) {
        el.cargoWorkersModalBody.innerHTML = '<p style="padding:20px;color:#6b7280;text-align:center;">Sin trabajadores asignados.</p>';
      } else {
        const escHtml = (v) => String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        const titleCase = (v) => String(v || '').trim().split(/\s+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        const rows = workers.map((w) => {
          const nombre = escHtml(`${titleCase(w.nombres || '')} ${titleCase(w.apellido_paterno || '')} ${titleCase(w.apellido_materno || '')}`.trim());
          const ciudad = escHtml(w.nombre_ciudad || w.ciudad || '—');
          const rut    = escHtml(w.RUT || w.rut || '');
          return `<tr>
            <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;">
              <strong>${nombre}</strong><br>
              <span style="color:#6b7280;font-size:12px;">${rut}</span>
            </td>
            <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">${ciudad}</td>
          </tr>`;
        }).join('');
        el.cargoWorkersModalBody.innerHTML = `
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:10px 16px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e5e7eb;">Trabajador</th>
                <th style="padding:10px 16px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e5e7eb;">Ciudad</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`;
      }
    }

    openManagedModal(el.cargoWorkersModal);
  }

  function closeCargoWorkersModal() {
    closeManagedModal(el.cargoWorkersModal);
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
      invalidateCargoCatalogCache();
      await loadCargos();
      notify('Cargo guardado exitosamente', 'success');
    } catch (error) {
      notify(error.message || 'No se pudo guardar el cargo', 'error');
    } finally {
      el.saveModal.disabled = false;
      el.saveModal.textContent = 'Guardar Cargo';
    }
  }

  async function deleteCargo() {
    if (!state.deletingCargo) return;

    try {
      const response = await fetch(`/api/cargos/${state.deletingCargo.id_cargo}`, {
        method: 'DELETE',
        headers: buildHeaders()
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409 && data.requires_confirmation) {
          if (el.deleteCargoText) {
            el.deleteCargoText.textContent = 'La eliminación afectará trabajadores que actualmente tienen este cargo asignado.';
          }
          if (el.deleteCargoAlert) {
            el.deleteCargoAlert.style.display = 'block';
            el.deleteCargoAlert.textContent = `${state.deletingCargo.nombre_cargo} tiene ${data.total_trabajadores} trabajador${data.total_trabajadores !== 1 ? 'es' : ''} asignado${data.total_trabajadores !== 1 ? 's' : ''}. Si confirmas de nuevo, esos trabajadores quedarán sin cargo asignado.`;
          }

          const retryResponse = await fetch(`/api/cargos/${state.deletingCargo.id_cargo}?force=true`, {
            method: 'DELETE',
            headers: buildHeaders()
          });
          const retryData = await retryResponse.json().catch(() => ({}));
          if (!retryResponse.ok) {
            throw new Error(retryData.message || retryData.error || 'No fue posible eliminar el cargo');
          }

          closeDeleteModal();
          invalidateCargoCatalogCache();
          await loadCargos();
          notify(`Cargo eliminado. ${retryData.affected_workers || 0} trabajador(es) quedaron sin cargo asignado.`, 'success');
          return;
        }

        throw new Error(data.message || data.error || 'No fue posible eliminar el cargo');
      }

      closeDeleteModal();
      invalidateCargoCatalogCache();
      await loadCargos();
      notify('Cargo eliminado exitosamente', 'success');
    } catch (error) {
      notify(error.message || 'No fue posible eliminar el cargo', 'error');
    }
  }

  function verificarAcceso() {
    const isSuperAdmin = localStorage.getItem('user_super_admin') === '1';
    const hasCargosViewPermission = typeof window.hasAdminPermission === 'function'
      ? window.hasAdminPermission('gestionar_cargos')
      : false;

    if (!isSuperAdmin && !hasCargosViewPermission) {
      notify('No tienes permisos para gestionar cargos', 'error');
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
      await Promise.all([loadPermisos(), loadTrabajadores()]);
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

    el.deleteModalClose?.addEventListener('click', closeDeleteModal);
    el.deleteModalCancel?.addEventListener('click', closeDeleteModal);
    el.deleteModalConfirm?.addEventListener('click', deleteCargo);
    el.deleteModal?.addEventListener('click', (ev) => {
      if (ev.target === el.deleteModal) closeDeleteModal();
    });

    el.closeCargoWorkersModal?.addEventListener('click', closeCargoWorkersModal);
    el.cargoWorkersModal?.addEventListener('click', (ev) => {
      if (ev.target === el.cargoWorkersModal) closeCargoWorkersModal();
    });

    setupViewSwitcher();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
