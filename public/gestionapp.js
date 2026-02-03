import { GRUPOS, COLORES } from './config.js';

const CLAVE_GESTIONAR = 'clave1super2secreta3';

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

async function cargar() {
  try {
    const r = await fetch('/datos');
    if (!r.ok) throw new Error('Error al cargar');
    trabajadores = await r.json();
    if (!Array.isArray(trabajadores)) trabajadores = [];
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
    col.className = 'grupo-col';
    col.style.backgroundColor = COLORES[g] || '#22c55e';

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
    } else {
      alert(data.error || 'Error al eliminar');
    }
  } catch (e) {
    alert('Error al eliminar');
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
      alert('Trabajador agregado.');
    } else {
      console.error('Error del servidor:', data);
      alert(data.error || `Error al agregar (${r.status})`);
    }
  } catch (err) {
    console.error('Error en enviarAgregar:', err);
    alert('Error al agregar: ' + err.message);
  }
}

function comprobarLogin(e) {
  e.preventDefault();
  const clave = (el.formLogin.querySelector('#clave-login').value || '').trim();
  if (clave === CLAVE_GESTIONAR) {
    el.modalLogin.classList.remove('show');
    cargar();
  } else {
    alert('Clave incorrecta.');
  }
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
