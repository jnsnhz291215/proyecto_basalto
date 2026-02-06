import { GRUPOS, COLORES } from './config.js';

// const CLAVE_GESTIONAR = 'clave1super2secreta3';

let trabajadores = [];
let rutParaBorrar = null;

const el = {
  modalLogin: null,
  formLogin: null,
  gruposColumnas: null,
  inputBuscar: null,
  selectFiltro: null,
  modalAgregar: null,
  modalConfirm: null,
  modalResult: null,
  resultOk: null,
  formAgregar: null,
  closeModal: null,
  cancelAdd: null,
  confirmTitle: null,
  confirmMsg: null,
  confirmCancel: null,
  confirmOk: null
};

function formatearRUT(val) {
  const s = (val || '').replace(/[.\-\s]/g, '');
  if (s.length < 8 || s.length > 9) return null;
  return s.slice(0, -1) + '-' + s.slice(-1);
}

function formatearTelefono(val) {
  const s = (val || '').replace(/\D/g, '');
  const n = s.startsWith('56') ? s.slice(2) : s;
  if (n.length !== 9) return null;
  return '+56' + n;
}

// Normalizar a Title Case: primera letra en mayúscula por palabra
function titleCase(s) {
  return String(s || '').trim().split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
async function cargar() {
  try {
    const r = await fetch('/datos');
    if (!r.ok) throw new Error('Error al cargar');
    trabajadores = await r.json();
    if (!Array.isArray(trabajadores)) trabajadores = [];
    // Normalizar nombres/apellidos/cargo para display
    trabajadores = trabajadores.map(t => ({
      ...t,
      nombres: titleCase(t.nombres),
      apellidos: titleCase(t.apellidos),
      cargo: t.cargo ? titleCase(t.cargo) : t.cargo
    }));
  } catch (e) {
    console.error(e);
    trabajadores = [];
  }
  render();
}

function getFiltrados() {
  const buscar = (el.inputBuscar && el.inputBuscar.value || '').trim().toLowerCase();
  const grupo = (el.selectFiltro && el.selectFiltro.value || '');
  let list = trabajadores;
  if (buscar) {
    list = list.filter(t => {
      const n = ((t.nombres || '') + ' ' + (t.apellidos || '')).toLowerCase();
      const a = ((t.apellidos || '') + ' ' + (t.nombres || '')).toLowerCase();
      return n.includes(buscar) || a.includes(buscar);
    });
  }
  if (grupo) list = list.filter(t => t.grupo === grupo);
  return list;
}

function render() {
  const list = getFiltrados();
  const porGrupo = {};
  GRUPOS.forEach(g => { porGrupo[g] = []; });
  list.forEach(t => {
    if (porGrupo[t.grupo]) porGrupo[t.grupo].push(t);
  });

  const filterGrupo = (el.selectFiltro && el.selectFiltro.value) || '';
  const gruposAmostrar = filterGrupo ? [filterGrupo] : GRUPOS;

  el.gruposColumnas.innerHTML = '';
  gruposAmostrar.forEach(g => {
    const workers = porGrupo[g] || [];
    const col = document.createElement('div');
    // add base class and a per-group class (e.g. grupo-a) so CSS or JS can target it
    col.className = 'grupo-col grupo-' + String(g).toLowerCase();
    // set accent color via CSS variable so the stylesheet controls visuals
    col.style.setProperty('--accent', COLORES[g] || '#22c55e');

    const tit = document.createElement('div');
    tit.className = 'grupo-col-titulo';
    tit.textContent = 'Grupo ' + g;
    col.appendChild(tit);

    workers.forEach(t => {
      const card = document.createElement('div');
      card.className = 'trabajador-card';

      const body = document.createElement('div');
      body.className = 'trabajador-card-body';

      const nom = document.createElement('div');
      nom.className = 'trabajador-card-nombre';
      nom.textContent = `${t.apellidos || ''}, ${t.nombres || ''}`.replace(/^,\s*|,\s*$/g, '').trim() || '-';

      const rutCargo = document.createElement('div');
      rutCargo.className = 'trabajador-card-linea';
      rutCargo.textContent = `RUT: ${t.RUT || '-'} | Cargo: ${t.cargo || '-'}`;

      const tel = document.createElement('div');
      tel.className = 'trabajador-card-linea';
      tel.textContent = `Tel: ${t.telefono || '-'}`;

      const resto = document.createElement('div');
      resto.className = 'trabajador-card-resto';
      resto.textContent = t.email || '';

      body.appendChild(nom);
      body.appendChild(rutCargo);
      body.appendChild(tel);
      body.appendChild(resto);

      const btnDel = document.createElement('button');
      btnDel.className = 'btn btn-borrar';
      btnDel.textContent = '×';
      btnDel.title = 'Borrar';
      btnDel.addEventListener('click', () => confirmarBorrar(t.RUT));

      card.appendChild(body);
      card.appendChild(btnDel);
      col.appendChild(card);
    });

    // si el grupo está vacío, mostrar placeholder informativo
    if (!workers || workers.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'grupo-empty';
      empty.textContent = 'Sin trabajadores activos';
      col.appendChild(empty);
    }

    el.gruposColumnas.appendChild(col);
  });
}

function confirmarBorrar(rut) {
  rutParaBorrar = rut;
  el.confirmTitle.textContent = 'Confirmar';
  el.confirmMsg.textContent = '¿Eliminar a este trabajador?';
  el.modalConfirm.classList.add('show');
}

async function ejecutarBorrar() {
  if (!rutParaBorrar) return;
  try {
    const r = await fetch('/eliminar-trabajador', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rut: rutParaBorrar })
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.success) {
      trabajadores = data.trabajadores || [];
      render();
      alert('Trabajador eliminado con éxito');
    } else if (r.status === 404) {
      alert(data.error || 'Error: El RUT no existe');
    } else if (r.status === 400) {
      alert(data.error || 'Solicitud inválida');
    } else {
      alert(data.error || `Error al eliminar (${r.status})`);
    }
  } catch (e) {
    console.error('Error en ejecutarBorrar:', e);
    alert('Error al eliminar: ' + (e && e.message));
  }
  rutParaBorrar = null;
  el.modalConfirm.classList.remove('show');
}

