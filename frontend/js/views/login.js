import { showToast } from '../components/toast.js';

let authConfig = null;

async function loadAuthConfig() {
  if (authConfig) return authConfig;
  const res = await fetch('/api/auth/config');
  authConfig = await res.json();
  return authConfig;
}

export async function render(container) {
  const config = await loadAuthConfig();
  const isSetup = config.needsSetup;

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px">
      <div style="width:400px;max-width:100%">
        <div style="text-align:center;margin-bottom:32px">
          <img src="/assets/icon-192.png" width="48" height="48" alt="Camanchaca CMS" style="margin:0 auto 12px;display:block;border-radius:8px">
          <h1 style="font-size:24px;font-weight:700;color:var(--accent)">Camanchaca CMS</h1>
          <p style="color:var(--text-secondary);font-size:13px;margin-top:4px">
            ${isSetup ? 'Crea tu cuenta de administrador para comenzar' : 'Inicia sesión para gestionar tus pantallas'}
          </p>
        </div>

        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px">
          <div id="localAuthForm">
            <div class="form-group">
              <label>${'Correo electrónico'}</label>
              <input type="email" id="loginEmail" class="input" placeholder="${'tu@ejemplo.com'}" autocomplete="email">
            </div>
            <div class="form-group">
              <label>${'Contraseña'}</label>
              <input type="password" id="loginPassword" class="input" placeholder="${'••••••••'}" autocomplete="current-password">
            </div>
            ${isSetup ? `
            <div class="form-group">
              <label>${'Nombre'}</label>
              <input type="text" id="loginName" class="input" placeholder="${'Tu nombre'}">
            </div>
            ` : ''}
            <button class="btn btn-primary" id="loginBtn" style="width:100%;justify-content:center;padding:10px">
              ${isSetup ? 'Crear cuenta de administrador' : 'Iniciar sesión'}
            </button>
          </div>
        </div>

        <p id="loginError" style="color:var(--danger);font-size:12px;text-align:center;margin-top:12px;display:none"></p>
      </div>
    </div>
  `;

  setupHandlers(isSetup);
}

function setupHandlers(isSetup) {
  const showError = (msg) => {
    const el = document.getElementById('loginError');
    el.textContent = msg;
    el.style.display = 'block';
  };

  // Login / First-time setup
  document.getElementById('loginBtn')?.addEventListener('click', () => {
    if (isSetup) {
      doRegister();
    } else {
      doLogin();
    }
  });

  // Enter key on password field
  document.getElementById('loginPassword')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') isSetup ? doRegister() : doLogin();
  });

  async function doLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) { showError('Se requieren correo y contraseña'); return; }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error); return; }
      onAuthSuccess(data);
    } catch (err) {
      showError('Error al iniciar sesión');
    }
  }

  async function doRegister() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const name = document.getElementById('loginName')?.value.trim() || '';
    if (!email || !password) { showError('Se requieren correo y contraseña'); return; }
    if (password.length < 8) { showError('La contraseña debe tener al menos 6 caracteres'); return; }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error); return; }
      onAuthSuccess(data);
    } catch (err) {
      showError('Error al registrarse');
    }
  }
}

function onAuthSuccess(data) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  window.location.hash = '#/';
  window.location.reload();
}

export function cleanup() {}
