@echo off
cd /d "%~dp0"
node server/app.js
start http://localhost:3000
