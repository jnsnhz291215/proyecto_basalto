document.addEventListener('DOMContentLoaded', () => {
  // Tab Switching Logic
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Deactivate all
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.style.color = '#6b7280';
        b.style.borderBottomColor = 'transparent';
      });
      tabContents.forEach(c => c.style.display = 'none');

      // Activate clicked
      btn.classList.add('active');
      btn.style.color = '#7c3aed';
      btn.style.borderBottomColor = '#7c3aed';
      const targetId = btn.getAttribute('data-target');
      document.getElementById(targetId).style.display = 'block';

      if (targetId === 'tab-audit') {
        loadAuditLogs();
      }
    });
  });

  // Audit Viewer Logic
  const btnRefreshAudit = document.getElementById('btnRefreshAudit');
  const inputAuditSearch = document.getElementById('inputAuditSearch');
  if (btnRefreshAudit) {
    btnRefreshAudit.addEventListener('click', loadAuditLogs);
  }
  if (inputAuditSearch) {
    inputAuditSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') loadAuditLogs();
    });
  }

  async function loadAuditLogs() {
    const loadingState = document.getElementById('auditLoadingState');
    const emptyState = document.getElementById('auditEmptyState');
    const table = document.getElementById('auditTable');
    const tbody = document.getElementById('auditTableBody');

    loadingState.style.display = 'block';
    emptyState.style.display = 'none';
    table.style.display = 'none';
    tbody.innerHTML = '';

    try {
      const searchVal = document.getElementById('inputAuditSearch')?.value || '';
      const params = new URLSearchParams();
      if (searchVal) params.append('search', searchVal.trim());
      
      const res = await fetch(`/api/admin-logs?${params.toString()}`, {
        headers: {
          'rut_solicitante': localStorage.getItem('user_rut') || ''
        }
      }); 
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al cargar logs');
      }
      
      const logs = await res.json();
      
      loadingState.style.display = 'none';
      if (logs.length === 0) {
        emptyState.style.display = 'block';
      } else {
        table.style.display = 'table';
        logs.forEach(log => {
          const tr = document.createElement('tr');
          
          const dt = new Date(log.fecha);
          const fechaStr = dt.toLocaleString('es-CL');
          
          tr.innerHTML = `
            <td>${fechaStr}</td>
            <td><span class="admin-name">${log.admin_rut || 'Sistema'}</span></td>
            <td><span class="badge-regular-admin" style="background: #e0e7ff; color: #3730a3;">${log.accion}</span></td>
            <td>${log.detalle}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    } catch (err) {
      console.error(err);
      loadingState.style.display = 'none';
      emptyState.style.display = 'none';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="4" style="text-align: center; color: #dc2626;">Hubo un error al cargar el historial de auditoría.</td>`;
      tbody.appendChild(tr);
      table.style.display = 'table';
    }
  }
});
