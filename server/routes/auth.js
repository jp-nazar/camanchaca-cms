const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');
const { generateToken, requireAuth, requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const { resolveTenancy } = require('../lib/tenancy');
const { logActivity, getClientIp } = require('../services/activity');
const config = require('../config');

function ensureDefaultOrgForUser(user) {
  const existing = db.prepare(`
    SELECT w.id FROM workspaces w
    JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = ?
    ORDER BY wm.joined_at ASC LIMIT 1
  `).get(user.id);
  if (existing) return existing.id;

  const wsId  = uuidv4();
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO workspaces (id, name, created_by) VALUES (?, 'Default', ?)`).run(wsId, user.id);
    db.prepare(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'workspace_admin')`).run(wsId, user.id);
  });
  tx();
  return wsId;
}

function logFailedLogin(email, ip, reason) {
  try {
    db.prepare('INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (NULL, ?, ?, ?)')
      .run('auth:login_failed', `${email} - ${reason}`, ip);
  } catch {}
}

function logSuccessfulLogin(userId, email, ip) {
  try {
    // Phase 2.2 writer-leak fix: stamp the user's oldest workspace so this
    // login event is queryable in tenant-scoped activity views. Multi-workspace
    // users still land on one row; the activity dashboard already shows
    // per-user context separately from per-workspace context.
    const ws = db.prepare(
      'SELECT workspace_id FROM workspace_members WHERE user_id = ? ORDER BY joined_at ASC LIMIT 1'
    ).get(userId);
    db.prepare('INSERT INTO activity_log (user_id, action, details, ip_address, workspace_id) VALUES (?, ?, ?, ?, ?)')
      .run(userId, 'auth:login_success', email, ip, ws?.workspace_id || null);
    db.prepare("UPDATE users SET last_login = strftime('%s','now') WHERE id = ?").run(userId);
  } catch {}
}

// ==================== Local Auth ====================

// Returns true if new account creation is allowed at this moment.
// First-user setup (empty DB) is always allowed so a fresh install can be initialized.
function canRegister() {
  if (!config.disableRegistration) return true;
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  return userCount === 0;
}

// Register — only first user can self-register (bootstrap), after that admin-only
router.post('/register', (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const isFirstUser = userCount === 0;

  if (!isFirstUser) {
    return res.status(403).json({ error: 'Registration is disabled. Users must be created by an administrator.' });
  }

  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);

  // First user becomes platform_admin
  db.prepare(`
    INSERT INTO users (id, email, name, password_hash, auth_provider, role)
    VALUES (?, ?, ?, ?, 'local', 'platform_admin')
  `).run(id, email.toLowerCase(), name || email.split('@')[0], passwordHash);

  const user = db.prepare('SELECT id, email, name, role, auth_provider, avatar_url FROM users WHERE id = ?').get(id);
  const workspaceId = ensureDefaultOrgForUser(user);
  const token = generateToken(user, workspaceId);

  res.status(201).json({ token, user, current_workspace_id: workspaceId });
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND auth_provider = ?').get(email.toLowerCase(), 'local');
  if (!user) {
    logFailedLogin(email, getClientIp(req), 'User not found');
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
    logFailedLogin(email, getClientIp(req), 'Wrong password');
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  logSuccessfulLogin(user.id, email, getClientIp(req));
  const workspaceId = ensureDefaultOrgForUser(user);
  const token = generateToken(user, workspaceId);
  const { password_hash, ...safeUser } = user;
  res.json({ token, user: safeUser, current_workspace_id: workspaceId });
});

// ==================== Admin User Creation ====================

