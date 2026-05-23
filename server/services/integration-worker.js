const { db } = require('../db/database');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const zlib = require('zlib');

const POLL_INTERVAL = 30000; // worker tick
const FETCH_TIMEOUT = 60000;

let deviceNs = null;

function startIntegrationWorker(io) {
  deviceNs = io?.of('/device');
  setInterval(evaluateIntegrations, POLL_INTERVAL);
  console.log('Integration worker started');
}

function evaluateIntegrations() {
  const now = Math.floor(Date.now() / 1000);
  const due = db.prepare(`
    SELECT * FROM integrations
    WHERE enabled = 1 AND next_fetch_at IS NOT NULL AND next_fetch_at <= ?
    ORDER BY next_fetch_at ASC
    LIMIT 10
  `).all(now);

  for (const int of due) {
    db.prepare("UPDATE integrations SET status = 'fetching', updated_at = strftime('%s','now') WHERE id = ?").run(int.id);
    const configData = safeJsonParse(int.config, {});
    switch (int.integration_type) {
      case 'powerbi':
        fetchPowerBi(int, configData).catch(err => handleError(int, err));
        break;
      case 'looker_studio':
        fetchUrl(int, configData).catch(err => handleError(int, err));
        break;
      case 'custom_url':
        fetchUrl(int, configData).catch(err => handleError(int, err));
        break;
      default:
        handleError(int, new Error('Unknown integration type'));
    }
  }
}

async function fetchPowerBi(int, cfg) {
  const { tenant_id, client_id, client_secret, workspace_id, report_id, page_name, refresh_interval_min = 15 } = cfg;
  if (!tenant_id || !client_id || !client_secret || !workspace_id || !report_id) {
    throw new Error('Missing Power BI configuration: tenant_id, client_id, client_secret, workspace_id, and report_id are required');
  }

  // 1. Get access token
  const token = await oAuth2ClientCredentials(
    `https://login.microsoftonline.com/${tenant_id}/oauth2/v2.0/token`,
    client_id,
    client_secret,
    'https://analysis.windows.net/powerbi/api/.default'
  );

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 2. Trigger export
  const exportBody = {
    format: 'PNG',
    powerBIReportConfiguration: {}
  };
  if (page_name) exportBody.powerBIReportConfiguration.pages = [{ pageName: page_name }];

  const exportRes = await httpsPost(
    `https://api.powerbi.com/v1.0/myorg/groups/${workspace_id}/reports/${report_id}/ExportTo`,
    headers,
    JSON.stringify(exportBody)
  );
  const exportData = JSON.parse(exportRes);
  const exportId = exportData.id;
  if (!exportId) throw new Error('Failed to start Power BI export: ' + (exportData.error?.message || exportRes));

  // 3. Poll until complete
  const png = await pollPowerBiExport(token, workspace_id, report_id, exportId);

  // 4. Save as content (pushes to devices if content changed)
  await saveAsContent(int, png, 'image/png', '.png');
  scheduleNext(int, refresh_interval_min);
}

async function pollPowerBiExport(token, workspaceId, reportId, exportId) {
  const headers = { Authorization: `Bearer ${token}` };
  const maxAttempts = 30; // ~60s
  for (let i = 0; i < maxAttempts; i++) {
    const statusRes = await httpsGet(
      `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/exports/${exportId}`,
      headers
    );
    const status = JSON.parse(statusRes);
    if (status.status === 'Succeeded') {
      const fileRes = await httpsGet(
        `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/exports/${exportId}/file`,
        headers
      );
      return Buffer.from(fileRes, 'binary');
    }
    if (status.status === 'Failed') throw new Error('Power BI export failed: ' + (status.error || 'Unknown'));
    await sleep(2000);
  }
  throw new Error('Power BI export timed out');
}

async function fetchUrl(int, cfg) {
  const { url, refresh_interval_min = 15, auth_type, auth_header } = cfg;
  if (!url) throw new Error('URL is required');

  const isJson = url.includes('format=json') || url.endsWith('.json');
  const headers = {};
  if (auth_type === 'bearer' && auth_header) headers['Authorization'] = `Bearer ${auth_header}`;
  if (auth_type === 'basic' && auth_header) headers['Authorization'] = `Basic ${auth_header}`;

  const res = await httpsGet(url, headers, FETCH_TIMEOUT);
  const buf = Buffer.from(res, 'binary');

  let mimeType = 'image/png';
  let ext = '.png';
  if (isJson) {
    mimeType = 'application/json';
    ext = '.json';
  } else {
    // Detect content-type from response headers isn't available with simple httpsGet
    // Default to PNG — user should configure correctly
  }

  await saveAsContent(int, buf, mimeType, ext);
  scheduleNext(int, refresh_interval_min);
}

