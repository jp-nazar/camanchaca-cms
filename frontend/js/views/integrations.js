import { t } from '../i18n.js';
import { esc } from '../utils.js';
import { showToast } from '../components/toast.js';

const API = (url, opts = {}) => fetch('/api' + url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json', ...opts.headers }, ...opts }).then(r => r.json());

const TYPE_NAMES = {
  powerbi: 'Power BI',
  looker_studio: 'Looker Studio',
  custom_url: 'URL personalizada',
};

const TYPE_ICONS = {
  powerbi: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 8v8M12 11v5M15 6v10"/></svg>',
  looker_studio: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  custom_url: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
};

export function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div><h1>${'Integraciones'} <span class="help-tip" data-tip="${'Conecta fuentes externas como Power BI, Looker Studio o URLs personalizadas. El sistema descarga automáticamente el contenido y lo almacena para asignarlo a tus pantallas.'}">?</span></h1><div class="subtitle">${'Conecta fuentes de datos externas'}</div></div>
      <button class="btn btn-primary btn-sm" id="newIntegrationBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        ${'Nueva integración'}
      </button>
    </div>
    <div id="integrationList"></div>
  `;
  document.getElementById('newIntegrationBtn')?.addEventListener('click', showCreateModal);
  loadIntegrations();
}

async function loadIntegrations() {
  const list = document.getElementById('integrationList');
  list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">Cargando...</div>';
  try {
    const integrations = await API('/integrations');
    if (!integrations.length) {
      list.innerHTML = `<div class="empty-state"><h3>Aún no hay integraciones</h3><p style="margin-bottom:20px">Conecta Power BI, Looker Studio o una URL personalizada para mostrar contenido externo en tus pantallas.</p><button class="btn btn-primary" id="newIntegrationBtnEmpty">Nueva integración</button></div>`;
      document.getElementById('newIntegrationBtnEmpty')?.addEventListener('click', showCreateModal);
      return;
    }
    list.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">
      ${integrations.map(int => renderCard(int)).join('')}
    </div>`;
    integrations.forEach(int => {
      document.getElementById(`refresh-${int.id}`)?.addEventListener('click', () => triggerRefresh(int.id));
      document.getElementById(`edit-${int.id}`)?.addEventListener('click', () => showEditModal(int));
      document.getElementById(`delete-${int.id}`)?.addEventListener('click', () => confirmDelete(int));
      document.getElementById(`preview-${int.id}`)?.addEventListener('click', () => showPreview(int));
    });
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><h3>Error al cargar</h3><p>${esc(err.message)}</p></div>`;
  }
}

function renderCard(int) {
  const config = int.config || {};
  const statusIcon = int.status === 'success' ? '🟢' : int.status === 'error' ? '🔴' : int.status === 'fetching' ? '🔄' : '⚪';
  const lastFetch = int.last_fetched_at ? new Date(int.last_fetched_at * 1000).toLocaleString() : 'Nunca';
  const hasContent = int.content_filename;
  return `
    <div class="settings-section" style="margin:0;position:relative">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="width:36px;height:36px;border-radius:8px;background:var(--bg-input);display:flex;align-items:center;justify-content:center;color:var(--accent)">${TYPE_ICONS[int.integration_type] || ''}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(int.name)}</div>
          <div style="font-size:12px;color:var(--text-muted)">${TYPE_NAMES[int.integration_type] || int.integration_type}</div>
        </div>
        <span style="font-size:14px" title="${int.status}">${statusIcon}</span>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;line-height:1.6">
        <div>Última actualización: ${lastFetch}</div>
        ${int.last_error ? `<div style="color:var(--danger)">Error: ${esc(int.last_error)}</div>` : ''}
        ${int.enabled ? `<div>Próxima actualización: ${int.next_fetch_at ? new Date(int.next_fetch_at * 1000).toLocaleString() : 'Pendiente'}</div>` : '<div style="color:var(--text-muted)">Deshabilitada</div>'}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${int.enabled ? `<button class="btn btn-secondary btn-sm" id="refresh-${int.id}">Actualizar ahora</button>` : ''}
        ${hasContent ? `<button class="btn btn-secondary btn-sm" id="preview-${int.id}">Vista previa</button>` : ''}
        <button class="btn btn-secondary btn-sm" id="edit-${int.id}">Editar</button>
        <button class="btn btn-danger btn-sm" id="delete-${int.id}">Eliminar</button>
      </div>
    </div>
  `;
}

function showCreateModal() {
  showFormModal(null);
}

function showEditModal(int) {
  showFormModal(int);
}

function showFormModal(existing) {
  const isEdit = !!existing;
  const config = existing?.config || {};
  const type = existing?.integration_type || 'powerbi';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="max-width:560px;width:95vw;max-height:85vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <h3>${isEdit ? 'Editar integración' : 'Nueva integración'}</h3>
        <button class="btn-icon" id="closeFormModal"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body" style="overflow-y:auto;flex:1">
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" id="intName" class="input" value="${esc(existing?.name || '')}" placeholder="Mi dashboard">
        </div>
        <div class="form-group">
          <label>Tipo</label>
          <select id="intType" class="input" style="background:var(--bg-input)">
            <option value="powerbi" ${type === 'powerbi' ? 'selected' : ''}>Power BI</option>
            <option value="looker_studio" ${type === 'looker_studio' ? 'selected' : ''}>Looker Studio</option>
            <option value="custom_url" ${type === 'custom_url' ? 'selected' : ''}>URL personalizada</option>
          </select>
        </div>
        <div id="intConfigFields"></div>
        <div class="form-group" style="margin-top:12px">
          <label>Intervalo de actualización (minutos)</label>
          <input type="number" id="intInterval" class="input" value="${config.refresh_interval_min || 15}" min="1" max="1440">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancelFormBtn">Cancelar</button>
        <button class="btn btn-primary" id="saveFormBtn">${isEdit ? 'Guardar' : 'Crear'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  function renderConfigFields() {
    const t = document.getElementById('intType').value;
    const cfg = existing?.config || {};
    const fields = document.getElementById('intConfigFields');
    if (t === 'powerbi') {
      fields.innerHTML = `
        <div class="form-group"><label>Tenant ID</label><input type="text" id="cfgTenant" class="input" value="${esc(cfg.tenant_id || '')}" placeholder="00000000-0000-0000-0000-000000000000"></div>
        <div class="form-group"><label>Client ID</label><input type="text" id="cfgClientId" class="input" value="${esc(cfg.client_id || '')}" placeholder="00000000-0000-0000-0000-000000000000"></div>
        <div class="form-group"><label>Client Secret</label><input type="password" id="cfgClientSecret" class="input" value="${esc(cfg.client_secret || '')}" placeholder="••••••••"></div>
        <div class="form-group"><label>Workspace ID (Grupo)</label><input type="text" id="cfgWorkspaceId" class="input" value="${esc(cfg.workspace_id || '')}" placeholder="00000000-0000-0000-0000-000000000000"></div>
        <div class="form-group"><label>Report ID</label><input type="text" id="cfgReportId" class="input" value="${esc(cfg.report_id || '')}" placeholder="00000000-0000-0000-0000-000000000000"></div>
        <div class="form-group"><label>Nombre de página (opcional)</label><input type="text" id="cfgPageName" class="input" value="${esc(cfg.page_name || '')}" placeholder="Dejar vacío para usar la página por defecto"></div>
      `;
    } else if (t === 'looker_studio' || t === 'custom_url') {
      fields.innerHTML = `
        <div class="form-group"><label>URL</label><input type="text" id="cfgUrl" class="input" value="${esc(cfg.url || '')}" placeholder="https://..."></div>
        <div class="form-group"><label>Tipo de autenticación</label>
          <select id="cfgAuthType" class="input" style="background:var(--bg-input)">
            <option value="none" ${(cfg.auth_type || 'none') === 'none' ? 'selected' : ''}>Sin autenticación</option>
            <option value="bearer" ${cfg.auth_type === 'bearer' ? 'selected' : ''}>Bearer token</option>
            <option value="basic" ${cfg.auth_type === 'basic' ? 'selected' : ''}>Basic Auth</option>
          </select>
        </div>
        <div class="form-group" id="cfgAuthField" style="${cfg.auth_type && cfg.auth_type !== 'none' ? '' : 'display:none'}">
          <label>Token / Credencial</label>
          <input type="password" id="cfgAuthHeader" class="input" value="${esc(cfg.auth_header || '')}" placeholder="token...">
        </div>
      `;
      document.getElementById('cfgAuthType')?.addEventListener('change', () => {
        document.getElementById('cfgAuthField').style.display = document.getElementById('cfgAuthType').value !== 'none' ? '' : 'none';
      });
    }
  }

  renderConfigFields();
  document.getElementById('intType').addEventListener('change', renderConfigFields);

  document.getElementById('closeFormModal').onclick = () => modal.remove();
  document.getElementById('cancelFormBtn').onclick = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  document.getElementById('saveFormBtn').onclick = async () => {
    const name = document.getElementById('intName').value.trim();
    if (!name) { showToast('El nombre es obligatorio', 'error'); return; }

    const intType = document.getElementById('intType').value;
    const refresh_interval_min = parseInt(document.getElementById('intInterval').value) || 15;
    let config = { refresh_interval_min };

    if (intType === 'powerbi') {
      config.tenant_id = document.getElementById('cfgTenant').value.trim();
      config.client_id = document.getElementById('cfgClientId').value.trim();
      config.client_secret = document.getElementById('cfgClientSecret').value;
      config.workspace_id = document.getElementById('cfgWorkspaceId').value.trim();
      config.report_id = document.getElementById('cfgReportId').value.trim();
      config.page_name = document.getElementById('cfgPageName').value.trim() || null;
      if (!config.tenant_id || !config.client_id || !config.client_secret || !config.workspace_id || !config.report_id) {
        showToast('Completa todos los campos de Power BI', 'error'); return;
      }
    } else {
      config.url = document.getElementById('cfgUrl').value.trim();
      config.auth_type = document.getElementById('cfgAuthType').value;
      config.auth_header = document.getElementById('cfgAuthHeader')?.value || '';
      if (!config.url) { showToast('La URL es obligatoria', 'error'); return; }
    }

    try {
      if (isEdit) {
        await API(`/integrations/${existing.id}`, { method: 'PUT', body: JSON.stringify({ name, integration_type: intType, config }) });
        showToast('Integración actualizada', 'success');
      } else {
        await API('/integrations', { method: 'POST', body: JSON.stringify({ name, integration_type: intType, config }) });
        showToast('Integración creada', 'success');
      }
      modal.remove();
      loadIntegrations();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

async function triggerRefresh(id) {
  try {
    await API(`/integrations/${id}/refresh`, { method: 'POST' });
    showToast('Actualización solicitada', 'success');
    loadIntegrations();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function showPreview(int) {
  if (!int.content_id) return;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="max-width:90vw;width:auto;max-height:90vh">
      <div class="modal-header">
        <h3>${esc(int.name)}</h3>
        <button class="btn-icon" id="closePreview"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="modal-body" style="padding:0;background:#000;text-align:center">
        <img src="/api/content/${int.content_id}/file" style="max-width:100%;max-height:70vh;display:block;margin:0 auto">
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('closePreview').onclick = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function confirmDelete(int) {
  if (!confirm(`¿Eliminar "${int.name}"? Esto también borrará el contenido asociado.`)) return;
  try {
    await API(`/integrations/${int.id}`, { method: 'DELETE' });
    showToast('Integración eliminada', 'success');
    loadIntegrations();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
