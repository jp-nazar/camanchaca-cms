import { t } from '../i18n.js';
import { api } from '../api.js';
import { showToast } from '../components/toast.js';
import { esc, isPlatformAdmin } from '../utils.js';


export async function render(container) {
  const serverUrl = `${window.location.protocol}//${window.location.host}`;
  // Fetch fresh user from the server — role may have been changed
  // by an admin since login. Fall back to localStorage if the request fails.
  let user;
  try { user = await api.getMe(); localStorage.setItem('user', JSON.stringify(user)); }
  catch { user = JSON.parse(localStorage.getItem('user') || '{}'); }
  const isSuperAdmin = isPlatformAdmin(user);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${'Configuración'}</h1>
        <div class="subtitle">${'Configuración del servidor e información de instalación'}</div>
      </div>
    </div>

    <div class="settings-section">
      <h3>${'Cuenta'}</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
        <div class="form-group"><label>${'Correo electrónico'}</label><input type="email" class="input" value="${esc(user.email || '')}" disabled></div>
        <div class="form-group"><label>${'Nombre'}</label><input type="text" id="acctName" class="input" value="${esc(user.name || '')}"></div>
      </div>
      <div class="form-group" style="margin-top:12px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="acctEmailAlerts" ${user.email_alerts ? 'checked' : ''}>
          <span>${'settings.email_alerts'}</span>
        </label>
      </div>
      <button class="btn btn-secondary btn-sm" id="saveAcctBtn">${'Guardar perfil'}</button>

      ${user.auth_provider === 'local' ? `
      <div style="border-top:1px solid var(--border);margin-top:20px;padding-top:16px">
        <h4 style="font-size:14px;margin-bottom:8px">${'Cambiar contraseña'}</h4>
        <p style="color:var(--text-muted);font-size:12px;margin-bottom:12px">${'Debe tener al menos 8 caracteres.'}</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
          <div class="form-group"><label>${'Contraseña actual'}</label><input type="password" id="acctCurrentPw" class="input" autocomplete="current-password"></div>
          <div class="form-group"><label>${'Contraseña nueva'}</label><input type="password" id="acctNewPw" class="input" autocomplete="new-password"></div>
          <div class="form-group"><label>${'Confirmar contraseña nueva'}</label><input type="password" id="acctConfirmPw" class="input" autocomplete="new-password"></div>
        </div>
        <button class="btn btn-primary btn-sm" id="changePwBtn">${'Cambiar contraseña'}</button>
      </div>
      ` : `
      <p style="color:var(--text-muted);font-size:12px;margin-top:16px">${'Inicias sesión con ' + (esc(user.auth_provider || 'SSO')) + '. Gestiona tu contraseña ahí.'}</p>
      `}
    </div>

    ${isSuperAdmin ? `<p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">${'Las herramientas de administración están en la'} <a href="#/admin" style="color:var(--accent)">${'Administrador'}</a> ${'.'}</p>` : ''}

    <div class="settings-section">
      <h3>${'Información del servidor'}</h3>
      <div class="info-grid">
        <div class="info-card">
          <div class="info-card-label">${'URL del servidor'}</div>
          <div class="info-card-value small">${serverUrl}</div>
          <p style="font-size:11px;color:var(--text-muted);margin-top:4px">${'Usa esta URL al configurar la app de Android'}</p>
        </div>
        <div class="info-card">
          <div class="info-card-label">${'Endpoint de la API'}</div>
          <div class="info-card-value small">${serverUrl}/api</div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3>${'Guía de instalación'}</h3>
      <div style="color:var(--text-secondary);font-size:13px;line-height:1.8">
        <ol style="padding-left:20px;list-style:decimal">
          <li>${'Instala el APK de Camanchaca CMS en tu TV mediante sideloading'}</li>
          <li>${'Abre la app e ingresa esta URL del servidor:'} <code style="background:var(--bg-input);padding:2px 6px;border-radius:4px">${serverUrl}</code></li>
          <li>${'La app mostrará un código de vinculación de 6 dígitos'}</li>
          <li>${'Haz clic en "Agregar pantalla" en el panel e ingresa el código'}</li>
          <li>${'Sube contenido en la Biblioteca de contenido'}</li>
          <li>${'Asigna contenido a la lista de la pantalla'}</li>
        </ol>
      </div>
    </div>

    <div class="settings-section">
      <h3>${'Tus datos'}</h3>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">${'Exporta o importa tus dispositivos, contenido, diseños, horarios y toda la configuración. Úsalo para migrar entre instancias en la nube y autoalojadas.'}</p>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" id="exportDataBtn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          ${'Exportar mis datos'}
        </button>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-secondary);cursor:pointer">
          <input type="checkbox" id="exportIncludeFiles"> ${'Incluir archivos multimedia (ZIP)'}
        </label>
        <button class="btn btn-secondary btn-sm" id="importDataBtn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          ${'Importar datos'}
        </button>
        <input type="file" id="importFileInput" accept=".json,.zip" style="display:none">
      </div>
      <div id="importStatus" style="display:none;margin-top:12px;padding:12px;border-radius:var(--radius);font-size:13px"></div>
    </div>

  `;

  // Export data handler
  document.getElementById('exportDataBtn')?.addEventListener('click', () => {
    const includeFiles = document.getElementById('exportIncludeFiles')?.checked;
    const token = localStorage.getItem('token');
    const url = `/api/status/export?token=${token}${includeFiles ? '&include_files=true' : ''}`;
    window.location.href = url;
  });

  // Import data handler
  document.getElementById('importDataBtn')?.addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isZip = file.name.endsWith('.zip') || file.type === 'application/zip';
    const statusEl = document.getElementById('importStatus');
    statusEl.style.display = 'block';
    statusEl.style.background = 'var(--bg-secondary)';
    statusEl.style.border = '1px solid var(--border)';
    statusEl.style.color = 'var(--text-secondary)';
    statusEl.textContent = 'Leyendo archivo...';
    try {
      let data;
      if (isZip) {
        // For ZIP, show basic info and skip preview parsing
        data = { format: 'camanchaca-export-v1', _isZip: true };
        statusEl.innerHTML = `${'Exportación ZIP detectada: <strong>' + (esc(file.name)) + '</strong> (' + ((file.size / 1048576).toFixed(1)) + ' MB)<br>Contiene datos + archivos multimedia.'}<br><br><button class="btn btn-primary btn-sm" id="confirmImportBtn">${'Confirmar importación'}</button> <button class="btn btn-secondary btn-sm" id="cancelImportBtn">${'Cancelar'}</button>`;
      } else {
        const text = await file.text();
        data = JSON.parse(text);
        if (!data.format || !data.format.startsWith('camanchaca-export')) {
          statusEl.style.color = 'var(--danger)';
          statusEl.textContent = 'Archivo no válido. Debe ser un JSON o ZIP de exportación de Camanchaca CMS.';
          return;
        }
        const summary = [
          data.devices?.length ? (data.devices.length) + ' dispositivos' : null,
          data.content?.length ? (data.content.length) + ' elementos de contenido' : null,
          data.layouts?.length ? (data.layouts.length) + ' diseños' : null,
          data.schedules?.length ? (data.schedules.length) + ' horarios' : null,
          data.video_walls?.length ? (data.video_walls.length) + ' muros de video' : null,
        ].filter(Boolean).join(', ');
        statusEl.innerHTML = `${'Encontrado: ' + (esc(summary) || t('settings.import.empty_export')) + '.<br>De: ' + (esc(data.user?.email) || t('common.unknown')) + ' (exportado ' + (esc(data.exported_at?.split('T')[0]) || t('common.unknown')) + ')'}<br><br><button class="btn btn-primary btn-sm" id="confirmImportBtn">${'Confirmar importación'}</button> <button class="btn btn-secondary btn-sm" id="cancelImportBtn">${'Cancelar'}</button>`;
      }
      document.getElementById('cancelImportBtn').onclick = () => { statusEl.style.display = 'none'; e.target.value = ''; };
      document.getElementById('confirmImportBtn').onclick = async () => {
        statusEl.innerHTML = isZip ? 'Subiendo e importando... Esto puede tardar para archivos grandes.' : 'Importando...';
        try {
          const token = localStorage.getItem('token');
          let res;
          if (isZip) {
            const formData = new FormData();
            formData.append('file', file);
            res = await fetch('/api/status/import', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: formData,
            });
          } else {
            res = await fetch('/api/status/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(data),
            });
          }
          const result = await res.json();
          if (res.ok) {
            const imported = Object.entries(result.stats).filter(([k,v]) => v > 0 && k !== 'files_restored').map(([k,v]) => `${v} ${k}`).join(', ');
            statusEl.style.color = 'var(--success)';
            let html = 'Importación completa: ' + (imported) + '.';
            if (result.device_pairings?.length) {
              html += `<br><br><strong>${'Códigos de vinculación:'}</strong><br><table style="margin-top:8px;font-size:12px;border-collapse:collapse">` +
                result.device_pairings.map(d => `<tr><td style="padding:4px 12px 4px 0">${d.name}</td><td style="font-family:monospace;font-weight:700;font-size:14px;letter-spacing:2px">${d.pairing_code}</td></tr>`).join('') +
                `</table><br>${'Ingresa estos códigos en cada dispositivo para volver a vincularlos. Las asignaciones y horarios se conservarán.'}`;
            }
            html += `<br><br>${(result.notes || []).map(n => '&bull; ' + n).join('<br>')}`;
            statusEl.innerHTML = html;
            showToast('Datos importados correctamente', 'success');
          } else {
            statusEl.style.color = 'var(--danger)';
            statusEl.textContent = result.error || 'Error al importar';
          }
        } catch (err) {
          statusEl.style.color = 'var(--danger)';
          statusEl.textContent = 'Error al importar: ' + (err.message);
        }
        e.target.value = '';
      };
    } catch (err) {
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = 'Error al leer el archivo: ' + (err.message);
    }
  });

  document.getElementById('langSelect')?.addEventListener('change', (e) => {
    // setLanguage dispatches hashchange so the router re-renders the current
    // view (including this settings page) with new strings — no refresh needed.
    setLanguage(e.target.value);
  });

  document.getElementById('saveAcctBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('acctName').value.trim();
    if (!name) return showToast('El nombre no puede estar vacío', 'error');
    const email_alerts = !!document.getElementById('acctEmailAlerts')?.checked;
    const btn = document.getElementById('saveAcctBtn');
    btn.disabled = true;
    try {
      const updated = await api.updateMe({ name, email_alerts });
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, ...updated }));
      showToast('Perfil guardado', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('changePwBtn')?.addEventListener('click', async () => {
    const current = document.getElementById('acctCurrentPw').value;
    const next = document.getElementById('acctNewPw').value;
    const confirm = document.getElementById('acctConfirmPw').value;
    if (!current) return showToast('Ingresa tu contraseña actual', 'error');
    if (next.length < 8) return showToast('La nueva contraseña debe tener al menos 8 caracteres', 'error');
    if (next !== confirm) return showToast('Las nuevas contraseñas no coinciden', 'error');
    const btn = document.getElementById('changePwBtn');
    btn.disabled = true;
    try {
      await api.updateMe({ current_password: current, password: next });
      document.getElementById('acctCurrentPw').value = '';
      document.getElementById('acctNewPw').value = '';
      document.getElementById('acctConfirmPw').value = '';
      showToast('Contraseña cambiada', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

export function cleanup() {}
