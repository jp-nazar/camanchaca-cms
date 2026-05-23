# AGENTS.md

## Package Manager

- **pnpm only** (`pnpm-lock.yaml` present, `pnpm.onlyBuiltDependencies` in `package.json`)
- pnpm v10+ blocks native build scripts by default. If you add a native dep, add its name to `pnpm.onlyBuiltDependencies` in `server/package.json` before running `pnpm install`.

## Commands

```bash
cd server
nvm use 20          # required if on Node ≥25
pnpm install
pnpm start          # node --env-file-if-exists=.env server.js
pnpm dev            # same + --watch for auto-restart
```

No test suite exists. No lint or typecheck config. This is a vanilla JS project.

## Node.js Version

**Node 20.6–22.x only.** Node ≥25 headers require C++20 but Apple Clang doesn't pass `-std=c++20` during native addon builds, causing `better-sqlite3` compilation failure. Use `nvm use 20` before any `pnpm` command.

## Local Setup

1. `nvm use 20`
2. `cd server && pnpm install`
3. `pnpm dev` — server starts on port 3001
4. First user to visit gets a setup form and becomes `platform_admin` automatically
4. All subsequent users must be created by an admin via the admin panel

The `.npmrc` in `server/` sets `registry=https://registry.npmjs.org/` to override any global work registry.

## Authentication

