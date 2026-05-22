# AGENTS.md

## Package Manager

- **pnpm only** (`pnpm-lock.yaml` present, `pnpm.onlyBuiltDependencies` in `package.json`)
- pnpm v10+ blocks native build scripts by default. If you add a native dep, add its name to `pnpm.onlyBuiltDependencies` in `server/package.json` before running `pnpm install`.

## Commands

```bash
cd server
pnpm install
pnpm start       # node --env-file-if-exists=.env server.js
pnpm dev         # same + --watch for auto-restart
```

No test suite exists. No lint or typecheck config. This is a vanilla JS project.

## Node.js Version

**Node 20.6–22.x only.** Node ≥25 headers require C++20 but Apple Clang doesn't pass `-std=c++20` during native addon builds, causing `better-sqlite3` compilation failure. Use `nvm use 20` before any `pnpm` command.

## Local Setup

1. `cd server && pnpm install`
2. `pnpm dev` — server starts on port 3001
3. First user to visit gets a setup form and becomes `platform_admin` automatically
4. All subsequent users must be created by an admin via the admin panel

The `.npmrc` in `server/` sets `registry=https://registry.npmjs.org/` to override any global work registry.

## Authentication

- **Local auth only** — no OAuth (Google/Microsoft removed)
- **No public registration** — first user self-registers via setup form, all other users created by admin
- Admin creates users at `/app#/admin` with role selection (default: `workspace_editor`)
- All users are auto-assigned to the admin's workspace on creation
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
  services/       heartbeat, alerts, email (MS Graph), scheduler, activity log
  ws/             WebSocket handlers (device + dashboard namespaces)
  lib/            tenancy resolver, permissions, socket-rooms, command-queue
  player/         Web-based display player (index.html + sw.js) — Service Worker for offline playback
  config/         Cloudflare IP ranges for trust-proxy
frontend/         Vanilla JS SPA (no framework)
android/          Android player (Kotlin + ExoPlayer)
scripts/          Admin recovery, migration scripts, device setup
```

- Multi-tenant: `organizations → workspaces → resources`. Every resource scoped by `workspace_id`.
- JWT carries `current_workspace_id` claim. Workspace resolved via: header > query > JWT > first membership > (platform_admin fallback).
- Six role levels: `platform_admin > org_owner > org_admin > workspace_admin > workspace_editor > workspace_viewer`.
- CSP applies to dashboard paths only; widget/kiosk render paths (`/api/widgets/:id/render`, `/api/kiosk/:id/render`) bypass it intentionally (inline scripts/styles needed for device display).

## Removed Features

- **No billing/subscriptions** — Stripe removed, everything is unlimited
- **No OAuth** — Google and Microsoft sign-in removed
- **No white-label/branding** — custom branding feature deleted
- **No marketing pages** — landing, legal, guides, comparisons deleted
- **No contact form** — enterprise contact endpoint removed
- **No plans table** — subscription plans dropped from schema (but `plan_id` column remains on `users` for compatibility)

## Known Issues & Fixes

### 1. Missing `plans` table on fresh install

**Error:** `SqliteError: no such table: main.plans`

**Fix:** Create the table manually:
```bash
sudo sqlite3 server/db/remote_display.db "
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  max_devices INTEGER DEFAULT 999999,
  max_storage_mb INTEGER DEFAULT 999999,
  has_analytics INTEGER DEFAULT 1,
  has_priority_support INTEGER DEFAULT 1,
  price_monthly REAL DEFAULT 0,
  price_yearly REAL DEFAULT 0,
  stripe_price_monthly TEXT,
  stripe_price_yearly TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);
INSERT OR IGNORE INTO plans (id, name) VALUES ('free', 'Free');
INSERT OR IGNORE INTO plans (id, name) VALUES ('enterprise', 'Enterprise');
"
```

### 2. Missing `plan_id` column on `users` table

**Error:** `SqliteError: no such column: plan_id`

**Fix:** Add the column:
```bash
sudo sqlite3 server/db/remote_display.db "ALTER TABLE users ADD COLUMN plan_id TEXT DEFAULT 'free';"
```

### 3. Organizations FK constraint referencing missing `plans` table

**Error:** `SqliteError: no such table: main.plans` when creating first organization

**Fix:** The multitenancy migration creates `organizations.plan_id` with `REFERENCES plans(id)`. Run `node scripts/fix-organization-fk.js` to recreate the table without the FK constraint. Or create the `plans` table first (see issue #1 above).

### 4. JWT Secret Mismatch

**Symptom:** Recovery tokens or user tokens show as "Invalid or expired"

**Root cause:** Server loads `.env` (via `--env-file-if-exists=.env`), but `reset-admin.js` reads `.jwt_secret`. If they differ, tokens are signed with one secret and verified with another.

**Fix:** Keep them in sync:
```bash
# Copy .env JWT_SECRET to .jwt_secret
JWT_SECRET=$(grep JWT_SECRET server/.env | cut -d= -f2)
echo "$JWT_SECRET" | sudo tee server/certs/.jwt_secret
sudo systemctl restart camanchaca-cms
```

### 5. First User Setup

On a fresh install with 0 users, visiting `/app#/login` shows a "Create Admin Account" form. The first user gets `role: 'platform_admin'` automatically.

If you see a login form instead:
1. Check user count: `sqlite3 server/db/remote_display.db "SELECT COUNT(*) FROM users"`
2. If 0, clear browser localStorage: `localStorage.clear(); location.reload()`
3. If still showing login, open incognito window

### 6. Android TV Connection Issues

**Server URL:** Use `https://your-server-domain.com` (NOT `/player`). The app appends `/device` automatically for WebSocket.

**"Connecting endlessly":**
- Check reverse proxy WebSocket support (nginx needs `proxy_set_header Upgrade $http_upgrade;`)
- Try `http://your-server-domain.com:3001` to bypass SSL/TLS issues
- Check TV logs via ADB: `adb logcat | grep -i "WebSocket\|socket\|connect"`
- Ensure TV and server are on same network

### 7. Admin Password Recovery (Lost Access)

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
| `migrate-multitenancy.js` | DB migration for multi-tenancy |
| `parity-multitenancy.js` | Verify migration integrity |
| `reset-admin.js` | Emergency admin recovery |
| `fix-organization-fk.js` | Fix organizations table FK constraint |

## Documentation

Use these project documents before asking general questions:

| File | Use when you need... |
|------|---------------------|
| `ARCHITECTURE.md` | High-level system overview, data flow, tech stack decisions |
| `GUIA_IT.md` | How to run, deploy, troubleshoot, and operate the system (ops guide) |
| `AGENTS.md` (this file) | Setup commands, known issues, deployment checklist |
| `server/contexto-camanchaca-llm.md` | Business context, reliability principles, project phases |

**When to consult each:**
- Changing backend structure or adding features → `ARCHITECTURE.md`
- Deploying, debugging, or handing over to IT → `GUIA_IT.md`
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

## Deployment Checklist

- [ ] `.env` configured with `JWT_SECRET`, `APP_URL`, `NODE_ENV=production`
- [ ] `.jwt_secret` synced with `.env` JWT_SECRET
- [ ] `plans` table exists (or run fix script)
- [ ] `users.plan_id` column exists
- [ ] SSL certificates in place (or use HTTP on port 3001)
- [ ] Reverse proxy configured for WebSocket upgrade
- [ ] First admin account created via setup form
- [ ] Service running as non-root user (e.g., `tvapp`)