function abrirAgregar() {
  el.formAgregar.reset();
  el.modalAgregar.classList.add('show');
}

function cerrarAgregar() {
  el.modalAgregar.classList.remove('show');
}

async function enviarAgregar(e) {
  e.preventDefault();
  const fd = new FormData(el.formAgregar);
  const nombre = (fd.get('nombre') || '').trim();
  const apellido = (fd.get('apellido') || '').trim();
  const rutRaw = (fd.get('rut') || '').trim();
  const cargo = (fd.get('cargo') || '').trim();
  const email = (fd.get('email') || '').trim();
  const telefonoRaw = (fd.get('telefono') || '').trim();
  const grupo = fd.get('grupo') || '';

  if (!nombre || !apellido || !rutRaw || !email || !telefonoRaw || !grupo) {
    alert('Complete todos los campos requeridos.');
    return;
  }

  const rut = formatearRUT(rutRaw);
  const telefono = formatearTelefono(telefonoRaw);
  if (!rut) { alert('RUT inválido (8-9 dígitos).'); return; }
  if (!telefono) { alert('Teléfono inválido (9 dígitos).'); return; }

  // Validar email antes de enviar
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert('Email inválido. Debe ser: texto@texto.texto');
    return;
  }

  const obj = {
    nombres: nombre.replace(/\s+/g, ' ').trim(),
    apellidos: apellido.replace(/\s+/g, ' ').trim(),
    RUT: rut,
    email: email.toLowerCase().trim(),
    telefono,
    grupo
  };
  if (cargo) obj.cargo = cargo.trim();

  // Normalizar a Title Case en frontend para mostrar inmediatamente
  obj.nombres = titleCase(obj.nombres);
  obj.apellidos = titleCase(obj.apellidos);
  if (obj.cargo) obj.cargo = titleCase(obj.cargo);

  try {
    const r = await fetch('/agregar-trabajador', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj)
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.success) {
      trabajadores = data.trabajadores || [];
      render();
      cerrarAgregar();
      showResult('Éxito', data.message || 'Trabajador agregado correctamente');
    } else {
      console.error('Error del servidor:', data);
      const detalle = data.detail ? '\nDetalle: ' + data.detail : '';
      showResult('Error', (data.error || `Error al agregar (${r.status})`) + detalle, true);
    }
  } catch (err) {
    console.error('Error en enviarAgregar:', err);
    showResult('Error', 'Error al agregar: ' + err.message, true);
  }
}

