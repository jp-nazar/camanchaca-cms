# Camanchaca CMS

Self-hosted digital signage management system. Gestiona pantallas en múltiples ubicaciones desde un panel central. Multi-tenant, open source, construido con Node.js + vanilla JS + SQLite.

## Features

- **Playlists** — crea, ordena, asigna duración por item; flujo draft/publish con revert
- **Grupos de pantallas** — organiza displays en grupos, asigna playlist y comandos masivos (reiniciar, apagar, encender, actualizar)
- **Layouts multi-zona** — divide pantallas en zonas con 7 plantillas (fullscreen, split, L-bar, PiP, grid)
- **Video walls** — combina múltiples displays en una sola pantalla con compensación de bezel y sync líder-seguidor
- **Control remoto** — screenshot en vivo, touch injection, teclas, encendido/apagado
- **Scheduling** — calendario semanal visual con reglas de recurrencia y resolución de conflictos
- **Integraciones** — Power BI (OAuth2 ExportTo PNG), Looker Studio, URLs personalizadas; refresco automático con detección de cambios byte a byte
- **Telemetría** — batería, almacenamiento, RAM, CPU, señal WiFi y uptime reportados por los players Android
- **Resiliencia offline** — los players web y Android siguen mostrando contenido cacheados durante cortes de red; se sincronizan al reconectar
- **Alertas** — notificaciones email vía Microsoft Graph cuando una pantalla se desconecta (dedup 2h, cutoff 24h, opt-out por usuario)
- **Workspaces** — multi-tenant plano: workspaces contienen recursos, usuarios pueden ser miembros de múltiples workspaces con cambio vía dropdown
- **Roles** — cuatro niveles (platform_admin > workspace_admin > workspace_editor > workspace_viewer) validados en cada ruta API
- **Content management** — carpetas, URLs remotas, embeds de YouTube, detección de duración de video vía ffprobe, thumbnails automáticos
- **Autenticación de dispositivos** — tokens por dispositivo para conexiones WebSocket seguras
- **Auto-update OTA** — actualizaciones del APK Android enviadas a los dispositivos automáticamente
- **Activity log** — auditoría completa de acciones de usuarios y sistema
- **Export/Import** — respaldo y restauración de playlists, grupos y schedules

## Quick Start

```bash
cd server
pnpm install
pnpm dev
```

Server starts on port 3001. El primer visitante se convierte en `platform_admin` automáticamente.

## Estructura

```
server/           Node.js/Express backend
  config.js       Configuración y variables de entorno
  server.js       Entry point
  db/             SQLite, schema, auto-migrations
  routes/         API REST (devices, playlists, schedules, etc.)
  middleware/     Auth JWT, rate limiting, uploads, sanitización
  services/       Heartbeat, scheduler, alerts, activity log, integration-worker
  ws/             WebSocket handlers (dispositivos + dashboard)
  player/         Web player HTML5
frontend/         SPA dashboard (vanilla JS, sin build step)
  js/views/       Vistas (dashboard, playlists, grupos, schedules, etc.)
  js/i18n/        Solo español
android/          Android TV player (Kotlin, ExoPlayer)
scripts/          Admin recovery, instalación systemd
docs/             Documentación técnica y de operación
```

## Requisitos

- Node.js **20.6–22.x**
- **pnpm** (no npm)
- Linux, macOS, o Windows
- SQLite (bundled vía `better-sqlite3`; no requiere instalación separada)

## Self-Hosting

### Instalación

```bash
cd server
pnpm install
pnpm start
```

El servidor inicia en puerto 3001 (HTTP). Si hay certificados SSL en `server/certs/`, inicia en puerto 3443 (HTTPS) con redirect automático. Las migraciones de esquema corren automáticamente al arrancar.

### Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto HTTP | `3001` |
| `HTTPS_PORT` | Puerto HTTPS (con SSL) | `3443` |
| `NODE_ENV` | `production` activa optimizaciones Express | _(none)_ |
| `JWT_SECRET` | Clave de firma JWT (auto-generada si no se setea) | _(auto)_ |
| `SSL_CERT` | Ruta al certificado SSL | `server/certs/cert.pem` |
| `SSL_KEY` | Ruta a la llave privada SSL | `server/certs/key.pem` |
| `PING_INTERVAL` | Socket.IO ping interval (ms) | `30000` |
| `PING_TIMEOUT` | Socket.IO pong timeout (ms) | `30000` |
| `HEARTBEAT_INTERVAL` | Frecuencia del checker offline (ms) | `10000` |
| `HEARTBEAT_TIMEOUT` | Timeout sin heartbeat (ms) antes de marcar offline | `45000` |
| `COMMAND_QUEUE_TTL_MS` | Tiempo que se retienen comandos para dispositivos offline (ms) | `30000` |

### Email Alerts (Microsoft Graph)

Configuración opcional para notificaciones cuando las pantallas se desconectan:

| Variable | Descripción |
|----------|-------------|
| `GRAPH_TENANT_ID` | Azure AD tenant ID |
| `GRAPH_CLIENT_ID` | Azure AD app registration client ID |
| `GRAPH_CLIENT_SECRET` | Azure AD app registration client secret |
| `GRAPH_SENDER_EMAIL` | Mailbox desde el que se envía |
| `GRAPH_SENDER_NAME` | Nombre mostrado en el `From` |

Sin configurar, el sistema funciona normalmente solo que no envía emails.

### Production Deployment

```bash
# Crear usuario dedicado
sudo useradd -r -s /bin/false camanchaca

# Copiar la app
sudo cp -r . /opt/camanchaca-cms
sudo chown -R camanchaca:camanchaca /opt/camanchaca-cms

# Instalar dependencias
cd /opt/camanchaca-cms/server && pnpm install --production

# Servicio systemd
sudo cat > /etc/systemd/system/camanchaca.service << 'EOF'
[Unit]
Description=Camanchaca CMS
After=network.target

[Service]
Type=simple
User=camanchaca
WorkingDirectory=/opt/camanchaca-cms/server
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now camanchaca
```

### Backup

```bash
sqlite3 server/db/remote_display.db ".backup /path/to/backup.db"
```

También respaldar `server/uploads/`.

### Admin Recovery

```bash
cd server && node scripts/reset-admin.js
```

Genera un token de 1 hora. Pega en la consola del navegador.

### Building the Android APK

```bash
cd android
export KEYSTORE_PASSWORD=your_password
export KEY_ALIAS=remotedisplay
export KEY_PASSWORD=your_password
./gradlew assembleDebug
cp android/app/build/outputs/apk/debug/app-debug.apk ../camanchaca-player.apk
```

**Requisitos:** JDK 17+, Android SDK (platforms;android-34, build-tools;34.0.0).

### Device Setup

1. Abrir `https://tu-servidor/player` en el navegador del dispositivo (o instalar el APK Android)
2. La pantalla muestra un código de 6 dígitos
3. En el dashboard, ir a **Displays → Agregar Display** e ingresar el código

## Tech Stack

- **Backend:** Node.js 20.6+, Express, Socket.IO, SQLite (better-sqlite3)
- **Frontend:** Vanilla JS SPA (sin framework, sin build step), Service Worker para offline
- **Android:** Kotlin, ExoPlayer, Socket.IO client
- **Auth:** JWT + bcrypt (local only, sin OAuth)
- **Email:** Microsoft Graph vía `@azure/msal-node` (opcional)
- **Data model:** multi-tenant plano — workspaces contienen recursos; cuatro niveles de roles validados en cada ruta API

## Documentación

- `docs/ARCHITECTURE.md` — Arquitectura del sistema, flujo de datos, decisiones técnicas
- `docs/GUIA_IT.md` — Guía de operación para el equipo de IT
- `docs/GUIA_USUARIO.md` — Manual de usuario del dashboard
- `docs/BUILD_ANDROID.md` — Instrucciones detalladas de compilación del APK
- `AGENTS.md` — Contexto para asistentes IA (setup, comandos, issues conocidos)

## License

MIT
