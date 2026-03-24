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
  const SHIFT_BYPASS_PERMISSION_ALIASES = [
    'editar_informes_anteriores',
    'editar_informe_anterior',
    'inf_editar_historico',
    'bypass_turno',
    'super_usuario',
    'inf_admin_historial'
  ];
  const MAX_AYUDANTES = 5;
  const AUTOSAVE_INTERVAL_MS = 2 * 60 * 1000;
  const HEARTBEAT_INTERVAL_MS = 30 * 1000;
  const SPINNER_FIELD_IDS = [
    'input-horas-trabajadas',
    'input-horometro-inicial',
    'input-horometro-final',
    'input-profundidad-inicial',
    'input-profundidad',
    'input-pulldown',
    'input-rpm',
    'input-petroleo',
    'input-lubricantes',
    'input-aceites',
    'input-otros'
  ];
  const SPINNER_FIELD_CONFIG = {
    'input-horas-trabajadas': { step: 0.5, min: 0 },
    'input-horometro-inicial': { step: 0.1, min: 0 },
    'input-horometro-final': { step: 0.1, min: 0 },
    'input-profundidad-inicial': { step: 0.01, min: 0 },
    'input-profundidad': { step: 0.01, min: 0 },
    'input-pulldown': { step: 100, min: 0 },
    'input-rpm': { step: 1, min: 0 },
    'input-petroleo': { step: 1, min: 0 },
    'input-lubricantes': { step: 1, min: 0 },
    'input-aceites': { step: 1, min: 0 },
    'input-otros': { step: 1, min: 0 }
  };

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
    userEmail: '',
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
    autosaveIntervalId: null,
    heartbeatIntervalId: null,
    helperSelectCount: 2,
    activeHelperWorkers: [],
    accessRestricted: false,
    auditModeRequested: false,
    auditModeEnabled: false,
    adminBypass: false,
    hasUnsavedChanges: false,
    suppressDirtyTracking: false,
    beforeUnloadBound: false,
    adminSelectedGroup: '',
    mathValidationErrors: {
      hrs_horometro: false,
      mts_perforados: false
    },
    mathWarningTimer: null
  };
  window.state = state;

  function getShiftStatusBadge() {
    return document.getElementById('status-badge') || document.getElementById('shift-status-badge');
  }

  function normalizeGroupValue(value) {
    return String(value || '').replace(/^grupo\s+/i, '').trim().toUpperCase();
  }

  function isTruthyFlag(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }

  function getTodayIsoLocal() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function normalizeDateInputValue(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const dmy = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    return '';
  }

  function getFolioLabelFromId(reportId) {
    const numeric = Number(reportId);
    if (Number.isFinite(numeric) && numeric > 0) {
      return `I-${String(numeric).padStart(3, '0')}`;
    }
    return 'I-001';
  }

  function getEstadoVisualLabel(status) {
    const normalized = normalizeStatus(status || '');
    if (normalized === 'finalizado' || normalized === 'validado') return 'Finalizado';
    if (normalized === 'cerrado') return 'Cerrado';
    if (normalized === 'borrador') return 'Borrador';
    return 'Borrador';
  }

  function refreshHeaderMeta() {
    const folioChip = document.getElementById('folio-chip');
    const estadoChip = document.getElementById('estado-chip');
    if (folioChip) {
      folioChip.textContent = getFolioLabelFromId(state.currentReportId);
    }
    if (estadoChip) {
      const label = getEstadoVisualLabel(state.currentReportStatus);
      estadoChip.textContent = label;
      estadoChip.classList.remove('estado-borrador', 'estado-finalizado', 'estado-cerrado');
      if (label === 'Finalizado') estadoChip.classList.add('estado-finalizado');
      else if (label === 'Cerrado') estadoChip.classList.add('estado-cerrado');
      else estadoChip.classList.add('estado-borrador');
    }
  }

  function updateObservacionesAvailability() {
    const estado = document.getElementById('observaciones-estado');
    if (!estado) return;
    const writable = !state.documentBlocked && sectionWritable('cierre');
    if (writable) {
      estado.textContent = 'Disponible para CD';
      estado.classList.remove('bloqueado');
      estado.classList.add('disponible');
    } else {
      estado.textContent = 'Bloqueado por CD';
      estado.classList.remove('disponible');
      estado.classList.add('bloqueado');
    }
  }

  function countNonEmptyRows(tbodyId) {
    const rows = Array.from(document.querySelectorAll(`#${tbodyId} tr`));
    return rows.filter((row) => {
      const values = Array.from(row.querySelectorAll('input, select, textarea'))
        .map((node) => String(node.value || '').trim())
        .filter(Boolean);
      return values.length > 0;
    }).length;
  }

  function updateResumenCards() {
    const metrosEl = document.getElementById('resumen-metros');
    const diamantesEl = document.getElementById('resumen-diamantes');
    const aditivosEl = document.getElementById('resumen-aditivos');
    if (!metrosEl && !diamantesEl && !aditivosEl) return;

    const metros = parseOptionalNumber(document.getElementById('input-mts-perforados')?.value) || 0;
    const diamantes = countNonEmptyRows('tabla-herramientas');
    const lubricantes = parseOptionalNumber(document.getElementById('input-lubricantes')?.value) || 0;
    const aceites = parseOptionalNumber(document.getElementById('input-aceites')?.value) || 0;
    const otros = parseOptionalNumber(document.getElementById('input-otros')?.value) || 0;
    const aditivos = lubricantes + aceites + otros;

    if (metrosEl) metrosEl.textContent = `${metros.toFixed(2)} m`;
    if (diamantesEl) diamantesEl.textContent = String(diamantes);
    if (aditivosEl) aditivosEl.textContent = aditivos.toFixed(2);
  }

  function ensureAdminGroupStatusBadge() {
    const row = document.querySelector('.header-iden-row');
    if (!row) return null;

    let wrapper = document.getElementById('admin-group-status-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'admin-group-status-wrapper';
      wrapper.style.cssText = 'flex-basis:100%;display:flex;justify-content:flex-end;';
      row.appendChild(wrapper);
    }

    let badge = document.getElementById('admin-group-status-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'admin-group-status-badge';
      badge.className = 'shift-badge shift-badge--unknown';
      badge.hidden = true;
      wrapper.appendChild(badge);
    }

    return badge;
  }

  async function updateAdminGroupStatusBadge(fecha, grupo) {
    if (!state.isSuperAdmin) return;
    const badge = ensureAdminGroupStatusBadge();
    if (!badge) return;

    const fechaIso = normalizeDateInputValue(fecha);
    const grupoNorm = normalizeGroupValue(grupo);
    if (!fechaIso || !grupoNorm) {
      badge.hidden = true;
      return;
    }

    try {
      const resp = await fetch(`/api/turnos/estado-grupo?fecha=${encodeURIComponent(fechaIso)}&grupo=${encodeURIComponent(grupoNorm)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      const estado = String(data.estado || '').toLowerCase();
      const jornada = String(data.jornada || 'SinJornada');
      const isHistoricalDate = fechaIso !== getTodayIsoLocal();

      // Para fechas distintas de hoy, mostrar estado histórico explícito.
      if (isHistoricalDate) {
        const jornadaHistorica = jornada && jornada !== 'SinJornada'
          ? jornada
          : (estado === 'en_turno' ? 'Día' : 'Noche');
        badge.className = 'shift-badge shift-badge--rest';
        badge.innerHTML = `<i class="fa-solid fa-lock"></i> Grupo ${grupoNorm}: ${jornadaHistorica} (Cerrado)`;
        badge.hidden = false;
        return;
      }

      if (estado === 'en_turno') {
        badge.className = 'shift-badge shift-badge--active';
        badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Grupo ${grupoNorm}: En Turno (${jornada})`;
      } else if (estado === 'descanso') {
        badge.className = 'shift-badge shift-badge--rest';
        badge.innerHTML = `<i class="fa-solid fa-moon"></i> Grupo ${grupoNorm}: En Descanso (${jornada})`;
      } else {
        badge.className = 'shift-badge shift-badge--unknown';
        badge.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Grupo ${grupoNorm}: Fuera de Jornada`;
      }
      badge.hidden = false;
    } catch (error) {
      badge.className = 'shift-badge shift-badge--unknown';
      badge.innerHTML = `<i class="fa-solid fa-circle-question"></i> Estado de grupo no disponible`;
      badge.hidden = false;
      console.warn('[ADMIN_GROUP_BADGE] Error consultando estado de grupo:', error?.message || error);
    }
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

  function stopBackgroundTimers() {
    stopShiftBadgeTimer();
    if (state.autosaveIntervalId) {
      window.clearInterval(state.autosaveIntervalId);
      state.autosaveIntervalId = null;
    }
    if (state.heartbeatIntervalId) {
      window.clearInterval(state.heartbeatIntervalId);
      state.heartbeatIntervalId = null;
    }
  }

  function setLockedTurnoValue(grupo) {
    const normalizedGroup = normalizeGroupValue(grupo);
    const hiddenInput = document.getElementById('input-turno');
    const displayInput = document.getElementById('input-turno-display');
    const adminGroupSelect = document.getElementById('input-grupo');
    if (hiddenInput) hiddenInput.value = normalizedGroup;
    if (displayInput) displayInput.value = normalizedGroup ? `Grupo ${normalizedGroup}` : 'Sin grupo asignado';
    if (adminGroupSelect && normalizedGroup && Array.from(adminGroupSelect.options).some((opt) => opt.value === normalizedGroup)) {
      adminGroupSelect.value = normalizedGroup;
    }
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

    if (!isInGrace && graceEndsAt) {
      const hora = new Date(graceEndsAt).toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      return `Tu ventana de gracia de 30 minutos terminó a las ${hora}. Los cambios quedaron bloqueados.`;
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
    state.accessRestricted = true;
    stopBackgroundTimers();
    console.warn('[DEBUG_SECURITY] Bloqueo activado por informe.js. Motivo:', reason);
    console.trace('[DEBUG_TRACE] Origen de la llamada al bloqueo:');

    const oldModals = document.querySelectorAll('#access-restricted-overlay, #shift-access-denied-overlay, [class*="access-restricted"], [class*="restricted-content"]');
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
    const btnPdf = document.getElementById('btn-exportar-pdf');
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
    state.userEmail = localStorage.getItem('user_email') || '';
    state.cargoName = localStorage.getItem('user_cargo_name') || '';
    state.permisosCargo = parseJSONArray('user_permissions_cargo');
    state.isSuperAdmin = isTruthyFlag(localStorage.getItem('user_super_admin'));
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

  async function syncUserSession() {
    const rutActual = localStorage.getItem('user_rut') || state.userRut || '';
    const isSuperAdminLocal = isTruthyFlag(localStorage.getItem('user_super_admin')) || state.isSuperAdmin;

    if (!rutActual) return;

    try {
      const resp = await fetch(`/api/auth/perfil?rut=${encodeURIComponent(rutActual)}`, {
        headers: {
          'x-user-rut': rutActual
        }
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = await resp.json();
      if (!data?.success) {
        throw new Error(data?.message || 'Respuesta inválida de /api/auth/perfil');
      }

      const user = data.user || {};
      const syncRole = String(user.userRole || data.Rol || '').trim();
      const syncRut = String(user.userRut || data.RUT || rutActual).trim();
      const syncName = String(user.userName || data.Nombre || '').trim();
      const syncEmail = String(user.userEmail || data.Correo || '').trim();
      const syncSuper = Boolean(user.isSuperAdmin ?? data.isSuperAdmin);
      const syncGrupo = String(user.grupo || '').trim();
      const syncCargo = String(user.cargo || '').trim();

      localStorage.setItem('user_role', syncRole);
      localStorage.setItem('user_rut', syncRut);
      localStorage.setItem('user_name', syncName);
      localStorage.setItem('user_email', syncEmail);
      localStorage.setItem('user_super_admin', syncSuper ? '1' : '0');
      localStorage.setItem('user_grupo', syncGrupo);
      localStorage.setItem('user_cargo_name', syncCargo);

      const usuarioActivo = JSON.parse(localStorage.getItem('usuarioActivo') || '{}');
      const usuarioSincronizado = {
        ...usuarioActivo,
        rut: syncRut,
        nombre: syncName || usuarioActivo.nombre || '',
        email: syncEmail || usuarioActivo.email || '',
        grupo: syncGrupo || usuarioActivo.grupo || '',
        cargo: syncCargo || usuarioActivo.cargo || '',
        role: syncRole || usuarioActivo.role || '',
        isSuperAdmin: syncSuper
      };
      localStorage.setItem('usuarioActivo', JSON.stringify(usuarioSincronizado));
      localStorage.removeItem('usuario');
      localStorage.setItem('usuario', JSON.stringify(usuarioSincronizado));
      console.log('[AUTH_SYNC] Cache de localStorage limpiado y actualizado.');

      state.role = syncRole;
      state.userRut = syncRut;
      state.userName = syncName;
      state.userEmail = syncEmail;
      state.isSuperAdmin = syncSuper;
      state.userGrupo = syncGrupo || state.userGrupo;
      state.cargoName = syncCargo || state.cargoName;

      // Refresco visual inmediato de sesión en UI (navbar/modal)
      const userNameSpan = document.getElementById('user_name_span');
      if (userNameSpan && state.userName) {
        userNameSpan.textContent = state.userName;
      }
      const btnConfirmCorreo = document.getElementById('btn-confirm-correo');
      if (btnConfirmCorreo) {
        btnConfirmCorreo.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Enviar a mi correo (${state.userEmail || 'sin correo en sesión'})`;
      }

      refreshSessionContext();
      console.log(`[AUTH_SYNC] Datos sincronizados desde DB para ${state.userName || 'Usuario'}. Correo: ${state.userEmail || '-'}.`);
      console.log('[AUTH_SYNC] Sincronización exitosa. Procediendo con vista de Admin.');
    } catch (error) {
      if (isSuperAdminLocal) {
        console.warn('[AUTH_SYNC] Sincronización falló para Super Admin. Se continúa con datos locales para priorizar acceso.', error?.message || error);
        return;
      }
      console.warn('[AUTH_SYNC] No se pudo sincronizar sesión. Se usará contexto local.', error?.message || error);
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

  function hasElevatedAccess() {
    return state.isSuperAdmin || normalizePerm(state.role) === 'admin';
  }

  function hasShiftHeartbeatBypassPermission() {
    if (state.isSuperAdmin) return true;
    const permisos = cargoPermSet();
    if (permisos.size === 0) return false;
    return SHIFT_BYPASS_PERMISSION_ALIASES.some((alias) => permisos.has(normalizePerm(alias)));
  }

  function shouldBypassShiftHeartbeat() {
    return state.adminBypass || hasElevatedAccess() || hasShiftHeartbeatBypassPermission();
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

  function hasNegativeMathError() {
    return Object.values(state.mathValidationErrors || {}).some(Boolean);
  }

  function showMathWarningToast(message) {
    let toast = document.getElementById('math-warning-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'math-warning-toast';
      toast.className = 'math-warning-toast';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('show');

    if (state.mathWarningTimer) {
      window.clearTimeout(state.mathWarningTimer);
    }

    state.mathWarningTimer = window.setTimeout(() => {
      toast.classList.remove('show');
      state.mathWarningTimer = null;
    }, 2600);
  }

  function parseOptionalNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function normalizeNumericOutput(value) {
    return Number((value || 0).toFixed(2));
  }

  function setMathErrorState(campo, finalInput, hasError) {
    const hadError = Boolean(state.mathValidationErrors[campo]);

    if (finalInput) {
      finalInput.classList.toggle('input-error', hasError);
    }

    state.mathValidationErrors[campo] = hasError;
    if (hasError) {
      console.log(`[VALIDACION] Error detectado: Valor negativo en ${campo}. Bloqueando envío.`);
      if (!hadError) {
        showMathWarningToast('⚠️ El valor final no puede ser menor al inicial');
      }
    }
  }

  function computeFieldDifference(config) {
    const { campo, initialId, finalId, resultId } = config;
    const initialInput = document.getElementById(initialId);
    const finalInput = document.getElementById(finalId);
    const resultInput = document.getElementById(resultId);
    if (!initialInput || !finalInput || !resultInput) return;

    const initialValue = parseOptionalNumber(initialInput.value);
    const finalValue = parseOptionalNumber(finalInput.value);

    if (initialValue === null || finalValue === null) {
      resultInput.value = '';
      setMathErrorState(campo, finalInput, false);
      return;
    }

    const rawDiff = finalValue - initialValue;
    const diff = normalizeNumericOutput(rawDiff);
    resultInput.value = String(diff);
    console.log(`[MATH_ENGINE] Cálculo actualizado: ${campo} = ${diff}.`);

    setMathErrorState(campo, finalInput, diff < 0);
  }

  function runLiveMathEngine() {
    computeFieldDifference({
      campo: 'hrs_horometro',
      initialId: 'input-horometro-inicial',
      finalId: 'input-horometro-final',
      resultId: 'input-horometro-hrs'
    });

    computeFieldDifference({
      campo: 'mts_perforados',
      initialId: 'input-profundidad-inicial',
      finalId: 'input-profundidad',
      resultId: 'input-mts-perforados'
    });

    applyActionBarState();
    updateResumenCards();
  }

  function setAutoCalculatedField(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.setAttribute('readonly', 'readonly');
    input.classList.add('input-auto-calculated');
  }

  function setupNumericSpinners() {
    SPINNER_FIELD_IDS.forEach((fieldId) => {
      const input = document.getElementById(fieldId);
      if (!input || input.dataset.spinnerReady === '1') return;

      const config = SPINNER_FIELD_CONFIG[fieldId] || {};
      if (Number.isFinite(Number(config.step))) input.step = String(config.step);
      if (Number.isFinite(Number(config.min))) input.min = String(config.min);
      if (Number.isFinite(Number(config.max))) input.max = String(config.max);

      const parent = input.parentElement;
      if (!parent) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'numeric-spinner';

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'spinner-btn spinner-btn-minus';
      minusBtn.setAttribute('aria-label', `Disminuir ${fieldId}`);
      minusBtn.textContent = '-';

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'spinner-btn spinner-btn-plus';
      plusBtn.setAttribute('aria-label', `Aumentar ${fieldId}`);
      plusBtn.textContent = '+';

      parent.insertBefore(wrapper, input);
      wrapper.appendChild(minusBtn);
      wrapper.appendChild(input);
      wrapper.appendChild(plusBtn);

      input.dataset.spinnerReady = '1';
      input.classList.add('numeric-spinner-input');

      const changeByStep = (delta) => {
        const step = parseOptionalNumber(input.step) || 1;
        const current = parseOptionalNumber(input.value) ?? 0;
        const min = parseOptionalNumber(input.min);
        const max = parseOptionalNumber(input.max);
        let next = normalizeNumericOutput(current + (step * delta));

        if (min !== null) next = Math.max(min, next);
        if (max !== null) next = Math.min(max, next);

        input.value = String(next);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };

      minusBtn.addEventListener('click', () => changeByStep(-1));
      plusBtn.addEventListener('click', () => changeByStep(1));
    });
  }

  function initializeMathEngine() {
    setAutoCalculatedField('input-horometro-hrs');
    setAutoCalculatedField('input-mts-perforados');
    setupNumericSpinners();
    runLiveMathEngine();
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

  function getFinalizeRequiredFields() {
    return [
      { id: 'input-horometro-inicial', name: 'Horóm. Inicial' },
      { id: 'input-horometro-final', name: 'Horóm. Final' },
      { id: 'input-faena', name: 'Faena / C. Costo' },
      { id: 'input-lugar', name: 'Lugar' },
      { id: 'input-equipo', name: 'Equipo' },
      { id: 'input-operador', name: 'Responsable de Turno' },
      { id: 'input-pozo-num', name: 'Pozo N°' }
    ];
  }

  function validateFinalizeRequirements(markInvalid = false) {
    const missing = [];
    getFinalizeRequiredFields().forEach((field) => {
      const input = document.getElementById(field.id);
      const value = String(input?.value || '').trim();
      if (!value) {
        missing.push(field.name);
        if (markInvalid && input) input.classList.add('input-error');
      } else if (input) {
        input.classList.remove('input-error');
      }
    });

    return {
      isValid: missing.length === 0,
      missing
    };
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
          if (!node.classList.contains('input-auto-calculated')) {
            node.removeAttribute('readonly');
          }
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

    if (btnGuardar) {
      if (state.isSuperAdmin) btnGuardar.removeAttribute('disabled');
      else if (state.documentBlocked || !state.canWriteAnySection) btnGuardar.setAttribute('disabled', 'disabled');
      else btnGuardar.removeAttribute('disabled');
    }

    if (btnFinalizar) {
      if (state.isSuperAdmin) {
        btnFinalizar.removeAttribute('disabled');
        // Cambiar texto si está Finalizado y es Super Admin
        const isFinalizado = normalizeStatus(state.currentReportStatus) === 'finalizado';
        const esCerrado = normalizeStatus(state.currentReportStatus) === 'cerrado';
        if (isFinalizado || esCerrado) {
          btnFinalizar.innerHTML = '<i class="fa-solid fa-pencil"></i> Actualizar Informe Cerrado';
          btnFinalizar.title = 'Como Administrador, puedes actualizar un informe finalizado';
        } else {
          btnFinalizar.innerHTML = '<i class="fa-solid fa-check"></i> Finalizar Turno';
          btnFinalizar.title = 'Finalizar el informe de turno';
        }
      } else {
        const finalizeReady = validateFinalizeRequirements(false).isValid;
        if (state.documentBlocked || !state.canCloseTurno || !finalizeReady || state.accessRestricted || hasNegativeMathError()) {
          btnFinalizar.setAttribute('disabled', 'disabled');
        } else {
          btnFinalizar.removeAttribute('disabled');
        }
      }
    }

    if (btnReabrir) {
      if (state.documentBlocked && state.isSuperAdmin && state.auditModeEnabled) {
        btnReabrir.style.display = 'inline-flex';
      } else {
        btnReabrir.style.display = 'none';
      }
    }

    refreshHeaderMeta();
    updateResumenCards();
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

  function getPersonnelSelects() {
    const selects = [];
    const operador = document.getElementById('input-operador');
    if (operador && operador.tagName === 'SELECT') selects.push(operador);

    for (let index = 1; index <= state.helperSelectCount; index += 1) {
      const helper = document.getElementById(`input-ayudante-${index}`);
      if (helper && helper.tagName === 'SELECT') selects.push(helper);
    }

    return selects;
  }

  function refreshWorkerLists() {
    const selects = getPersonnelSelects();
    const selectedByField = new Map();
    const occupied = new Set();

    selects.forEach((select) => {
      const selected = String(select.value || '').trim();
      if (selected) {
        selectedByField.set(select.id, selected);
        occupied.add(selected);
      }
    });

    const operadorRut = String(document.getElementById('input-operador')?.value || '').trim();
    const blockedLogged = new Set();

    selects.forEach((select) => {
      const currentValue = String(select.value || '').trim();
      const isHelper = select.id.startsWith('input-ayudante-');

      Array.from(select.options).forEach((option) => {
        const rut = String(option.value || '').trim();
        if (!rut) {
          option.disabled = false;
          return;
        }

        let shouldDisable = occupied.has(rut) && rut !== currentValue;
        if (isHelper && operadorRut && rut === operadorRut && rut !== currentValue) {
          shouldDisable = true;
        }

        option.disabled = shouldDisable;

        if (shouldDisable && !blockedLogged.has(rut)) {
          blockedLogged.add(rut);
          console.log(`[VALIDACION_PERSONAL] Trabajador ${rut} bloqueado en el resto de la lista.`);
        }
      });
    });
  }

  function removeExtraHelper(helperIndex) {
    if (helperIndex < 3 || helperIndex > state.helperSelectCount) return;

    const snapshot = {};
    for (let index = 1; index <= state.helperSelectCount; index += 1) {
      snapshot[index] = document.getElementById(`input-ayudante-${index}`)?.value || '';
    }

    for (let index = helperIndex; index < state.helperSelectCount; index += 1) {
      snapshot[index] = snapshot[index + 1] || '';
    }

    snapshot[state.helperSelectCount] = '';
    state.helperSelectCount = Math.max(2, state.helperSelectCount - 1);
    renderExtraAyudanteFields();

    for (let index = 1; index <= state.helperSelectCount; index += 1) {
      const select = document.getElementById(`input-ayudante-${index}`);
      const value = snapshot[index] || '';
      if (select) {
        const exists = Array.from(select.options).some((option) => option.value === value);
        if (value && !exists) ensureSelectOption(`input-ayudante-${index}`, value, value);
        select.value = value;
      }
    }

    console.log(`[DRAFT_ENGINE] Ayudante ${helperIndex} eliminado del informe`);
    state.hasUnsavedChanges = true;
    refreshWorkerLists();
    applyActionBarState();
  }

  function renderExtraAyudanteFields() {
    const container = document.getElementById('extra-ayudantes-container');
    const addButton = document.getElementById('btn-add-ayudante');
    if (!container) return;

    container.innerHTML = '';
    for (let index = 3; index <= state.helperSelectCount; index += 1) {
      const wrapper = document.createElement('div');
      wrapper.className = 'input-group';
      wrapper.dataset.helperIndex = String(index);
      wrapper.innerHTML = `
        <label>Ayudante ${index}</label>
        <div class="helper-inline-row">
          <select id="input-ayudante-${index}" class="modern-input helper-select-inline">
            <option value="">— Ninguno —</option>
          </select>
          <button type="button" class="btn-inline-control btn-remove-helper" data-helper-index="${index}" title="Quitar ayudante ${index}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `;
      container.appendChild(wrapper);
    }

    if (addButton) {
      addButton.disabled = state.helperSelectCount >= MAX_AYUDANTES;
      addButton.style.opacity = state.helperSelectCount >= MAX_AYUDANTES ? '0.6' : '1';
      addButton.style.cursor = state.helperSelectCount >= MAX_AYUDANTES ? 'not-allowed' : 'pointer';
    }

    syncAyudanteSelects();
    refreshWorkerLists();
  }

  function syncAyudanteSelects() {
    const workers = state.activeHelperWorkers || [];
    for (let index = 1; index <= state.helperSelectCount; index += 1) {
      const select = document.getElementById(`input-ayudante-${index}`);
      if (select && select.tagName === 'SELECT') {
        buildSelectOptions(select, workers, '— Ninguno —');
      }
    }
    refreshWorkerLists();
  }

  function collectAyudantesData() {
    const ayudantes = {};
    for (let index = 1; index <= MAX_AYUDANTES; index += 1) {
      const isVisible = index <= state.helperSelectCount;
      const value = isVisible ? (document.getElementById(`input-ayudante-${index}`)?.value || '') : '';
      ayudantes[`ayudante_${index}`] = value || null;
    }
    return ayudantes;
  }

  function detectGrupoActivo(activeGroups) {
    return normalizeGroupValue(
      state.userShiftContext?.grupo
      || state.userGrupo
      || (Array.isArray(activeGroups) && activeGroups.length > 0 ? activeGroups[0] : '')
    );
  }

  async function populatePersonalSelects(activeGroups, options = {}) {
    const auditMode = Boolean(options.auditMode);
    let trabajadores = [];
    let responsables = [];
    const grupoDetectado = detectGrupoActivo(activeGroups);

    try {
      console.log('[DEBUG_WORKERS] Cargando responsables para el turno:', grupoDetectado);
      const resp = await fetch('/api/trabajadores');
      if (resp.ok) {
        trabajadores = await resp.json();
        console.log('[DEBUG_WORKERS] Lista recibida:', trabajadores);
      }
    } catch (_) { return; }

    if (auditMode) {
      responsables = trabajadores.filter(isOperadorCargo);
    } else if (grupoDetectado) {
      try {
        const respResponsables = await fetch(`/api/trabajadores/responsables?grupo=${encodeURIComponent(grupoDetectado)}`);
        if (respResponsables.ok) {
          responsables = await respResponsables.json();
        }
      } catch (_error) {
        responsables = [];
      }
    }

    console.group('[DEBUG_RESPONSABLES]');
    console.log('Filtrando por Grupo:', grupoDetectado);
    console.log('Trabajadores recibidos del servidor:', responsables);
    console.groupEnd();

    const selResp = document.getElementById('input-operador');
    if (selResp && selResp.tagName === 'SELECT') {
      buildSelectOptions(selResp, responsables, '— Seleccionar Responsable —');
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
    state.activeHelperWorkers = ayudantes;
    syncAyudanteSelects();
  }

  async function initAuditContext() {
    const shiftBadge = getShiftStatusBadge();
    if (shiftBadge) {
      shiftBadge.hidden = true;
    }

    populateTurnoDropdown([], null);
    await populatePersonalSelects([], { auditMode: true });
  }

  function applyAdminAccessVisuals() {
    const hiddenTurno = document.getElementById('input-turno');
    const displayTurno = document.getElementById('input-turno-display');
    const badge = getShiftStatusBadge();

    if (hiddenTurno && !hiddenTurno.value && state.userGrupo) {
      hiddenTurno.value = normalizeGroupValue(state.userGrupo);
    }
    if (displayTurno) {
      displayTurno.value = 'Acceso Total';
    }
    if (badge) {
      badge.hidden = false;
      badge.className = 'shift-badge shift-badge--unknown';
      badge.innerHTML = '<i class="fa-solid fa-user-shield"></i> Modo Administrador - Acceso Total';
    }

    ensureAdminGroupStatusBadge();
  }

  function clearInformeForGroupChange(selectedGroup, selectedDate = '') {
    state.currentReportId = null;
    state.currentReportStatus = '';
    state.documentBlocked = false;
    refreshHeaderMeta();

    const fechaPreservada = normalizeDateInputValue(selectedDate)
      || normalizeDateInputValue(document.getElementById('input-fecha')?.value)
      || getTodayIsoLocal();

    const params = new URLSearchParams(window.location.search);
    params.delete('id');
    window.history.replaceState({}, '', params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname);

    populateInforme({}, [], [], [], { preserveDate: true, forcedDate: fechaPreservada });
    setLockedTurnoValue(selectedGroup);
  }

  async function fetchInformeForAdminView(fecha, grupo) {
    if (!fecha || !grupo) {
      clearInformeForGroupChange(grupo, fecha);
      return;
    }

    clearInformeForGroupChange(grupo, fecha);
    await populatePersonalSelects([grupo]);

    const existing = await fetchExistingInformeForShift(fecha, grupo);
    if (existing?.id_informe) {
      await openExistingInforme(existing.id_informe);
      return;
    }

    applyPermissionMatrix();
    runLiveMathEngine();
  }

  async function setupAdminGroupSelector() {
    if (!state.isSuperAdmin) return;

    const displayTurno = document.getElementById('input-turno-display');
    if (!displayTurno) return;

    let groupSelect = document.getElementById('input-grupo');
    if (!groupSelect) {
      groupSelect = document.createElement('select');
      groupSelect.id = 'input-grupo';
      groupSelect.className = 'modern-input';

      // En modo admin se muestran todos los grupos base, no solo activos del día.
      let allGroups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'];
      try {
        const fechaParam = document.getElementById('input-fecha')?.value 
          || getTodayIsoLocal();
        const resp = await fetch(`/api/turnos/grupos-activos?fecha=${encodeURIComponent(fechaParam)}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.grupos && Array.isArray(data.grupos)) {
            allGroups = [...new Set([...allGroups, ...data.grupos.map(normalizeGroupValue)])].sort();
            console.log('[ADMIN_SELECTOR] Grupos disponibles para ' + fechaParam + ':', allGroups);
          }
        }
      } catch (error) {
        console.warn('[ADMIN_SELECTOR] Error obteniendo grupos activos, usando catálogo completo:', error?.message);
      }
      
      allGroups.forEach((group) => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = `Grupo ${group}`;
        groupSelect.appendChild(option);
      });
      displayTurno.replaceWith(groupSelect);
    }

    const initialGroup = normalizeGroupValue(
      state.adminSelectedGroup
      || document.getElementById('input-turno')?.value
      || state.userGrupo
      || 'A'
    );

    // Validar que el grupo inicial existe en las opciones disponibles
    const availableOptions = Array.from(groupSelect.options).map(opt => opt.value);
    groupSelect.value = availableOptions.includes(initialGroup) ? initialGroup : (availableOptions[0] || 'A');
    state.adminSelectedGroup = groupSelect.value;
    setLockedTurnoValue(groupSelect.value);
    await updateAdminGroupStatusBadge(document.getElementById('input-fecha')?.value || getTodayIsoLocal(), groupSelect.value);

    groupSelect.onchange = async () => {
      const seleccionado = normalizeGroupValue(groupSelect.value) || 'A';
      state.adminSelectedGroup = seleccionado;
      setLockedTurnoValue(seleccionado);
      console.log('[ADMIN_ACTION] Cambiando vista al Grupo: ' + seleccionado);
      const fecha = document.getElementById('input-fecha')?.value || '';
      await fetchInformeForAdminView(fecha, seleccionado);
      await updateAdminGroupStatusBadge(fecha, seleccionado);
    };
  }

  async function loadInformeFull() {
    state.adminBypass = true;

    const fechaInput = document.getElementById('input-fecha');
    if (fechaInput) {
      const fechaInicial = normalizeDateInputValue(fechaInput.value)
        || normalizeDateInputValue(window.getShiftDateISO ? window.getShiftDateISO() : '')
        || getTodayIsoLocal();
      fechaInput.value = fechaInicial;
    }

    applyAdminAccessVisuals();

    if (state.isSuperAdmin) {
      // --- Desbloquear input de fecha para navegación histórica ---
      if (fechaInput) {
        fechaInput.removeAttribute('readonly');
        fechaInput.removeAttribute('disabled');
        fechaInput.removeAttribute('max');
        fechaInput.removeAttribute('aria-readonly');
        fechaInput.classList.remove('input-readonly');
        console.log('[ADMIN_NAVIGATION] Calendario desbloqueado para Super Admin.');

        // Flechas de navegación
        const btnPrev = document.getElementById('btn-fecha-prev');
        const btnNext = document.getElementById('btn-fecha-next');
        if (btnPrev) btnPrev.style.display = 'flex';
        if (btnNext) btnNext.style.display = 'flex';

        const navigateFecha = async (deltaDays) => {
          const current = fechaInput.value ? new Date(fechaInput.value + 'T12:00:00') : new Date();
          current.setDate(current.getDate() + deltaDays);
          fechaInput.value = current.toISOString().split('T')[0];
          const grupoNav = normalizeGroupValue(state.adminSelectedGroup || document.getElementById('input-grupo')?.value || 'A');
          console.log(`[ADMIN_NAVIGATION] Buscando registros para la fecha: ${fechaInput.value}.`);
          await fetchInformeForAdminView(fechaInput.value, grupoNav);
          await updateAdminGroupStatusBadge(fechaInput.value, grupoNav);
        };

        if (btnPrev && !btnPrev.dataset.navReady) {
          btnPrev.dataset.navReady = '1';
          btnPrev.addEventListener('click', () => navigateFecha(-1));
        }
        if (btnNext && !btnNext.dataset.navReady) {
          btnNext.dataset.navReady = '1';
          btnNext.addEventListener('click', () => navigateFecha(1));
        }

        // onchange para saltar directo a una fecha del calendario
        if (!fechaInput.dataset.navChangeReady) {
          fechaInput.dataset.navChangeReady = '1';
          fechaInput.addEventListener('change', async () => {
            const nuevaFecha = normalizeDateInputValue(fechaInput.value) || getTodayIsoLocal();
            fechaInput.value = nuevaFecha;
            if (!nuevaFecha) return;
            const grupoActual = normalizeGroupValue(state.adminSelectedGroup || document.getElementById('input-grupo')?.value || 'A');
            console.log(`[ADMIN_NAVIGATION] Buscando registros para la fecha: ${nuevaFecha}.`);
            await fetchInformeForAdminView(nuevaFecha, grupoActual);
            await updateAdminGroupStatusBadge(nuevaFecha, grupoActual);
          });
        }
      }

      await setupAdminGroupSelector();
      const selectedGroup = normalizeGroupValue(state.adminSelectedGroup || document.getElementById('input-grupo')?.value || 'A');
      state.adminSelectedGroup = selectedGroup;

      const params = new URLSearchParams(window.location.search);
      if (params.get('id')) {
        try {
          await loadExistingReportIfNeeded();
          setLockedTurnoValue(document.getElementById('input-turno')?.value || selectedGroup);
        } catch (error) {
          console.error('[INFORME] Error cargando informe existente en modo admin:', error);
          setStatusBanner('warning', error.message || 'No se pudo cargar el informe solicitado.');
        }
      } else {
        await fetchInformeForAdminView(fechaInput?.value || '', selectedGroup);
      }
    } else {
      await populatePersonalSelects([], { auditMode: true });
    }

    applyPermissionMatrix();
    runLiveMathEngine();
    startAutosaveCycle();
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

  async function fetchDraftForCurrentShift(fecha, grupo, rut) {
    try {
      const url = `/api/informes/por-turno?fecha=${encodeURIComponent(fecha)}&grupo=${encodeURIComponent(grupo)}&rut=${encodeURIComponent(rut)}&estado=Borrador`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!data.existe || !data.id_informe) return null;
      console.log('[DRAFT_ENGINE] Borrador detectado y cargado automáticamente.');
      return data;
    } catch (_error) {
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
      if (normalizeStatus(data.estado) === 'borrador') {
        await openExistingInforme(data.id_informe);
        return;
      }
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
    if (fechaInput) {
      const fechaInicial = normalizeDateInputValue(fechaInput.value)
        || normalizeDateInputValue(window.getShiftDateISO ? window.getShiftDateISO() : '')
        || getTodayIsoLocal();
      fechaInput.value = fechaInicial;
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
          if (resp.status === 404 && hasElevatedAccess()) {
            state.adminBypass = true;
            applyAdminAccessVisuals();
            console.log('[SECURITY] Acceso concedido por privilegios de Super Admin.');
            console.log('[AUTH_DEBUG] Usuario Juan Sanhueza detectado como Admin. Omitiendo restricciones de tiempo real.');
          }
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

  async function runShiftHeartbeat() {
    if (!state.userRut || state.auditModeEnabled || state.accessRestricted || state.isSuperAdmin || shouldBypassShiftHeartbeat()) return;

    try {
      const previousShiftContext = state.userShiftContext;
      const resp = await fetch(`/api/estado-turno/${encodeURIComponent(state.userRut)}`);
      if (!resp.ok) return;

      const shiftData = await resp.json();
      state.userShiftContext = shiftData;
      state.userShiftStatus = shiftData.estado || null;
      state.userGrupo = normalizeGroupValue(shiftData.grupo || state.userGrupo);
      updateShiftStatusBadge(shiftData);

      const inGrace = Boolean(shiftData.in_grace ?? shiftData.inGrace);
      const exactActive = Boolean(shiftData.exact_active ?? shiftData.exactActive);
      const secondsRemaining = Number(shiftData.seconds_remaining ?? shiftData.secondsRemaining ?? 0);

      if (inGrace && secondsRemaining <= 300 && !state.documentBlocked) {
        setStatusBanner('warning', '⚠️ Atención: Quedan 5 min para el cierre automático del sistema.');
      } else if (!state.documentBlocked) {
        updateStatusBanner();
      }

      if (!exactActive && !inGrace) {
        if (state.currentReportId && normalizeStatus(state.currentReportStatus) === 'borrador') {
          try {
            const autoCloseResp = await fetch('/api/informes/auto-cerrar-expirado', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id_informe: state.currentReportId,
                rut_operador: state.userRut
              })
            });

            const autoCloseData = await autoCloseResp.json().catch(() => ({}));
            if (autoCloseResp.ok && autoCloseData.auto_closed) {
              state.currentReportStatus = autoCloseData.estado || 'Finalizado';
              state.documentBlocked = !state.isSuperAdmin && isLockedStatus(state.currentReportStatus);
              applyPermissionMatrix();
              console.log('[AUTO_CLOSE] Borrador auto-cerrado al finalizar ventana de gracia.');
            }
          } catch (autoCloseError) {
            console.warn('[AUTO_CLOSE] No se pudo confirmar auto-cierre:', autoCloseError?.message || autoCloseError);
          }
        }

        const expiredContext = previousShiftContext?.grace_ends_at
          ? { ...shiftData, grace_ends_at: previousShiftContext.grace_ends_at }
          : shiftData;
        showRestrictedAccess(buildAccessDeniedReason(expiredContext, false));
      }
    } catch (error) {
      console.warn('[INFORME][HEARTBEAT] Error consultando estado-turno:', error?.message || error);
    }
  }

  function startHeartbeatCycle() {
    if (state.auditModeEnabled || state.accessRestricted || state.isSuperAdmin || shouldBypassShiftHeartbeat()) {
      if (state.heartbeatIntervalId) {
        window.clearInterval(state.heartbeatIntervalId);
        state.heartbeatIntervalId = null;
      }
      return;
    }
    if (state.heartbeatIntervalId) window.clearInterval(state.heartbeatIntervalId);
    state.heartbeatIntervalId = window.setInterval(runShiftHeartbeat, HEARTBEAT_INTERVAL_MS);
  }

  function startAutosaveCycle() {
    if (state.auditModeEnabled || state.accessRestricted) return;
    if (state.autosaveIntervalId) window.clearInterval(state.autosaveIntervalId);
    state.autosaveIntervalId = window.setInterval(async () => {
      if (state.documentBlocked || !state.canWriteAnySection || state.accessRestricted) return;

      // Evita degradar estados cerrados por autosave (ej. Finalizado -> Borrador).
      const currentStatus = String(state.currentReportStatus || '').trim();
      const targetStatus = isLockedStatus(currentStatus) ? currentStatus : 'Borrador';
      await persistInforme(targetStatus, { silent: true, autoSave: true });
    }, AUTOSAVE_INTERVAL_MS);
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
    updateObservacionesAvailability();
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

  function populateInforme(informe = {}, actividades = [], perforaciones = [], herramientas = [], options = {}) {
    const { preserveDate = false, forcedDate = '' } = options;
    state.suppressDirtyTracking = true;
    const fechaInput = document.getElementById('input-fecha');
    const fechaActual = normalizeDateInputValue(fechaInput?.value);
    const fechaInforme = informe.fecha ? String(informe.fecha).split('T')[0] : '';

    if (fechaInput) {
      if (fechaInforme) {
        fechaInput.value = fechaInforme;
      } else if (preserveDate) {
        fechaInput.value = normalizeDateInputValue(forcedDate) || fechaActual || getTodayIsoLocal();
      } else {
        fechaInput.value = '';
      }
    }

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
    const maxVisibleHelpers = [3, 4, 5].reduce((count, index) => (informe[`ayudante_${index}`] ? index : count), 2);
    state.helperSelectCount = Math.max(2, maxVisibleHelpers);
    renderExtraAyudanteFields();
    [3, 4, 5].forEach((index) => {
      ensureSelectOption(`input-ayudante-${index}`, informe[`ayudante_${index}`] || '', informe[`ayudante_${index}`] || '');
    });
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
    runLiveMathEngine();
    state.suppressDirtyTracking = false;
    state.hasUnsavedChanges = false;
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
    refreshHeaderMeta();

    populateInforme(result.informe, result.actividades, result.perforaciones, result.herramientas);

    if (result.informe.creado_el && !state.documentBlocked) {
      iniciarTemporizadorCierre(result.informe.creado_el);
    }
  }

  let informeCerrado = false;

  function iniciarTemporizadorCierre(fechaApertura) {
      return fechaApertura;
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
    const ayudantes = collectAyudantesData();
    return {
      fecha: document.getElementById('input-fecha')?.value || '',
      turno: normalizeGroupValue(document.getElementById('input-turno')?.value || state.userGrupo || ''),
      horas_trabajadas: parseFloat(document.getElementById('input-horas-trabajadas')?.value) || null,
      faena: document.getElementById('input-faena')?.value || '',
      lugar: document.getElementById('input-lugar')?.value || '',
      equipo: document.getElementById('input-equipo')?.value || '',
      operador_rut: operadorVal,
      ...ayudantes,
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

  async function persistInforme(estadoFinal, options = {}) {
    const { silent = false, autoSave = false } = options;

    if (autoSave && normalizeStatus(estadoFinal) === 'borrador' && isLockedStatus(state.currentReportStatus)) {
      estadoFinal = state.currentReportStatus;
    }

    if (state.documentBlocked || state.accessRestricted) {
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
      if (hasNegativeMathError()) {
        showErrorModal('No se puede finalizar mientras existan calculos automaticos con valor negativo.');
        return;
      }

      document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

      const validation = validateFinalizeRequirements(true);
      if (!validation.isValid) {
        showErrorModal(`Por favor complete los siguientes campos obligatorios para finalizar: ${validation.missing.join(', ')}`);
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

    if (state.isSuperAdmin && state.currentReportId) {
      payload.forceUpdate = true;
    }

    const method = state.currentReportId ? 'PUT' : 'POST';
    const url = state.currentReportId ? `/api/informes/${state.currentReportId}` : '/api/informes';
    
    const btnId = estadoFinal === 'Finalizado' ? 'btn-confirm-finalizar' : 'btn-guardar-borrador';
    setLoading(btnId, true, state.auditModeEnabled && estadoFinal !== 'Finalizado');

    let response;
    let result;
    try {
      const fetchHeaders = {
        'Content-Type': 'application/json'
      };

      // Agregar headers de Super Admin si aplica
      if (state.isSuperAdmin) {
        fetchHeaders['isSuperAdmin'] = 'true';
        if (state.userRut) {
          fetchHeaders['x-admin-rut'] = state.userRut;
        }
      }

      // Agregar flags de Super Admin al payload
      if (state.isSuperAdmin) {
        payload.isSuperAdmin = true;
        payload.admin_rut = state.userRut || '';
      }

      response = await fetch(url, {
        method,
        headers: fetchHeaders,
        body: JSON.stringify(payload)
      });
      result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 403) {
          showErrorModal('Error: Tiempo de turno expirado. Los cambios no se guardaron.');
          return;
        }
        showErrorModal(`Error al guardar: ${result.error || 'Error desconocido'}`);
        return;
      }

      state.hasUnsavedChanges = false;
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
    refreshHeaderMeta();
    applyPermissionMatrix();

    if (state.auditModeEnabled) {
      showSuccessModal('Auditoría', 'Cambios de auditoría guardados y registrados en la bitácora.', false);
    } else if (estadoFinal === 'Finalizado') {
      showSuccessModal('Turno Finalizado', 'Turno Finalizado con Éxito', true);
    } else if (!silent) {
      showSuccessModal('Borrador', 'Borrador guardado correctamente', false);
      setTimeout(hideSuccessModal, 2500);
    } else if (autoSave) {
      console.log('[DRAFT_ENGINE] Borrador guardado automáticamente.');
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
      state.hasUnsavedChanges = true;
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
      state.hasUnsavedChanges = true;
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
      state.hasUnsavedChanges = true;
      applyPermissionMatrix();
    });

    ['lista-actividades', 'tabla-perforacion', 'tabla-herramientas'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.btn-delete');
        if (!btn || btn.disabled) return;
        ev.preventDefault();
        btn.closest('tr')?.remove();
        state.hasUnsavedChanges = true;
        updateResumenCards();
      });
    });
  }

  function bindActions() {
    document.getElementById('extra-ayudantes-container')?.addEventListener('click', (event) => {
      const removeBtn = event.target.closest('.btn-remove-helper');
      if (!removeBtn) return;
      event.preventDefault();
      const helperIndex = parseInt(removeBtn.getAttribute('data-helper-index') || '', 10);
      if (Number.isInteger(helperIndex)) {
        removeExtraHelper(helperIndex);
      }
    });

    document.getElementById('btn-add-ayudante')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (state.helperSelectCount >= MAX_AYUDANTES) return;
      state.helperSelectCount += 1;
      renderExtraAyudanteFields();
      state.hasUnsavedChanges = true;
      applyActionBarState();
    });

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

    document.addEventListener('input', (event) => {
      if (event.target.closest('.informe-container')) {
        if (!state.suppressDirtyTracking) {
          state.hasUnsavedChanges = true;
        }
        if (event.target.matches('#input-horometro-inicial, #input-horometro-final, #input-profundidad-inicial, #input-profundidad')) {
          runLiveMathEngine();
        }
        applyActionBarState();
      }
    });

    document.addEventListener('change', (event) => {
      if (event.target.closest('.informe-container')) {
        if (!state.suppressDirtyTracking) {
          state.hasUnsavedChanges = true;
        }
        if (event.target.matches('#input-operador, [id^="input-ayudante-"]')) {
          refreshWorkerLists();
        }
        applyActionBarState();
      }
    });

    if (!state.beforeUnloadBound) {
      state.beforeUnloadBound = true;
      window.addEventListener('beforeunload', (event) => {
        if (!state.hasUnsavedChanges) return;
        event.preventDefault();
        event.returnValue = '';
      });
    }

    // Modal de Exportación + Envío de Correo
    const btnExportarPdf = document.getElementById('btn-exportar-pdf');

    const getSessionEmail = () => {
      try {
        const session = window.getSession ? window.getSession() : null;
        if (session?.userEmail) return String(session.userEmail).trim();
        if (session?.email) return String(session.email).trim();

        const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
        if (usuario?.email) return String(usuario.email).trim();

        const usuarioActivo = JSON.parse(localStorage.getItem('usuarioActivo') || '{}');
        if (usuarioActivo?.email) return String(usuarioActivo.email).trim();

        const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
        if (adminData?.email) return String(adminData.email).trim();
      } catch (_error) {}

      return '';
    };

    const normalizeJornadaLabel = (value) => {
      const raw = String(value || '').trim();
      if (!raw) return '';
      const normalized = raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      if (normalized.includes('noche')) return 'Noche';
      if (normalized.includes('dia')) return 'Dia';
      return raw;
    };

    const extractGroupFromText = (value) => {
      const text = String(value || '').trim();
      if (!text) return '';
      const explicit = text.match(/grupo\s*([a-z0-9]+)/i);
      if (explicit?.[1]) return normalizeGroupValue(explicit[1]);
      const compact = text.match(/\b([a-z])\b/i);
      return compact?.[1] ? normalizeGroupValue(compact[1]) : '';
    };

    const getCurrentGroupForExport = () => {
      const hiddenGroup = normalizeGroupValue(document.getElementById('input-turno')?.value || '');
      if (hiddenGroup) return hiddenGroup;
      const displayGroup = extractGroupFromText(document.getElementById('input-turno-display')?.value || '');
      if (displayGroup) return displayGroup;
      if (state.adminSelectedGroup) return normalizeGroupValue(state.adminSelectedGroup);
      return normalizeGroupValue(state.userGrupo || '');
    };

    const inferJornadaFromUI = () => {
      const sources = [
        document.getElementById('status-badge')?.textContent || '',
        document.getElementById('admin-group-status-badge')?.textContent || '',
        document.getElementById('input-turno-display')?.value || ''
      ];
      for (const text of sources) {
        const jornada = normalizeJornadaLabel(text);
        if (jornada === 'Dia' || jornada === 'Noche') return jornada;
      }
      return '';
    };

    const resolveJornadaForExport = async () => {
      const fecha = normalizeDateInputValue(document.getElementById('input-fecha')?.value) || getTodayIsoLocal();
      const grupo = getCurrentGroupForExport();
      if (fecha && grupo) {
        try {
          const response = await fetch(`/api/turnos/jornada?fecha=${encodeURIComponent(fecha)}&grupo=${encodeURIComponent(grupo)}`);
          if (response.ok) {
            const payload = await response.json();
            const jornadaApi = normalizeJornadaLabel(payload?.jornada || '');
            if (jornadaApi === 'Dia' || jornadaApi === 'Noche') return jornadaApi;
          }
        } catch (_error) {}
      }
      return inferJornadaFromUI() || 'Dia';
    };

    const ensureMailModal = () => {
      let modal = document.getElementById('modal-enviar-correo');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-enviar-correo';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2400;align-items:center;justify-content:center;';
        modal.innerHTML = `
          <div class="modal-content" style="background:white;padding:24px;border-radius:12px;max-width:420px;width:90%;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h3 style="margin:0;font-size:18px;font-weight:600;color:#1e293b;"><i class="fa-regular fa-envelope"></i> Enviar Informe por Correo</h3>
              <button id="btn-close-correo" style="background:none;border:none;font-size:20px;cursor:pointer;color:#64748b;">&times;</button>
            </div>
            <p style="color:#4b5563;font-size:14px;margin-bottom:20px;">El informe se exportará a PDF y se enviará como archivo adjunto.</p>
            <button id="btn-confirm-correo" class="btn btn-mail-soft" style="font-weight:600;width:100%;margin-bottom:14px;justify-content:center;">
              <i class="fa-solid fa-paper-plane"></i> Enviar a mi correo
            </button>
            <div class="input-group" style="margin-bottom:14px;">
              <label style="display:block;margin-bottom:8px;font-size:14px;font-weight:500;color:#334155;">Correo adicional (opcional)</label>
              <div style="display:flex;gap:8px;align-items:center;">
                <input type="email" id="input-correo-adicional" placeholder="tercero@empresa.com" class="modern-input" style="flex:1;box-sizing:border-box;">
                <button id="btn-enviar-correo-adicional" class="btn btn-mail-soft" type="button" style="padding:8px 12px;white-space:nowrap;">
                  <i class="fa-solid fa-paper-plane"></i> Enviar a este correo
                </button>
              </div>
              <span id="error-correo" style="color:#ef4444;font-size:12px;display:none;margin-top:4px;">Ingresa un correo electrónico válido.</span>
            </div>
            <div style="display:flex;gap:12px;justify-content:flex-end;">
              <button id="btn-cancel-correo" class="btn" style="background:#e5e7eb;color:#374151;font-weight:600;">Cancelar</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }
      return modal;
    };

    const openMailModal = () => {
      const modalCorreo = ensureMailModal();
      const btnCloseCorreo = document.getElementById('btn-close-correo');
      const btnCancelCorreo = document.getElementById('btn-cancel-correo');
      const btnConfirmCorreo = document.getElementById('btn-confirm-correo');
      const btnEnviarCorreoAdicional = document.getElementById('btn-enviar-correo-adicional');
      const inputCorreoAdicional = document.getElementById('input-correo-adicional');
      const errorCorreo = document.getElementById('error-correo');

      const myEmail = getSessionEmail();
      if (btnConfirmCorreo) {
        btnConfirmCorreo.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Enviar a mi correo (${myEmail || 'sin correo en sesión'})`;
      }

      const closeCorreoModal = () => {
        modalCorreo.style.display = 'none';
        if (window.desbloquearScroll) window.desbloquearScroll();
      };

      if (btnCloseCorreo) btnCloseCorreo.onclick = closeCorreoModal;
      if (btnCancelCorreo) btnCancelCorreo.onclick = closeCorreoModal;

      const ejecutarEnvioCorreo = async (destinatarioSeleccionado) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const destinatario = String(destinatarioSeleccionado || '').trim();

        if (!destinatario || !emailRegex.test(destinatario)) {
          if (errorCorreo) errorCorreo.style.display = 'block';
          return;
        }
        if (errorCorreo) errorCorreo.style.display = 'none';

        if (!state.currentReportId) {
          closeCorreoModal();
          showErrorModal('Debes guardar el informe antes de enviarlo por correo.');
          return;
        }

        console.log(`[MAIL_SYSTEM] Preparando envío para: ${destinatario}.`);
        closeCorreoModal();

        const btnExportMain = document.getElementById('btn-exportar-pdf');
        if (btnExportMain) btnExportMain.classList.add('btn-loading');

        try {
          if (typeof generarPDFBase64ParaCorreo !== 'function') {
            throw new Error('Motor PDF no disponible para envío por correo.');
          }

          const { pdfBase64, nombreArchivo } = await generarPDFBase64ParaCorreo(state.currentReportId);
          console.log('[MAIL_SYSTEM] PDF generado y adjuntado exitosamente.');

          const res = await fetch('/api/mail/enviar-informe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_informe: state.currentReportId,
              rut_solicitante: state.userRut,
              destinatario: destinatario,
              pdf_base64: pdfBase64,
              nombre_archivo: nombreArchivo
            })
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Error al enviar correo con adjunto');

          showSuccessModal('Correo Enviado', `📧 Informe enviado correctamente a ${destinatario}`, false);
        } catch (err) {
          if (btnExportMain) btnExportMain.classList.remove('btn-loading');
          console.error('[MAIL_SYSTEM] Error en envío. Spinner reseteado.', err.message);
          showErrorModal(err.message || 'Error al enviar el correo.');
        } finally {
          if (btnExportMain) btnExportMain.classList.remove('btn-loading');
        }
      };

      if (btnConfirmCorreo) {
        btnConfirmCorreo.onclick = async () => {
          await ejecutarEnvioCorreo(myEmail);
        };
      }

      if (btnEnviarCorreoAdicional) {
        btnEnviarCorreoAdicional.onclick = async () => {
          const correoAdicional = String(inputCorreoAdicional?.value || '').trim();
          await ejecutarEnvioCorreo(correoAdicional);
        };
      }

      if (inputCorreoAdicional) {
        console.log('[MAIL_SYSTEM] Tecla Enter vinculada al input de correo.');
        inputCorreoAdicional.onkeypress = async (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            const correoAdicional = String(inputCorreoAdicional.value || '').trim();
            console.log(`[MAIL_SYSTEM] Tecla Enter detectada. Validando correo: ${correoAdicional}.`);
            await ejecutarEnvioCorreo(correoAdicional);
          }
        };
      }

      if (inputCorreoAdicional) inputCorreoAdicional.value = '';
      if (errorCorreo) errorCorreo.style.display = 'none';
      console.log('[UI_DEBUG] Ajustando prioridad de modales para Super Admin.');
      modalCorreo.style.display = 'flex';
      if (window.bloquearScroll) window.bloquearScroll();
    };

    const ensureExportModal = () => {
      let modal = document.getElementById('modal-exportar-pdf');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-exportar-pdf';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2450;align-items:center;justify-content:center;';
        modal.innerHTML = `
          <div class="modal-content" style="background:white;padding:24px;border-radius:12px;max-width:460px;width:90%;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <h3 style="margin:0;font-size:18px;font-weight:700;color:#0f172a;"><i class="fa-solid fa-file-export"></i> Exportar Informe</h3>
              <button id="btn-close-export" style="background:none;border:none;font-size:20px;cursor:pointer;color:#64748b;">&times;</button>
            </div>
            <div id="export-modal-body" style="color:#334155;font-size:14px;line-height:1.5;margin-bottom:18px;"></div>
            <div id="export-modal-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
              <button id="btn-cancel-export" class="btn" style="background:#e5e7eb;color:#374151;font-weight:600;">Cerrar</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }
      return modal;
    };

    const getExportState = () => {
      const statusRaw = String(state.currentReportStatus || '').trim();
      const chipStatus = String(document.getElementById('estado-chip')?.textContent || '').trim();
      const normalized = normalizeStatus(statusRaw || chipStatus);
      const blockedStatuses = new Set(['finalizado', 'cerrado', 'validado']);
      const estadoInforme = normalized || 'borrador';
      const isBorrador = !blockedStatuses.has(estadoInforme);
      return { estadoInforme, isBorrador };
    };

    const openExportModal = async () => {
      const modalExport = ensureExportModal();
      const body = document.getElementById('export-modal-body');
      const actions = document.getElementById('export-modal-actions');
      const closeBtn = document.getElementById('btn-close-export');
      const cancelBtn = document.getElementById('btn-cancel-export');
      const { estadoInforme, isBorrador } = getExportState();
      const jornada = await resolveJornadaForExport();
      const jornadaLabel = String(jornada || 'Dia').toLowerCase() === 'noche' ? 'noche' : 'día';

      console.log(`[UI_LOGIC] Modal de exportación abierto en modo: ${estadoInforme}.`);
      console.log(`[UI_LOGIC] Bloqueo de exportación activo para borrador: ${isBorrador}.`);

      const closeExportModal = () => {
        modalExport.style.display = 'none';
        if (window.desbloquearScroll) window.desbloquearScroll();
      };

      if (closeBtn) closeBtn.onclick = closeExportModal;
      if (cancelBtn) cancelBtn.onclick = closeExportModal;
      modalExport.onclick = (event) => {
        if (event.target === modalExport) closeExportModal();
      };

      if (!body || !actions) return;

      if (isBorrador) {
        body.innerHTML = `
          <div style="display:flex;gap:10px;align-items:flex-start;">
            <span style="font-size:22px;line-height:1;">⚠️</span>
            <p style="margin:0;">El informe no ha sido cerrado. Para poder exportar se debe cerrar el informe del turno del ${jornadaLabel}.</p>
          </div>
        `;
        actions.innerHTML = '<button id="btn-cancel-export" class="btn" style="background:#e5e7eb;color:#374151;font-weight:600;">Cerrar</button>';
        const newCancel = document.getElementById('btn-cancel-export');
        if (newCancel) newCancel.onclick = closeExportModal;
      } else {
        body.innerHTML = '<p style="margin:0;">El informe está cerrado y listo para exportación. Selecciona una acción:</p>';
        actions.innerHTML = `
          <button id="btn-export-modal-download" class="btn btn-primary" style="font-weight:600;">
            <i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> Descargar PDF
          </button>
          <button id="btn-export-modal-mail" class="btn btn-light-blue" style="font-weight:600;">
            <i class="fa-solid fa-envelope"></i> Enviar por Correo
          </button>
          <button id="btn-cancel-export" class="btn" style="background:#e5e7eb;color:#374151;font-weight:600;">Cancelar</button>
        `;

        const btnDownload = document.getElementById('btn-export-modal-download');
        const btnMail = document.getElementById('btn-export-modal-mail');
        const btnCancelDynamic = document.getElementById('btn-cancel-export');

        if (btnDownload) {
          btnDownload.onclick = async () => {
            closeExportModal();
            if (typeof generarPDF === 'function') {
              await generarPDF();
            } else {
              showErrorModal('Motor PDF no disponible.');
            }
          };
        }
        if (btnMail) {
          btnMail.onclick = () => {
            closeExportModal();
            openMailModal();
          };
        }
        if (btnCancelDynamic) btnCancelDynamic.onclick = closeExportModal;
      }

      modalExport.style.display = 'flex';
      if (window.bloquearScroll) window.bloquearScroll();
    };

    if (btnExportarPdf) {
      btnExportarPdf.addEventListener('click', async () => {
        await openExportModal();
      });
    }

    const btnEnviarCorreoLegacy = document.getElementById('btn-enviar-correo');
    if (btnEnviarCorreoLegacy) {
      btnEnviarCorreoLegacy.addEventListener('click', openMailModal);
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
    if (hasNegativeMathError()) {
      showErrorModal('No se puede finalizar mientras existan calculos automaticos con valor negativo.');
      return;
    }

    const validation = validateFinalizeRequirements(true);
    if (!validation.isValid) {
      showErrorModal(`No se puede finalizar. Faltan datos obligatorios: ${validation.missing.join(', ')}`);
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
    await syncUserSession();
    state.accessRestricted = false;
    state.helperSelectCount = 2;
    renderExtraAyudanteFields();
    syncAuditModeFromURL();
    updateAuditModeBanner();

    const urlParams = new URLSearchParams(window.location.search);
    const isEditing = !!urlParams.get('id');

    addRowHandlers();
    bindActions();
    initializeMathEngine();
    refreshHeaderMeta();
    updateResumenCards();
    updateObservacionesAvailability();
    console.log('[UI_FIX] Cabecera unificada. Separaciones corregidas.');
    console.log('[UI_FIX] Barra de acciones integrada en Header Card.');
    console.log('[UI_CLEANUP] Reajustando grilla de Antecedentes a 4 columnas.');
    console.log('[UI_CLEANUP] Compactando controles de entrada numéricos.');
    
    await loadCargoPermisosIds();

    const hasShiftBypassAccess = hasElevatedAccess() || hasShiftHeartbeatBypassPermission();
    if (hasShiftBypassAccess) {
      state.adminBypass = true;
      console.log('[SECURITY] Acceso concedido por privilegios elevados.');
      console.log('[AUTH_DEBUG] Restricciones de tiempo real desactivadas para este perfil.');
      await loadInformeFull();
      return;
    }

    if (state.auditModeEnabled) {
      await initAuditContext();
    } else {
      // Fecha contable + grupos activos + selects de personal
      await initShiftContext();
    }

    let reportAlreadyLoaded = false;
    let existingShiftReport = null;
    let currentShiftDraft = null;

    if (!state.isSuperAdmin && !state.auditModeEnabled && !isEditing) {
      const fechaInput = document.getElementById('input-fecha');
      const shiftContext = state.userShiftContext || {};
      const fecha = fechaInput?.value || '';

      if (fecha && state.userGrupo) {
        currentShiftDraft = await fetchDraftForCurrentShift(fecha, state.userGrupo, state.userRut);
        existingShiftReport = await fetchExistingInformeForShift(fecha, state.userGrupo);
      }

      const existingDraft = currentShiftDraft || (existingShiftReport && normalizeStatus(existingShiftReport.estado) === 'borrador'
        ? existingShiftReport
        : null);
      const exactActive = Boolean(shiftContext.exact_active ?? shiftContext.exactActive);
      const inGrace = Boolean(shiftContext.in_grace ?? shiftContext.inGrace);

      if ((exactActive || inGrace) && existingDraft?.id_informe) {
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
    runLiveMathEngine();
    await runShiftHeartbeat();
    startHeartbeatCycle();
    startAutosaveCycle();
    console.log('[UI_MODERNIZATION] Nuevos estilos aplicados exitosamente. Vista profesional activa.');
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
window.abrirPestana = InformeTurno.abrirPestaña;
document.addEventListener('DOMContentLoaded', () => {
  InformeTurno.init().catch((error) => {
    console.error('[INFORME] Error inicializando la vista:', error);
  });
});

