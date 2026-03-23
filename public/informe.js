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

  const SECTION_ID_MAP = {
    antecedentes: { r: 22, w: 12 },
    operacion: { r: 23, w: 13 },
    materiales: { r: 24, w: 14 },
    actividades: { r: 26, w: 27 },
    cierre: { r: 25, w: 15 }
  };

  const state = {
    role: '',
    userRut: '',
    userName: '',
    cargoName: '',
    permisosCargo: [],
    permisosIds: [],
    isSuperAdmin: false,
    currentReportId: null,
    currentReportStatus: '',
    documentBlocked: false,
    canCloseTurno: false,
    canWriteAnySection: false,
    hasVisibleSections: false,
    userGrupo: null,
    userShiftStatus: null,
    userShiftContext: null,
    shiftBadgeTimerId: null,
    auditModeRequested: false,
    auditModeEnabled: false
  };
  window.state = state;

  function getShiftStatusBadge() {
    return document.getElementById('status-badge') || document.getElementById('shift-status-badge');
  }

  function normalizeGroupValue(value) {
    return String(value || '').replace(/^grupo\s+/i, '').trim().toUpperCase();
  }

  function formatCountdown(totalSeconds) {
    const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function stopShiftBadgeTimer() {
    if (!state.shiftBadgeTimerId) return;
    window.clearInterval(state.shiftBadgeTimerId);
    state.shiftBadgeTimerId = null;
  }

  function setLockedTurnoValue(grupo) {
    const normalizedGroup = normalizeGroupValue(grupo);
    const hiddenInput = document.getElementById('input-turno');
    const displayInput = document.getElementById('input-turno-display');
    if (hiddenInput) hiddenInput.value = normalizedGroup;
    if (displayInput) displayInput.value = normalizedGroup ? `Grupo ${normalizedGroup}` : 'Sin grupo asignado';
  }

  function buildAccessDeniedReason(shiftContext, isInGrace) {
    const estado = shiftContext?.estado || '';
    const grupo = state.userGrupo || normalizeGroupValue(shiftContext?.grupo || '');
    const graceEndsAt = shiftContext?.grace_ends_at || null;

    if (isInGrace && graceEndsAt) {
      const hora = new Date(graceEndsAt).toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      return `Tu ventana de gracia de 30 minutos termina a las ${hora}. Para ingresar necesitas tener un borrador guardado de tu turno.`;
    }

    if (estado === 'sin_grupo') {
      return 'Tu cuenta no tiene un grupo de turno asignado. Contacta al administrador.';
    }

    if (estado === 'sin_datos') {
      return 'No se pudo verificar tu estado de turno. Verifica tu sesión o contacta al administrador.';
    }

    const grupoMsg = grupo ? ` El Grupo ${grupo} no tiene turno activo en este momento.` : '';
    return `No estás en turno operativo el día de hoy.${grupoMsg} Solo puedes crear informes durante tu jornada activa.`;
  }

  function showRestrictedAccess(reason) {
    console.warn('[DEBUG_SECURITY] Bloqueo activado por informe.js. Motivo:', reason);
    console.trace('[DEBUG_TRACE] Origen de la llamada al bloqueo:');

    const oldModals = document.querySelectorAll('#access-restricted-overlay, [class*="access-restricted"], [class*="restricted-content"]');
    oldModals.forEach((el) => {
      console.log('[DEBUG_CLEANUP] Eliminando elemento redundante:', el.tagName, el.className, el.id);
      el.remove();
    });

    document.querySelector('.informe-container')?.style.setProperty('display', 'none', 'important');

    const main = document.querySelector('main');
    if (main) {
      main.innerHTML = '';
    }

    const overlay = document.createElement('div');
    overlay.id = 'access-restricted-overlay';
    overlay.className = 'access-restricted-overlay';
    overlay.innerHTML = `
      <div class="access-restricted-card">
        <div class="access-restricted-icon">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
        <h2 class="access-restricted-title">Acceso Restringido</h2>
        <p class="access-restricted-reason"></p>
        <a href="/index.html" class="access-restricted-btn">
          <i class="fa-solid fa-arrow-left"></i> Volver al Inicio
        </a>
      </div>
    `;

    overlay.querySelector('.access-restricted-reason').textContent = reason;

    overlay.style.zIndex = '3000';
    document.body.appendChild(overlay);
  }

  function activarBotonPDF() {
    const btnPdf = document.getElementById('btn-descargar-pdf');
    if (btnPdf) {
      btnPdf.disabled = false;
      btnPdf.removeAttribute('title');
      btnPdf.style.cursor = 'pointer';
      btnPdf.style.opacity = '1';
    }
  }

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
    // Leer grupo desde localStorage para que el check de turno en init() tenga el valor correcto
    // antes de que initShiftContext() lo asigne a través de la API.
    if (!state.userGrupo) {
      try {
        const ua = JSON.parse(localStorage.getItem('usuarioActivo') || '{}');
        state.userGrupo = localStorage.getItem('user_grupo') || ua.grupo || String(ua.id_grupo || '') || null;
      } catch (_e) {
        state.userGrupo = localStorage.getItem('user_grupo') || null;
      }
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
    if (state.isSuperAdmin) return 'w';
    const map = SECTION_ID_MAP[sectionKey];
    if (!map) return 'none';
    const ids = new Set(state.permisosIds || []);
    if (ids.has(map.w)) return 'w';
    if (ids.has(map.r)) return 'r';
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

  function setLoading(btnId, isLoading, isAudit = false) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isLoading) {
      btn.classList.add('btn-loading');
      if (isAudit) btn.classList.add('audit-spinner');
    } else {
      btn.classList.remove('btn-loading');
      btn.classList.remove('audit-spinner');
    }
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
    sectionPanels(sectionKey).forEach((panel) => {
      setElementVisible(panel, visible);
      if (visible) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });
  }

  function setSectionReadOnly(sectionKey, readOnly) {
    sectionPanels(sectionKey).forEach((panel) => {
      panel.classList.toggle('is-readonly', readOnly);
      panel.querySelectorAll('input, select, textarea, button').forEach((node) => {
        if (readOnly) {
          node.setAttribute('disabled', 'disabled');
          if (node.tagName !== 'BUTTON') node.setAttribute('readonly', 'readonly');
          if (node.tagName === 'BUTTON' && (node.className.includes('btn-add') || node.className.includes('btn-delete') || node.id.includes('btnAgregar'))) {
            node.classList.add('hidden');
            node.style.display = 'none';
          }
        } else {
          node.removeAttribute('disabled');
          node.removeAttribute('readonly');
          if (node.tagName === 'BUTTON' && (node.className.includes('btn-add') || node.className.includes('btn-delete') || node.id.includes('btnAgregar'))) {
            node.classList.remove('hidden');
            node.style.display = '';
          }
        }
      });
    });
  }

  function applyActionBarState() {
    const btnGuardar = document.getElementById('btn-guardar-borrador');
    const btnFinalizar = document.getElementById('btn-finalizar-turno');
    const btnReabrir = document.getElementById('btn-reabrir-turno');
    const btnEnviarCorreo = document.getElementById('btn-enviar-correo');

    if (btnGuardar) {
      if (state.documentBlocked || !state.canWriteAnySection) btnGuardar.setAttribute('disabled', 'disabled');
      else btnGuardar.removeAttribute('disabled');
    }

    if (btnFinalizar) {
      if (state.documentBlocked || !state.canCloseTurno) {
        btnFinalizar.setAttribute('disabled', 'disabled');
      } else {
        btnFinalizar.removeAttribute('disabled');
      }
    }

    if (btnReabrir) {
      if (state.documentBlocked && state.isSuperAdmin && state.auditModeEnabled) {
        btnReabrir.style.display = 'inline-flex';
      } else {
        btnReabrir.style.display = 'none';
      }
    }

    if (btnEnviarCorreo) {
      if (normalizeStatus(state.currentReportStatus) === 'finalizado' || normalizeStatus(state.currentReportStatus) === 'cerrado' || normalizeStatus(state.currentReportStatus) === 'validado') {
        btnEnviarCorreo.style.display = 'inline-flex';
      } else {
        btnEnviarCorreo.style.display = 'none';
      }
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
    const badge = getShiftStatusBadge();
    if (!badge) return;
    stopShiftBadgeTimer();

    const normalizedGroup = normalizeGroupValue(shiftData?.grupo || state.userGrupo);
    const graceEndsAt = shiftData?.grace_ends_at || shiftData?.graceEndsAt || null;
    const exactActive = Boolean(shiftData?.exact_active ?? shiftData?.exactActive);
    const inGrace = Boolean(shiftData?.in_grace ?? shiftData?.inGrace);

    if (inGrace && graceEndsAt) {
      const renderCountdown = () => {
        const remaining = Math.max(0, Math.ceil((new Date(graceEndsAt).getTime() - Date.now()) / 1000));
        if (remaining <= 0) {
          stopShiftBadgeTimer();
          badge.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Fuera de Turno${normalizedGroup ? ` — Grupo ${escapeAttribute(normalizedGroup)}` : ''}`;
          badge.className = 'shift-badge shift-badge--rest';
          badge.hidden = false;
          return;
        }

        badge.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> Cierre de turno en: ${formatCountdown(remaining)}`;
        badge.className = 'shift-badge shift-badge--grace';
        badge.hidden = false;
      };

      renderCountdown();
      state.shiftBadgeTimerId = window.setInterval(renderCountdown, 1000);
      return;
    }

    const msgs = {
      en_turno:      `<i class="fa-solid fa-circle-check"></i> Turno Activo — Grupo ${escapeAttribute(normalizedGroup || '')}`,
      en_descanso:   `<i class="fa-solid fa-moon"></i> En Descanso — Grupo ${escapeAttribute(normalizedGroup || '')}`,
      proximo_turno: `<i class="fa-solid fa-clock"></i> Próximo a Turno — Grupo ${escapeAttribute(normalizedGroup || '')}`,
      sin_grupo:     `<i class="fa-solid fa-circle-question"></i> Sin Grupo Asignado`
    };
    const cls = {
      en_turno:      'shift-badge--active',
      en_descanso:   'shift-badge--rest',
      proximo_turno: 'shift-badge--upcoming',
      sin_grupo:     'shift-badge--unknown'
    };
    const estado = shiftData?.estado || (exactActive ? 'en_turno' : 'sin_grupo');
    badge.innerHTML = msgs[estado]
      || `<i class="fa-solid fa-circle-question"></i> ${escapeAttribute(shiftData?.mensaje || 'Estado desconocido')}`;
    badge.className = `shift-badge ${cls[estado] || 'shift-badge--unknown'}`;
    badge.hidden = false;
  }

  function populateTurnoDropdown(activeGroups, userGrupo) {
    const normalizedUserGroup = normalizeGroupValue(userGrupo);
    const normalizedGroups = (activeGroups || []).map(normalizeGroupValue).filter(Boolean);
    const lockedGroup = normalizedUserGroup || normalizedGroups.find((group) => group === normalizedUserGroup) || '';
    setLockedTurnoValue(lockedGroup);
  }

  // Ensure a value exists as an option in a select (used when loading saved reports)
  function ensureSelectOption(selectId, value, label) {
    if (selectId === 'input-turno') {
      setLockedTurnoValue(value);
      return;
    }

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
    const shiftBadge = getShiftStatusBadge();
    if (shiftBadge) {
      shiftBadge.hidden = true;
    }

    populateTurnoDropdown([], null);
    await populatePersonalSelects([], { auditMode: true });
  }

  async function fetchExistingInformeForShift(fecha, grupo) {
    try {
      const url = `/api/informes/por-turno?fecha=${encodeURIComponent(fecha)}&grupo=${encodeURIComponent(grupo)}`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!data.existe || !data.id_informe) return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  async function openExistingInforme(reportId) {
    const params = new URLSearchParams(window.location.search);
    params.set('id', String(reportId));
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    await loadExistingReportIfNeeded();
  }

  async function checkExistingInformeForShift(fecha, grupo) {
    try {
      const data = await fetchExistingInformeForShift(fecha, grupo);
      if (!data) return;
      const continuar = confirm(
        `Ya existe un Informe para el Grupo ${grupo} el ${fecha} (estado: ${data.estado || '—'}).\n¿Desea abrirlo?`
      );
      if (continuar) {
        await openExistingInforme(data.id_informe);
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
          state.userGrupo = normalizeGroupValue(shiftData.grupo || state.userGrupo);
          state.userShiftStatus = shiftData.estado || null;
          state.userShiftContext = shiftData;
          setLockedTurnoValue(state.userGrupo);
          updateShiftStatusBadge(shiftData);
        } else {
          console.warn('[INFORME][SHIFT_API] /api/estado-turno respondió con status:', resp.status);
        }
      } catch (error) {
        console.warn('[INFORME][SHIFT_API] Error consultando /api/estado-turno:', error?.message || error);
      }
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
        } else {
          console.warn('[INFORME][SHIFT_API] /api/turnos/grupos-activos respondió con status:', resp.status);
        }
      } catch (error) {
        console.warn('[INFORME][SHIFT_API] Error consultando /api/turnos/grupos-activos:', error?.message || error);
      }
    }

    // 4. Poblar dropdown de turno con grupos activos
    populateTurnoDropdown(activeGroups, state.userGrupo);

    // 5. Poblar selects de personal filtrado
    await populatePersonalSelects(state.userGrupo ? [state.userGrupo] : activeGroups);
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
    state.canCloseTurno = state.isSuperAdmin || new Set(state.permisosIds || []).has(15);
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
          <td><input type="text" class="input-compact" name="perf_tipo[]" value="${escapeAttribute(row.tipo_roca || '')}"></td>
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
          <td><input type="text" class="input-compact" name="herr_tipo_elemento[]" value="${escapeAttribute(row.tipo_elemento || '')}"></td>
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
    activarBotonPDF();
    state.currentReportStatus = result.informe.estado || '';
    state.documentBlocked = !state.isSuperAdmin && isLockedStatus(state.currentReportStatus);

    populateInforme(result.informe, result.actividades, result.perforaciones, result.herramientas);

    if (result.informe.creado_el && !state.documentBlocked) {
      iniciarTemporizadorCierre(result.informe.creado_el);
    }
  }

  let informeCerrado = false;

  function iniciarTemporizadorCierre(fechaApertura) {
      const finTurno = new Date(new Date(fechaApertura).getTime() + 12 * 60 * 60 * 1000);
      
      const interval = setInterval(async () => {
          const ahora = new Date();
          const difMinutos = (finTurno - ahora) / 1000 / 60;

          if (difMinutos <= 10 && difMinutos > 5) {
              setStatusBanner('warning', '⚠️ Quedan menos de 10 min para el cierre automático del turno.');
          }

          if (difMinutos <= 5 && difMinutos > 0 && !informeCerrado) {
              clearInterval(interval);
              console.log('🚀 Iniciando secuencia de guardado y cierre forzado...');
              await ejecutarCierreEmergencia();
          }
      }, 60000);
  }

  async function ejecutarCierreEmergencia() {
      try {
          if (!state.currentReportId) return;
          
          const datosGenerales = buildDatosGenerales('Borrador');
          const listas = collectTableData();
          const payload = { datosGenerales, ...listas, id_informe: state.currentReportId };

          await fetch('/api/informes/temporal', { 
             method: 'POST', 
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(payload) 
          });

          const res = await fetch('/api/informes/finalizar-auto', { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id_informe: state.currentReportId }) 
          });

          if (res.ok) {
              informeCerrado = true;
              alert('⏰ Turno finalizado: El informe se ha guardado y bloqueado automáticamente.');
              window.location.reload(); 
          }
      } catch (err) {
          console.error('Error en cierre forzado:', err);
      }
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
      const tipoElemento = fila.querySelector('[name="herr_tipo_elemento[]"]')?.value || '';
      const diametro = fila.querySelector('[name="herr_diametro[]"]')?.value || '';
      const numeroSerie = fila.querySelector('[name="herr_numero_serie[]"]')?.value || '';
      const desdeMts = parseFloat(fila.querySelector('[name="herr_desde_mts[]"]')?.value);
      const hastaMts = parseFloat(fila.querySelector('[name="herr_hasta_mts[]"]')?.value);
      const detalleExtra = fila.querySelector('[name="herr_detalle_extra[]"]')?.value || '';
      if (tipoElemente || numeroSerie || Number.isFinite(desdeMts) || Number.isFinite(hastaMts) || detalleExtra) {
        herramientas.push({
          tipo_elemento: tipoElemento,
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
      turno: normalizeGroupValue(document.getElementById('input-turno')?.value || state.userGrupo || ''),
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
    
    // Validar siempre campos críticos básicos si finalizamos
    if (estadoFinal === 'Finalizado') {
      const requiredFields = [
        { key: 'fecha', name: 'Fecha del Informe', id: 'input-fecha' },
        { key: 'turno', name: 'Turno', id: 'input-turno' },
        { key: 'faena', name: 'Faena / C. Costo', id: 'input-faena' },
        { key: 'equipo', name: 'Equipo', id: 'input-equipo' },
        { key: 'operador_rut', name: 'Operador', id: 'input-operador' },
        { key: 'horometro_inicial', name: 'Horóm. Inicial', id: 'input-horometro-inicial' },
        { key: 'horometro_final', name: 'Horóm. Final', id: 'input-horometro-final' },
      ];

      const faltantes = [];

      // Limpiar errores previos
      document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

      for (const field of requiredFields) {
        if (!datosGenerales[field.key]) {
          faltantes.push(`&bull; ${field.name}`);
          const inputEl = document.getElementById(field.id);
          if (inputEl) inputEl.classList.add('input-error');
        }
      }

      if (faltantes.length > 0) {
        showErrorModal(`Por favor complete los siguientes campos obligatorios para finalizar:<br><br>${faltantes.join('<br>')}`);
        return;
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
    
    const btnId = estadoFinal === 'Finalizado' ? 'btn-confirm-finalizar' : 'btn-guardar-borrador';
    setLoading(btnId, true, state.auditModeEnabled && estadoFinal !== 'Finalizado');

    let response;
    let result;
    try {
      response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      result = await response.json().catch(() => ({}));

      if (!response.ok) {
        showErrorModal(`Error al guardar: ${result.error || 'Error desconocido'}`);
        return;
      }
    } finally {
      setLoading(btnId, false);
    }

    if (!state.currentReportId && result.id_informe) {
      state.currentReportId = Number(result.id_informe);
      activarBotonPDF();
      const params = new URLSearchParams(window.location.search);
      params.set('id', String(result.id_informe));
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }

    state.currentReportStatus = result.estado || estadoFinal;
    state.documentBlocked = !state.isSuperAdmin && isLockedStatus(state.currentReportStatus);
    applyPermissionMatrix();

    if (state.auditModeEnabled) {
      showSuccessModal('Auditoría', 'Cambios de auditoría guardados y registrados en la bitácora.', false);
    } else if (estadoFinal === 'Finalizado') {
      showSuccessModal('Turno Finalizado', 'Turno Finalizado con Éxito', true);
    } else {
      showSuccessModal('Borrador', 'Borrador guardado correctamente', false);
      // Auto cerramos después de unos segundos
      setTimeout(hideSuccessModal, 2500);
    }
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
          <td><input type="text" class="input-compact" name="herr_tipo_elemento[]"></td>
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
      if (!state.canWriteAnySection && !state.isSuperAdmin && !state.auditModeEnabled) {
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
      showFinalizeModal();
    });

    // Modal Enviar Correo
    const btnEnviarCorreo = document.getElementById('btn-enviar-correo');
    const modalCorreo = document.getElementById('modal-enviar-correo');
    const btnCloseCorreo = document.getElementById('btn-close-correo');
    const btnCancelCorreo = document.getElementById('btn-cancel-correo');
    const btnConfirmCorreo = document.getElementById('btn-confirm-correo');
    const inputCorreo = document.getElementById('input-correo-destino');
    const errorCorreo = document.getElementById('error-correo');

    if (btnEnviarCorreo) {
      btnEnviarCorreo.addEventListener('click', () => {
        if (!modalCorreo) return;
        modalCorreo.style.display = 'flex';
        if (inputCorreo) inputCorreo.value = '';
        if (errorCorreo) errorCorreo.style.display = 'none';
        if (window.bloquearScroll) window.bloquearScroll();
      });
    }

    const closeCorreoModal = () => {
      if (modalCorreo) modalCorreo.style.display = 'none';
      if (window.desbloquearScroll) window.desbloquearScroll();
    };

    if (btnCloseCorreo) btnCloseCorreo.addEventListener('click', closeCorreoModal);
    if (btnCancelCorreo) btnCancelCorreo.addEventListener('click', closeCorreoModal);

    if (btnConfirmCorreo) {
      btnConfirmCorreo.addEventListener('click', async () => {
        const email = inputCorreo.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!email || !emailRegex.test(email)) {
          errorCorreo.style.display = 'block';
          return;
        }

        errorCorreo.style.display = 'none';
        
        const originalContent = btnConfirmCorreo.innerHTML;
        btnConfirmCorreo.disabled = true;
        btnConfirmCorreo.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando y Enviando...';
        btnCancelCorreo.disabled = true;
        btnCloseCorreo.disabled = true;
        inputCorreo.disabled = true;

        try {
          const res = await fetch('/api/informes/enviar-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_informe: state.currentReportId, email })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al enviar');
          
          closeCorreoModal();
          showSuccessModal('Correo Enviado', `El informe ha sido enviado exitosamente a ${email}`, false);
        } catch (err) {
          showErrorModal(err.message || 'Error al enviar el correo.');
        } finally {
          btnConfirmCorreo.disabled = false;
          btnConfirmCorreo.innerHTML = originalContent;
          btnCancelCorreo.disabled = false;
          btnCloseCorreo.disabled = false;
          inputCorreo.disabled = false;
        }
      });
    }

    // Modales de Confirmación y Éxito
    const btnCancelFinalizar = document.getElementById('btn-cancel-finalizar');
    const btnConfirmFinalizar = document.getElementById('btn-confirm-finalizar');
    const btnSuccessOk = document.getElementById('btn-success-ok');
    const btnSuccessPdf = document.getElementById('btn-success-pdf');
    const btnErrorOk = document.getElementById('btn-error-ok');

    if (btnCancelFinalizar) btnCancelFinalizar.addEventListener('click', hideFinalizeModal);
    if (btnConfirmFinalizar) {
      btnConfirmFinalizar.addEventListener('click', async () => {
        hideFinalizeModal();
        await persistInforme('Finalizado');
      });
    }
    if (btnSuccessOk) btnSuccessOk.addEventListener('click', hideSuccessModal);
    if (btnSuccessPdf) {
      btnSuccessPdf.addEventListener('click', () => {
        hideSuccessModal();
        if (typeof generarPDF === 'function') generarPDF();
      });
    }
    if (btnErrorOk) btnErrorOk.addEventListener('click', hideErrorModal);
  }

  // --- Helpers Modales ---
  function showFinalizeModal() {
    const missing = [];
    if (!document.getElementById('input-horometro-inicial').value) missing.push('Horómetro Inicial');
    if (!document.getElementById('input-horometro-final').value) missing.push('Horómetro Final');
    
    const mts = document.getElementById('input-mts-perforados').value;
    if (mts === '' || mts === null || mts === undefined) missing.push('Metros Perforados');

    if (missing.length > 0) {
      showErrorModal(`No se puede finalizar. Faltan datos obligatorios: ${missing.join(', ')}`);
      return;
    }

    document.getElementById('modal-confirm-finalizar').style.display = 'flex';
    if (window.bloquearScroll) window.bloquearScroll();
  }

  function hideFinalizeModal() {
    document.getElementById('modal-confirm-finalizar').style.display = 'none';
    if (window.desbloquearScroll) window.desbloquearScroll();
  }

  function showErrorModal(msg) {
    document.getElementById('modal-error-message').textContent = msg;
    document.getElementById('modal-error').style.display = 'flex';
    if (window.bloquearScroll) window.bloquearScroll();
  }

  function hideErrorModal() {
    document.getElementById('modal-error').style.display = 'none';
    if (window.desbloquearScroll) window.desbloquearScroll();
  }

  function showSuccessModal(title, message, showPdfBtn = false) {
    const modal = document.getElementById('modal-success');
    if (!modal) return;
    document.getElementById('modal-success-title').textContent = title;
    document.getElementById('modal-success-message').textContent = message;
    document.getElementById('btn-success-pdf').style.display = showPdfBtn ? 'inline-flex' : 'none';
    modal.style.display = 'flex';
    if (window.bloquearScroll) window.bloquearScroll();
  }

  function hideSuccessModal() {
    const modal = document.getElementById('modal-success');
    if (modal) modal.style.display = 'none';
    if (window.desbloquearScroll) window.desbloquearScroll();
  }

  async function loadCargoPermisosIds() {
    state.permisosIds = [];
    if (!state.cargoName || state.isSuperAdmin) return;
    try {
      const res = await fetch('/api/cargos');
      if (!res.ok) return;
      const cargos = await res.json();
      const miCargo = cargos.find(c => String(c.nombre_cargo).toLowerCase() === String(state.cargoName).toLowerCase());
      if (miCargo && miCargo.id_permisos) {
        state.permisosIds = miCargo.id_permisos.map(Number);
      }
    } catch (e) {
      console.error('Error cargando permisos IDs', e);
    }
  }

  async function init() {
    refreshSessionContext();
    syncAuditModeFromURL();
    updateAuditModeBanner();

    const urlParams = new URLSearchParams(window.location.search);
    const isEditing = !!urlParams.get('id');

    addRowHandlers();
    bindActions();
    
    await loadCargoPermisosIds();

    if (state.auditModeEnabled) {
      await initAuditContext();
    } else {
      // Fecha contable + grupos activos + selects de personal
      await initShiftContext();
    }

    let reportAlreadyLoaded = false;
    let existingShiftReport = null;

    if (!state.isSuperAdmin && !state.auditModeEnabled && !isEditing) {
      const fechaInput = document.getElementById('input-fecha');
      const shiftContext = state.userShiftContext || {};
      const fecha = fechaInput?.value || '';

      if (fecha && state.userGrupo) {
        existingShiftReport = await fetchExistingInformeForShift(fecha, state.userGrupo);
      }

      const existingDraft = existingShiftReport && normalizeStatus(existingShiftReport.estado) === 'borrador'
        ? existingShiftReport
        : null;
      const exactActive = Boolean(shiftContext.exact_active ?? shiftContext.exactActive);
      const inGrace = Boolean(shiftContext.in_grace ?? shiftContext.inGrace);

      if (inGrace && existingDraft?.id_informe) {
        await openExistingInforme(existingDraft.id_informe);
        reportAlreadyLoaded = true;
      } else if (!exactActive) {
        const reason = buildAccessDeniedReason(shiftContext, inGrace);
        showRestrictedAccess(reason);
        applyPermissionMatrix();
        return;
      }
    }

    // Cargar informe si ?id= presente
    const currentParams = new URLSearchParams(window.location.search);
    if (!reportAlreadyLoaded && currentParams.get('id')) {
      try {
        await loadExistingReportIfNeeded();
      } catch (error) {
        console.error('[INFORME] Error cargando informe existente:', error);
        setStatusBanner('warning', error.message || 'No se pudo cargar el informe solicitado.');
      }
    } else if (!reportAlreadyLoaded && !state.auditModeEnabled && state.userGrupo) {
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
    },
    showErrorModal
  };
})();

window.abrirPestaña = InformeTurno.abrirPestaña;
document.addEventListener('DOMContentLoaded', () => {
  InformeTurno.init().catch((error) => {
    console.error('[INFORME] Error inicializando la vista:', error);
  });
});

