@echo off
cd /d "%~dp0"

echo ========================================
echo Iniciando servidor...
echo ========================================
echo.

REM Abrir el navegador despues de 2 segundos
start "" cmd /c "timeout /t 2 > nul && start http://localhost:3000"

REM Iniciar servidor (MISMA ventana)
node server/app.js
