import { api } from '../api.js';
import { showToast } from '../components/toast.js';
import { esc, isPlatformAdmin } from '../utils.js';

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });
const API = (url, opts = {}) => fetch('/api' + url, { headers: headers(), ...opts }).then(r => r.json());

export async function render(container, opts = {}) {
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
          <div class="form-group">
            <label>Workspace</label>
            <select id="newUserWorkspace" class="input">
              <option value="">Sin workspace</option>
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
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3>${'Workspaces'}</h3>
        <button class="btn btn-primary btn-sm" id="showCreateWorkspaceBtn">+ Crear workspace</button>
      </div>

      <div id="createWorkspaceForm" style="display:none;margin-bottom:20px;padding:16px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius)">
        <h4 style="margin-bottom:12px;font-size:14px">Nuevo workspace</h4>
        <div style="display:grid;grid-template-columns:1fr;gap:12px">
          <div class="form-group">
            <label>Nombre</label>
            <input type="text" id="newWorkspaceName" class="input" placeholder="Ej: Planta Santiago">
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn btn-primary btn-sm" id="createWorkspaceBtn">Crear workspace</button>
          <button class="btn btn-secondary btn-sm" id="cancelCreateWorkspaceBtn">Cancelar</button>
        </div>
        <p id="createWorkspaceError" style="color:var(--danger);font-size:12px;margin-top:8px;display:none"></p>
      </div>

      <div id="workspacesTable"><p style="color:var(--text-muted)">${'Cargando...'}</p></div>
    </div>

    <div class="settings-section">
      <h3>${'Sistema'}</h3>
      <div id="systemInfo"><p style="color:var(--text-muted)">${'Cargando...'}</p></div>
    </div>
  `;

  loadUsers();
  loadWorkspaces();
  loadSystem(opts);

  // Create user form handlers
  document.getElementById('showCreateUserBtn')?.addEventListener('click', async () => {
    document.getElementById('createUserForm').style.display = 'block';
    document.getElementById('showCreateUserBtn').style.display = 'none';
    await populateWorkspaceSelect();
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
    const workspace_id = document.getElementById('newUserWorkspace').value || undefined;
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
        body: JSON.stringify({ email, name, password, role, workspace_id })
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

  // Create workspace form handlers
  document.getElementById('showCreateWorkspaceBtn')?.addEventListener('click', () => {
    document.getElementById('createWorkspaceForm').style.display = 'block';
    document.getElementById('showCreateWorkspaceBtn').style.display = 'none';
  });

  document.getElementById('cancelCreateWorkspaceBtn')?.addEventListener('click', () => {
    document.getElementById('createWorkspaceForm').style.display = 'none';
    document.getElementById('showCreateWorkspaceBtn').style.display = 'inline-flex';
    document.getElementById('createWorkspaceError').style.display = 'none';
  });

  document.getElementById('createWorkspaceBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('newWorkspaceName').value.trim();
    const errorEl = document.getElementById('createWorkspaceError');

    if (!name) {
      errorEl.textContent = 'El nombre del workspace es obligatorio';
      errorEl.style.display = 'block';
      return;
    }

    try {
      const res = await api.createWorkspace(name);
      if (res?.id) {
        showToast('Workspace creado correctamente', 'success');
        document.getElementById('newWorkspaceName').value = '';
        document.getElementById('createWorkspaceForm').style.display = 'none';
        document.getElementById('showCreateWorkspaceBtn').style.display = 'inline-flex';
        errorEl.style.display = 'none';
        loadWorkspaces();
      } else {
        errorEl.textContent = 'Error al crear workspace';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      errorEl.textContent = err.message || 'Error al crear workspace';
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
                <select class="input" style="max-width:150px;width:100%;background:var(--bg-input);font-size:12px;padding:4px" data-role-user="${u.id}">
                  <option value="user" ${u.role === 'user' ? 'selected' : ''}>${'Usuario'}</option>
                  <option value="workspace_editor" ${u.role === 'workspace_editor' ? 'selected' : ''}>Editor de espacio</option>
                  <option value="workspace_admin" ${u.role === 'workspace_admin' ? 'selected' : ''}>Admin de espacio</option>
                  <option value="platform_admin" ${u.role === 'platform_admin' ? 'selected' : ''}>Platform Admin</option>
                </select>
              </td>
              <td style="padding:8px;font-size:11px;color:var(--text-secondary)">
                ${u.workspaces && u.workspaces.length > 0
                  ? u.workspaces.map(w => `<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px">
                      <span style="white-space:nowrap">${esc(w.name)}:</span>
                      <select class="input" style="max-width:130px;width:auto;background:var(--bg-input);font-size:11px;padding:2px 4px" data-ws-role-user="${u.id}" data-ws-id="${esc(w.id)}">
                        <option value="workspace_editor" ${w.workspace_role === 'workspace_editor' ? 'selected' : ''}>Editor</option>
                        <option value="workspace_admin" ${w.workspace_role === 'workspace_admin' ? 'selected' : ''}>Admin</option>
                        <option value="workspace_viewer" ${w.workspace_role === 'workspace_viewer' ? 'selected' : ''}>Visualizador</option>
                      </select>
                    </div>`).join('')
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

    // Workspace role change handlers
    el.querySelectorAll('[data-ws-role-user]').forEach(select => {
      select.onchange = async () => {
        try {
          await API(`/auth/users/${select.dataset.wsRoleUser}/workspace-role`, {
            method: 'PUT',
            body: JSON.stringify({ workspace_id: select.dataset.wsId, role: select.value })
          });
          showToast('Rol de workspace actualizado', 'success');
        } catch (err) { showToast(err.message, 'error'); loadUsers(); }
      };
    });
  } catch (err) { el.innerHTML = `<p style="color:var(--danger)">${esc(err.message)}</p>`; }
}

async function loadWorkspaces() {
  const el = document.getElementById('workspacesTable');
  try {
    const workspaces = await api.createWorkspace ? await fetch('/api/workspaces', { headers: headers() }).then(r => r.json()) : [];
    if (!Array.isArray(workspaces)) {
      el.innerHTML = '<p style="color:var(--text-muted)">No se pudieron cargar los workspaces</p>';
      return;
    }

    el.innerHTML = `
      <div class="table-wrap">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:400px">
        <thead><tr style="border-bottom:1px solid var(--border)">
          <th style="padding:8px;text-align:left;color:var(--text-muted)">${'Nombre'}</th>
          <th style="padding:8px;text-align:left;color:var(--text-muted)">${'Creado'}</th>
          <th style="padding:8px;text-align:left;color:var(--text-muted)">${'Acciones'}</th>
        </tr></thead>
        <tbody>
          ${workspaces.map(w => `
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px"><div style="font-weight:500">${esc(w.name)}</div></td>
              <td style="padding:8px;font-size:11px;color:var(--text-muted)">${w.created_at ? new Date(w.created_at * 1000).toLocaleDateString() : '—'}</td>
              <td style="padding:8px;white-space:nowrap">
                <button class="btn btn-secondary btn-sm" data-rename-workspace="${esc(w.id)}" data-workspace-name="${esc(w.name)}" style="margin-right:4px">${'Renombrar'}</button>
                ${workspaces.length > 1 ? `<button class="btn btn-danger btn-sm" data-delete-workspace="${esc(w.id)}" data-workspace-name="${esc(w.name)}">${'Eliminar'}</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
      <p style="color:var(--text-muted);font-size:11px;margin-top:8px">${workspaces.length + ' workspaces'}</p>
    `;

    el.querySelectorAll('[data-rename-workspace]').forEach(btn => {
      btn.onclick = async () => {
        const wsId = btn.dataset.renameWorkspace;
        const currentName = btn.dataset.workspaceName;
        const newName = prompt('Nuevo nombre para el workspace:', currentName);
        if (!newName || newName.trim() === '' || newName.trim() === currentName) return;
        try {
          await api.renameWorkspace(wsId, { name: newName.trim() });
          showToast('Workspace renombrado', 'success');
          loadWorkspaces();
        } catch (err) { showToast(err.message, 'error'); }
      };
    });

    el.querySelectorAll('[data-delete-workspace]').forEach(btn => {
      let confirming = false;
      btn.onclick = async () => {
        if (confirming) {
          try {
            await fetch(`/api/workspaces/${btn.dataset.deleteWorkspace}`, { method: 'DELETE', headers: headers() });
            showToast('Workspace eliminado', 'success');
            loadWorkspaces();
          } catch (err) { showToast(err.message, 'error'); }
          return;
        }
        confirming = true;
        btn.textContent = '¿Confirmar?';
        btn.style.background = 'var(--danger)';
        btn.style.color = 'white';
        setTimeout(() => {
          confirming = false;
          btn.textContent = 'Eliminar';
          btn.style.background = '';
          btn.style.color = '';
        }, 3000);
      };
    });
  } catch (err) { el.innerHTML = `<p style="color:var(--danger)">${esc(err.message)}</p>`; }
}

async function loadSystem(opts = {}) {
  const el = document.getElementById('systemInfo');
  try {
    const version = await fetch('/api/version').then(r => r.json());
    const token = localStorage.getItem('token');
    const commitDisplay = version.commit ? `${version.commit} (${version.branch || 'main'})` : '—';
    const deployedDisplay = version.deployedAt
      ? new Date(version.deployedAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
      : '—';
    el.innerHTML = `
      <div class="info-grid">
        <div class="info-card"><div class="info-card-label">${'Versión'}</div><div class="info-card-value small">${version.version}</div></div>
        <div class="info-card"><div class="info-card-label">${'Hash del frontend'}</div><div class="info-card-value small">${version.hash}</div></div>
        <div class="info-card"><div class="info-card-label">${'Commit'}</div><div class="info-card-value small">${commitDisplay}</div></div>
        <div class="info-card"><div class="info-card-label">${'Mensaje del commit'}</div><div class="info-card-value small" style="white-space:normal;line-height:1.3">${version.commitMessage || '—'}</div></div>
        <div class="info-card"><div class="info-card-label">${'Desplegado'}</div><div class="info-card-value small">${deployedDisplay}</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        ${opts.uiSimplified ? '' : `<a href="/api/status/backup?token=${token}" class="btn btn-secondary btn-sm" style="text-decoration:none">${'Descargar respaldo de BD'}</a>`}
        <a href="/api/status" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none">${'Estado del servidor'}</a>
        <a href="/api/version" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none">${'Ver versión JSON'}</a>
      </div>
    `;
  } catch (err) { el.innerHTML = `<p style="color:var(--danger)">${esc(err.message)}</p>`; }
}

async function populateWorkspaceSelect() {
  const select = document.getElementById('newUserWorkspace');
  if (!select) return;
  try {
    const workspaces = await fetch('/api/workspaces', { headers: headers() }).then(r => r.json());
    if (!Array.isArray(workspaces)) return;
    select.innerHTML = '<option value="">Sin workspace</option>' +
      workspaces.map(w => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('');
  } catch (_) {}
}

export function cleanup() {}
