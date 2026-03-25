(function() {
  'use strict';

  const state = {
    cities: [],
    editingCity: null,
    deletingCity: null,
    deleteForce: false
  };

  const el = {
    btnViewCargos: document.getElementById('btnViewCargos'),
    btnViewCiudades: document.getElementById('btnViewCiudades'),
    btnAgregarCiudad: document.getElementById('btnAgregarCiudad'),
    cityCountBadge: document.getElementById('cityCountBadge'),
    citySummary: document.getElementById('citySummary'),
    citiesTableBody: document.getElementById('citiesTableBody'),
    addCityModal: document.getElementById('addCityModal'),
    addCityInput: document.getElementById('addCityInput'),
    cancelAddCity: document.getElementById('cancelAddCity'),
    confirmAddCity: document.getElementById('confirmAddCity'),
    editCityModal: document.getElementById('editCityModal'),
    editCityInput: document.getElementById('editCityInput'),
    cancelEditCity: document.getElementById('cancelEditCity'),
    saveEditCity: document.getElementById('saveEditCity'),
    deleteCityModal: document.getElementById('deleteCityModal'),
    deleteCityText: document.getElementById('deleteCityText'),
    deleteCityAlert: document.getElementById('deleteCityAlert'),
    cancelDeleteCity: document.getElementById('cancelDeleteCity'),
    confirmDeleteCity: document.getElementById('confirmDeleteCity')
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

  function setSummary() {
    const totalCities = state.cities.length;
    const totalWorkers = state.cities.reduce((acc, city) => acc + Number(city.total_trabajadores || 0), 0);
    if (el.cityCountBadge) {
      el.cityCountBadge.innerHTML = '<i class="fa-solid fa-city"></i><span>' + totalCities + ' ciudad' + (totalCities !== 1 ? 'es' : '') + '</span>';
    }
    if (el.citySummary) {
      el.citySummary.textContent = totalWorkers + ' trabajador' + (totalWorkers !== 1 ? 'es' : '') + ' distribuidos en el catálogo actual.';
    }
  }

  function renderTable() {
    if (!el.citiesTableBody) return;

    if (!state.cities.length) {
      el.citiesTableBody.innerHTML = '<tr><td colspan="3" class="empty-state">No hay ciudades registradas.</td></tr>';
      setSummary();
      return;
    }

    const allowEdit = canEditCities();
    const allowDelete = canDeleteCities();

    el.citiesTableBody.innerHTML = state.cities.map((city) => {
      const isSinCiudad = String(city.nombre_ciudad || '').trim().toLowerCase() === 'sin ciudad';
      const ciudadLabel = titleCase(city.nombre_ciudad);
      const totalTrabajadores = Number(city.total_trabajadores || 0);
      const deleteDisabled = isSinCiudad || !allowDelete;
      const editDisabled = isSinCiudad || !allowEdit;
      const cityMeta = isSinCiudad
        ? 'Ciudad de resguardo para trabajadores sin asignación.'
        : 'Se usa en gestión de personal y formularios relacionados.';

      return `
        <tr>
          <td>
            <span class="city-name">${escapeHtml(ciudadLabel)}</span>
            <span class="city-meta">${escapeHtml(cityMeta)}</span>
          </td>
          <td>
            <span class="worker-badge">
              <i class="fa-solid fa-users"></i>
              ${totalTrabajadores} trabajador${totalTrabajadores !== 1 ? 'es' : ''}
            </span>
          </td>
          <td>
            <div class="actions">
              <button class="btn-action btn-edit" data-action="edit" data-id="${city.id_ciudad}" ${editDisabled ? 'disabled' : ''}>Editar</button>
              <button class="btn-action btn-delete" data-action="delete" data-id="${city.id_ciudad}" ${deleteDisabled ? 'disabled' : ''}>Borrar</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    el.citiesTableBody.querySelectorAll('[data-action="edit"]').forEach((button) => {
      button.addEventListener('click', () => openEditModal(Number(button.dataset.id)));
    });

    el.citiesTableBody.querySelectorAll('[data-action="delete"]').forEach((button) => {
      button.addEventListener('click', () => openDeleteModal(Number(button.dataset.id)));
    });

    setSummary();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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
      if (el.citySummary) {
        el.citySummary.textContent = 'No fue posible obtener la información de ciudades.';
      }
    }
  }

  function openAddModal() {
    if (el.addCityInput) {
      el.addCityInput.value = '';
      setTimeout(() => el.addCityInput.focus(), 40);
    }
    openModal(el.addCityModal);
  }

  async function saveNewCity() {
    const nombre = String(el.addCityInput?.value || '').trim();
    if (!nombre) {
      alert('Debes ingresar un nombre de ciudad.');
      return;
    }
    try {
      const response = await fetch('/api/ciudades', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ nombre_ciudad: nombre })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) {
          alert('Esta ciudad ya existe.');
        } else {
          alert(data.error || 'Error al crear la ciudad.');
        }
        return;
      }
      closeModal(el.addCityModal);
      await loadCities();
    } catch (error) {
      console.error('[CIUDADES_VIEW] Error creando ciudad:', error);
      alert(error.message || 'No fue posible crear la ciudad.');
    }
  }

  function openEditModal(cityId) {
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
    if (!nombreCiudad) {
      alert('Debes ingresar un nombre de ciudad.');
      return;
    }

    try {
      const response = await fetch('/api/ciudades/' + state.editingCity.id_ciudad, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ nombre_ciudad: nombreCiudad })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No fue posible actualizar la ciudad');
      }
      closeModal(el.editCityModal);
      state.editingCity = null;
      await loadCities();
      alert('Ciudad actualizada correctamente.');
    } catch (error) {
      console.error('[CIUDADES_VIEW] Error actualizando ciudad:', error);
      alert(error.message || 'No fue posible actualizar la ciudad.');
    }
  }

  function openDeleteModal(cityId) {
    state.deletingCity = state.cities.find((city) => Number(city.id_ciudad) === Number(cityId)) || null;
    state.deleteForce = false;
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
        ? titleCase(state.deletingCity.nombre_ciudad) + ' tiene ' + totalTrabajadores + ' trabajador' + (totalTrabajadores !== 1 ? 'es' : '') + ' asignado' + (totalTrabajadores !== 1 ? 's' : '') + '. Confirma si quieres reasignarlos a Sin ciudad y borrar la ciudad.'
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
            el.deleteCityAlert.textContent = titleCase(state.deletingCity.nombre_ciudad) + ' tiene ' + data.total_trabajadores + ' trabajador' + (data.total_trabajadores !== 1 ? 'es' : '') + ' asignado' + (data.totalTrabajadores !== 1 ? 's' : '') + '. Vuelve a confirmar para reasignarlos a ' + titleCase(data.fallback_city || 'Sin ciudad') + ' y eliminar la ciudad.';
          }
          if (el.deleteCityText) {
            el.deleteCityText.textContent = 'La eliminación requiere confirmación adicional porque afectará trabajadores existentes.';
          }
          const retryResponse = await fetch('/api/ciudades/' + state.deletingCity.id_ciudad + '?force=true', {
            method: 'DELETE',
            headers: getHeaders()
          });
          const retryData = await retryResponse.json().catch(() => ({}));
          if (!retryResponse.ok) {
            throw new Error(retryData.error || 'No fue posible eliminar la ciudad');
          }
          closeModal(el.deleteCityModal);
          state.deletingCity = null;
          await loadCities();
          alert('Ciudad eliminada. Los trabajadores afectados fueron reasignados a ' + titleCase(retryData.fallback_city || 'Sin ciudad') + '.');
          return;
        }

        throw new Error(data.error || 'No fue posible eliminar la ciudad');
      }

      closeModal(el.deleteCityModal);
      state.deletingCity = null;
      await loadCities();
      if (Number(data.reassigned_workers || 0) > 0) {
        alert('Ciudad eliminada. ' + data.reassigned_workers + ' trabajador' + (data.reassigned_workers !== 1 ? 'es fueron' : ' fue') + ' reasignado' + (data.reassigned_workers !== 1 ? 's' : '') + ' a ' + titleCase(data.fallback_city || 'Sin ciudad') + '.');
      } else {
        alert('Ciudad eliminada correctamente.');
      }
    } catch (error) {
      console.error('[CIUDADES_VIEW] Error eliminando ciudad:', error);
      alert(error.message || 'No fue posible eliminar la ciudad.');
    }
  }

  function bindEvents() {
    el.btnViewCargos?.addEventListener('click', () => {
      window.location.href = '/gestioncargos.html';
    });

    el.btnAgregarCiudad?.addEventListener('click', openAddModal);

    el.cancelAddCity?.addEventListener('click', () => closeModal(el.addCityModal));
    el.confirmAddCity?.addEventListener('click', saveNewCity);
    el.addCityModal?.addEventListener('click', (event) => {
      if (event.target === el.addCityModal) closeModal(el.addCityModal);
    });
    el.addCityInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); saveNewCity(); }
    });

    el.cancelEditCity?.addEventListener('click', () => {
      closeModal(el.editCityModal);
      state.editingCity = null;
    });

    el.saveEditCity?.addEventListener('click', saveCityEdit);
    el.editCityModal?.addEventListener('click', (event) => {
      if (event.target === el.editCityModal) {
        closeModal(el.editCityModal);
        state.editingCity = null;
      }
    });

    el.cancelDeleteCity?.addEventListener('click', () => {
      closeModal(el.deleteCityModal);
      state.deletingCity = null;
      state.deleteForce = false;
    });

    el.confirmDeleteCity?.addEventListener('click', confirmDeleteCity);
    el.deleteCityModal?.addEventListener('click', (event) => {
      if (event.target === el.deleteCityModal) {
        closeModal(el.deleteCityModal);
        state.deletingCity = null;
        state.deleteForce = false;
      }
    });

    el.editCityInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveCityEdit();
      }
    });
  }

  bindEvents();
  loadCities();
})();
