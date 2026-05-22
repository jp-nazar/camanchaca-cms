import { showToast } from '../components/toast.js';

const API = (url, opts = {}) => fetch('/api' + url, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}`, ...opts.headers }, ...opts }).then(r => r.json());

export async function render(container) {
  const hash = window.location.hash;
  if (hash.startsWith('#/kiosk/')) {
    const id = hash.split('#/kiosk/')[1];
    return renderEditor(container, id);
  }
  return renderList(container);
}

async function renderList(container) {
  container.innerHTML = `
    <div class="page-header">
      <div><h1>${'Páginas de kiosco'} <span class="help-tip" data-tip="${'Crea interfaces táctiles interactivas. Agrega botones con iconos y acciones. Incluye pantalla inactiva tras inactividad. Asígnalas a dispositivos como widget.'}">?</span></h1><div class="subtitle">${'Crea interfaces táctiles interactivas'}</div></div>
      <button class="btn btn-primary" id="newKioskBtn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        ${'Nueva página de kiosco'}
      </button>
    </div>
    <div class="content-grid" id="kioskGrid"></div>
  `;

  document.getElementById('newKioskBtn').onclick = async () => {
    const name = prompt('Nombre de la página de kiosco:');
    if (!name) return;
    const page = await API('/kiosk', { method: 'POST', body: JSON.stringify({ name }) });
    window.location.hash = `#/kiosk/${page.id}`;
  };

  try {
    const pages = await API('/kiosk');
    const grid = document.getElementById('kioskGrid');
    if (!pages.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>${'Aún no hay páginas'}</h3><p>${'Crea una interfaz táctil interactiva para tus pantallas.'}</p></div>`;
      return;
    }
    grid.innerHTML = pages.map(p => `
      <div class="content-item" style="cursor:pointer" onclick="window.location.hash='#/kiosk/${p.id}'">
        <div class="content-item-preview" style="display:flex;align-items:center;justify-content:center;background:var(--bg-primary)">
          <span style="font-size:48px">&#128433;</span>
        </div>
        <div class="content-item-body">
          <div class="content-item-name">${p.name}</div>
          <div class="content-item-size">${'Página de kiosco'}</div>
        </div>
        <div class="content-item-actions">
          <a href="/api/kiosk/${p.id}/render" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none" onclick="event.stopPropagation()">${'Previsualizar'}</a>
          <button class="btn btn-danger btn-sm" data-delete-kiosk="${p.id}" data-kiosk-name="${p.name}" onclick="event.stopPropagation()">${'Eliminar'}</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-delete-kiosk]').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const name = btn.dataset.kioskName;
        if (!confirm('¿Eliminar la página "' + (name) + '"? Esto no se puede deshacer.')) return;
        try {
          await API(`/kiosk/${btn.dataset.deleteKiosk}`, { method: 'DELETE' });
          showToast('Página eliminada');
          renderList(container);
        } catch (err) {
          showToast(err.message || 'Error al eliminar', 'error');
        }
      };
    });
  } catch (err) { showToast(err.message, 'error'); }
}

