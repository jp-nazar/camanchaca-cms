import { t } from '../i18n.js';
import { showToast } from '../components/toast.js';
import { esc } from '../utils.js';

const API = (url) => fetch('/api' + url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }}).then(r => r.json());

export async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div><h1>${'Registro de actividad'}</h1><div class="subtitle">${'Historial de auditoría de todas las acciones'}</div></div>
    </div>
    <div id="activityList"><div class="empty-state"><h3>${'Cargando...'}</h3></div></div>
    <div style="text-align:center;margin-top:16px">
      <button class="btn btn-secondary btn-sm" id="loadMoreBtn" style="display:none">${'Cargar más'}</button>
    </div>
  `;

  let offset = 0;
  const limit = 50;

  async function loadActivity(append = false) {
    try {
      const items = await API(`/activity?limit=${limit}&offset=${offset}`);
      const list = document.getElementById('activityList');

      if (!append) list.innerHTML = '';

      if (items.length === 0 && offset === 0) {
        list.innerHTML = `<div class="empty-state"><h3>${'Aún no hay actividad'}</h3><p>${'Las acciones aparecerán aquí a medida que uses el sistema.'}</p></div>`;
        return;
      }

      const html = items.map(item => {
        const time = new Date(item.created_at * 1000);
        const timeStr = time.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
                        time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        const icon = getActionIcon(item.action);

        return `
          <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);align-items:flex-start">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--bg-card);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px">${icon}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px">
                <strong>${esc(item.user_name || item.user_email || 'Sistema')}</strong>
                <span style="color:var(--text-secondary)"> ${esc(formatAction(item.action))}</span>
              </div>
              ${item.details ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${esc(item.details)}</div>` : ''}
            </div>
            <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;flex-shrink:0">${timeStr}</div>
          </div>
        `;
      }).join('');

      if (append) {
        list.insertAdjacentHTML('beforeend', html);
      } else {
        list.innerHTML = html;
      }

      document.getElementById('loadMoreBtn').style.display = items.length >= limit ? '' : 'none';
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  document.getElementById('loadMoreBtn').onclick = () => {
    offset += limit;
    loadActivity(true);
  };

  loadActivity();
}

function getActionIcon(action) {
  if (action.includes('DELETE')) return '&#128465;';
  if (action.includes('POST') && action.includes('content')) return '&#128228;';
  if (action.includes('POST') && action.includes('provision')) return '&#128279;';
  if (action.includes('POST') && action.includes('assignment')) return '&#128203;';
  if (action.includes('alert')) return '&#128276;';
  if (action.includes('PUT')) return '&#9998;';
  if (action.includes('POST')) return '&#10133;';
  return '&#128196;';
}

// Action verbs are user-visible; translate them through t() so they switch
// languages with the rest of the UI. The mapping below preserves the original
// verb-then-noun structure of the English version.
function formatAction(action) {
  // Verbs
  let s = action
    .replace('POST /api/', 'creó' + ' ')
    .replace('PUT /api/', 'actualizó' + ' ')
    .replace('DELETE /api/', 'eliminó' + ' ');
  // Specific endpoints
  s = s
    .replace('/provision/pair', 'vinculó un dispositivo')
    .replace('/content/remote', 'agregó contenido remoto')
    .replace('/content', 'contenido')
    .replace('/devices/:id', 'dispositivo')
    .replace('/assignments/device/:deviceId', 'asignación de lista')
    .replace('/assignments/:id', 'asignación')
    .replace('/layouts', 'diseño')
    .replace('/schedules', 'horario')
    .replace('/walls', 'muro de video')
    .replace('alert:device_offline', 'alerta: dispositivo desconectado');
  return s;
}

export function cleanup() {}
