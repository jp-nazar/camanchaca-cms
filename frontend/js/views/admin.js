import { api } from '../api.js';
import { showToast } from '../components/toast.js';
import { esc, isPlatformAdmin } from '../utils.js';

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });
const API = (url, opts = {}) => fetch('/api' + url, { headers: headers(), ...opts }).then(r => r.json());

export async function render(container) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!isPlatformAdmin(user)) {
    container.innerHTML = `<div class="empty-state"><h3>${'Acceso denegado'}</h3><p>${'Se requiere acceso de administrador de plataforma.'}</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div><h1>${'Administración de plataforma'}</h1><div class="subtitle">${'Controles de superadmin - solo tú puedes ver esto'}</div></div>
    </div>

    <div class="settings-section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3>${'Todos los usuarios'}</h3>
        <button class="btn btn-primary btn-sm" id="showCreateUserBtn">+ Crear usuario</button>
      </div>

      <div id="createUserForm" style="display:none;margin-bottom:20px;padding:16px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius)">
        <h4 style="margin-bottom:12px;font-size:14px">Nuevo usuario</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="newUserEmail" class="input" placeholder="usuario@ejemplo.com">
          </div>
          <div class="form-group">
            <label>Nombre</label>
            <input type="text" id="newUserName" class="input" placeholder="Nombre completo">
          </div>
          <div class="form-group">
            <label>Contraseña</label>
            <input type="password" id="newUserPassword" class="input" placeholder="Mínimo 8 caracteres">
          </div>
          <div class="form-group">
            <label>Rol</label>
            <select id="newUserRole" class="input">
              <option value="workspace_editor" selected>Editor de espacio</option>
              <option value="workspace_admin">Admin de espacio</option>
              <option value="workspace_viewer">Visualizador</option>
              <option value="user">Usuario</option>
              <option value="platform_admin">Platform Admin</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn btn-primary btn-sm" id="createUserBtn">Crear usuario</button>
          <button class="btn btn-secondary btn-sm" id="cancelCreateUserBtn">Cancelar</button>
        </div>
        <p id="createUserError" style="color:var(--danger);font-size:12px;margin-top:8px;display:none"></p>
      </div>

      <div id="allUsersTable"><p style="color:var(--text-muted)">${'Cargando...'}</p></div>
    </div>

    <div class="settings-section">
      <h3>${'Sistema'}</h3>
      <div id="systemInfo"><p style="color:var(--text-muted)">${'Cargando...'}</p></div>
    </div>
  `;

  loadUsers();
  loadSystem();

  // Create user form handlers
  document.getElementById('showCreateUserBtn')?.addEventListener('click', () => {
    document.getElementById('createUserForm').style.display = 'block';
    document.getElementById('showCreateUserBtn').style.display = 'none';
  });

  document.getElementById('cancelCreateUserBtn')?.addEventListener('click', () => {
    document.getElementById('createUserForm').style.display = 'none';
    document.getElementById('showCreateUserBtn').style.display = 'inline-flex';
    document.getElementById('createUserError').style.display = 'none';
  });

  document.getElementById('createUserBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('newUserEmail').value.trim();
    const name = document.getElementById('newUserName').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;
    const errorEl = document.getElementById('createUserError');

    if (!email || !password) {
      errorEl.textContent = 'Email y contraseña son obligatorios';
      errorEl.style.display = 'block';
      return;
    }
    if (password.length < 8) {
      errorEl.textContent = 'La contraseña debe tener al menos 8 caracteres';
      errorEl.style.display = 'block';
      return;
    }

    try {
        const res = await fetch('/api/auth/admin/users', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ email, name, password, role })
      });
      const data = await res.json();
      if (!res.ok) {
        errorEl.textContent = data.error || 'Error al crear usuario';
        errorEl.style.display = 'block';
        return;
      }

      showToast('Usuario creado correctamente', 'success');
      document.getElementById('newUserEmail').value = '';
      document.getElementById('newUserName').value = '';
      document.getElementById('newUserPassword').value = '';
      document.getElementById('createUserForm').style.display = 'none';
      document.getElementById('showCreateUserBtn').style.display = 'inline-flex';
      errorEl.style.display = 'none';
      loadUsers();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  });
}

