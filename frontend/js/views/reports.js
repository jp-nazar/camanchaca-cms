import { api } from '../api.js';
import { showToast } from '../components/toast.js';
import { esc } from '../utils.js';

const API = (url, opts = {}) => fetch('/api' + url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, ...opts.headers }, ...opts }).then(r => r.json());

export async function render(container, opts = {}) {
  const devices = await api.getDevices();
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  container.innerHTML = `
    <div class="page-header">
      <div><h1>${'Informes'} <span class="help-tip" data-tip="${'Análisis de reproducción. Ve qué se reprodujo, cuándo y en qué dispositivo. Filtra por rango de fechas y dispositivo. Exporta a CSV para verificación.'}">?</span></h1><div class="subtitle">${'Análisis de reproducción y disponibilidad de dispositivos'}</div></div>
      ${opts.uiSimplified ? '' : `
      <a class="btn btn-secondary" id="exportBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        ${'Exportar CSV'}
      </a>
      `}
    </div>

    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:flex-end">
      <div class="form-group" style="margin:0"><label>${'Dispositivo'}</label>
        <select id="reportDevice" class="input" style="width:200px;background:var(--bg-input)">
          <option value="">${'Todos los dispositivos'}</option>
          ${devices.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin:0"><label>${'Fecha de inicio'}</label>
        <input type="date" id="reportStart" class="input" value="${thirtyDaysAgo.toISOString().split('T')[0]}">
      </div>
      <div class="form-group" style="margin:0"><label>${'Fecha de fin'}</label>
        <input type="date" id="reportEnd" class="input" value="${today.toISOString().split('T')[0]}">
      </div>
      <button class="btn btn-primary btn-sm" id="loadReportBtn">${'Cargar informe'}</button>
    </div>

    <div id="reportContent"><div class="empty-state"><h3>${'Selecciona un rango de fechas y haz clic en Cargar informe'}</h3></div></div>
  `;

  document.getElementById('loadReportBtn').onclick = loadReport;
  loadReport();
  if (!opts.uiSimplified) {
    document.getElementById('exportBtn').onclick = () => {
      const deviceId = document.getElementById('reportDevice').value;
      const start = document.getElementById('reportStart').value;
      const end = document.getElementById('reportEnd').value;
      const token = localStorage.getItem('token');
      window.open(`/api/reports/export?device_id=${deviceId}&start=${start}&end=${end}&token=${token}`, '_blank');
    };
  }

  async function loadReport() {
    const deviceId = document.getElementById('reportDevice').value;
    const start = document.getElementById('reportStart').value;
    const end = document.getElementById('reportEnd').value;
    const content = document.getElementById('reportContent');

    content.innerHTML = `<div class="empty-state"><h3>${'Cargando...'}</h3></div>`;

    try {
      const summary = await API(`/reports/summary?device_id=${deviceId}&start=${start}&end=${end}`);

      content.innerHTML = `
        <div class="info-grid" style="margin-bottom:24px">
          <div class="info-card">
            <div class="info-card-label">${'Reproducciones totales'}</div>
            <div class="info-card-value">${summary.overall.total_plays.toLocaleString()}</div>
          </div>
          <div class="info-card">
            <div class="info-card-label">${'Horas totales'}</div>
            <div class="info-card-value">${summary.overall.total_hours}</div>
          </div>
          <div class="info-card">
            <div class="info-card-label">${'Contenido único'}</div>
            <div class="info-card-value">${summary.overall.unique_content}</div>
          </div>
          <div class="info-card">
            <div class="info-card-label">${'Dispositivos activos'}</div>
            <div class="info-card-value">${summary.overall.unique_devices}</div>
          </div>
          <div class="info-card">
            <div class="info-card-label">${'Duración media'}</div>
            <div class="info-card-value small">${formatDuration(summary.overall.avg_duration_sec)}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
          <div class="settings-section" style="margin:0">
            <h3 style="font-size:14px;margin-bottom:12px">${'Reproducciones por día'}</h3>
            <div id="dailyChart" style="height:200px;display:flex;align-items:flex-end;gap:2px"></div>
          </div>

          <div class="settings-section" style="margin:0">
            <h3 style="font-size:14px;margin-bottom:12px">${'Reproducciones por hora'}</h3>
            <div id="hourlyChart" style="height:200px;display:flex;align-items:flex-end;gap:1px"></div>
          </div>
        </div>

        <div class="settings-section" style="margin-bottom:20px">
          <h3 style="font-size:14px;margin-bottom:12px">${'Contenido más reproducido'}</h3>
          <div class="table-wrap">
          <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:460px">
            <thead><tr style="border-bottom:1px solid var(--border)">
              <th style="padding:8px;text-align:left;color:var(--text-muted)">${'Contenido'}</th>
              <th style="padding:8px;text-align:right;color:var(--text-muted)">${'Reproducciones'}</th>
              <th style="padding:8px;text-align:right;color:var(--text-muted)">${'Horas totales'}</th>
              <th style="padding:8px;text-align:right;color:var(--text-muted)">${'Finalización'}</th>
            </tr></thead>
            <tbody>
              ${summary.by_content.map(c => `
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px">${c.content_name || 'Desconocido'}</td>
                  <td style="padding:8px;text-align:right">${c.plays}</td>
                  <td style="padding:8px;text-align:right">${(c.total_seconds / 3600).toFixed(1)}</td>
                  <td style="padding:8px;text-align:right">${c.plays > 0 ? Math.round((c.completed_plays / c.plays) * 100) : 0}%</td>
                </tr>
              `).join('') || `<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--text-muted)">${'Sin datos'}</td></tr>`}
            </tbody>
          </table>
          </div>
        </div>

        <div class="settings-section">
          <h3 style="font-size:14px;margin-bottom:12px">${'Por dispositivo'}</h3>
          <div class="table-wrap">
          <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:400px">
            <thead><tr style="border-bottom:1px solid var(--border)">
              <th style="padding:8px;text-align:left;color:var(--text-muted)">${'Dispositivo'}</th>
              <th style="padding:8px;text-align:right;color:var(--text-muted)">${'Reproducciones'}</th>
              <th style="padding:8px;text-align:right;color:var(--text-muted)">${'Horas totales'}</th>
            </tr></thead>
            <tbody>
              ${summary.by_device.map(d => `
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px">${d.device_name}</td>
                  <td style="padding:8px;text-align:right">${d.plays}</td>
                  <td style="padding:8px;text-align:right">${(d.total_seconds / 3600).toFixed(1)}</td>
                </tr>
              `).join('') || `<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--text-muted)">${'Sin datos'}</td></tr>`}
            </tbody>
          </table>
          </div>
        </div>
      `;

      renderBarChart('dailyChart', summary.by_day.map(d => ({
        label: new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        value: d.plays
      })));

      const hourData = Array.from({ length: 24 }, (_, i) => {
        const found = summary.by_hour.find(h => h.hour === i);
        return { label: i === 0 ? '12a' : i < 12 ? i + 'a' : i === 12 ? '12p' : (i - 12) + 'p', value: found?.plays || 0 };
      });
      renderBarChart('hourlyChart', hourData);

    } catch (err) {
      content.innerHTML = `<div class="empty-state"><h3>${'Error'}</h3><p>${esc(err.message)}</p></div>`;
    }
  }
}

function renderBarChart(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container || !data.length) return;

  const maxVal = Math.max(...data.map(d => d.value), 1);

  container.innerHTML = data.map(d => `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-width:0" title="${d.label}: ${d.value}">
      <div style="font-size:9px;color:var(--text-muted);margin-bottom:2px;display:${d.value > 0 ? 'block' : 'none'}">${d.value}</div>
      <div style="width:100%;max-width:20px;height:${Math.max(2, (d.value / maxVal) * 160)}px;background:var(--accent);border-radius:2px 2px 0 0;min-height:2px"></div>
      <div style="font-size:8px;color:var(--text-muted);margin-top:4px;transform:rotate(-45deg);white-space:nowrap">${d.label}</div>
    </div>
  `).join('');
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  if (seconds < 60) return Math.round(seconds) + 's';
  if (seconds < 3600) return Math.round(seconds / 60) + 'm';
  return (seconds / 3600).toFixed(1) + 'h';
}

export function cleanup() {}
