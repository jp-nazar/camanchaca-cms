import { showToast } from '../components/toast.js';

// Steps are computed lazily so translated strings refresh on language change.
function getSteps() {
  return [
    {
      title: '¡Bienvenido a Camanchaca CMS!',
      icon: '&#128075;',
      content: `<p style="font-size:16px;color:var(--text-secondary);margin-bottom:16px">${'Vamos a configurarlo todo en menos de 5 minutos.'}</p>
        <p style="color:var(--text-muted);font-size:14px">${'Este asistente te guiará a través de:'}</p>
        <ul style="color:var(--text-muted);font-size:14px;padding-left:20px;margin-top:8px;line-height:2">
          <li>${'Descargar la app del reproductor'}</li>
          <li>${'Vincular tu primera pantalla'}</li>
          <li>${'Subir y asignar contenido'}</li>
        </ul>`,
      action: null
    },
    {
      title: 'Paso 1: Obtén la app del reproductor',
      icon: '&#128229;',
      content: `<p style="color:var(--text-secondary);margin-bottom:16px">${'Instala el reproductor en tu dispositivo de pantalla.'}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <a href="/download/apk" style="background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:16px;text-align:center;text-decoration:none;color:var(--text-primary)">
            <div style="font-size:32px;margin-bottom:8px">&#129302;</div>
            <div style="font-weight:600;font-size:14px">${'APK Android'}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${'Cajas TV, tabletas, Fire TV'}</div>
          </a>
          <a href="/player" target="_blank" style="background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:16px;text-align:center;text-decoration:none;color:var(--text-primary)">
            <div style="font-size:32px;margin-bottom:8px">&#127760;</div>
            <div style="font-weight:600;font-size:14px">${'Reproductor web'}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${'Cualquier navegador, Pi, ChromeOS'}</div>
          </a>
        </div>
        <p style="color:var(--text-muted);font-size:12px;margin-top:12px">${'Abre la app en tu pantalla e ingresa esta URL del servidor:'}</p>
        <code style="display:block;background:var(--bg-input);padding:10px;border-radius:6px;margin-top:6px;font-size:14px;user-select:all">${window.location.origin}</code>`,
      action: null
    },
    {
      title: 'Paso 2: Vincula tu pantalla',
      icon: '&#128279;',
      content: `<p style="color:var(--text-secondary);margin-bottom:16px">${'Ingresa el código de 6 dígitos mostrado en tu pantalla.'}</p>
        <div style="text-align:center;margin:20px 0">
          <input type="text" id="onboardPairingCode" maxlength="6" pattern="[0-9]{6}" placeholder="000000"
            style="max-width:240px;width:100%;padding:16px;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;
            color:var(--text-primary);font-size:32px;font-weight:700;text-align:center;letter-spacing:8px;font-family:monospace">
        </div>
        <div style="text-align:center">
          <input type="text" id="onboardDeviceName" placeholder="${'Nombre (p. ej., TV Vestíbulo)'}"
            style="max-width:240px;width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:14px;text-align:center">
        </div>
        <p id="onboardPairStatus" style="color:var(--text-muted);font-size:13px;text-align:center;margin-top:12px"></p>`,
      action: 'pair'
    },
    {
      title: 'Paso 3: Sube contenido',
      icon: '&#128228;',
      content: `<p style="color:var(--text-secondary);margin-bottom:16px">${'Sube un video o imagen para mostrar.'}</p>
        <div style="border:2px dashed var(--border);border-radius:12px;padding:32px;text-align:center;cursor:pointer" id="onboardUploadArea">
          <div style="font-size:32px;margin-bottom:8px">&#128193;</div>
          <p style="color:var(--text-secondary)">${'Haz clic para seleccionar un archivo'}</p>
          <p style="color:var(--text-muted);font-size:12px;margin-top:4px">${'MP4, WebM, JPEG, PNG, GIF'}</p>
          <input type="file" id="onboardFileInput" style="display:none" accept="video/*,image/*">
        </div>
        <div id="onboardUploadProgress" style="display:none;margin-top:12px">
          <div style="height:4px;background:var(--bg-primary);border-radius:2px;overflow:hidden">
            <div id="onboardProgressBar" style="height:100%;background:var(--accent);width:0%;transition:width 0.3s"></div>
          </div>
          <p id="onboardUploadText" style="font-size:12px;color:var(--text-muted);margin-top:6px">${'Subiendo...'}</p>
        </div>`,
      action: 'upload'
    },
    {
      title: '¡Todo listo!',
      icon: '&#127881;',
      content: `<p style="font-size:16px;color:var(--text-secondary);margin-bottom:20px">${'¡Tu pantalla está vinculada y el contenido se está reproduciendo!'}</p>
        <div style="background:var(--bg-input);border-radius:8px;padding:16px;margin-bottom:16px">
          <p style="font-size:14px;color:var(--text-primary);font-weight:600;margin-bottom:8px">${'¿Qué sigue?'}</p>
          <ul style="color:var(--text-muted);font-size:13px;padding-left:20px;line-height:2">
            <li>${'Agrega más contenido en la <strong>Biblioteca de contenido</strong>'}</li>
            <li>${'Crea diseños multizona en <strong>Diseños</strong>'}</li>
            <li>${'Configura un horario en el calendario de <strong>Horario</strong>'}</li>
          </ul>
        </div>`,
      action: null
    }
  ];
}

