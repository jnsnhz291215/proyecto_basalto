function limpiarRUT(rut) {
  return String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

function calcularDV(cuerpo) {
  const digits = String(cuerpo || '').replace(/[^0-9]/g, '');
  let suma = 0;
  let multiplicador = 2;

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    suma += Number(digits[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

function validarRUT(rut) {
  const rutLimpio = limpiarRUT(rut);
  if (!/^\d{7,8}[\dK]$/.test(rutLimpio)) return false;

  const cuerpo = rutLimpio.slice(0, -1);
  const dvIngresado = rutLimpio.slice(-1).toUpperCase();
  const dvCalculado = calcularDV(cuerpo);

  return dvIngresado === dvCalculado;
}

module.exports = {
  validarRUT,
  limpiarRUT,
  calcularDV
};
