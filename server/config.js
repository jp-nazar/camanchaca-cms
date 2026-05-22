const path = require('path');

module.exports = {
  port: process.env.PORT || 3001,
  httpsPort: process.env.HTTPS_PORT || 3443,
  dbPath: path.join(__dirname, 'db', 'remote_display.db'),
  uploadsDir: path.join(__dirname, 'uploads'),
  contentDir: path.join(__dirname, 'uploads', 'content'),
  screenshotsDir: path.join(__dirname, 'uploads', 'screenshots'),
  frontendDir: path.join(__dirname, '..', 'frontend'),
  // App-level heartbeat. Checker runs every heartbeatInterval and marks
  // devices offline if last_heartbeat is older than heartbeatTimeout.
  // Env override for self-hosters on slow/jittery networks (issue #3:
  // reporter found raising HEARTBEAT_TIMEOUT to 60s reduced false offlines).
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 10000,
  heartbeatTimeout:  parseInt(process.env.HEARTBEAT_TIMEOUT)  || 45000,
  // How long the server holds commands/playlist-updates for a device that's
  // offline at emit time (ms). On reconnect within this window, queued events
  // are flushed in order. Past TTL they're dropped. See lib/command-queue.js.
  commandQueueTtlMs: parseInt(process.env.COMMAND_QUEUE_TTL_MS) || 30000,
  // Engine.IO transport-level ping/pong. Raised from Socket.IO defaults
  // (25000/20000) because TV WebKits (LG webOS, older Tizen) miss pongs
  // under decode load - tighter values cause spurious transport drops.
  // Worst-case dead-socket detection: pingInterval + pingTimeout = 60s.
  pingInterval: parseInt(process.env.PING_INTERVAL) || 30000,
  pingTimeout:  parseInt(process.env.PING_TIMEOUT)  || 30000,
  maxFileSize: 500 * 1024 * 1024, // 500MB
  thumbnailWidth: 320,
  screenshotQuality: 70,
  // SSL: drop your Cloudflare Origin cert + key in certs/ folder
  // or set env vars SSL_CERT and SSL_KEY to custom paths
  sslCert: process.env.SSL_CERT || path.join(__dirname, 'certs', 'cert.pem'),
  sslKey: process.env.SSL_KEY || path.join(__dirname, 'certs', 'key.pem'),
  // Auth
  jwtSecret: process.env.JWT_SECRET || (() => {
    const secretFile = path.join(__dirname, 'certs', '.jwt_secret');
    const fs = require('fs');
    if (fs.existsSync(secretFile)) return fs.readFileSync(secretFile, 'utf8').trim();
    const secret = require('crypto').randomBytes(64).toString('hex');
    try { fs.mkdirSync(path.dirname(secretFile), { recursive: true }); fs.writeFileSync(secretFile, secret); } catch {}
    return secret;
  })(),
  jwtExpiry: '7d',
  // Microsoft Graph email sender (services/email.js). Required for actual
  // delivery; absent values short-circuit to a stdout fallback for local dev.
  graphTenantId: process.env.GRAPH_TENANT_ID || '',
  graphClientId: process.env.GRAPH_CLIENT_ID || '',
  graphClientSecret: process.env.GRAPH_CLIENT_SECRET || '',
  graphSenderEmail: process.env.GRAPH_SENDER_EMAIL || '',
  graphSenderName: process.env.GRAPH_SENDER_NAME || 'Camanchaca CMS',
  // Dev safety net: comma-separated allow-list of recipient emails. When set,
  // sends to any address NOT in the list are suppressed (logged but not posted
  // to Graph). Intended for local dev that pulls fresh prod DB copies - keeps
  // us from accidentally emailing real prod users. UNSET on prod systemd unit.
  graphDevRestrictTo: process.env.GRAPH_DEV_RESTRICT_TO || '',
  // Always self-hosted — no billing, no subscriptions, unlimited everything
  selfHosted: true,
  // Disable public registration (OAuth auto-signup is also blocked when set).
  // First-user setup is still allowed so a fresh install can be initialized.
  disableRegistration: ['true', '1'].includes(String(process.env.DISABLE_REGISTRATION || '').toLowerCase()),
};
