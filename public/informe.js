const InformeTurno = (() => {
  const SECTION_KEYS = ['antecedentes', 'operacion', 'materiales', 'actividades', 'cierre'];
  const TAB_KEYS = ['antecedentes', 'operacion', 'materiales', 'cierre'];
  const TAB_BUTTON_IDS = {
    antecedentes: 'btn-tab-antecedentes',
    operacion: 'btn-tab-operacion',
    materiales: 'btn-tab-materiales',
    cierre: 'btn-tab-cierre'
  };
  const TAB_CONTENT_IDS = {
    antecedentes: 'tab-antecedentes',
    operacion: 'tab-operacion',
    materiales: 'tab-materiales',
    cierre: 'tab-cierre'
  };
  const SECTION_TO_TAB = {
    antecedentes: 'antecedentes',
    operacion: 'operacion',
    actividades: 'operacion',
    materiales: 'materiales',
    cierre: 'cierre'
  };
  const BLOCKED_STATUSES = new Set(['cerrado', 'validado', 'finalizado']);
  const CLOSE_TURNO_PERMISSION_ALIASES = ['cerrar_turno', 'finalizar_turno', 'inf_cerrar_turno'];

  const state = {
    role: '',
    userRut: '',
    userName: '',
    cargoName: '',
    permisosCargo: [],
    isSuperAdmin: false,
    currentReportId: null,
    currentReportStatus: '',
    documentBlocked: false,
    canCloseTurno: false,
    canWriteAnySection: false,
    hasVisibleSections: false,
    userGrupo: null,
    userShiftStatus: null,
    auditModeRequested: false,
    auditModeEnabled: false
  };

  function parseJSONArray(key) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (_error) {
      return [];
    }
  }

  function refreshSessionContext() {
    state.role = localStorage.getItem('user_role') || '';
    state.userRut = localStorage.getItem('user_rut') || '';
    state.userName = localStorage.getItem('user_name') || '';
    state.cargoName = localStorage.getItem('user_cargo_name') || '';
    state.permisosCargo = parseJSONArray('user_permissions_cargo');
    state.isSuperAdmin = localStorage.getItem('user_super_admin') === '1';
  }

  function normalizePerm(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function normalizeStatus(value) {
    return normalizePerm(value).replace(/_/g, '');
  }

  function cargoPermSet() {
    return new Set((state.permisosCargo || []).map(normalizePerm).filter(Boolean));
  }

  function permissionAliases(permissionKey) {
    const normalized = normalizePerm(permissionKey);
    if (normalized === 'cerrar_turno') return CLOSE_TURNO_PERMISSION_ALIASES;
    return [permissionKey];
  }

  function hasCargoPermission(permissionKey) {
    if (state.isSuperAdmin) return true;

    const permisos = cargoPermSet();
    if (permisos.size === 0) return false;

    return permissionAliases(permissionKey).some((alias) => permisos.has(normalizePerm(alias)));
  }

  function sectionAccess(sectionKey) {
    if (hasCargoPermission(`inf_seccion_${sectionKey}_w`)) return 'w';
    if (hasCargoPermission(`inf_seccion_${sectionKey}_r`)) return 'r';
    return 'none';
  }

  function sectionWritable(sectionKey) {
    return sectionAccess(sectionKey) === 'w';
  }

  function sectionReadable(sectionKey) {
    return sectionAccess(sectionKey) !== 'none';
  }

  function isLockedStatus(status) {
    return BLOCKED_STATUSES.has(normalizeStatus(status));
  }

  function sectionPanels(sectionKey) {
    return Array.from(document.querySelectorAll(`[data-section-panel="${sectionKey}"]`));
  }

  function getTabButton(tabKey) {
    return document.getElementById(TAB_BUTTON_IDS[tabKey]);
  }

  function getTabContent(tabKey) {
    return document.getElementById(TAB_CONTENT_IDS[tabKey]);
  }

  function setElementVisible(node, visible) {
    if (!node) return;
    node.hidden = !visible;
    node.style.display = visible ? '' : 'none';
  }

  function isElementVisible(node) {
    return !!node && !node.hidden && node.style.display !== 'none';
  }

  function escapeAttribute(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function activateTab(tabKey) {
    TAB_KEYS.forEach((key) => {
      getTabButton(key)?.classList.toggle('active', key === tabKey);
      getTabContent(key)?.classList.toggle('active', key === tabKey);
    });
  }

  function ensureVisibleActiveTab() {
    const activeButton = document.querySelector('.tab-btn.active');
    if (isElementVisible(activeButton)) return;

    const firstVisible = TAB_KEYS.map((key) => getTabButton(key)).find(isElementVisible);
    if (!firstVisible) return;

    activateTab(firstVisible.dataset.sectionTab);
  }

  function setStatusBanner(type, message) {
    const banner = document.getElementById('document-status-banner');
    if (!banner) return;

    if (!message) {
      banner.hidden = true;
      banner.className = 'status-banner';
      banner.textContent = '';
      return;
    }

    banner.hidden = false;
    banner.className = `status-banner ${type}`;
    banner.textContent = message;
  }

  function updateStatusBanner() {
    if (state.documentBlocked) {
      const status = state.currentReportStatus || 'DOCUMENTO BLOQUEADO';
      setStatusBanner('blocked', `Documento Bloqueado: este informe está en estado ${String(status).toUpperCase()} y solo un Superadmin puede modificarlo.`);
      return;
    }

    if (!state.hasVisibleSections) {
      setStatusBanner('warning', 'Tu cargo no tiene acceso a ninguna sección de este informe.');
      return;
    }

    setStatusBanner('', '');
  }

  function syncAuditModeFromURL() {
    const params = new URLSearchParams(window.location.search);
    state.auditModeRequested = normalizePerm(params.get('mode')) === 'admin';
    state.auditModeEnabled = state.auditModeRequested && state.isSuperAdmin;
  }

  function updateAuditModeBanner() {
    const banner = document.getElementById('audit-mode-banner');
    if (!banner) return;

    if (state.auditModeEnabled) {
      banner.hidden = false;
      banner.className = 'status-banner audit';
      banner.textContent = '📍 MODO AUDITORÍA ACTIVO: Edición de registro histórico habilitada';
      return;
    }

    banner.hidden = true;
    banner.className = 'status-banner audit';
    banner.textContent = '';
  }

  function setSectionVisibility(sectionKey, visible) {
    sectionPanels(sectionKey).forEach((panel) => setElementVisible(panel, visible));
  }

  function setSectionReadOnly(sectionKey, readOnly) {
    sectionPanels(sectionKey).forEach((panel) => {
      panel.classList.toggle('is-readonly', readOnly);
      panel.querySelectorAll('input, select, textarea, button').forEach((node) => {
        if (readOnly) node.setAttribute('disabled', 'disabled');
        else node.removeAttribute('disabled');
      });
    });
  }

  function applyActionBarState() {
    const btnGuardar = document.getElementById('btn-guardar-borrador');
    const btnFinalizar = document.getElementById('btn-finalizar-turno');

    if (btnGuardar) {
      if (state.documentBlocked || !state.canWriteAnySection) btnGuardar.setAttribute('disabled', 'disabled');
      else btnGuardar.removeAttribute('disabled');
    }

    if (btnFinalizar) {
      if (state.documentBlocked || !state.canCloseTurno) btnFinalizar.setAttribute('disabled', 'disabled');
      else btnFinalizar.removeAttribute('disabled');
    }
  }

  function applyResponsableRules() {
    const operadorInput = document.getElementById('input-operador');
    const label = operadorInput?.closest('.input-group')?.querySelector('label');
    if (label) {
      label.textContent = state.canCloseTurno ? 'Responsable de Turno' : 'Operador';
    }
  }

  // ---- Shift Context -------------------------------------------------------

  function updateShiftStatusBadge(shiftData) {
    const badge = document.getElementById('shift-status-badge');
    if (!badge) return;
    const msgs = {
      en_turno:      `<i class="fa-solid fa-circle-check"></i> Turno Activo — Grupo ${shiftData.grupo || ''}`,
      en_descanso:   `<i class="fa-solid fa-moon"></i> En Descanso — Grupo ${shiftData.grupo || ''}`,
      proximo_turno: `<i class="fa-solid fa-clock"></i> Próximo a Turno — Grupo ${shiftData.grupo || ''}`,
      sin_grupo:     `<i class="fa-solid fa-circle-question"></i> Sin Grupo Asignado`
    };
    const cls = {
      en_turno:      'shift-badge--active',
      en_descanso:   'shift-badge--rest',
      proximo_turno: 'shift-badge--upcoming',
      sin_grupo:     'shift-badge--unknown'
    };
    const estado = shiftData.estado || 'sin_grupo';
    badge.innerHTML = msgs[estado]
      || `<i class="fa-solid fa-circle-question"></i> ${escapeAttribute(shiftData.mensaje || 'Estado desconocido')}`;
    badge.className = `shift-badge ${cls[estado] || 'shift-badge--unknown'}`;
    badge.hidden = false;
  }

  function populateTurnoDropdown(activeGroups, userGrupo) {
    const select = document.getElementById('input-turno');
    if (!select) return;
    const prevValue = select.value;
    select.innerHTML = '';
    const groups = activeGroups && activeGroups.length > 0 ? activeGroups : ['A', 'B', 'C', 'D'];
    groups.forEach((g) => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = `Grupo ${g}`;
      select.appendChild(opt);
    });
    if (userGrupo && groups.includes(userGrupo)) {
      select.value = userGrupo;
    } else if (prevValue && groups.includes(prevValue)) {
      select.value = prevValue;
    } else {
      select.selectedIndex = 0;
    }
  }

  // Ensure a value exists as an option in a select (used when loading saved reports)
  function ensureSelectOption(selectId, value, label) {
    const select = document.getElementById(selectId);
    if (!select || !value) return;
    const v = String(value);
    const exists = Array.from(select.options).some((o) => o.value === v);
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = label || v;
      select.appendChild(opt);
    }
    select.value = v;
  }

  function isOperadorCargo(t) {
    const cargo = String(t.cargo || t.nombre_cargo || '').toLowerCase();
    return cargo.includes('operador') || cargo.includes('operator');
  }

  function hasInfEditPermission(t) {
    return (t.permisos_cargo || []).some((p) => {
      const n = String(p.nombre_permiso || '').toLowerCase();
      return n.includes('inf_edit') || n.includes('antecedente');
    });
  }

  function perteneceAGruposActivos(t, activeGroups) {
    if (!activeGroups || activeGroups.length === 0) return true;
    const grupo = String(t.nombre_grupo || t.grupo || t.id_grupo || '').trim();
    return activeGroups.includes(grupo);
  }

  function buildSelectOptions(select, trabajadores, emptyLabel) {
    const prevValue = select.value;
    select.innerHTML = `<option value="">${emptyLabel}</option>`;
    trabajadores.forEach((t) => {
      const opt = document.createElement('option');
      const rut = String(t.RUT || t.rut || '');
      opt.value = rut;
      const nombre = `${t.nombres || ''} ${t.apellido_paterno || ''}`.trim();
      opt.textContent = nombre ? `${nombre} (${rut})` : rut;
      select.appendChild(opt);
    });
    if (prevValue) select.value = prevValue;
  }

  async function populatePersonalSelects(activeGroups, options = {}) {
    const auditMode = Boolean(options.auditMode);
    let trabajadores = [];
    try {
      const resp = await fetch('/api/trabajadores');
      if (resp.ok) trabajadores = await resp.json();
    } catch (_) { return; }

    // En modo auditoria (superadmin) no se restringe por grupo/permiso para inspeccion historica.
    const responsables = auditMode
      ? trabajadores.filter(isOperadorCargo)
      : trabajadores.filter(
        (t) => isOperadorCargo(t) && hasInfEditPermission(t) && perteneceAGruposActivos(t, activeGroups)
      );
    const listaResp = responsables.length > 0 ? responsables : trabajadores.filter(isOperadorCargo);
    const selResp = document.getElementById('input-operador');
    if (selResp && selResp.tagName === 'SELECT') {
      buildSelectOptions(selResp, listaResp, '— Seleccionar Responsable —');
      if (state.userRut && Array.from(selResp.options).some((o) => o.value === state.userRut)) {
        selResp.value = state.userRut;
      }
    }

    // Ayudantes: cualquier trabajador del grupo activo
    const ayudantes = auditMode
      ? trabajadores
      : (activeGroups && activeGroups.length > 0
      ? trabajadores.filter((t) => perteneceAGruposActivos(t, activeGroups))
      : trabajadores);
    const sel1 = document.getElementById('input-ayudante-1');
    const sel2 = document.getElementById('input-ayudante-2');
    if (sel1 && sel1.tagName === 'SELECT') buildSelectOptions(sel1, ayudantes, '— Ninguno —');
    if (sel2 && sel2.tagName === 'SELECT') buildSelectOptions(sel2, ayudantes, '— Ninguno —');
  }

  async function initAuditContext() {
    const shiftBadge = document.getElementById('shift-status-badge');
    if (shiftBadge) {
      shiftBadge.hidden = true;
    }

    populateTurnoDropdown([], null);
    await populatePersonalSelects([], { auditMode: true });
  }

  async function checkExistingInformeForShift(fecha, grupo) {
    try {
      const url = `/api/informes/por-turno?fecha=${encodeURIComponent(fecha)}&grupo=${encodeURIComponent(grupo)}`;
      const resp = await fetch(url);
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data.existe || !data.id_informe) return;
      const continuar = confirm(
        `Ya existe un Informe para el Grupo ${grupo} el ${fecha} (estado: ${data.estado || '—'}).\n¿Desea abrirlo?`
      );
      if (continuar) {
        const params = new URLSearchParams(window.location.search);
        params.set('id', String(data.id_informe));
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
        await loadExistingReportIfNeeded();
      }
    } catch (_) { /* silencioso */ }
  }

  async function initShiftContext() {
    // 1. Fecha contable
    const fechaInput = document.getElementById('input-fecha');
    if (fechaInput && !fechaInput.value) {
      fechaInput.value = window.getShiftDateISO ? window.getShiftDateISO() : new Date().toISOString().split('T')[0];
    }

    // 2. Estado de turno del usuario
    if (state.userRut) {
      try {
        const resp = await fetch(`/api/estado-turno/${encodeURIComponent(state.userRut)}`);
        if (resp.ok) {
          const shiftData = await resp.json();
          state.userGrupo = shiftData.grupo || null;
          state.userShiftStatus = shiftData.estado || null;
          updateShiftStatusBadge(shiftData);
        }
      } catch (_) { /* silencioso */ }
    }

    // 3. Grupos activos para esta fecha
    let activeGroups = [];
    const fecha = fechaInput?.value || '';
    if (fecha) {
      try {
        const resp = await fetch(`/api/turnos/grupos-activos?fecha=${encodeURIComponent(fecha)}`);
        if (resp.ok) {
          const data = await resp.json();
          activeGroups = data.grupos || [];
        }
      } catch (_) { /* silencioso */ }
    }

    // 4. Poblar dropdown de turno con grupos activos
    populateTurnoDropdown(activeGroups, state.userGrupo);

    // 5. Poblar selects de personal filtrado
    await populatePersonalSelects(activeGroups);
  }

  function applyPermissionMatrix() {
    const accesoAntecedentes = sectionAccess('antecedentes');
    const accesoOperacion = sectionAccess('operacion');
    const accesoActividades = sectionAccess('actividades');
    const accesoMateriales = sectionAccess('materiales');
    const accesoCierre = sectionAccess('cierre');

    const operationTabVisible = accesoOperacion !== 'none' || accesoActividades !== 'none';
    setElementVisible(getTabButton('antecedentes'), accesoAntecedentes !== 'none');
    setElementVisible(getTabContent('antecedentes'), accesoAntecedentes !== 'none');
    setElementVisible(getTabButton('operacion'), operationTabVisible);
    setElementVisible(getTabContent('operacion'), operationTabVisible);
    setElementVisible(getTabButton('materiales'), accesoMateriales !== 'none');
    setElementVisible(getTabContent('materiales'), accesoMateriales !== 'none');
    setElementVisible(getTabButton('cierre'), accesoCierre !== 'none');
    setElementVisible(getTabContent('cierre'), accesoCierre !== 'none');

    setSectionVisibility('antecedentes', accesoAntecedentes !== 'none');
    setSectionVisibility('operacion', accesoOperacion !== 'none');
    setSectionVisibility('actividades', accesoActividades !== 'none');
    setSectionVisibility('materiales', accesoMateriales !== 'none');
    setSectionVisibility('cierre', accesoCierre !== 'none');

    SECTION_KEYS.forEach((sectionKey) => {
      if (!sectionReadable(sectionKey)) return;
      setSectionReadOnly(sectionKey, state.documentBlocked || !sectionWritable(sectionKey));
    });

    state.canWriteAnySection = state.isSuperAdmin || SECTION_KEYS.some((sectionKey) => sectionWritable(sectionKey));
    state.canCloseTurno = state.isSuperAdmin || CLOSE_TURNO_PERMISSION_ALIASES.some((key) => hasCargoPermission(key));
    state.hasVisibleSections = TAB_KEYS.some((tabKey) => isElementVisible(getTabButton(tabKey)));

    applyResponsableRules();
    applyActionBarState();
    updateStatusBanner();
    ensureVisibleActiveTab();
  }

  function clearTable(tableBodyId) {
    const body = document.getElementById(tableBodyId);
    if (body) body.innerHTML = '';
  }

  function appendRow(tableBodyId, html) {
    const body = document.getElementById(tableBodyId);
    if (body) body.insertAdjacentHTML('beforeend', html);
  }

  function renderActividades(rows = []) {
    clearTable('lista-actividades');
    rows.forEach((row) => {
      appendRow('lista-actividades', `
        <tr>
          <td><input type="time" class="input-compact" name="hora_desde[]" value="${escapeAttribute(row.hora_desde || '')}"></td>
          <td><input type="time" class="input-compact" name="hora_hasta[]" value="${escapeAttribute(row.hora_hasta || '')}"></td>
          <td><input type="text" class="input-compact" name="detalle[]" value="${escapeAttribute(row.detalle || '')}"></td>
          <td><input type="number" class="input-compact" name="hrs_bd[]" step="0.1" value="${escapeAttribute(row.hrs_bd ?? '')}"></td>
          <td><input type="number" class="input-compact" name="hrs_cliente[]" step="0.1" value="${escapeAttribute(row.hrs_cliente ?? '')}"></td>
          <td style="text-align:center;"><button class="btn-delete" type="button"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
      `);
    });
  }

  function renderPerforaciones(rows = []) {
    clearTable('tabla-perforacion');
    rows.forEach((row) => {
      appendRow('tabla-perforacion', `
        <tr>
          <td><input type="number" class="input-compact" name="perf_desde[]" value="${escapeAttribute(row.desde ?? row.desde_mts ?? '')}"></td>
          <td><input type="number" class="input-compact" name="perf_hasta[]" value="${escapeAttribute(row.hasta ?? row.hasta_mts ?? '')}"></td>
          <td><input type="number" class="input-compact" name="perf_metros[]" value="${escapeAttribute(row.metros_perforados ?? '')}"></td>
          <td><input type="number" class="input-compact" name="perf_recuper[]" value="${escapeAttribute(row.recuperacion ?? '')}"></td>
          <td><input type="text" class="input-compact" name="perf_tipo[]" value="${escapeAttribute(row.tipo_roca || row.tipo_rocka || '')}"></td>
          <td><input type="text" class="input-compact" name="perf_dureza[]" value="${escapeAttribute(row.dureza || '')}"></td>
          <td style="text-align:center;"><button class="btn-delete" type="button"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
      `);
    });
  }

  function renderHerramientas(rows = []) {
    clearTable('tabla-herramientas');
    rows.forEach((row) => {
      appendRow('tabla-herramientas', `
        <tr>
          <td><input type="text" class="input-compact" name="herr_tipo_elemente[]" value="${escapeAttribute(row.tipo_elemente || '')}"></td>
          <td><input type="text" class="input-compact" name="herr_diametro[]" value="${escapeAttribute(row.diametro || '')}"></td>
          <td><input type="text" class="input-compact" name="herr_numero_serie[]" value="${escapeAttribute(row.numero_serie || '')}"></td>
          <td><input type="number" class="input-compact" name="herr_desde_mts[]" step="0.1" value="${escapeAttribute(row.desde_mts ?? '')}"></td>
          <td><input type="number" class="input-compact" name="herr_hasta_mts[]" step="0.1" value="${escapeAttribute(row.hasta_mts ?? '')}"></td>
          <td><input type="text" class="input-compact" name="herr_detalle_extra[]" value="${escapeAttribute(row.detalle_extra || '')}"></td>
          <td style="text-align:center;"><button class="btn-delete" type="button"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
      `);
    });
  }

  function populateInforme(informe = {}, actividades = [], perforaciones = [], herramientas = []) {
    document.getElementById('input-fecha').value = informe.fecha ? String(informe.fecha).split('T')[0] : '';
    ensureSelectOption('input-turno', informe.turno || '', `Grupo ${informe.turno || ''}`);
    document.getElementById('input-horas-trabajadas').value = informe.horas_trabajadas ?? '';
    document.getElementById('input-horometro-inicial').value = informe.horometro_inicial ?? '';
    document.getElementById('input-horometro-final').value = informe.horometro_final ?? '';
    document.getElementById('input-horometro-hrs').value = informe.horometro_hrs ?? '';
    document.getElementById('input-faena').value = informe.faena || '';
    document.getElementById('input-lugar').value = informe.lugar || '';
    document.getElementById('input-equipo').value = informe.equipo || '';
    ensureSelectOption('input-operador', informe.operador_rut || state.userRut || '', informe.operador_rut || '');
    ensureSelectOption('input-ayudante-1', informe.ayudante_1 || '', informe.ayudante_1 || '');
    ensureSelectOption('input-ayudante-2', informe.ayudante_2 || '', informe.ayudante_2 || '');
    document.getElementById('input-pozo-num').value = informe.pozo_numero || '';
    document.getElementById('input-sector').value = informe.sector || '';
    document.getElementById('input-diametro').value = informe.diametro || '';
    document.getElementById('input-inclinacion').value = informe.inclinacion || '';
    document.getElementById('input-profundidad-inicial').value = informe.profundidad_inicial ?? '';
    document.getElementById('input-profundidad').value = informe.profundidad_final ?? '';
    document.getElementById('input-mts-perforados').value = informe.mts_perforados ?? '';
    document.getElementById('input-pulldown').value = informe.pull_down ?? '';
    document.getElementById('input-rpm').value = informe.rpm ?? '';
    document.getElementById('input-petroleo').value = informe.insumo_petroleo ?? '';
    document.getElementById('input-lubricantes').value = informe.insumo_lubricantes ?? '';
    document.getElementById('notas-observaciones').value = informe.observaciones || '';

    renderActividades(actividades);
    renderPerforaciones(perforaciones);
    renderHerramientas(herramientas);
  }

  async function loadExistingReportIfNeeded() {
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('id');
    if (!reportId) return;

    const response = await fetch(`/api/informes/${encodeURIComponent(reportId)}/detalles`);
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result?.informe) {
      throw new Error(result.error || 'No se pudo cargar el informe solicitado');
    }

    state.currentReportId = Number(reportId);
    state.currentReportStatus = result.informe.estado || '';
    state.documentBlocked = !state.isSuperAdmin && isLockedStatus(state.currentReportStatus);

    populateInforme(result.informe, result.actividades, result.perforaciones, result.herramientas);
  }

  function collectTableData() {
    const actividades = [];
    document.querySelectorAll('#lista-actividades tr').forEach((fila) => {
      const horaDesde = fila.querySelector('[name="hora_desde[]"]')?.value || '';
      const horaHasta = fila.querySelector('[name="hora_hasta[]"]')?.value || '';
      const detalle = fila.querySelector('[name="detalle[]"]')?.value || '';
      const hrsBd = parseFloat(fila.querySelector('[name="hrs_bd[]"]')?.value);
      const hrsCliente = parseFloat(fila.querySelector('[name="hrs_cliente[]"]')?.value);
      if (horaDesde || horaHasta || detalle) {
        actividades.push({
          hora_desde: horaDesde,
          hora_hasta: horaHasta,
          detalle,
          hrs_bd: Number.isFinite(hrsBd) ? hrsBd : null,
          hrs_cliente: Number.isFinite(hrsCliente) ? hrsCliente : null
        });
      }
    });

    const perforaciones = [];
    document.querySelectorAll('#tabla-perforacion tr').forEach((fila) => {
      const desde = parseFloat(fila.querySelector('[name="perf_desde[]"]')?.value);
      const hasta = parseFloat(fila.querySelector('[name="perf_hasta[]"]')?.value);
      const metros = parseFloat(fila.querySelector('[name="perf_metros[]"]')?.value);
      const recuperacion = parseFloat(fila.querySelector('[name="perf_recuper[]"]')?.value);
      const tipoRoca = fila.querySelector('[name="perf_tipo[]"]')?.value || '';
      const dureza = fila.querySelector('[name="perf_dureza[]"]')?.value || '';
      if (Number.isFinite(desde) || Number.isFinite(hasta) || Number.isFinite(metros) || tipoRoca || dureza) {
        perforaciones.push({
          desde: Number.isFinite(desde) ? desde : null,
          hasta: Number.isFinite(hasta) ? hasta : null,
          metros_perforados: Number.isFinite(metros) ? metros : null,
          recuperacion: Number.isFinite(recuperacion) ? recuperacion : null,
          tipo_roca: tipoRoca,
          dureza
        });
      }
    });

    const herramientas = [];
    document.querySelectorAll('#tabla-herramientas tr').forEach((fila) => {
      const tipoElemente = fila.querySelector('[name="herr_tipo_elemente[]"]')?.value || '';
      const diametro = fila.querySelector('[name="herr_diametro[]"]')?.value || '';
      const numeroSerie = fila.querySelector('[name="herr_numero_serie[]"]')?.value || '';
      const desdeMts = parseFloat(fila.querySelector('[name="herr_desde_mts[]"]')?.value);
      const hastaMts = parseFloat(fila.querySelector('[name="herr_hasta_mts[]"]')?.value);
      const detalleExtra = fila.querySelector('[name="herr_detalle_extra[]"]')?.value || '';
      if (tipoElemente || numeroSerie || Number.isFinite(desdeMts) || Number.isFinite(hastaMts) || detalleExtra) {
        herramientas.push({
          tipo_elemente: tipoElemente,
          diametro,
          numero_serie: numeroSerie,
          desde_mts: Number.isFinite(desdeMts) ? desdeMts : null,
          hasta_mts: Number.isFinite(hastaMts) ? hastaMts : null,
          detalle_extra: detalleExtra
        });
      }
    });

    return { actividades, perforaciones, herramientas };
  }

  function buildDatosGenerales(estadoFinal) {
    const operadorVal = document.getElementById('input-operador')?.value || '';
    return {
      fecha: document.getElementById('input-fecha')?.value || '',
      turno: document.getElementById('input-turno')?.value || '',
      horas_trabajadas: parseFloat(document.getElementById('input-horas-trabajadas')?.value) || null,
      faena: document.getElementById('input-faena')?.value || '',
      lugar: document.getElementById('input-lugar')?.value || '',
      equipo: document.getElementById('input-equipo')?.value || '',
      operador_rut: operadorVal,
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
  }

  async function persistInforme(estadoFinal) {
    if (state.documentBlocked) {
      alert('Documento bloqueado. Solo un Superadmin puede modificar este informe.');
      return;
    }

    if (state.auditModeEnabled && !state.currentReportId) {
      alert('El modo auditoria requiere abrir un informe existente desde Gestion de Informes.');
      return;
    }

    const datosGenerales = buildDatosGenerales(estadoFinal);
    if (estadoFinal === 'Finalizado') {
      const required = ['fecha', 'turno', 'faena', 'equipo', 'operador_rut'];
      for (const field of required) {
        if (!datosGenerales[field]) {
          alert('Complete los campos obligatorios antes de finalizar el turno.');
          return;
        }
      }
    }

    const payload = {
      datosGenerales,
      ...collectTableData()
    };

    if (state.auditModeEnabled) {
      payload.is_audit_edit = true;
      payload.admin_rut = state.userRut || '';
    }

    const method = state.currentReportId ? 'PUT' : 'POST';
    const url = state.currentReportId ? `/api/informes/${state.currentReportId}` : '/api/informes';
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      alert(`❌ Error al guardar: ${result.error || 'Error desconocido'}`);
      return;
    }

    if (!state.currentReportId && result.id_informe) {
      state.currentReportId = Number(result.id_informe);
      const params = new URLSearchParams(window.location.search);
      params.set('id', String(result.id_informe));
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }

    state.currentReportStatus = result.estado || estadoFinal;
    state.documentBlocked = !state.isSuperAdmin && isLockedStatus(state.currentReportStatus);
    applyPermissionMatrix();

    const folioMessage = result.folio ? ` Folio: ${result.folio}` : '';
    alert(`✅ ${result.message || 'Informe guardado correctamente'}.${folioMessage}`.trim());
  }

  function addRowHandlers() {
    document.getElementById('btnAgregar')?.addEventListener('click', (e) => {
      e.preventDefault();
      appendRow('lista-actividades', `
        <tr>
          <td><input type="time" class="input-compact" name="hora_desde[]"></td>
          <td><input type="time" class="input-compact" name="hora_hasta[]"></td>
          <td><input type="text" class="input-compact" name="detalle[]"></td>
          <td><input type="number" class="input-compact" name="hrs_bd[]" step="0.1"></td>
          <td><input type="number" class="input-compact" name="hrs_cliente[]" step="0.1"></td>
          <td style="text-align:center;"><button class="btn-delete" type="button"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
      `);
      applyPermissionMatrix();
    });

    document.getElementById('btnAgregarPerforacion')?.addEventListener('click', (e) => {
      e.preventDefault();
      appendRow('tabla-perforacion', `
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
      applyPermissionMatrix();
    });

    document.getElementById('btnAgregarHerramienta')?.addEventListener('click', (e) => {
      e.preventDefault();
      appendRow('tabla-herramientas', `
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
      applyPermissionMatrix();
    });

    ['lista-actividades', 'tabla-perforacion', 'tabla-herramientas'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.btn-delete');
        if (!btn || btn.disabled) return;
        ev.preventDefault();
        btn.closest('tr')?.remove();
      });
    });
  }

  function bindActions() {
    document.getElementById('btn-guardar-borrador')?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!state.canWriteAnySection && !state.isSuperAdmin) {
        alert('No tiene permisos de escritura para guardar cambios en este informe.');
        return;
      }
      await persistInforme('Borrador');
    });

    document.getElementById('btn-finalizar-turno')?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!state.canCloseTurno) {
        alert('No tiene permisos para cerrar turno.');
        return;
      }
      const ok = confirm('¿Finalizar y bloquear turno? Esta acción no se puede deshacer.');
      if (ok) await persistInforme('Finalizado');
    });
  }

  async function init() {
    refreshSessionContext();
    syncAuditModeFromURL();
    updateAuditModeBanner();
    addRowHandlers();
    bindActions();

    if (state.auditModeEnabled) {
      await initAuditContext();
    } else {
      // Fecha contable + grupos activos + selects de personal
      await initShiftContext();
    }

    // Cargar informe si ?id= presente
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('id')) {
      try {
        await loadExistingReportIfNeeded();
      } catch (error) {
        console.error('[INFORME] Error cargando informe existente:', error);
        setStatusBanner('warning', error.message || 'No se pudo cargar el informe solicitado.');
      }
    } else if (!state.auditModeEnabled && state.userGrupo) {
      // Sin id explícito: verificar si ya hay un informe abierto para este turno
      const fechaInput = document.getElementById('input-fecha');
      if (fechaInput?.value) {
        await checkExistingInformeForShift(fechaInput.value, state.userGrupo);
      }
    }

    applyPermissionMatrix();
  }

  return {
    init,
    abrirPestaña(event, idTab) {
      if (event) event.preventDefault();
      const targetTab = document.getElementById(idTab);
      if (!isElementVisible(targetTab)) return;

      const tabKey = Object.entries(TAB_CONTENT_IDS)
        .find(([, contentId]) => contentId === idTab)?.[0];

      if (tabKey) activateTab(tabKey);
    }
  };
})();

window.abrirPestaña = InformeTurno.abrirPestaña;
document.addEventListener('DOMContentLoaded', () => {
  InformeTurno.init().catch((error) => {
    console.error('[INFORME] Error inicializando la vista:', error);
  });
});