// Create a new user (admin only). Users are always local auth.
router.post('/admin/users', requireAuth, requireAdmin, (req, res) => {
  const { email, name, password, role, workspace_id } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);

  // Default role is workspace_editor if not specified
  const userRole = role || 'workspace_editor';
  if (!['user', 'workspace_editor', 'workspace_admin', 'platform_admin'].includes(userRole)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  db.prepare(`
    INSERT INTO users (id, email, name, password_hash, auth_provider, role)
    VALUES (?, ?, ?, ?, 'local', ?)
  `).run(id, email.toLowerCase(), name || email.split('@')[0], passwordHash, userRole);

  const user = db.prepare('SELECT id, email, name, role, auth_provider, avatar_url FROM users WHERE id = ?').get(id);

  // Assign to specified workspace, or fall back to caller's workspace
  const targetWsId = workspace_id || (() => {
    const cw = db.prepare('SELECT workspace_id FROM workspace_members WHERE user_id = ? ORDER BY joined_at ASC LIMIT 1').get(req.user.id);
    return cw ? cw.workspace_id : null;
  })();

  if (targetWsId) {
    const ws = db.prepare('SELECT id FROM workspaces WHERE id = ?').get(targetWsId);
    if (!ws) return res.status(400).json({ error: 'Workspace not found' });
    const memberRole = userRole === 'platform_admin' ? 'workspace_admin' : userRole;
    db.prepare('INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)').run(targetWsId, id, memberRole);
  }

  res.status(201).json({ user });
});

// ==================== User Management ====================

// Get current user + tenancy context.
router.get('/me', requireAuth, resolveTenancy, (req, res) => {
  // Platform admins see every workspace in the system (via the LEFT JOIN they
  // still get their own workspace_role for direct memberships; NULL elsewhere,
  // matching accessContext's actingAs semantics). Regular users see only
  // workspaces they have a direct workspace_members row in. Role is read from
  // the signed JWT (not user-supplied), so non-admins cannot reach the admin
  // branch. No cap on the admin list yet - revisit at 50+ workspaces when
  // dropdown UX without search starts to degrade.
  //
  // Each accessible_workspaces entry also carries `can_admin: bool` so the
  // UI can render admin affordances (rename pencil etc.) only where the
  // caller has permission. The server still enforces permission on the
  // actual mutation routes regardless of this advisory flag.
  // device_count: correlated subquery on workspaces.id. Equality fails on NULL
  // so unclaimed pair-pool devices (workspace_id IS NULL) are correctly excluded.
  // Microseconds per row at current scale (~37 rows worst case for platform_admin);
  // not optimizing - revisit if the admin list grows past a few hundred workspaces.
  const isPlatformAdmin = req.user.role === 'platform_admin' || req.user.role === 'superadmin';
  const accessible = isPlatformAdmin
    ? db.prepare(`
        SELECT w.id, w.name,
               wm.role AS workspace_role,
               (SELECT COUNT(*) FROM devices WHERE workspace_id = w.id) AS device_count
        FROM workspaces w
        LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
        ORDER BY w.name
      `).all(req.user.id)
    : db.prepare(`
        SELECT w.id, w.name,
               wm.role AS workspace_role,
               (SELECT COUNT(*) FROM devices WHERE workspace_id = w.id) AS device_count
        FROM workspace_members wm
        JOIN workspaces w ON w.id = wm.workspace_id
        WHERE wm.user_id = ?
        ORDER BY w.name
      `).all(req.user.id);

  // Compute can_admin per workspace
  for (const w of accessible) {
    w.can_admin = isPlatformAdmin || w.workspace_role === 'workspace_admin';
  }

  res.json({
    ...req.user,
    current_workspace_id: req.workspaceId,
    current_workspace: req.workspace ? { id: req.workspace.id, name: req.workspace.name } : null,
    current_workspace_role: req.workspaceRole,
    is_platform_admin: req.isPlatformAdmin,
    accessible_workspaces: accessible,
  });
});

// Switch the active workspace. Validates the user has access (direct
// workspace_member, org-level admin in the parent org, or platform_admin),
// then mints a fresh JWT with the new current_workspace_id.
router.post('/switch-workspace', requireAuth, (req, res) => {
  const { workspace_id } = req.body || {};
  if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });

  const ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspace_id);
  if (!ws) return res.status(404).json({ error: 'Workspace not found' });

  const isPlatformAdmin = req.user.role === 'platform_admin' || req.user.role === 'superadmin';
  const wsMember = db.prepare('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(ws.id, req.user.id);
  const canAct = isPlatformAdmin || !!wsMember;

  if (!canAct) return res.status(403).json({ error: 'Access denied to that workspace' });

  const token = generateToken(req.user, ws.id);
  res.json({ token, current_workspace_id: ws.id });
});

