#!/bin/bash

# Ir a la carpeta del script
cd "$(dirname "$0")"

echo "========================================"
echo "Iniciando servidor..."
echo "========================================"
echo

# Abrir el navegador después de 2 segundos
(
  sleep 2
  open http://localhost:3000
) &

# Iniciar servidor (misma terminal)
node server/app.js