async function saveAsContent(int, buf, mimeType, ext) {
  const contentId = int.content_id || uuidv4();
  const isNew = !int.content_id;
  const filename = int.name;
  const filepath = `${contentId}${ext}`; // stable filename for caching
  const destPath = path.join(config.contentDir, filepath);

  fs.mkdirSync(config.contentDir, { recursive: true });

  // If content exists and bytes are identical, skip write + push entirely
  if (!isNew && fs.existsSync(destPath)) {
    const existing = fs.readFileSync(destPath);
    if (existing.equals(buf)) {
      db.prepare('UPDATE integrations SET status = \'success\', last_error = NULL, last_fetched_at = strftime(\'%s\',\'now\'), updated_at = strftime(\'%s\',\'now\') WHERE id = ?')
        .run(int.id);
      return contentId;
    }
  }

  fs.writeFileSync(destPath, buf);

  // Generate device-optimized variant for image integrations
  let optimizedPath = null;
  if (mimeType.startsWith('image/')) {
    try {
      const sharp = require('sharp');
      optimizedPath = `opt_${contentId}.jpg`;
      await sharp(destPath)
        .resize(config.deviceImageMaxWidth, config.deviceImageMaxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: config.deviceImageQuality, progressive: true })
        .toFile(path.join(config.contentDir, optimizedPath));
    } catch (e) {
      console.warn('[integration-worker] Optimized image generation failed:', e.message);
      optimizedPath = null;
    }
  }

  if (isNew) {
    db.prepare(`
      INSERT INTO content (id, user_id, workspace_id, filename, filepath, mime_type, file_size, optimized_filepath)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(contentId, null, int.workspace_id, filename, filepath, mimeType, buf.length, optimizedPath);
    db.prepare('UPDATE integrations SET content_id = ?, status = \'success\', last_error = NULL, last_fetched_at = strftime(\'%s\',\'now\'), updated_at = strftime(\'%s\',\'now\') WHERE id = ?')
      .run(contentId, int.id);
  } else {
    // Remove stale files if names changed (pre-migration cleanup)
    const old = db.prepare('SELECT filepath, optimized_filepath FROM content WHERE id = ?').get(contentId);
    if (old) {
      if (old.filepath && old.filepath !== filepath) {
        try { fs.unlinkSync(path.join(config.contentDir, old.filepath)); } catch {}
      }
      if (old.optimized_filepath && old.optimized_filepath !== optimizedPath) {
        try { fs.unlinkSync(path.join(config.contentDir, old.optimized_filepath)); } catch {}
      }
    }
    db.prepare('UPDATE content SET filename = ?, filepath = ?, file_size = ?, optimized_filepath = ? WHERE id = ?')
      .run(filename, filepath, buf.length, optimizedPath, contentId);
    db.prepare('UPDATE integrations SET status = \'success\', last_error = NULL, last_fetched_at = strftime(\'%s\',\'now\'), updated_at = strftime(\'%s\',\'now\') WHERE id = ?')
      .run(int.id);
    pushToAffectedDevices(contentId);
  }
  return contentId;
}

function scheduleNext(int, intervalMin) {
  const next = Math.floor(Date.now() / 1000) + (intervalMin * 60);
  db.prepare('UPDATE integrations SET next_fetch_at = ?, status = \'success\', updated_at = strftime(\'%s\',\'now\') WHERE id = ?')
    .run(next, int.id);
}

function handleError(int, err) {
  console.error(`[integration-worker] ${int.name} (${int.id}):`, err.message);
  const next = Math.floor(Date.now() / 1000) + 300; // retry in 5 min
  db.prepare("UPDATE integrations SET status = 'error', last_error = ?, next_fetch_at = ?, updated_at = strftime('%s','now') WHERE id = ?")
    .run(err.message, next, int.id);
}

// ---- HTTP helpers ----

function oAuth2ClientCredentials(url, clientId, clientSecret, scope) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: scope,
      grant_type: 'client_credentials'
    }).toString();
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) resolve(json.access_token);
          else reject(new Error(json.error_description || json.error || 'OAuth2 failed'));
        } catch { reject(new Error('OAuth2 response parse failed')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(FETCH_TIMEOUT, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(body);
    req.end();
  });
}

function httpsGet(url, headers, timeout, redirects = 5) {
  return new Promise((resolve, reject) => {
    if (redirects <= 0) return reject(new Error('Too many redirects'));
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'Accept-Encoding': 'identity', ...headers } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const redirectUrl = new URL(res.headers.location, url).href;
        return httpsGet(redirectUrl, headers, timeout, redirects - 1).then(resolve, reject);
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('binary')));
    });
    req.on('error', reject);
    req.setTimeout(timeout || FETCH_TIMEOUT, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

function pushToAffectedDevices(contentId) {
  if (!deviceNs || !contentId) return;

  // Update published_snapshot for any playlist that references this content
  const content = db.prepare('SELECT * FROM content WHERE id = ?').get(contentId);
  if (!content) return;

  const playlists = db.prepare(`
    SELECT DISTINCT pi.playlist_id FROM playlist_items pi
    WHERE pi.content_id = ?
  `).all(contentId);

  for (const row of playlists) {
    const pl = db.prepare('SELECT published_snapshot FROM playlists WHERE id = ?').get(row.playlist_id);
    if (!pl?.published_snapshot) continue;
    let snapshot;
    try { snapshot = JSON.parse(pl.published_snapshot); } catch { continue; }
    let changed = false;
    const version = Date.now();
    for (const item of snapshot) {
      if (item.content_id === contentId) {
        item.filepath = content.filepath;
        item.filename = content.filename;
        item.file_size = content.file_size;
        item.content_version = version;
        changed = true;
      }
    }
    if (changed) {
      db.prepare('UPDATE playlists SET published_snapshot = ? WHERE id = ?')
        .run(JSON.stringify(snapshot), row.playlist_id);
    }
  }

  const devices = db.prepare(`
    SELECT DISTINCT d.id FROM devices d
    JOIN playlist_items pi ON pi.playlist_id = d.playlist_id
    WHERE pi.content_id = ?
  `).all(contentId);
  if (!devices.length) return;

  const { buildPlaylistPayload } = require('../ws/deviceSocket');
  const commandQueue = require('../lib/command-queue');
  for (const d of devices) {
    commandQueue.queueOrEmitPlaylistUpdate(deviceNs, d.id, buildPlaylistPayload);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

module.exports = { startIntegrationWorker };
