# Guía de Operación — Camanchaca CMS

Guía para el equipo de IT. Cómo funciona, cómo se corre, y qué tocar cuando algo falla.

---

## 0. Contexto (¿Qué estás operando?)

Esto **no es un CMS de marketing digital**. Es una plataforma de **operación visual industrial** para planta acuícola.

### El problema real
Las pantallas de planta dependían de navegadores web tradicionales mostrando dashboards. Sesiones que expiraban, pantallas congeladas, negros, falta de refresh. La operación se detenía cuando una pantalla dejaba de mostrar datos críticos.

### Lo que esto debe garantizar
- **Continuidad**: la pantalla nunca debe quedar en negro o dejar de refrescar por una sesión expirada.
- **Resiliencia**: recovery automático ante fallas de red, dispositivo o sesión.
- **Observabilidad**: saber qué pantallas están online, qué muestran, cuándo fue su último refresh.
- **Control remoto**: recuperar una pantalla sin ir físicamente a planta.

### Decisiones técnicas que derivan de esto
- Player dedicado (Android TV con ExoPlayer o Web Player con kiosk controlado), no un navegador genérico.
- WebSocket persistente con reconexión automática y cola de comandos.
- Heartbeats y screenshots para monitoreo centralizado.
- Service Worker y cache offline para que siga funcionando sin internet.
- CSP estricto en dashboard.

### Fases de evolución posibles
1. **Estabilidad base** — players confiables, monitoreo, control remoto.
2. **Automatización** — scheduling, alertas, acciones proactivas.
3. **Integración de datos** — Power BI, Looker Studio, BigQuery.
4. **Inteligencia operacional** — anomalías, near real-time, IA.

El criterio de decisión técnico: **¿Esto hace más confiable, observable y operable la red de pantallas de planta?** Si la respuesta es no, no va.

---

## 1. Arquitectura

Tres capas:

```
┌─────────────────┐
│  Admin Dashboard │  ← Vanilla JS SPA (frontend/)
│  (Navegador)     │
└────────┬────────┘
         │ HTTPS + WebSocket /dashboard
         ▼
┌─────────────────┐
│   Servidor      │  ← Node.js + Express + Socket.IO (server/)
│   (Node 20-22)  │     SQLite en disco
└────────┬────────┘
         │ WebSocket /devices
         ▼
┌─────────────────┐
│    Players      │  ← Web (/player) o Android TV (/android)
│  (Pantallas)    │
└─────────────────┘
```

- **Backend**: Puerto 3001 (HTTP) o 3443 (HTTPS si hay certificados en `server/certs/`).
- **Base de datos**: SQLite en `server/db/remote_display.db`. Sin servidor externo.
- **Estáticos**: Express sirve `frontend/` y `server/player/` directamente. No hay paso de build.
- **Tiempo real**: Socket.IO. Namespace `/dashboard` para admins, `/devices` para pantallas.

### 1.1 Arquitectura del Frontend

El dashboard admin es una **SPA en vanilla JavaScript** (sin React, Vue, ni build step). Express sirve los archivos estáticos directamente desde `frontend/`.

**Patrón:**
```javascript
// Cada vista exporta una función render(container)
export async function render(container) {
  container.innerHTML = `<div style="...">...</div>`;
  // Event listeners se attachan manualmente después
}
```

**Ventajas:**
- Cero dependencias de frontend. No hay `node_modules` ni build que se rompa.
- Sirve directo desde Express. Un archivo `.js` cambiado = cambio inmediato en producción.
- Funciona offline con Service Worker.

**Desventajas:**
- **290+ usos de `innerHTML`** en el codebase. Todo el UI se construye con strings HTML.
- **CSS inline masivo**: estilos en atributos `style="..."` en vez de clases CSS.
- **Sin componentes reutilizables**: cambiar un pattern de UI requiere editar N archivos.
- **Difícil de testear**: no hay unit tests ni framework de testing.
- **Difícil de mantener a escala**: el proyecto ya tiene ~20 vistas y sigue creciendo.

**Para el equipo de IT:** No necesitás saber React ni Angular. Pero sí entender que cualquier cambio de UI es editar strings de HTML dentro de archivos `.js` en `frontend/js/views/`. Si el cliente necesita features complejas nuevas, evaluar si conviene migrar a un framework con build step.

---

## 2. Requisitos