function showResult(title, msg, isError=false){
  const m = document.getElementById('modal-result');
  const t = document.getElementById('result-title');
  const p = document.getElementById('result-msg');
  t.textContent = title || 'Resultado';
  p.textContent = msg || '';
  if (m) m.classList.add('show');
  // optional styling for error
  if (isError) t.style.color = '#b91c1c'; else t.style.color = '';
}
function comprobarLogin(e) {
  e.preventDefault();
  (async () => {
    const rut = String((el.formLogin.querySelector('#rut-login')||{value:''}).value||'').replace(/\D/g,'').trim();
    const password = String((el.formLogin.querySelector('#pass-login')||{value:''}).value||'');
    if (!rut || !password) { alert('Ingrese RUT y password'); return; }
    try{
      const resp = await fetch('/admin-login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ rut, password }) });
      const d = await resp.json().catch(()=>({}));
      if (resp.ok && d && d.success) {
        el.modalLogin.classList.remove('show');
        cargar();
      } else {
        alert(d.error || 'Credenciales inválidas');
      }
    }catch(err){
      console.error('Error en admin-login:', err);
      alert('Error conectando al servidor');
    }
  })();
}

document.addEventListener('DOMContentLoaded', () => {
  el.modalLogin = document.getElementById('modal-login');
  el.formLogin = document.getElementById('form-login');
  el.gruposColumnas = document.getElementById('grupos-columnas');
  el.inputBuscar = document.getElementById('input-buscar');
  el.selectFiltro = document.getElementById('select-filtro');
  el.modalAgregar = document.getElementById('modal-agregar');
  el.modalConfirm = document.getElementById('modal-confirm');
  el.formAgregar = document.getElementById('form-agregar');
  el.closeModal = document.getElementById('close-modal');
  el.cancelAdd = document.getElementById('cancel-add');
  el.confirmTitle = document.getElementById('confirm-title');
  el.confirmMsg = document.getElementById('confirm-msg');
  el.confirmCancel = document.getElementById('confirm-cancel');
  el.confirmOk = document.getElementById('confirm-ok');

  el.modalResult = document.getElementById('modal-result');
  el.resultOk = document.getElementById('result-ok');

  if (el.resultOk) {
    el.resultOk.addEventListener('click', () => {
      if (el.modalResult) el.modalResult.classList.remove('show');
    });
  }

  el.formLogin.addEventListener('submit', comprobarLogin);

  document.getElementById('btn-agregar').addEventListener('click', abrirAgregar);
  el.inputBuscar.addEventListener('input', render);
  el.selectFiltro.addEventListener('change', render);
  el.closeModal.addEventListener('click', cerrarAgregar);
  el.cancelAdd.addEventListener('click', cerrarAgregar);
  el.formAgregar.addEventListener('submit', enviarAgregar);
  el.confirmCancel.addEventListener('click', () => {
    rutParaBorrar = null;
    el.modalConfirm.classList.remove('show');
  });
  el.confirmOk.addEventListener('click', ejecutarBorrar);

  if (el.resultOk) {
    el.resultOk.addEventListener('click', () => {
      const m = document.getElementById('modal-result');
      if (m) m.classList.remove('show');
    });
  }

  el.modalAgregar.addEventListener('click', ev => {
    if (ev.target === el.modalAgregar) cerrarAgregar();
  });
  el.modalConfirm.addEventListener('click', ev => {
    if (ev.target === el.modalConfirm) {
      rutParaBorrar = null;
      el.modalConfirm.classList.remove('show');
    }
  });

  // RUT: solo dígitos
  const rutInput = document.getElementById('rut');
  if (rutInput) {
    rutInput.addEventListener('input', ev => {
      ev.target.value = ev.target.value.replace(/\D/g, '').slice(0, 9);
    });
  }
  const telInput = document.getElementById('telefono');
  if (telInput) {
    telInput.addEventListener('input', ev => {
      ev.target.value = ev.target.value.replace(/\D/g, '').slice(0, 9);
    });
  }

  // cargar() se ejecuta solo tras login correcto en comprobarLogin
});
