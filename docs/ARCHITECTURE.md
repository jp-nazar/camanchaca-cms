# Camanchaca CMS Architecture

A self-hosted digital signage management system built with Node.js, vanilla JavaScript, and SQLite.

---

## Table of Contents

- [System Overview](#system-overview)
- [Backend (`server/`)](#backend-server)
- [Frontend (`frontend/`)](#frontend-frontend)
- [Players](#players)
  - [Web Player](#web-player)
  - [Android TV Player](#android-tv-player)
- [Data Flow](#data-flow)
- [Key Dependencies](#key-dependencies)
- [Notable Characteristics](#notable-characteristics)

---

## System Overview

Camanchaca CMS is a multi-tenant digital signage platform with three layers:

1. **Backend** — Node.js/Express API + WebSocket server
2. **Frontend** — Vanilla JS admin dashboard (no build step)
3. **Players** — Web-based HTML5 player + Android TV app (Kotlin)

**Communication**: Real-time via Socket.IO. REST API for CRUD. SQLite for persistence.

---

## Backend (`server/`)

Entry point: `server/server.js` (port 3001)

### Directory Structure

| Path | Purpose |
|------|---------|
| `server.js` | Express + Socket.IO server setup, SSL, rate limiting, CSP |
| `config.js` | Environment variables, paths, intervals, JWT config |
| `db/` | SQLite database (`better-sqlite3`), schema, auto-migrations |
| `routes/` | REST API endpoints (auth, devices, content, playlists, schedules, widgets, kiosks, reports) |
| `middleware/` | JWT authentication, file uploads (multer), input sanitization |
| `services/` | Heartbeat checker, scheduler, alerts, email (MS Graph), activity logger |
| `ws/` | Socket.IO handlers for `/dashboard` (admins) and `/devices` (players) namespaces |
| `lib/` | Tenancy resolver, permission checks, socket rooms, command queue |
| `player/` | Web-based display player (pure HTML5/JS) |

### Key Architectural Decisions

- **Database**: SQLite with WAL mode and foreign keys. Auto-migrates on boot. Snapshots DB before major migrations.
- **Multi-tenancy**: Flat workspace model: `workspaces → resources`. Every resource is scoped by `workspace_id`.
- **Role-based access**: Two levels — **system roles** (`platform_admin > workspace_admin > workspace_editor > user`) and **workspace roles** (`workspace_admin > workspace_editor > workspace_viewer`).
- **Workspace resolution**: Determined from JWT `current_workspace_id` claim. Priority: header → query param → JWT → first membership → platform_admin fallback.
- **Command queue**: If a device is offline when a command is sent, it's queued and flushed on reconnect (30s TTL by default).
- **CSP**: Strict Content Security Policy on dashboard paths. Widget/kiosk render paths and the web player bypass CSP intentionally (they need inline scripts/styles).
- **Rate limiting**: Simple in-memory rate limiter for auth, provisioning, exports, and content endpoints.

### WebSocket Namespaces

- `/dashboard` — Admin dashboard connections. Receives device status updates, telemetry, screenshots.
- `/devices` — Player connections. Receives playlist updates, commands. Sends heartbeats, screenshots, telemetry.

---

## Frontend (`frontend/`)

**Vanilla JavaScript SPA** — no framework, no build step.

- Served as static files by Express
- Hash-based routing (`/app#/login`, `/app#/dashboard`, etc.)
- **Spanish only** — all i18n files removed except `js/i18n/es.js`
- Service worker (`sw-admin.js`) for offline admin capabilities

### Key Views

- `dashboard.js` — Device grid, status overview
- `device-detail.js` — Individual device control, screenshots, telemetry
- `content-library.js` — Upload and manage media
- `playlists.js` — Playlist creation and management
- `schedule.js` — Time/day scheduling
- `layout-editor.js` — Screen zone layouts
- `widgets.js` / `kiosk.js` — Widget and kiosk designers
- `video-wall.js` — Video wall configuration
- `admin.js` — User and workspace management

### Components

- `workspace-switcher.js` — Switch between workspaces
- `toast.js` — Notification system

---

## Players

### Web Player

Located in `server/player/` and served at `/player`.

- Pure HTML5/JavaScript (no build step)
- Connects to Socket.IO `/devices` namespace
- Supports: images, videos, YouTube (IFrame API), zones, layouts
- Features: setup screen, pairing code display, fullscreen playback, zone-based rendering
- Service worker (`sw.js`) for offline playback

### Android TV Player

Located in `android/` — Kotlin app with ExoPlayer.

**Activities:**
- `SetupActivity.kt` — Initial server configuration
- `ProvisioningActivity.kt` — Pairing code display
- `MainActivity.kt` — Main playback with zone management

**Services:**
- `WebSocketService.kt` — Persistent connection to server
- `ScreenCaptureService.kt` — Screenshot capture
- `UpdateChecker.kt` — APK update polling
- `PowerAccessibilityService.kt` — Kiosk mode / power management

**Features:**
- Kiosk mode via accessibility service
- Auto-update from `/api/update/check`
- Remote touch injection (`TouchInjector.kt`)
- Content caching (`ContentCache.kt`)
- Telemetry reporting (`DeviceInfo.kt`)
- **Image optimization fix**: `ImageLoader.kt` backs off power-of-2 inSampleSize to prevent undershooting target resolution, which caused upscaling and pixelation on high-resolution photos. The server also generates device-optimized JPEG variants (max 1920×1080, quality 85) and serves them to Android players, while keeping originals for the web player and admin download.

**Setup script**: `android/scripts/setup-kiosk.sh` (ADB-based kiosk setup for Android TV boxes)

---

## Data Flow

```
┌─────────────────┐     REST API      ┌──────────────┐
│  Admin Dashboard │◄────────────────►│              │
│  (frontend SPA)  │                   │   Backend    │
└────────┬────────┘     Socket.IO      │  (Node.js)   │
         │      /dashboard namespace   │              │
         ▼                             └──────┬───────┘
    Real-time updates                        │
         ▲                                   │ SQLite
         │                                   │
         │      /devices namespace           │
┌────────┴────────┐                         │
│  Digital Sign   │◄────────────────────────┘
│  Players        │
│  (Web/Android)  │
└─────────────────┘
```

### Typical Workflow

1. **Upload content** → Files stored in `uploads/content/`, thumbnails generated via `sharp`
2. **Create playlists** → Arrange content with durations and transitions
3. **Assign to devices** → Link playlists to devices or video walls
4. **Schedule playback** → Time/day-based scheduling via cron-like scheduler
5. **Device pairs** → Generates pairing code, admin claims via `/api/provision/pair`
6. **Real-time sync** → Playlist changes pushed via WebSocket to connected players
7. **Telemetry back** → Devices send screenshots, battery, storage, CPU, WiFi data
8. **Monitoring** → Admin dashboard shows live status, receives alerts

---

## Key Dependencies

From `server/package.json`:

| Package | Purpose |
|---------|---------|
| `express` | Web framework |
| `socket.io` | Real-time WebSocket communication |
| `better-sqlite3` | SQLite database driver |
| `jsonwebtoken` | JWT authentication |
| `bcryptjs` | Password hashing |
| `helmet` | Security headers (CSP, HSTS) |
| `multer` | File uploads |
| `sharp` | Image thumbnail generation |
| `archiver` / `unzipper` | ZIP handling |
| `uuid` | UUID generation |
| `cors` | Cross-origin requests |
| `express-rate-limit` | Rate limiting (though custom impl used) |
| `@azure/msal-node` | Microsoft Graph email sending |

---

## Notable Characteristics

- **Self-hosted only**: `SELF_HOSTED=true` is hardcoded in `config.js`. No billing, subscriptions, or usage limits.
- **No OAuth**: Local authentication only. First visitor to a fresh install becomes `platform_admin` automatically.
- **No public registration**: All users after the first must be created by an admin.
- **No marketing pages**: Root (`/`) redirects directly to `/app`.
- **No external database**: SQLite only. Suitable for small-to-medium deployments.
- **Node.js version**: Requires 20.6–22.x. Native dependencies (`better-sqlite3`, `sharp`) may fail on newer versions.
- **pnpm only**: Managed via pnpm with `onlyBuiltDependencies` for native modules.
- **SSL support**: Auto-detects certificates in `certs/` folder. Falls back to HTTP if not present.
- **Cloudflare-ready**: Trusts Cloudflare IP ranges for `X-Forwarded-For`.
- **Emergency recovery**: `scripts/reset-admin.js` generates a 1-hour admin token for lockout recovery.
