const InformeTurno = (() => {
  const state = {
    role: localStorage.getItem('user_role') || '',
    userRut: localStorage.getItem('user_rut') || '',
    userName: localStorage.getItem('user_name') || '',
    cargoName: localStorage.getItem('user_cargo_name') || '',
    permisosCargo: parseJSONArray('user_permissions_cargo'),
    permisosTotal: parseJSONArray('user_permissions_total'),
    locked: false,
    mode: 'default' // default | supervisor | operador_faena | operador_maquina
  };

  function parseJSONArray(key) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (_error) {
      return [];
    }
  }

  function normalizePerm(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function allPerms() {
    return new Set([...state.permisosCargo, ...state.permisosTotal].map(normalizePerm).filter(Boolean));
  }

  function hasPermission(alias) {
    if (typeof window.hasPermission === 'function') return window.hasPermission(alias);
    const perms = allPerms();
    if (perms.size === 0) return true;

    const target = normalizePerm(alias);
    return Array.from(perms).some((p) => p === target || p.includes(target) || target.includes(p));
  }

  function detectModeByCargo() {
    const cargo = String(state.cargoName || '').toLowerCase();
    if (cargo.includes('supervisor')) return 'supervisor';
    if (cargo.includes('operador') && (cargo.includes('maquina') || cargo.includes('máquina'))) return 'operador_maquina';
    if (cargo.includes('operador') && cargo.includes('faena')) return 'operador_faena';
    return 'default';
  }

  function lockKey() {
    const fecha = document.getElementById('input-fecha')?.value || 'sin_fecha';
    const turno = document.getElementById('input-turno')?.value || 'sin_turno';
    return `informe_lock_${state.userRut}_${fecha}_${turno}`;
  }

  function checkPersistedLock() {
    state.locked = localStorage.getItem(lockKey()) === '1';
  }

  function markLocked() {
    localStorage.setItem(lockKey(), '1');
    state.locked = true;
  }

  function setFormReadOnly(readOnly) {
    document.querySelectorAll('input, select, textarea, button').forEach((node) => {
      if (node.closest('.tabs-header') || node.closest('.action-bar') || node.classList.contains('btn-delete')) {
        return;
      }
      if (readOnly) node.setAttribute('disabled', 'disabled');
      else node.removeAttribute('disabled');
    });

    document.querySelectorAll('.btn-add-row, .btn-delete').forEach((btn) => {
      if (readOnly) btn.setAttribute('disabled', 'disabled');
      else btn.removeAttribute('disabled');
    });
  }

  async function cargarTrabajadoresActivos() {
    const res = await fetch('/datos');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async function convertirInputEnSelect(inputId, rows, selectedValue = '') {
    const input = document.getElementById(inputId);
    if (!input) return;

    const select = document.createElement('select');
    select.id = inputId;
    select.className = input.className.replace('input-readonly', '').trim() || 'modern-input';

    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Seleccione...';
    select.appendChild(ph);

    rows.forEach((t) => {
      const option = document.createElement('option');
      const nombre = `${t.nombres || ''} ${t.apellidos || ''}`.trim();
      const rut = t.RUT || '';
      option.value = rut;
      option.textContent = `${nombre} (${rut})`;
      select.appendChild(option);
    });

    select.value = selectedValue || state.userRut || '';
    input.replaceWith(select);
  }

  async function habilitarSelectoresPersonal() {
    const rows = await cargarTrabajadoresActivos();
    await convertirInputEnSelect('input-operador', rows, state.userRut);
    await convertirInputEnSelect('input-ayudante-1', rows);
    await convertirInputEnSelect('input-ayudante-2', rows);
  }

  function setResponsableLabel() {
    const operadorInput = document.getElementById('input-operador');
    const group = operadorInput?.closest('.input-group');
    const label = group?.querySelector('label');
    if (label) label.textContent = 'Responsable';
  }

  function updateTabVisibility() {
    const rules = {
      'tab-antecedentes': 'crear_informe_turno',
      'tab-operacion': 'editar_informe_propio',
      'tab-materiales': 'editar_informe_propio',
      'tab-cierre': 'cerrar_turno'
    };

    const buttons = document.querySelectorAll('.tabs-header .tab-btn');
    buttons.forEach((btn) => {
      const onclick = btn.getAttribute('onclick') || '';
      const match = onclick.match(/'([^']+)'/);
      const tabId = match ? match[1] : null;
      const needed = tabId ? rules[tabId] : null;
      if (!needed) return;

      if (!hasPermission(needed) && state.role !== 'admin') {
        btn.style.display = 'none';
        const panel = document.getElementById(tabId);
        if (panel) panel.style.display = 'none';
      }
    });

    const visibleBtn = Array.from(buttons).find((b) => b.style.display !== 'none');
    if (visibleBtn && !visibleBtn.classList.contains('active')) visibleBtn.click();
  }

  function applyModeRules() {
    state.mode = detectModeByCargo();
    checkPersistedLock();

    const operadorInput = document.getElementById('input-operador');
    if (operadorInput && !operadorInput.value) {
      operadorInput.value = state.userRut || state.userName || '';
    }

    const btnFinalizar = document.getElementById('btn-finalizar-turno');

    if (state.mode === 'supervisor') {
      setFormReadOnly(true);
      if (btnFinalizar) btnFinalizar.setAttribute('disabled', 'disabled');
    }

    if (state.mode === 'operador_faena') {
      habilitarSelectoresPersonal();
      if (btnFinalizar && !hasPermission('cerrar_turno')) btnFinalizar.setAttribute('disabled', 'disabled');
    }

    if (state.mode === 'operador_maquina') {
      setResponsableLabel();
      habilitarSelectoresPersonal();
      if (btnFinalizar) btnFinalizar.removeAttribute('disabled');
    }

    if (state.locked) {
      setFormReadOnly(true);
      if (btnFinalizar) btnFinalizar.setAttribute('disabled', 'disabled');
      alert('Este turno ya fue finalizado y bloqueado para futuras ediciones.');
    }

    updateTabVisibility();
  }

  function collectTableData() {
    const actividades = [];
    document.querySelectorAll('#lista-actividades tr').forEach((fila) => {
      const horaDesde = fila.querySelector('[name="hora_desde[]"]')?.value || '';
      const horaHasta = fila.querySelector('[name="hora_hasta[]"]')?.value || '';
      const detalle = fila.querySelector('[name="detalle[]"]')?.value || '';
      const hrsBd = parseFloat(fila.querySelector('[name="hrs_bd[]"]')?.value) || null;
      const hrsCliente = parseFloat(fila.querySelector('[name="hrs_cliente[]"]')?.value) || null;
      if (horaDesde || horaHasta || detalle) actividades.push({ hora_desde: horaDesde, hora_hasta: horaHasta, detalle, hrs_bd: hrsBd, hrs_cliente: hrsCliente });
    });

    const perforaciones = [];
    document.querySelectorAll('#tabla-perforacion tr').forEach((fila) => {
      const desde = parseFloat(fila.querySelector('[name="perf_desde[]"]')?.value) || null;
      const hasta = parseFloat(fila.querySelector('[name="perf_hasta[]"]')?.value) || null;
      const metros = parseFloat(fila.querySelector('[name="perf_metros[]"]')?.value) || null;
      const recuperacion = parseFloat(fila.querySelector('[name="perf_recuper[]"]')?.value) || null;
      const tipoRoca = fila.querySelector('[name="perf_tipo[]"]')?.value || '';
      const dureza = fila.querySelector('[name="perf_dureza[]"]')?.value || '';
      if (desde !== null || hasta !== null || metros !== null) {
        perforaciones.push({ desde, hasta, metros_perforados: metros, recuperacion, tipo_roca: tipoRoca, dureza });
      }
    });

    const herramientas = [];
    document.querySelectorAll('#tabla-herramientas tr').forEach((fila) => {
      const tipo_elemente = fila.querySelector('[name="herr_tipo_elemente[]"]')?.value || '';
      const diametro = fila.querySelector('[name="herr_diametro[]"]')?.value || '';
      const numero_serie = fila.querySelector('[name="herr_numero_serie[]"]')?.value || '';
      const desde_mts = parseFloat(fila.querySelector('[name="herr_desde_mts[]"]')?.value) || null;
      const hasta_mts = parseFloat(fila.querySelector('[name="herr_hasta_mts[]"]')?.value) || null;
      const detalle_extra = fila.querySelector('[name="herr_detalle_extra[]"]')?.value || '';
      if (tipo_elemente || numero_serie) herramientas.push({ tipo_elemente, diametro, numero_serie, desde_mts, hasta_mts, detalle_extra });
    });

    return { actividades, perforaciones, herramientas };
  }

  async function enviarInforme(estadoFinal) {
    if (state.locked) {
      alert('Este turno ya fue bloqueado.');
      return;
    }

    const operadorVal = document.getElementById('input-operador')?.value || '';
    const datosGenerales = {
      fecha: document.getElementById('input-fecha')?.value || '',
      turno: document.getElementById('input-turno')?.value || '',
      horas_trabajadas: parseFloat(document.getElementById('input-horas-trabajadas')?.value) || null,
      faena: document.getElementById('input-faena')?.value || '',
      lugar: document.getElementById('input-lugar')?.value || '',
      equipo: document.getElementById('input-equipo')?.value || '',
      operador_rut: operadorVal,
      responsable_rut: state.mode === 'operador_maquina' ? operadorVal : null,
      ayudante_1: document.getElementById('input-ayudante-1')?.value || '',
      ayudante_2: document.getElementById('input-ayudante-2')?.value || '',
      pozo_numero: document.getElementById('input-pozo-num')?.value || '',
      sector: document.getElementById('input-sector')?.value || '',
      diametro: document.getElementById('input-diametro')?.value || '',
      inclinacion: document.getElementById('input-inclinacion')?.value || '',
      profundidad_inicial: parseFloat(document.getElementById('input-profundidad-inicial')?.value) || null,
      profundidad_final: parseFloat(document.getElementById('input-profundidad')?.value) || null,
      mts_perforados: parseFloat(document.getElementById('input-mts-perforados')?.value) || null,
      pull_down: parseFloat(document.getElementById('input-pulldown')?.value) || null,
      rpm: parseFloat(document.getElementById('input-rpm')?.value) || null,
      horometro_inicial: parseFloat(document.getElementById('input-horometro-inicial')?.value) || null,
      horometro_final: parseFloat(document.getElementById('input-horometro-final')?.value) || null,
      horometro_hrs: parseFloat(document.getElementById('input-horometro-hrs')?.value) || null,
      insumo_petroleo: parseFloat(document.getElementById('input-petroleo')?.value) || null,
      insumo_lubricantes: parseFloat(document.getElementById('input-lubricantes')?.value) || null,
      observaciones: document.getElementById('notas-observaciones')?.value || '',
      estado: estadoFinal
    };

    if (estadoFinal === 'Finalizado') {
      const required = ['fecha', 'turno', 'faena', 'equipo', 'operador_rut'];
      for (const field of required) {
        if (!datosGenerales[field]) {
          alert('Complete los campos obligatorios antes de finalizar el turno.');
          return;
        }
      }
    }

    const { actividades, perforaciones, herramientas } = collectTableData();

    const response = await fetch('/api/informes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datosGenerales, actividades, perforaciones, herramientas })
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      alert(`❌ Error al guardar: ${result.error || 'Error desconocido'}`);
      return;
    }

    alert(`✅ Informe guardado correctamente. Folio: ${result.folio}`);
    if (estadoFinal === 'Finalizado') {
      markLocked();
      applyModeRules();
    }
  }

  function addRowHandlers() {
    document.getElementById('btnAgregar')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('lista-actividades').insertAdjacentHTML('beforeend', `
        <tr>
          <td><input type="time" class="input-compact" name="hora_desde[]"></td>
          <td><input type="time" class="input-compact" name="hora_hasta[]"></td>
          <td><input type="text" class="input-compact" name="detalle[]"></td>
          <td><input type="number" class="input-compact" name="hrs_bd[]" step="0.1"></td>
          <td><input type="number" class="input-compact" name="hrs_cliente[]" step="0.1"></td>
          <td style="text-align:center;"><button class="btn-delete" type="button"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
      `);
    });

    document.getElementById('btnAgregarPerforacion')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('tabla-perforacion').insertAdjacentHTML('beforeend', `
        <tr>
          <td><input type="number" class="input-compact" name="perf_desde[]"></td>
          <td><input type="number" class="input-compact" name="perf_hasta[]"></td>
          <td><input type="number" class="input-compact" name="perf_metros[]"></td>
          <td><input type="number" class="input-compact" name="perf_recuper[]"></td>
          <td><input type="text" class="input-compact" name="perf_tipo[]"></td>
          <td><input type="text" class="input-compact" name="perf_dureza[]"></td>
          <td style="text-align:center;"><button class="btn-delete" type="button"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
      `);
    });

    document.getElementById('btnAgregarHerramienta')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('tabla-herramientas').insertAdjacentHTML('beforeend', `
        <tr>
          <td><input type="text" class="input-compact" name="herr_tipo_elemente[]"></td>
          <td><input type="text" class="input-compact" name="herr_diametro[]"></td>
          <td><input type="text" class="input-compact" name="herr_numero_serie[]"></td>
          <td><input type="number" class="input-compact" name="herr_desde_mts[]" step="0.1"></td>
          <td><input type="number" class="input-compact" name="herr_hasta_mts[]" step="0.1"></td>
          <td><input type="text" class="input-compact" name="herr_detalle_extra[]"></td>
          <td style="text-align:center;"><button class="btn-delete" type="button"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
      `);
    });

    ['lista-actividades', 'tabla-perforacion', 'tabla-herramientas'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.btn-delete');
        if (!btn) return;
        ev.preventDefault();
        btn.closest('tr')?.remove();
      });
    });
  }

  function bindActions() {
    document.getElementById('btn-guardar-borrador')?.addEventListener('click', (e) => {
      e.preventDefault();
      enviarInforme('Borrador');
    });

    document.getElementById('btn-finalizar-turno')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!hasPermission('cerrar_turno') && state.role !== 'admin') {
        alert('No tiene permisos para cerrar turno.');
        return;
      }
      const ok = confirm('¿Finalizar y bloquear turno? Esta acción no se puede deshacer.');
      if (ok) enviarInforme('Finalizado');
    });

    document.getElementById('input-fecha')?.addEventListener('change', () => {
      checkPersistedLock();
      applyModeRules();
    });
    document.getElementById('input-turno')?.addEventListener('change', () => {
      checkPersistedLock();
      applyModeRules();
    });
  }

  function init() {
    addRowHandlers();
    bindActions();
    applyModeRules();
  }

  return {
    init,
    abrirPestaña(event, idTab) {
      if (event) event.preventDefault();
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(cont => cont.classList.remove('active'));
      event?.target?.closest('.tab-btn')?.classList.add('active');
      document.getElementById(idTab)?.classList.add('active');
    }
  };
})();

window.abrirPestaña = InformeTurno.abrirPestaña;
document.addEventListener('DOMContentLoaded', InformeTurno.init);