- **Node.js**: 20.6 a 22.x. No usar 25+ (fallan módulos nativos).
- **pnpm**: Gestor de paquetes (hay `pnpm-lock.yaml`).
- **Sistema**: Linux recomendado para producción.
- **Recursos mínimos**: 1GB RAM, 5GB disco (depende del contenido que subas).

### 2.1 Costos de Infraestructura

Cada pantalla conectada **no aumenta el costo del servidor**. El consumo por pantalla es marginal (~2-5 KB RAM + una escritura SQLite cada 15s). Una instancia pequeña corre cientos de pantallas sin problema.

| Tipo | vCPU | RAM | Costo/mes (aprox) | Pantallas recomendadas |
|------|------|-----|--------------------|----------------------|
| VPS económico (ej: Lightsail) | 1 | 1 GB | ~$3.5-10 | 1-200 |
| EC2 t3.nano | 2 (burstable) | 0.5 GB | ~$5 | No recomendado (RAM justa para Node.js) |
| EC2 t3.micro | 2 (burstable) | 1 GB | ~$8-12 | 1-500+ ✅ |
| EC2 t3.small | 2 (burstable) | 2 GB | ~$20 | 1-2000+ |
| EC2 t3.medium | 2 (burstable) | 4 GB | ~$40 | 1-10000+ |

**El costo que sí escala es el ancho de banda**, no el cómputo por pantalla:
- Heartbeats y WebSocket: prácticamente cero (< 1 MB/mes por pantalla).
- Contenido multimedia estático: los navegadores lo cachean por 30 días, se descarga **una vez**.
- Integraciones Power BI (imagen cada 10 min): el worker compara byte a byte antes de escribir. Si el dashboard no cambió, **no se descarga nada**. Si cambió, se actualiza una vez y las TVs descargan la nueva imagen. Cache del navegador mantiene la URL estable.

**Costo real con integraciones Power BI (imagen ~500 KB, refresco cada 10 min):**

| Pantallas | Datos sin cambios (solo WebSocket) | Datos cambian cada hora |
|-----------|-----------------------------------|------------------------|
| 10 | ~$0/mes (free tier 100 GB) | ~$0/mes |
| 50 | ~$0/mes | ~$2/mes |
| 100 | ~$0/mes | ~$12/mes |
| 200 | ~$0/mes | ~$35/mes |

El ahorro respecto a la implementación anterior (URL con timestamp que forzaba descarga siempre) es de hasta **83%** en ancho de banda.

**Recomendación:** t3.micro (~$8-12/mes) para la mayoría de los casos. Solo necesita más RAM si supera ~500 pantallas o si se integran múltiples conexiones Power BI simultáneas.

---

## 3. Puesta en Marcha

### 3.1 Instalar dependencias

```bash
cd server
pnpm install
```

### 3.2 Variables de entorno (opcional)

Crear `server/.env` si se necesita:

```bash
NODE_ENV=production
PORT=3001
JWT_SECRET=tu-clave-secreta-aqui
# SSL_CERT=/ruta/a/cert.pem
# SSL_KEY=/ruta/a/key.pem
```

Si no hay `.env`, el servidor usa defaults (puerto 3001, JWT auto-generado).

### 3.3 Iniciar

```bash
# Desarrollo (auto-restart al cambiar archivos)
pnpm dev

# Producción
pnpm start
```

El primer usuario que visite la URL se convierte en `platform_admin` automáticamente.

### 3.4 Cuentas y Multitenancy

**Modelo simplificado (sin organizaciones):**
```
workspaces (scope de recursos: devices, content, playlists)
  └── members (usuarios con rol en ese workspace)
```

**Al instalar por primera vez:**
1. Visitás `/app#/login` con la DB vacía (0 usuarios).
2. Aparece el formulario "Crear cuenta de administrador".
3. El primer usuario se crea con `role: 'platform_admin'`.
4. Se crea automáticamente un **workspace** default.

**Jerarquía de roles** (de más a menos poder):

| Rol | Alcance | Puede hacer |
|-----|---------|-------------|
| `platform_admin` | Todo el sistema | Crear workspaces, ver y administrar cualquier workspace, gestionar usuarios |
| `workspace_admin` | Su workspace | Miembros, renombrar, full read/write |
| `workspace_editor` | Su workspace | Crear/editar contenido, devices, playlists. No tocar miembros. |
| `workspace_viewer` | Su workspace | Solo lectura |