async function loadUsers() {
  const el = document.getElementById('allUsersTable');
  try {
    const users = await API('/auth/users');
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    el.innerHTML = `
      <div class="table-wrap">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:600px">
        <thead><tr style="border-bottom:1px solid var(--border)">
          <th style="padding:8px;text-align:left;color:var(--text-muted)">${'Usuario'}</th>
          <th style="padding:8px;text-align:left;color:var(--text-muted)">${'Auth'}</th>
          <th style="padding:8px;text-align:left;color:var(--text-muted)">${'Último inicio'}</th>
          <th style="padding:8px;text-align:left;color:var(--text-muted)">${'Rol'}</th>
          <th style="padding:8px;text-align:left;color:var(--text-muted)">Espacios de trabajo</th>
          <th style="padding:8px;text-align:left;color:var(--text-muted)">${'Acciones'}</th>
        </tr></thead>
        <tbody>
          ${users.map(u => `
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px"><div style="font-weight:500">${u.name || u.email}</div><div style="font-size:11px;color:var(--text-muted)">${u.email}</div></td>
              <td style="padding:8px"><span style="background:var(--bg-primary);padding:2px 8px;border-radius:10px;font-size:11px">${u.auth_provider}</span></td>
              <td style="padding:8px;font-size:11px;color:var(--text-muted)">${u.last_login ? new Date(u.last_login * 1000).toLocaleString() : 'Nunca'}</td>
              <td style="padding:8px">
                <select class="input" style="max-width:140px;width:100%;background:var(--bg-input);font-size:12px;padding:4px" data-role-user="${u.id}">
                  <option value="user" ${u.role === 'user' ? 'selected' : ''}>${'Usuario'}</option>
                  <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>${'Admin'}</option>
                  <option value="platform_admin" ${u.role === 'platform_admin' ? 'selected' : ''}>Platform Admin</option>
                </select>
              </td>
              <td style="padding:8px;font-size:11px;color:var(--text-secondary)">
                ${u.workspaces && u.workspaces.length > 0
                  ? u.workspaces.map(w => `<div>${esc(w.name)} <span style="color:var(--text-muted)">(${w.workspace_role})</span></div>`).join('')
                  : '<span style="color:var(--text-muted)">—</span>'
                }
              </td>
              <td style="padding:8px;white-space:nowrap">
                ${u.auth_provider === 'local' && u.id !== currentUser.id ? `<button class="btn btn-secondary btn-sm" data-reset-pw-user="${u.id}" data-user-email="${u.email}" style="margin-right:4px">${'Restablecer contraseña'}</button>` : ''}
                ${u.role !== 'platform_admin' ? `<button class="btn btn-danger btn-sm" data-delete-user="${u.id}">${'Eliminar'}</button>` : `<span style="color:var(--text-muted);font-size:11px">${'Propietario'}</span>`}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
      <p style="color:var(--text-muted);font-size:11px;margin-top:8px">${(users.length) + ' usuarios totales'}</p>
    `;

    el.querySelectorAll('[data-role-user]').forEach(select => {
      select.onchange = async () => {
        try {
          await API(`/auth/users/${select.dataset.roleUser}/role`, { method: 'PUT', body: JSON.stringify({ role: select.value }) });
          showToast('Rol actualizado', 'success');
        } catch (err) { showToast(err.message, 'error'); loadUsers(); }
      };
    });

    // Reset password handlers
    el.querySelectorAll('[data-reset-pw-user]').forEach(btn => {
      btn.onclick = async () => {
        const email = btn.dataset.userEmail;
        const pw = prompt('Ingresa una nueva contraseña para ' + (email) + ' (mínimo 8 caracteres):');
        if (pw === null) return;
        if (pw.length < 8) { showToast('La contraseña debe tener al menos 8 caracteres', 'error'); return; }
        try {
          await api.resetUserPassword(btn.dataset.resetPwUser, pw);
          showToast('Contraseña restablecida', 'success');
        } catch (err) { showToast(err.message, 'error'); }
      };
    });

    el.querySelectorAll('[data-delete-user]').forEach(btn => {
      let confirming = false;
      btn.onclick = async () => {
        if (confirming) {
          try { await api.deleteUser(btn.dataset.deleteUser); showToast('Usuario eliminado', 'success'); loadUsers(); }
          catch (err) { showToast(err.message, 'error'); }
          return;
        }
        confirming = true; btn.textContent = '¿Confirmar?'; btn.style.background = 'var(--danger)'; btn.style.color = 'white';
        setTimeout(() => { confirming = false; btn.textContent = 'Eliminar'; btn.style.background = ''; btn.style.color = ''; }, 3000);
      };
    });
  } catch (err) { el.innerHTML = `<p style="color:var(--danger)">${esc(err.message)}</p>`; }
}

async function loadSystem() {
  const el = document.getElementById('systemInfo');
  try {
    const version = await fetch('/api/version').then(r => r.json());
    const token = localStorage.getItem('token');
    el.innerHTML = `
      <div class="info-grid">
        <div class="info-card"><div class="info-card-label">${'Versión'}</div><div class="info-card-value small">${version.version}</div></div>
        <div class="info-card"><div class="info-card-label">${'Hash del frontend'}</div><div class="info-card-value small">${version.hash}</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <a href="/api/status/backup?token=${token}" class="btn btn-secondary btn-sm" style="text-decoration:none">${'Descargar respaldo de BD'}</a>
        <a href="/api/status" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none">${'Estado del servidor'}</a>
      </div>
    `;
  } catch (err) { el.innerHTML = `<p style="color:var(--danger)">${esc(err.message)}</p>`; }
}

export function cleanup() {}
