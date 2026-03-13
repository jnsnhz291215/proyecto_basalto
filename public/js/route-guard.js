// ============================================
// ROUTE GUARD - Protección contra acceso directo a rutas restringidas
// Se ejecuta inmediatamente en el <head> para máxima velocidad
// ============================================

(function() {
  'use strict';

  // Obtener sesión activa
  const userRole = localStorage.getItem('user_role');
  const userRut = localStorage.getItem('user_rut');
  const currentPath = window.location.pathname;

  // Mapeo de rutas y requisitos de acceso
  const routeRequirements = {
    'gestionar.html': { requiresAuth: true, requiresAdmin: true },
    'gestionviajes.html': { requiresAuth: true, requiresAdmin: true },
    'gestioninformes.html': { requiresAuth: true, requiresAdmin: true },
    'gestioncargos.html': { requiresAuth: true, requiresAdmin: true },
    'datos.html': { requiresAuth: true, requiresAdmin: false },
    'informe.html': { requiresAuth: true, requiresAdmin: false },
    'viajes.html': { requiresAuth: true, requiresAdmin: false }
  };

  // Verificar la ruta actual
  let currentRoute = null;
  for (const route in routeRequirements) {
    if (currentPath.includes(route)) {
      currentRoute = route;
      break;
    }
  }

  // Si la ruta requiere autenticación
  if (currentRoute && routeRequirements[currentRoute].requiresAuth) {
    if (!userRole || !userRut) {
      // No hay sesión válida
      console.log('[ROUTE_GUARD] Acceso denegado - No hay sesión para:', currentRoute);
      window.location.href = '/index.html';
      return;
    }

    // Si requiere admin y el usuario no es admin
    if (routeRequirements[currentRoute].requiresAdmin && userRole !== 'admin') {
      console.log('[ROUTE_GUARD] Acceso denegado - Solo admin puede acceder a:', currentRoute);
      // Mostrar modal de acceso denegado
      showAccessDeniedModal('Acceso Denegado', 'Solo los administradores pueden acceder a esta sección.');
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 2000);
      return;
    }
  }

  // Mostrar modal de acceso denegado
  function showAccessDeniedModal(title, message) {
    // Crear estructuras HTML del modal si no existen
    let modal = document.getElementById('access-denied-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'access-denied-modal';
      modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-container">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${title}</h5>
              <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
              <p>${message}</p>
            </div>
            <div class="modal-footer">
              <button class="btn btn-primary">Aceptar</button>
            </div>
          </div>
        </div>
        <style>
          #access-denied-modal {
            display: flex;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            align-items: center;
            justify-content: center;
            z-index: 9999;
          }
          #access-denied-modal .modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
          }
          #access-denied-modal .modal-container {
            position: relative;
            z-index: 10000;
          }
          #access-denied-modal .modal-content {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            max-width: 400px;
            width: 90%;
            overflow: hidden;
          }
          #access-denied-modal .modal-header {
            background: #4f46e5;
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          #access-denied-modal .modal-title {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
          }
          #access-denied-modal .modal-close {
            background: none;
            border: none;
            color: white;
            font-size: 28px;
            cursor: pointer;
            padding: 0;
            opacity: 0.8;
          }
          #access-denied-modal .modal-close:hover {
            opacity: 1;
          }
          #access-denied-modal .modal-body {
            padding: 20px;
            font-size: 15px;
            color: #374151;
            line-height: 1.5;
          }
          #access-denied-modal .modal-footer {
            padding: 15px 20px;
            background: #f9fafb;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
          }
          #access-denied-modal .btn {
            padding: 8px 16px;
            font-size: 14px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s ease;
          }
          #access-denied-modal .btn-primary {
            background: #4f46e5;
            color: white;
          }
          #access-denied-modal .btn-primary:hover {
            background: #4338ca;
          }
        </style>
      `;
      document.body.appendChild(modal);

      // Manejar cierres
      const closeBtn = modal.querySelector('.modal-close');
      const acceptBtn = modal.querySelector('.btn-primary');
      const backdrop = modal.querySelector('.modal-backdrop');

      closeBtn?.addEventListener('click', () => modal.remove());
      acceptBtn?.addEventListener('click', () => modal.remove());
      backdrop?.addEventListener('click', () => modal.remove());
    } else {
      // Actualizar titulo y mensaje si el modal ya existe
      modal.querySelector('.modal-title').textContent = title;
      modal.querySelector('.modal-body').innerHTML = `<p>${message}</p>`;
      modal.style.display = 'flex';
    }
  }

})();