async function renderEditor(container, pageId) {
  let page;
  try { page = await API(`/kiosk/${pageId}`); } catch { container.innerHTML = `<div class="empty-state"><h3>${'Página no encontrada'}</h3></div>`; return; }

  let config = JSON.parse(page.config || '{}');
  if (!config.buttons) config.buttons = [];
  if (!config.style) config.style = {};

  container.innerHTML = `
    <a href="#/kiosk" class="back-link" style="display:inline-flex;align-items:center;gap:6px;color:var(--text-secondary);margin-bottom:16px;font-size:13px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
      ${'Volver a páginas'}
    </a>
    <div class="page-header">
      <h1>${page.name}</h1>
      <div style="display:flex;gap:8px">
        <a href="/api/kiosk/${pageId}/render" target="_blank" class="btn btn-secondary" style="text-decoration:none">${'Previsualizar'}</a>
        <button class="btn btn-primary" id="saveKioskBtn">${'Guardar'}</button>
      </div>
    </div>
    <div style="display:flex;gap:20px">
      <div style="flex:1">
        <iframe id="kioskPreview" src="/api/kiosk/${pageId}/render" style="width:100%;aspect-ratio:16/9;border:1px solid var(--border);border-radius:var(--radius-lg)"></iframe>
      </div>
      <div style="width:320px;max-height:calc(100vh - 140px);overflow-y:auto;display:flex;flex-direction:column;gap:12px">
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:12px">
          <h4 style="font-size:13px;margin-bottom:10px">${'Ajustes de la página'}</h4>
          <div class="form-group"><label>${'Título'}</label><input type="text" id="kTitle" class="input" value="${config.title || ''}"></div>
          <div class="form-group"><label>${'Subtítulo'}</label><input type="text" id="kSubtitle" class="input" value="${config.subtitle || ''}"></div>
          <div class="form-group"><label>${'URL del logotipo'}</label><input type="text" id="kLogo" class="input" value="${config.logoUrl || ''}" placeholder="https://..."></div>
          <div class="form-group"><label>${'Texto del pie'}</label><input type="text" id="kFooter" class="input" value="${config.footer || ''}"></div>
          <div class="form-group"><label>${'Título pantalla inactiva'}</label><input type="text" id="kIdleTitle" class="input" value="${config.idleTitle || 'Toca para comenzar'}"></div>
          <div class="form-group"><label>${'Tiempo de inactividad (segundos)'}</label><input type="number" id="kIdleTimeout" class="input" value="${config.idleTimeout || 60}"></div>
        </div>

        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:12px">
          <h4 style="font-size:13px;margin-bottom:10px">${'Estilo'}</h4>
          <div class="form-group"><label>${'Fondo'}</label><input type="text" id="kBg" class="input" value="${config.style?.background || '#111827'}"></div>
          <div class="form-group"><label>${'Color del texto'}</label><input type="color" id="kTextColor" value="${config.style?.textColor || '#f1f5f9'}" style="width:100%;height:28px;border:none;cursor:pointer"></div>
          <div class="form-group"><label>${'Columnas'}</label><select id="kColumns" class="input" style="background:var(--bg-input)">
            <option ${(config.style?.columns || 3) === 2 ? 'selected' : ''} value="2">2</option>
            <option ${(config.style?.columns || 3) === 3 ? 'selected' : ''} value="3">3</option>
            <option ${(config.style?.columns || 3) === 4 ? 'selected' : ''} value="4">4</option>
          </select></div>
          <div class="form-group"><label>${'Color del botón'}</label><input type="color" id="kBtnBg" value="${config.style?.buttonBg || '#1e293b'}" style="width:100%;height:28px;border:none;cursor:pointer"></div>
          <div class="form-group"><label>${'Color hover del botón'}</label><input type="color" id="kBtnHover" value="${config.style?.buttonHover || '#3b82f6'}" style="width:100%;height:28px;border:none;cursor:pointer"></div>
        </div>

        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h4 style="font-size:13px">${'Botones'}</h4>
            <button class="btn btn-secondary btn-sm" id="addBtnBtn">${'+ Agregar'}</button>
          </div>
          <div id="buttonList"></div>
        </div>
      </div>
    </div>
  `;

  function renderButtons() {
    const list = document.getElementById('buttonList');
    list.innerHTML = config.buttons.map((btn, i) => `
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius);padding:8px;margin-bottom:6px">
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <input type="text" class="input" value="${btn.icon || ''}" placeholder="${'Emoji'}" style="width:50px;text-align:center" data-btn="${i}" data-field="icon">
          <input type="text" class="input" value="${btn.label || ''}" placeholder="${'Etiqueta'}" style="flex:1" data-btn="${i}" data-field="label">
        </div>
        <input type="text" class="input" value="${btn.sublabel || ''}" placeholder="${'Sub-etiqueta'}" style="font-size:12px;margin-bottom:4px" data-btn="${i}" data-field="sublabel">
        <div style="display:flex;gap:6px;align-items:center">
          <select class="input" style="background:var(--bg-input);font-size:11px;flex:1" data-btn="${i}" data-field="action">
            <option value="" ${!btn.action ? 'selected' : ''}>${'Sin acción'}</option>
            <option value="url" ${btn.action === 'url' ? 'selected' : ''}>${'Abrir URL'}</option>
            <option value="page" ${btn.action === 'page' ? 'selected' : ''}>${'Ir a página'}</option>
          </select>
          <button class="btn-icon" style="color:var(--danger)" data-remove-btn="${i}" title="${'Eliminar'}">&#10005;</button>
        </div>
        <input type="text" class="input" value="${btn.url || btn.page || ''}" placeholder="${'URL o página'}" style="font-size:11px;margin-top:4px" data-btn="${i}" data-field="url">
      </div>
    `).join('') || `<p style="color:var(--text-muted);font-size:12px">${'Aún no hay botones'}</p>`;

    list.querySelectorAll('[data-btn]').forEach(input => {
      input.oninput = () => {
        const idx = parseInt(input.dataset.btn);
        const field = input.dataset.field;
        if (field === 'url' && config.buttons[idx].action === 'page') config.buttons[idx].page = input.value;
        else config.buttons[idx][field] = input.tagName === 'SELECT' ? input.value : input.value;
      };
    });
    list.querySelectorAll('[data-remove-btn]').forEach(btn => {
      btn.onclick = () => { config.buttons.splice(parseInt(btn.dataset.removeBtn), 1); renderButtons(); };
    });
  }

  document.getElementById('addBtnBtn').onclick = () => {
    config.buttons.push({ label: 'Nuevo botón', sublabel: '', icon: '&#11088;', action: '', url: '' });
    renderButtons();
  };

  document.getElementById('saveKioskBtn').onclick = async () => {
    config.title = document.getElementById('kTitle').value;
    config.subtitle = document.getElementById('kSubtitle').value;
    config.logoUrl = document.getElementById('kLogo').value;
    config.footer = document.getElementById('kFooter').value;
    config.idleTitle = document.getElementById('kIdleTitle').value;
    config.idleTimeout = parseInt(document.getElementById('kIdleTimeout').value) || 60;
    config.style = {
      ...config.style,
      background: document.getElementById('kBg').value,
      textColor: document.getElementById('kTextColor').value,
      columns: parseInt(document.getElementById('kColumns').value),
      buttonBg: document.getElementById('kBtnBg').value,
      buttonHover: document.getElementById('kBtnHover').value,
    };

    try {
      await API(`/kiosk/${pageId}`, { method: 'PUT', body: JSON.stringify({ config }) });
      showToast('Página guardada', 'success');
      document.getElementById('kioskPreview').src = `/api/kiosk/${pageId}/render?t=${Date.now()}`;
    } catch (err) { showToast(err.message, 'error'); }
  };

  renderButtons();
}

export function cleanup() {}