// Update current user
router.put('/me', requireAuth, (req, res) => {
  const { name, password, current_password, email_alerts } = req.body;
  if (name) {
    db.prepare('UPDATE users SET name = ?, updated_at = strftime(\'%s\',\'now\') WHERE id = ?')
      .run(name, req.user.id);
  }
  if (email_alerts !== undefined) {
    db.prepare('UPDATE users SET email_alerts = ?, updated_at = strftime(\'%s\',\'now\') WHERE id = ?')
      .run(email_alerts ? 1 : 0, req.user.id);
  }
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const row = db.prepare('SELECT password_hash, auth_provider FROM users WHERE id = ?').get(req.user.id);
    if (!row) return res.status(404).json({ error: 'User not found' });
    if (row.auth_provider !== 'local') {
      return res.status(400).json({ error: `Your account signs in via ${row.auth_provider}. Manage your password there.` });
    }
    if (row.password_hash) {
      if (!current_password || !bcrypt.compareSync(current_password, row.password_hash)) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = strftime(\'%s\',\'now\') WHERE id = ?')
      .run(hash, req.user.id);
  }
  const user = db.prepare('SELECT id, email, name, role, auth_provider, avatar_url, email_alerts FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// List users - platform admin only
router.get('/users', requireAuth, requireSuperAdmin, (req, res) => {
  let users = db.prepare('SELECT id, email, name, role, auth_provider, avatar_url, created_at, last_login FROM users ORDER BY created_at ASC').all();

  // Include workspace memberships for each user
  const getWorkspaces = db.prepare(`
    SELECT w.id, w.name, wm.role as workspace_role
    FROM workspaces w
    JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = ?
    ORDER BY w.name
  `);

  users = users.map(u => ({
    ...u,
    workspaces: getWorkspaces.all(u.id)
  }));

  res.json(users);
});

// Delete user (superadmin only)
router.delete('/users/:id', requireAuth, requireSuperAdmin, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Update user system role (platform admin only)
router.put('/users/:id/role', requireAuth, requireSuperAdmin, (req, res) => {
  const { role } = req.body;
  const validRoles = ['user', 'workspace_editor', 'workspace_admin', 'platform_admin'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (req.params.id === req.user.id && role !== 'platform_admin') return res.status(400).json({ error: 'Cannot demote yourself' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ success: true });
});

// Update user workspace membership role (platform admin only)
router.put('/users/:id/workspace-role', requireAuth, requireSuperAdmin, (req, res) => {
  const { workspace_id, role } = req.body;
  if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });
  const validRoles = ['workspace_editor', 'workspace_admin', 'workspace_viewer'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid workspace role' });
  const ws = db.prepare('SELECT id FROM workspaces WHERE id = ?').get(workspace_id);
  if (!ws) return res.status(404).json({ error: 'Workspace not found' });
  const member = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(workspace_id, req.params.id);
  if (!member) return res.status(404).json({ error: 'User is not a member of this workspace' });
  db.prepare('UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?').run(role, workspace_id, req.params.id);
  res.json({ success: true });
});

// Admin password reset for another user (platform admin only)
router.put('/users/:id/password', requireAuth, requireSuperAdmin, (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Use Settings > Change Password for your own account' });
  }
  const target = db.prepare('SELECT id, email, role, auth_provider FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.auth_provider !== 'local') {
    return res.status(400).json({ error: `User signs in via ${target.auth_provider} — password reset does not apply` });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = strftime('%s','now') WHERE id = ?")
    .run(hash, req.params.id);

  // Explicit audit entry — the generic activity logger captures the route
  // and target id, but a labeled detail string makes the audit log readable.
  // Never include the password; just who reset whose password.
  logActivity(req.user.id, 'password_reset_for_user', `target: ${target.email}`, null, getClientIp(req));
  res.json({ success: true });
});

// Get auth config (public - tells frontend which providers are available)
router.get('/config', (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  res.json({
    localEnabled: true,
    needsSetup: userCount === 0,
    registration_enabled: userCount === 0,
  });
});

module.exports = router;
