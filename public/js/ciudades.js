(function() {
  'use strict';

  const state = {
    cities: [],
    trabajadores: [],
    editingCity: null,
    deletingCity: null,
    deleteForce: false
  };

  const el = {
    btnViewCargos:     document.getElementById('btnViewCargos'),
    btnViewCiudades:   document.getElementById('btnViewCiudades'),
    btnAgregarCiudad:  document.getElementById('btnAgregarCiudad'),
    cityCount:         document.getElementById('cityCount'),
    citiesTableBody:   document.getElementById('citiesTableBody'),
    // Agregar modal
    addCityModal:      document.getElementById('addCityModal'),
    addCityInput:      document.getElementById('addCityInput'),
    cancelAddCity:     document.getElementById('cancelAddCity'),
    cancelAddCity2:    document.getElementById('cancelAddCity2'),
    confirmAddCity:    document.getElementById('confirmAddCity'),
    // Editar modal
    editCityModal:     document.getElementById('editCityModal'),
    editCityInput:     document.getElementById('editCityInput'),
    cancelEditCity:    document.getElementById('cancelEditCity'),
    cancelEditCity2:   document.getElementById('cancelEditCity2'),
    saveEditCity:      document.getElementById('saveEditCity'),
    // Eliminar modal
    deleteCityModal:   document.getElementById('deleteCityModal'),
    deleteCityText:    document.getElementById('deleteCityText'),
    deleteCityAlert:   document.getElementById('deleteCityAlert'),
    cancelDeleteCity:  document.getElementById('cancelDeleteCity'),
    cancelDeleteCity2: document.getElementById('cancelDeleteCity2'),
    confirmDeleteCity: document.getElementById('confirmDeleteCity'),
    // Workers modal
    workersModal:      document.getElementById('workersModal'),
    workersModalTitle: document.getElementById('workersModalTitle'),
    workersModalBody:  document.getElementById('workersModalBody'),
    closeWorkersModal: document.getElementById('closeWorkersModal')
  };

  function sanitizeRut(rut) {
    return String(rut || '').replace(/[.\-\s]/g, '').trim().toUpperCase();
  }

  function titleCase(value) {
    return String(value || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getHeaders() {
    const rut = sanitizeRut(localStorage.getItem('user_rut'));
    return {
      'Content-Type': 'application/json',
      ...(rut ? { rut_solicitante: rut } : {})
    };
  }

  function isSuperAdmin() {
    return localStorage.getItem('user_super_admin') === '1';
  }

  function canDeleteCities() {
    return isSuperAdmin() || (typeof window.hasAdminPermission === 'function' && window.hasAdminPermission('gestionar_cargos'));
  }

  function canEditCities() {
    return typeof window.hasAdminPermission === 'function'
      ? window.hasAdminPermission('gestionar_cargos')
      : true;
  }

  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  // ── Workers modal ──────────────────────────────────────────────────────────

  function openWorkersModal(cityId) {
    const city = state.cities.find((c) => Number(c.id_ciudad) === Number(cityId));
    if (!city) return;

    const ciudadLabel = titleCase(city.nombre_ciudad);
    const workers = state.trabajadores.filter((t) => Number(t.id_ciudad) === Number(cityId));

    if (el.workersModalTitle) {
      el.workersModalTitle.innerHTML =
        `<i class="fa-solid fa-users" style="margin-right:6px;"></i>${escapeHtml(ciudadLabel)} — ${workers.length} trabajador${workers.length !== 1 ? 'es' : ''}`;
    }

    if (el.workersModalBody) {
      if (!workers.length) {
        el.workersModalBody.innerHTML = '<p style="padding:20px;color:#6b7280;text-align:center;">Sin trabajadores asignados.</p>';
      } else {
        const rows = workers.map((w) => {
          const nombre = escapeHtml(`${titleCase(w.nombres || '')} ${titleCase(w.apellido_paterno || '')} ${titleCase(w.apellido_materno || '')}`.trim());
          const cargo  = escapeHtml(w.cargo || w.nombre_cargo || '—');
          const grupo  = escapeHtml(w.nombre_grupo || w.grupo || '—');
          const rut    = escapeHtml(w.RUT || w.rut || '');
          return `<tr>
            <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;">
              <strong>${nombre}</strong><br>
              <span style="color:#6b7280;font-size:12px;">${rut}</span>
            </td>
            <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:13px;">${cargo}</td>
            <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">${grupo}</td>
          </tr>`;
        }).join('');
        el.workersModalBody.innerHTML = `
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:10px 16px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e5e7eb;">Trabajador</th>
                <th style="padding:10px 16px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e5e7eb;">Cargo</th>
                <th style="padding:10px 16px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e5e7eb;">Grupo</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`;
      }
    }

    openModal(el.workersModal);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function renderTable() {
    if (!el.citiesTableBody) return;

    if (!state.cities.length) {
      el.citiesTableBody.innerHTML = '<tr><td colspan="3" class="empty-state">No hay ciudades registradas.</td></tr>';
      if (el.cityCount) el.cityCount.textContent = '0 ciudades';
      return;
    }

    const allowEdit   = canEditCities();
    const allowDelete = canDeleteCities();

    if (el.cityCount) {
      const n = state.cities.length;
      el.cityCount.textContent = `${n} ciudad${n !== 1 ? 'es' : ''}`;
    }

    el.citiesTableBody.innerHTML = state.cities.map((city) => {
      const isSinCiudad       = String(city.nombre_ciudad || '').trim().toLowerCase() === 'sin ciudad';
      const ciudadLabel       = titleCase(city.nombre_ciudad);
      const totalTrabajadores = Number(city.total_trabajadores || 0);
      const deleteDisabled    = isSinCiudad || !allowDelete;
      const editDisabled      = isSinCiudad || !allowEdit;

      return `
        <tr>
          <td>
            <span class="city-name">${escapeHtml(ciudadLabel)}</span>
          </td>
          <td>
            <button class="worker-badge-btn" data-action="workers" data-id="${city.id_ciudad}" title="Ver trabajadores de ${escapeHtml(ciudadLabel)}" style="border:none;background:none;padding:0;cursor:pointer;">
              <span class="worker-badge">
                <i class="fa-solid fa-users"></i>
                ${totalTrabajadores} trabajador${totalTrabajadores !== 1 ? 'es' : ''}
              </span>
            </button>
          </td>
          <td>
            <div class="actions">
              <button class="btn-action btn-edit"   data-action="edit"   data-id="${city.id_ciudad}" ${editDisabled   ? 'disabled' : ''}>Editar</button>
              <button class="btn-action btn-delete" data-action="delete" data-id="${city.id_ciudad}" ${deleteDisabled ? 'disabled' : ''}>Borrar</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    el.citiesTableBody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => openEditModal(Number(btn.dataset.id)));
    });
    el.citiesTableBody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', () => openDeleteModal(Number(btn.dataset.id)));
    });
    el.citiesTableBody.querySelectorAll('[data-action="workers"]').forEach((btn) => {
      btn.addEventListener('click', () => openWorkersModal(Number(btn.dataset.id)));
    });
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  async function loadCities() {
    try {
      const response = await fetch('/api/ciudades?detalle=true');
      if (!response.ok) throw new Error('No se pudo cargar la lista de ciudades');
      state.cities = await response.json();
      renderTable();
    } catch (error) {
      console.error('[CIUDADES_VIEW] Error cargando ciudades:', error);
      if (el.citiesTableBody) {
        el.citiesTableBody.innerHTML = '<tr><td colspan="3" class="error-state">Error al cargar las ciudades.</td></tr>';
      }
    }
  }

  async function loadTrabajadores() {
    try {
      const res = await fetch('/api/trabajadores', { headers: getHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      state.trabajadores = data.trabajadores || (Array.isArray(data) ? data : []);
    } catch (e) {
      state.trabajadores = [];
    }
  }

  // ── Modales CRUD ───────────────────────────────────────────────────────────

  function openAddModal() {
    if (el.addCityInput) {
      el.addCityInput.value = '';
      setTimeout(() => el.addCityInput.focus(), 40);
    }
    openModal(el.addCityModal);
  }

  async function saveNewCity() {
    const nombre = String(el.addCityInput?.value || '').trim();
    if (!nombre) { alert('Debes ingresar un nombre de ciudad.'); return; }
    try {
      const response = await fetch('/api/ciudades', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ nombre_ciudad: nombre })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(response.status === 409 ? 'Esta ciudad ya existe.' : (data.error || 'Error al crear la ciudad.'));
        return;
      }
      closeModal(el.addCityModal);
      await Promise.all([loadCities(), loadTrabajadores()]);
    } catch (error) {
      alert(error.message || 'No fue posible crear la ciudad.');
    }
  }

  function openEditModal(cityId) {
    state.editingCity = state.cities.find((city) => Number(city.id_ciudad) === Number(cityId)) || null;
    if (!state.editingCity) return;
    if (el.editCityInput) {
      el.editCityInput.value = titleCase(state.editingCity.nombre_ciudad || '');
      setTimeout(() => el.editCityInput.focus(), 40);
    }
    openModal(el.editCityModal);
  }

  async function saveCityEdit() {
    if (!state.editingCity) return;
    const nombreCiudad = String(el.editCityInput?.value || '').trim();
    if (!nombreCiudad) { alert('Debes ingresar un nombre de ciudad.'); return; }
    try {
      const response = await fetch('/api/ciudades/' + state.editingCity.id_ciudad, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ nombre_ciudad: nombreCiudad })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No fue posible actualizar la ciudad');
      closeModal(el.editCityModal);
      state.editingCity = null;
      await loadCities();
    } catch (error) {
      alert(error.message || 'No fue posible actualizar la ciudad.');
    }
  }

  function openDeleteModal(cityId) {
    state.deletingCity = state.cities.find((city) => Number(city.id_ciudad) === Number(cityId)) || null;
    state.deleteForce  = false;
    if (!state.deletingCity) return;

    const totalTrabajadores = Number(state.deletingCity.total_trabajadores || 0);
    if (el.deleteCityText) {
      el.deleteCityText.textContent = totalTrabajadores > 0
        ? 'Esta ciudad tiene trabajadores asignados. Si confirmas, esos trabajadores pasarán automáticamente a Sin ciudad.'
        : 'Esta acción eliminará definitivamente la ciudad del catálogo.';
    }
    if (el.deleteCityAlert) {
      el.deleteCityAlert.classList.toggle('show', totalTrabajadores > 0);
      el.deleteCityAlert.textContent = totalTrabajadores > 0
        ? `${titleCase(state.deletingCity.nombre_ciudad)} tiene ${totalTrabajadores} trabajador${totalTrabajadores !== 1 ? 'es' : ''} asignado${totalTrabajadores !== 1 ? 's' : ''}. Confirma si quieres reasignarlos a Sin ciudad y borrar la ciudad.`
        : '';
    }
    openModal(el.deleteCityModal);
  }

  async function confirmDeleteCity() {
    if (!state.deletingCity) return;
    try {
      const totalTrabajadores = Number(state.deletingCity.total_trabajadores || 0);
      const response = await fetch('/api/ciudades/' + state.deletingCity.id_ciudad + (totalTrabajadores > 0 ? '?force=true' : ''), {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409 && data.requires_confirmation) {
          state.deleteForce = true;
          if (el.deleteCityAlert) {
            el.deleteCityAlert.classList.add('show');
            el.deleteCityAlert.textContent = `${titleCase(state.deletingCity.nombre_ciudad)} tiene ${data.total_trabajadores} trabajador${data.total_trabajadores !== 1 ? 'es' : ''} asignado${data.total_trabajadores !== 1 ? 's' : ''}. Vuelve a confirmar para reasignarlos a ${titleCase(data.fallback_city || 'Sin ciudad')} y eliminar la ciudad.`;
          }
          if (el.deleteCityText) {
            el.deleteCityText.textContent = 'La eliminación requiere confirmación adicional porque afectará trabajadores existentes.';
          }
          const retryResponse = await fetch('/api/ciudades/' + state.deletingCity.id_ciudad + '?force=true', {
            method: 'DELETE',
            headers: getHeaders()
          });
          const retryData = await retryResponse.json().catch(() => ({}));
          if (!retryResponse.ok) throw new Error(retryData.error || 'No fue posible eliminar la ciudad');
          closeModal(el.deleteCityModal);
          state.deletingCity = null;
          await Promise.all([loadCities(), loadTrabajadores()]);
          return;
        }
        throw new Error(data.error || 'No fue posible eliminar la ciudad');
      }

      closeModal(el.deleteCityModal);
      state.deletingCity = null;
      await Promise.all([loadCities(), loadTrabajadores()]);
    } catch (error) {
      alert(error.message || 'No fue posible eliminar la ciudad.');
    }
  }

  // ── Eventos ────────────────────────────────────────────────────────────────

  function bindEvents() {
    el.btnViewCargos?.addEventListener('click', () => { window.location.href = '/gestioncargos.html'; });
    el.btnAgregarCiudad?.addEventListener('click', openAddModal);

    // Agregar
    [el.cancelAddCity, el.cancelAddCity2].forEach((b) => b?.addEventListener('click', () => closeModal(el.addCityModal)));
    el.confirmAddCity?.addEventListener('click', saveNewCity);
    el.addCityModal?.addEventListener('click', (e) => { if (e.target === el.addCityModal) closeModal(el.addCityModal); });
    el.addCityInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveNewCity(); }});

    // Editar
    [el.cancelEditCity, el.cancelEditCity2].forEach((b) => b?.addEventListener('click', () => { closeModal(el.editCityModal); state.editingCity = null; }));
    el.saveEditCity?.addEventListener('click', saveCityEdit);
    el.editCityModal?.addEventListener('click', (e) => { if (e.target === el.editCityModal) { closeModal(el.editCityModal); state.editingCity = null; }});
    el.editCityInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveCityEdit(); }});

    // Eliminar
    [el.cancelDeleteCity, el.cancelDeleteCity2].forEach((b) => b?.addEventListener('click', () => { closeModal(el.deleteCityModal); state.deletingCity = null; state.deleteForce = false; }));
    el.confirmDeleteCity?.addEventListener('click', confirmDeleteCity);
    el.deleteCityModal?.addEventListener('click', (e) => { if (e.target === el.deleteCityModal) { closeModal(el.deleteCityModal); state.deletingCity = null; state.deleteForce = false; }});

    // Workers
    el.closeWorkersModal?.addEventListener('click', () => closeModal(el.workersModal));
    el.workersModal?.addEventListener('click', (e) => { if (e.target === el.workersModal) closeModal(el.workersModal); });
  }

  async function init() {
    bindEvents();
    await Promise.all([loadCities(), loadTrabajadores()]);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