export function render(container) {
  let currentStep = 0;
  let pairedDeviceId = null;

  function renderStep() {
    const STEPS = getSteps();
    const step = STEPS[currentStep];
    const isFirst = currentStep === 0;
    const isLast = currentStep === STEPS.length - 1;

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:calc(100vh - 48px)">
        <div style="width:560px;max-width:95vw">
          <!-- Progress -->
          <div style="display:flex;gap:4px;margin-bottom:32px">
            ${STEPS.map((_, i) => `<div style="flex:1;height:4px;border-radius:2px;background:${i <= currentStep ? 'var(--accent)' : 'var(--border)'}"></div>`).join('')}
          </div>

          <div style="text-align:center;margin-bottom:24px">
            <div style="font-size:48px;margin-bottom:12px">${step.icon}</div>
            <h2 style="font-size:24px">${step.title}</h2>
          </div>

          <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:24px">
            ${step.content}
          </div>

          <div style="display:flex;justify-content:space-between">
            ${isFirst ? '<div></div>' : `<button class="btn btn-secondary" id="prevBtn">${'Atrás'}</button>`}
            <div style="display:flex;gap:8px">
              ${!isLast ? `<button class="btn btn-secondary" id="skipBtn" style="color:var(--text-muted)">${'Omitir asistente'}</button>` : ''}
              <button class="btn btn-primary" id="nextBtn">${isLast ? 'Ir al panel' : step.action === 'pair' ? 'Vincular pantalla' : 'Siguiente'}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('prevBtn')?.addEventListener('click', () => { currentStep--; renderStep(); });
    document.getElementById('skipBtn')?.addEventListener('click', () => {
      localStorage.setItem('rd_onboarded', 'true');
      window.location.hash = '#/';
      window.location.reload();
    });
    document.getElementById('nextBtn')?.addEventListener('click', handleNext);

    if (step.action === 'upload') {
      const area = document.getElementById('onboardUploadArea');
      const input = document.getElementById('onboardFileInput');
      area?.addEventListener('click', () => input.click());
      input?.addEventListener('change', handleUpload);
    }
  }

  async function handleNext() {
    const STEPS = getSteps();
    const step = STEPS[currentStep];

    if (step.action === 'pair') {
      const code = document.getElementById('onboardPairingCode')?.value.trim();
      const name = document.getElementById('onboardDeviceName')?.value.trim();
      const status = document.getElementById('onboardPairStatus');

      if (!code || code.length !== 6) {
        if (status) status.textContent = 'Ingresa un código válido de 6 dígitos';
        return;
      }

      try {
        if (status) status.textContent = 'Vinculando...';
        const token = localStorage.getItem('token');
        const res = await fetch('/api/provision/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pairing_code: code, name: name || undefined })
        });
        const data = await res.json();
        if (!res.ok) { if (status) status.textContent = data.error || 'Falló la vinculación'; return; }
        pairedDeviceId = data.id;
        showToast('¡Pantalla vinculada!', 'success');
        currentStep++;
        renderStep();
      } catch (err) {
        if (status) status.textContent = 'Falló la vinculación: ' + (err.message);
      }
      return;
    }

    if (currentStep === STEPS.length - 1) {
      localStorage.setItem('rd_onboarded', 'true');
      window.location.hash = '#/';
      window.location.reload();
      return;
    }

    currentStep++;
    renderStep();
  }

  async function handleUpload() {
    const file = document.getElementById('onboardFileInput')?.files[0];
    if (!file) return;

    const progress = document.getElementById('onboardUploadProgress');
    const bar = document.getElementById('onboardProgressBar');
    const text = document.getElementById('onboardUploadText');
    if (progress) progress.style.display = 'block';

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/content');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && bar) bar.style.width = Math.round((e.loaded / e.total) * 100) + '%';
      };
      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const content = JSON.parse(xhr.responseText);
          if (text) text.textContent = '¡Subido! Asignando a la pantalla...';

          if (pairedDeviceId) {
            try {
              await fetch(`/api/assignments/device/${pairedDeviceId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ content_id: content.id, duration_sec: 10 })
              });
            } catch {}
          }

          showToast('¡Contenido subido y asignado!', 'success');
          currentStep++;
          renderStep();
        } else {
          if (text) text.textContent = 'Falló la subida';
        }
      };
      xhr.onerror = () => { if (text) text.textContent = 'Falló la subida'; };
      xhr.send(formData);
    } catch (err) {
      if (text) text.textContent = 'Error: ' + (err.message);
    }
  }

  renderStep();
}

export function cleanup() {}