- **Local auth only** — no OAuth (Google/Microsoft removed)
- **No public registration** — first user self-registers via setup form, all other users created by admin
- Admin creates users at `/app#/admin` with role + workspace assignment (default: `workspace_editor`, workspace optional — if none selected, auto-assigned to admin's workspace)
- **Recovery tokens**: `node scripts/reset-admin.js` generates a 1-hour emergency token. Paste into browser console. Recovery users have `role: 'admin'` but the app requires `role: 'platform_admin'` for admin access — update the user's role in the DB if needed.

## Database

- SQLite via `better-sqlite3` (no external DB). WAL mode + foreign keys enabled.
- Schema auto-migrates on boot — no manual migration commands.
- On first multi-tenancy migration, snapshots DB to `server/db/remote_display.pre-migration-<ts>.db`.
- DB at `server/db/remote_display.db`, uploaded content at `server/uploads/`.
- Backup: `sqlite3 server/db/remote_display.db ".backup /path/to/backup.db"`
- **Adding migrations**: simple `ALTER TABLE` statements go in the `migrations` array in `server/db/database.js`. Complex migrations need a tracked function with a `schema_migrations` ID (see existing Phase 2–6 examples).

## Frontend

- Vanilla JS SPA served by Express (`frontend/`). **No build step.**
- **Pattern:** Each view exports a `render(container)` function that sets `container.innerHTML = '...'` and attaches event listeners manually. No framework, no components.
- WebSocket via Socket.IO (`/dashboard` namespace for admin, `/devices` for players).
- **Service Worker** (`frontend/sw-admin.js`) caches critical files for offline access. Network-first strategy.
- **Spanish only** — all i18n files removed except `frontend/js/i18n/es.js`
- No marketing pages (landing, legal, guides, comparisons deleted)

## Architecture

```
server/           Node.js/Express backend
  server.js       Entry point (Express + Socket.IO)
  config.js       Env vars with defaults
  db/             SQLite schema + auto-migrations
  routes/         API routes (auth, devices, playlists, schedules, etc.)
  middleware/     Auth (JWT), upload (multer), sanitize
  services/       heartbeat, alerts, email (MS Graph), scheduler, activity log, integration-worker
  ws/             WebSocket handlers (device + dashboard namespaces)
  lib/            tenancy resolver, permissions, socket-rooms, command-queue
  player/         Web-based display player (index.html + sw.js) — Service Worker for offline playback
  config/         Cloudflare IP ranges for trust-proxy
frontend/         Vanilla JS SPA (no framework)
android/          Android player (Kotlin + ExoPlayer)
scripts/          Admin recovery, migration scripts, device setup
```

- Multi-tenant: `workspaces → resources`. Every resource scoped by `workspace_id`.
- JWT carries `current_workspace_id` claim. Workspace resolved via: header > query > JWT > first membership > (platform_admin fallback).
- Two role levels: **system role** (`users.role`: `user`, `workspace_editor`, `workspace_admin`, `platform_admin`) and **workspace role** (`workspace_members.role`: `workspace_editor`, `workspace_admin`, `workspace_viewer`). Admin panel at `/app#/admin` manages both: dropdown for system role, inline select per workspace membership.
- Platform admins can create and delete workspaces from the admin panel (/app#/admin).
- CSP applies to dashboard paths only.

## Removed Features

- **No billing/subscriptions** — Stripe removed, everything is unlimited
- **No OAuth** — Google and Microsoft sign-in removed
- **No white-label/branding** — custom branding feature deleted
- **No contact form** — enterprise contact endpoint removed
- **No organizations** — org hierarchy removed; flat workspaces only
- **No teams** — teams feature removed; workspace memberships replace team groupings
- **No subscription plans** — plans table dropped; `plan_id` column on `users` is vestigial
- **No Kiosk/Touchscreen** — `kiosk_pages` table dropped, route/view removed
- **No Diseñador** — frontend canvas editor removed
- **No Widgets** — `widgets` table and render routes kept for schema compat but all UI/API removed

## Known Issues & Fixes

### 1. JWT Secret Mismatch

**Symptom:** Recovery tokens or user tokens show as "Invalid or expired"

**Root cause:** Server loads `.env` (via `--env-file-if-exists=.env`), but `reset-admin.js` reads `.jwt_secret`. If they differ, tokens are signed with one secret and verified with another.

**Fix:** Keep them in sync:
```bash
# Copy .env JWT_SECRET to .jwt_secret
JWT_SECRET=$(grep JWT_SECRET server/.env | cut -d= -f2)
echo "$JWT_SECRET" | sudo tee server/certs/.jwt_secret
sudo systemctl restart camanchaca-cms
```

### 2. First User Setup

On a fresh install with 0 users, visiting `/app#/login` shows a "Create Admin Account" form. The first user gets `role: 'platform_admin'` automatically.

If you see a login form instead:
1. Check user count: `sqlite3 server/db/remote_display.db "SELECT COUNT(*) FROM users"`
2. If 0, clear browser localStorage: `localStorage.clear(); location.reload()`
3. If still showing login, open incognito window

### 3. Android TV Connection Issues

**Server URL:** Use `https://your-server-domain.com` (NOT `/player`). The app appends `/device` automatically for WebSocket.

**"Connecting endlessly":**
- Check reverse proxy WebSocket support (nginx needs `proxy_set_header Upgrade $http_upgrade;`)
- Try `http://your-server-domain.com:3001` to bypass SSL/TLS issues
- Check TV logs via ADB: `adb logcat | grep -i "WebSocket\|socket\|connect"`
- Ensure TV and server are on same network

### 4. Admin Password Recovery (Lost Access)

**Symptom:** Locked out of the admin account, `reset-admin.js` creates a NEW admin but you need the original account back.

**Fix:** Update the password hash directly in SQLite:

```bash
cd server

# Generate bcrypt hash of new password
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('new-password', 10));"

# Update the user's password hash
sqlite3 db/remote_display.db "UPDATE users SET password_hash = 'HASH_FROM_ABOVE' WHERE email = 'admin@example.com';"
```

**Note:** The `reset-admin.js` script creates a NEW user with a 1-hour token. It does NOT recover the original admin's password. Use SQL for existing user recovery.

## Integrations (Power BI, Looker Studio, Custom URLs)

The `integrations` table stores configurations for external data sources. An **integration worker** (`server/services/integration-worker.js`) runs every 30s and:

1. Checks for enabled integrations whose `next_fetch_at` is due
2. **Power BI**: OAuth2 client credentials → `ExportTo` (PNG) → poll status → download file
3. **Looker Studio / Custom URL**: HTTP GET with optional Bearer/Basic auth
4. Saves/replaces the result as a `content` item (reuses the same `content_id` across refreshes)
5. Updates `published_snapshot` for any playlist referencing that content
6. **Pushes WebSocket update** to all devices displaying the content so the new image appears immediately
7. Cache busting via timestamp in filepath (`{contentId}_{timestamp}.png`) — player always gets a fresh URL

The filename stored in the content library is the **integration name** (no extension, no timestamp).

**Supported types:**

| Type | Config fields |
|------|---------------|
| `powerbi` | tenant_id, client_id, client_secret, workspace_id, report_id, page_name (optional) |
| `looker_studio` | url, auth_type, auth_header |
| `custom_url` | url, auth_type, auth_header |

**UI:** `/app#/integrations` — list, create, edit, delete, manual refresh trigger, preview.

## Known Quirks

- `proxy-addr` is required by `server/services/activity.js` but was an implicit Express dependency. It's listed in `package.json` explicitly now.
- Unconfigured `GRAPH_*` env vars cause `sendEmail()` to log `[EMAIL] not configured` to stdout instead of sending.
- `GRAPH_DEV_RESTRICT_TO` is a comma-separated email allow-list for dev safety against prod DB clones.
- Admin lockout recovery: `node scripts/reset-admin.js` prints a 1-hour login URL.
- `reset-admin.js` hardcodes path to `node_modules` via relative `path.join` — must be run from repo root.
- `SELF_HOSTED=true` is hardcoded in `config.js` — no billing logic, all features unlocked for all users.

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `install-service.sh` | Install as systemd service |
| `reset-admin.js` | Emergency admin recovery |
| `android/scripts/setup-kiosk.sh` | Android TV kiosk mode setup |

## API Endpoints (Admin User Management)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/auth/users` | List all users with workspace memberships |
| `POST` | `/api/auth/admin/users` | Create user (body: `email`, `name`, `password`, `role`, `workspace_id` optional) |
| `PUT` | `/api/auth/users/:id/role` | Change system role (`user`, `workspace_editor`, `workspace_admin`, `platform_admin`) |
| `PUT` | `/api/auth/users/:id/workspace-role` | Change workspace membership role (body: `workspace_id`, `role`) |
| `PUT` | `/api/auth/users/:id/password` | Admin reset password for another user |
| `DELETE` | `/api/auth/users/:id` | Delete user |

## API Endpoints (Integrations)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/integrations` | List integrations with last content info |
| `POST` | `/api/integrations` | Create integration (body: `name`, `integration_type`, `config`) |
| `GET` | `/api/integrations/:id` | Get single integration |
| `PUT` | `/api/integrations/:id` | Update integration (name, config, enabled) |
| `DELETE` | `/api/integrations/:id` | Delete integration + orphan content |
| `POST` | `/api/integrations/:id/refresh` | Trigger immediate fetch |

## Documentation

Use these project documents before asking general questions:

| File | Use when you need... |
|------|---------------------|
| `docs/ARCHITECTURE.md` | High-level system overview, data flow, tech stack decisions |
| `docs/GUIA_IT.md` | How to run, deploy, troubleshoot, and operate the system (ops guide) |
| `AGENTS.md` (this file) | Setup commands, known issues, deployment checklist |
| `server/contexto-camanchaca-llm.md` | Business context, reliability principles, project phases |

**When to consult each:**
- Changing backend structure or adding features → `docs/ARCHITECTURE.md`
- Deploying, debugging, or handing over to IT → `docs/GUIA_IT.md`
- Fixing errors during setup or migration → `AGENTS.md` Known Issues
- Designing new features or prioritizing reliability → `contexto-camanchaca-llm.md`

## Context7 References

Available documentation libraries for deep technical questions. Use these IDs with Context7 queries:

| Technology | Context7 ID | Use for |
|------------|-------------|---------|
| Express.js | `/expressjs/express` or `/websites/expressjs_en_5` | Middleware, routing, request/response patterns |
| Socket.IO | `/websites/socket_io_v4` | Namespaces, rooms, reconnection, broadcasting |
| better-sqlite3 | `/wiselibs/better-sqlite3` | Transactions, prepared statements, WAL mode, backups |

**Typical queries:**
- "Socket.IO namespaces and room broadcasting examples"
- "better-sqlite3 WAL mode configuration and backup"
- "Express middleware error handling patterns"

## Android TV Player Setup (ADB)

### Prerequisites

- **JDK 17**: `brew install openjdk@17`
- **Android SDK**: `brew install --cask android-commandlinetools`
  - `sdkmanager "platforms;android-34" "build-tools;34.0.0"`
- **ADB**: `brew install android-platform-tools`
- **Keystore**: `android/release-key.jks` (password: `camanchaca`)

### Build APK

```bash
cd android
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export PATH=$JAVA_HOME/bin:$PATH
export KEYSTORE_PASSWORD="camanchaca"
export KEY_ALIAS="remotedisplay"
export KEY_PASSWORD="camanchaca"
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`
Copied to root: `camanchaca-player.apk` (for OTA updates)

### Connect to TV via ADB

```bash
# Via WiFi (TV must have USB debugging enabled)
adb connect <TV_IP>:5555
adb devices

# Example
adb connect 10.55.36.140:5555
```

### Install / Update APK

```bash
# First install
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Update (if signature matches)
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# If signature mismatch (new keystore), uninstall first:
adb uninstall com.remotedisplay.player
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Kiosk Mode Setup

For dedicated Android TV boxes (e.g., ET-N0566):

```bash
cd android/scripts
./setup-kiosk.sh
```

This disables the default launcher and sets Camanchaca Player as the home app.

### Version Bump

Edit `android/app/build.gradle.kts`:

```kotlin
defaultConfig {
    versionCode = 2        // Increment for each release
    versionName = "1.0.1"  // Human readable version
}
```

### OTA Updates

The server serves `camanchaca-player.apk` from the repo root at `/api/update/check`. The Android app checks this endpoint periodically and prompts for update when a new version is available.

**Note:** `*.apk` is gitignored. The APK must be manually copied to the server after each build:
```bash
# On server
/opt/tv-app-factory/camanchaca-player.apk
```

## Deployment Checklist

- [ ] `.env` configured with `JWT_SECRET`, `APP_URL`, `NODE_ENV=production`
- [ ] `.jwt_secret` synced with `.env` JWT_SECRET
- [ ] SSL certificates in place (or use HTTP on port 3001)
- [ ] Reverse proxy configured for WebSocket upgrade
- [ ] First admin account created via setup form
- [ ] Service running as non-root user (e.g., `tvapp`)
- [ ] For Power BI integrations: App Registration in Azure AD with `Report.Read.All` (Application permission), service principal added to Power BI workspace
