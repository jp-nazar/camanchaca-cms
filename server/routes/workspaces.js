const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { canAdminWorkspace } = require('../lib/permissions');
const { v4: uuidv4 } = require('uuid');

// Workspace management routes. Operates on a target workspace specified by
// URL param, NOT the caller's currently active workspace - so this router
// does NOT use resolveTenancy. Permission is gated via canAdminWorkspace()
// which evaluates against the target workspace, not req.workspaceRole.

const NAME_MAX = 80;
const SLUG_MAX = 60;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// List all workspaces the user has access to
router.get('/', (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'platform_admin' || req.user.role === 'superadmin';
  
  let workspaces;
  if (isAdmin) {
    // Platform admins see all workspaces
    workspaces = db.prepare('SELECT w.*, COUNT(DISTINCT wm.user_id) as member_count FROM workspaces w LEFT JOIN workspace_members wm ON w.id = wm.workspace_id GROUP BY w.id ORDER BY w.created_at DESC').all();
  } else {
    // Regular users see only their workspaces
    workspaces = db.prepare(`
      SELECT w.* FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = ?
      ORDER BY w.created_at DESC
    `).all(userId);
  }
  
  res.json(workspaces);
});

// Create a new workspace (platform_admin only)
router.post('/', (req, res) => {
  if (req.user.role !== 'platform_admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Platform admin required' });
  }
  
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Workspace name is required' });
  if (name.length > NAME_MAX) return res.status(400).json({ error: `Name must be ${NAME_MAX} characters or fewer` });
  
  const wsId = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  
  // Use a default organization or create one if needed
  let orgId = req.body.organization_id || null;
  if (!orgId) {
    // Try to get the first organization
    const org = db.prepare('SELECT id FROM organizations LIMIT 1').get();
    if (org) {
      orgId = org.id;
    } else {
      // Create a default organization
      orgId = uuidv4();
      db.prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
        .run(orgId, 'Default Organization', now);
    }
  }
  
  try {
    // Create workspace
    db.prepare('INSERT INTO workspaces (id, organization_id, name, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(wsId, orgId, name, req.user.id, now, now);
    
    // Add creator as workspace_admin
    db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)')
      .run(wsId, req.user.id, 'workspace_admin', now);
    
    const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(wsId);
    res.status(201).json(workspace);
  } catch (e) {
    console.error('Error creating workspace:', e);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

// Delete a workspace (platform_admin only)
router.delete('/:id', (req, res) => {
  if (req.user.role !== 'platform_admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Platform admin required' });
  }
  
  const ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.params.id);
  if (!ws) return res.status(404).json({ error: 'Workspace not found' });
  
  // Don't allow deleting the last workspace
  const wsCount = db.prepare('SELECT COUNT(*) as count FROM workspaces').get().count;
  if (wsCount <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last workspace' });
  }
  
  try {
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(req.params.id);
    res.json({ message: 'Workspace deleted' });
  } catch (e) {
    console.error('Error deleting workspace:', e);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

// Rename a workspace. MVP scope: name + slug only. Permission: platform_admin,
// org_owner/admin of the parent org, or workspace_admin of the target ws.
router.patch('/:id', (req, res) => {
  const ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.params.id);
  if (!ws) return res.status(404).json({ error: 'Workspace not found' });
  if (!canAdminWorkspace(db, req.user, ws)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Stamp the target workspace_id so activityLogger captures the right
  // tenant attribution. This route doesn't use resolveTenancy (operates on
  // a URL-param target, not the caller's active workspace), so req.workspaceId
  // would otherwise be undefined and the audit row would have NULL workspace.
  req.workspaceId = ws.id;

  const updates = [];
  const values = [];

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ error: 'Name cannot be empty' });
    if (name.length > NAME_MAX) return res.status(400).json({ error: `Name must be ${NAME_MAX} characters or fewer` });
    updates.push('name = ?');
    values.push(name);
  }

  if (req.body.slug !== undefined) {
    // Empty string -> NULL (workspace has no slug). Otherwise normalize +
    // validate against the URL-safe segment pattern.
    const raw = String(req.body.slug || '').trim().toLowerCase();
    if (raw === '') {
      updates.push('slug = NULL');
    } else {
      if (raw.length > SLUG_MAX) return res.status(400).json({ error: `Slug must be ${SLUG_MAX} characters or fewer` });
      if (!SLUG_RE.test(raw)) {
        return res.status(400).json({ error: 'Slug must be lowercase letters, digits, and hyphens (no leading/trailing/double hyphens)' });
      }
      updates.push('slug = ?');
      values.push(raw);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push("updated_at = strftime('%s','now')");
  values.push(req.params.id);

  try {
    db.prepare(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE/i.test(e.message)) {
      return res.status(409).json({ error: 'Slug already used in this organization' });
    }
    throw e;
  }

  const updated = db.prepare('SELECT id, name, slug, organization_id FROM workspaces WHERE id = ?').get(req.params.id);
  res.json(updated);
});

module.exports = router;
