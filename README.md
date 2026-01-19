# Calendario de Turnos – Guía mínima de instalación

Esta guía explica **únicamente lo necesario** para poder **acceder al repositorio privado, clonar el proyecto y ejecutarlo** en un equipo nuevo.

---

## 🔐 Acceso al repositorio (IMPORTANTE)

Este repositorio es **privado**.

➡️ Para poder clonar el proyecto y modificar archivos (por ejemplo `trabajadores.js`) es **obligatorio** que el propietario del repositorio te agregue como **colaborador en GitHub**.

Si no tienes acceso otorgado:

* No podrás clonar el repositorio
* No podrás ver el código
* No podrás hacer cambios

---

## 1️⃣ Crear cuenta en GitHub

Si aún no tienes cuenta:

👉 [https://github.com/](https://github.com/)

Es necesaria para acceder a repositorios privados y trabajar con Git.

---

## 2️⃣ Instalar Git

Git se utiliza para descargar el proyecto y enviar cambios.

👉 Página oficial de Git:
[https://git-scm.com/](https://git-scm.com/)

Durante la instalación se pueden dejar **todas las opciones por defecto**.

### Verificar instalación

Abrir una consola (CMD o PowerShell) y ejecutar:

```bash
git --version
```

Si aparece una versión, Git está correctamente instalado.

---

## 3️⃣ Instalar Node.js

Node.js es necesario para ejecutar el servidor de la aplicación.

👉 Página oficial de Node.js:
[https://nodejs.org/](https://nodejs.org/)

Descargar e instalar la versión **LTS**.

### Verificar instalación

```bash
node -v
npm -v
```

Ambos comandos deben mostrar una versión.

---

## 4️⃣ Clonar el repositorio

Una vez que tengas acceso al repositorio privado, ejecuta:

```bash
git clone https://github.com/jnsnhz291215/proyecto_basalto.git
```

Luego entra a la carpeta del proyecto:

```bash
cd proyecto_basalto
```

Durante el proceso, GitHub pedirá que inicies sesión para verificar tus permisos.

---

## 5️⃣ Instalar dependencias

Dentro de la carpeta del proyecto, ejecutar:

```bash
npm install
```

Este comando descarga automáticamente todo lo necesario para que la aplicación funcione.

---

## 6️⃣ Iniciar la aplicación

### Opción A: Usando Node

```bash
node server/app.js
```

### Opción B: Usando el archivo `.bat` (Windows)

1. Hacer doble click en el archivo `.bat`
2. El servidor se iniciará automáticamente
3. El navegador se abrirá en:

```
http://localhost:3000
```

---

## 7️⃣ Acceder a la aplicación

Abrir un navegador web y entrar a:

```
http://localhost:3000
```

Mientras la consola esté abierta, el servidor seguirá ejecutándose.

---

## 🛑 Detener la aplicación

Cerrar la ventana de la consola donde se está ejecutando Node.

---

✅ Con estos pasos la aplicación queda lista para usarse.