**Crear / eliminar workspaces:**
- Solo `platform_admin` puede crear y eliminar workspaces.
- Desde el panel de Admin (`/app#/admin`) → sección "Workspaces".
- Los workspaces son completamente aislados: contenido, pantallas y usuarios no se comparten entre workspaces.

**Workspace switching:**
- El JWT lleva `current_workspace_id`.
- Si un usuario pertenece a múltiples workspaces, ve un dropdown en el sidebar.
- Al cambiar de workspace, se genera un nuevo JWT y se recarga la página.
- Todos los recursos (devices, content, playlists) están filtrados por `workspace_id`.

**Para crear usuarios:**
- El admin va a `/app#/admin` → "Usuarios" → "Crear usuario".
- Selecciona rol (default: `workspace_editor`).
- El nuevo usuario se asigna automáticamente al workspace actual del admin.

**Recovery de admin:** Si se pierde el acceso, ver sección 7.3.

---

## 4. Producción: Systemd + Caddy

### 4.1 Servicio Systemd

El archivo `scripts/remotedisplay.service` es un template. Adaptar rutas:

```ini
[Unit]
Description=Camanchaca CMS
After=network.target

[Service]
Type=simple
User=camanchaca
WorkingDirectory=/opt/camanchaca-cms/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Instalar:

```bash
sudo cp scripts/remotedisplay.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable camanchaca
sudo systemctl start camanchaca
```

Comandos útiles:

```bash
sudo systemctl status camanchaca
sudo systemctl restart camanchaca
sudo journalctl -u camanchaca -f
```

### 4.2 Caddy (Reverse Proxy + SSL)

Caddyfile:

```
signage.tuempresa.com {
    reverse_proxy localhost:3001
}
```

Caddy se encarga del SSL automáticamente. Solo necesitas apuntar el DNS al servidor.

Si usás Nginx en vez de Caddy:

```nginx
server {
    listen 443 ssl http2;
    server_name signage.tuempresa.com;

    client_max_body_size 500M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

**Importante**: WebSocket requiere `Upgrade` y `Connection` headers. Sin esto, los players no se conectan.

---

## 5. Base de Datos

### 5.1 Ubicación

`server/db/remote_display.db` — archivo SQLite único.

### 5.2 Backup

```bash
# Backup en caliente (funciona mientras el servidor corre)
sqlite3 server/db/remote_display.db ".backup /opt/backups/camanchaca-$(date +%F).db"
```

También respaldar `server/uploads/` (archivos subidos).

### 5.3 Migrations

El servidor aplica migrations automáticamente al arrancar. Si detecta una DB antigua sin multi-tenancy, hace snapshot primero (`remote_display.pre-migration-<timestamp>.db`) y luego migra. Si falla, muestra el comando para restaurar.

**No tocar manualmente** salvo emergencia.

---

## 6. Jugadores (Players)

### 6.1 Web Player

- URL: `https://tu-servidor/player`
- Es un HTML/JS puro en `server/player/`. Sin build.
- Se conecta por WebSocket a `/devices`.
- Soporta: imágenes, videos, YouTube, zonas, layouts.
- Offline: Service Worker cachea contenido.

**Emparejamiento:**
1. Abrir `/player` en el navegador (modo kiosk/fullscreen).
2. Muestra un código de 6 dígitos.
3. En el dashboard, ir a "Displays" → "Agregar Display" → ingresar código.

### 6.2 Android TV

- App Kotlin en `android/`.
- ExoPlayer para video. WebSocket para comandos.
- Soporta captura de pantalla, modo kiosk, y auto-update OTA.
- Se conecta a `wss://tu-servidor` (el app agrega `/device` automáticamente).

**Build:**

```bash
cd android
./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk ../ScreenPlayer.apk
```

El servidor sirve el APK desde `/download/apk` si existe `ScreenPlayer.apk` en la raíz.

**Setup Kiosk (Android TV):**

```bash
cd android/scripts
./setup-kiosk.sh
```

Esto configura ADB, instala la app, y activa modo kiosk. Requiere Developer Mode + USB Debugging en el TV.

---

### 6.3 Service Workers y Resiliencia Offline

El proyecto usa **Service Workers** para que las pantallas sigan funcionando incluso sin internet. Esto es crítico para la operación en planta.

**¿Qué son?** Scripts que el navegador corre en segundo plano, interceptando requests y sirviendo cache local cuando no hay red.

**Web Player** (`server/player/sw.js`):
- Cachea la página del player (`/player`) y assets estáticos (JS, CSS).
- Estrategia **network-first**: intenta traer la versión más nueva; si no hay internet, usa el cache.
- Los archivos multimedia (`/uploads/content/`) **no** los intercepta — el navegador los cachea nativamente por 30 días.

**Admin Dashboard** (`frontend/sw-admin.js`):
- Cachea archivos críticos del dashboard (`index.html`, `app.js`, CSS).
- También network-first. No intercepta `/api/` ni `/socket.io/` (eso necesita red).

**Escenario típico en planta:**
1. La pantalla tiene internet, recibe playlist y contenido nuevo.
2. Se corta internet (falla de red, mantenimiento).
3. El **Service Worker** sirve el player desde el cache local.
4. El **navegador** sigue mostrando videos/imágenes que ya descargó (cache nativo).
5. La pantalla **sigue operando** en loop, mostrando el último contenido cacheado.
6. Cuando vuelve la red, el WebSocket se reconecta automáticamente y sincroniza.

**Limitación:** Si un contenido nunca se descargó antes de cortarse la red, no se puede mostrar. Por eso el Android TV tiene `ContentCache.kt` que hace prefetch proactivo.

**Para forzar update del Service Worker:**
El cache se invalida automáticamente cuando cambia la versión (el servidor detecta cambios en los archivos y genera un hash nuevo). Si necesitás forzar un refresh inmediato en todas las pantallas, usá el comando "Actualizar" desde el dashboard (envía un comando por WebSocket que recarga la página).

---

## 7. Operación Diaria

### 7.1 Logs

```bash
# Ver logs en tiempo real
sudo journalctl -u camanchaca -f

# Últimas 100 líneas
sudo journalctl -u camanchaca -n 100
```

### 7.2 Actualizar

```bash
cd /opt/camanchaca-cms

# Backup DB
sqlite3 server/db/remote_display.db ".backup server/db/backup-$(date +%F).db"

# Actualizar código (si hay git)
git pull

# O reemplazar archivos manualmente, luego:
cd server && pnpm install
sudo systemctl restart camanchaca
```

Las migrations corren solas al reiniciar. Si hay tablas nuevas (ej: `integrations`), se crean automáticamente.

### 7.3 Monitorear el Integration Worker

El sistema tiene un worker que refresca contenido externo (Power BI, Looker Studio, URLs personalizadas). Corre cada 30 segundos y consulta las integraciones habilitadas. Cuando detecta contenido nuevo, automáticamente:

1. Compara el archivo en disco byte a byte con la nueva descarga. Si es idéntico, **no hace nada** (la URL estable permite al navegador usar su cache).
2. Si el contenido cambió, actualiza el archivo en disco (mismo filename siempre, sin timestamp).
3. Actualiza el `published_snapshot` de los playlists que referencian ese contenido.
4. Envía un **WebSocket push** a todas las pantallas que muestran ese contenido.
5. Las pantallas reciben el nuevo playlist y cargan la imagen actualizada.

**Optimización de ancho de banda:** Al mantener el filename estable, el navegador de cada TV usa `If-None-Match` (ETag). Si el archivo no cambió, el servidor responde `304 Not Modified` sin transferir la imagen. Si el worker detecta que los bytes son idénticos, ni siquiera escribe a disco ni envía WebSocket — las TVs nunca se enteran de un refresh que no trajo cambios.

```bash
# Ver logs del integration worker
sudo journalctl -u camanchaca | grep integration-worker

# Ver estado de las integraciones
sqlite3 server/db/remote_display.db "SELECT id, name, integration_type, status, last_error, last_fetched_at, next_fetch_at FROM integrations;"
```

**Si una integración falla:**
1. Revisar el error en la columna `last_error`.
2. Verificar credenciales desde la UI en `/app#/integrations`.
3. Probar un refresh manual desde el botón "Actualizar ahora".
4. Verificar conectividad del servidor a Internet (el worker hace requests HTTP/HTTPS externos).

### 7.3 Recovery de Admin

Si se pierde acceso al admin:

```bash
cd server
node scripts/reset-admin.js
```

Genera un token de 1 hora. Pegar en consola del navegador.

---

## 8. Troubleshooting

| Síntoma | Causa probable | Fix |
|---------|---------------|-----|
| Player "Conectando..." infinito | Proxy sin WebSocket | Revisar headers `Upgrade` y `Connection` en nginx/Caddy |
| Player web no carga contenido | CSP bloqueando | Revisar que `/player` está excluido de CSP en `server.js` |
| Android no empareja | URL incorrecta | Usar `https://dominio.com` sin `/player`. El app agrega `/device`. |
| `better-sqlite3` falla al instalar | Node 25+ o sin build tools | Usar Node 20-22. Instalar `build-essential` en Linux. |
| JWT inválido después de recovery | `.jwt_secret` vs `.env` desync | Sincronizar `JWT_SECRET` en `.env` con `certs/.jwt_secret` |
| Integración descargó contenido nuevo pero la pantalla no se actualiza | Snapshot del playlist no actualizado | Verificar `published_snapshot` en DB: `sqlite3 db/remote_display.db "SELECT id, substr(published_snapshot,1,100) FROM playlists WHERE published_snapshot LIKE '%filepath%';"`. Si el filepath está desactualizado, el worker debería actualizarlo automáticamente — revisar logs: `journalctl -u camanchaca | grep integration-worker` |

---

## 9. Estructura de Carpetas

Las carpetas principales son **peer folders** (al mismo nivel):

```
camanchaca-cms/
├── server/                 # Backend Node.js/Express
│   ├── server.js           # Entry point
│   ├── config.js           # Variables de entorno
│   ├── db/
│   │   ├── remote_display.db      # Base de datos SQLite
│   │   └── schema.sql             # Schema base
│   ├── routes/             # API REST
│   ├── ws/                 # WebSocket handlers
│   ├── services/           # Background jobs (heartbeat, scheduler, alerts, integration-worker)
│   ├── middleware/         # Auth JWT, uploads, sanitization
│   ├── player/             # ← Web player (para pantallas/dispositivos)
│   │   ├── index.html      #   Player HTML/JS puro
│   │   └── sw.js           #   Service Worker del player
│   └── uploads/            # Archivos subidos (contenido multimedia)
├── frontend/               # Admin dashboard SPA (para operadores)
│   ├── index.html          # Dashboard admin
│   ├── js/views/           # Vistas (dashboard, devices, content, etc.)
│   ├── js/components/      # Componentes reutilizables
│   ├── css/                # Estilos
│   └── sw-admin.js         # Service Worker para offline
├── android/                # App Android TV (Kotlin + ExoPlayer)
│   ├── app/src/main/...    # Código fuente Kotlin
│   └── scripts/
│       └── setup-kiosk.sh  # Script de configuración kiosk
└── scripts/                # Utilidades de administración
    ├── install-service.sh  # Instalar systemd
    ├── remotedisplay.service
    └── reset-admin.js      # Recovery de admin
```

**Nota importante:** 
- `server/` y `frontend/` son carpetas **peer** (al mismo nivel), no anidadas.
- El **web player** (`server/player/`) es para las pantallas que reproducen contenido.
- El **frontend** (`frontend/`) es el dashboard de administración para operadores.
- Express sirve cada uno por rutas separadas:
  - `/app` → `frontend/index.html` (dashboard)
  - `/player` → `server/player/index.html` (reproductor)

En producción, la estructura se mantiene igual:

```
/opt/camanchaca-cms/
├── server/        # WorkingDirectory del servicio systemd
├── frontend/      # Dashboard admin servido por Express
└── android/       # Opcional, solo si compilás la app
```

---

## 10. Seguridad (Checklist)

- [ ] Cambiar `JWT_SECRET` en producción (no usar el auto-generado).
- [ ] Usar HTTPS en producción (Caddy o nginx con certificados).
- [ ] Correr con usuario no-root (`camanchaca` en vez de `root`).
- [ ] Backup automático diario de la DB y uploads.
- [ ] Firewall: solo 80/443 públicos. Puerto 3001 solo local.
- [ ] Revisar `GRAPH_DEV_RESTRICT_TO` si se usa email (dejar vacío en prod).
- [ ] Monitorear integration worker si se usan integraciones externas: `journalctl -u camanchaca | grep integration-worker`
