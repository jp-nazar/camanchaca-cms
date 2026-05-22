// Phase 2.1: per-request tenancy resolver.
//
// Runs after requireAuth (which sets req.user and req.jwtWorkspaceId).
// Resolves the active workspace context for this request and attaches:
//
//   req.workspaceId      string | null   the workspace this request operates in
//   req.workspace        object | null   the full workspaces row
//   req.workspaceRole    string | null   'workspace_admin' | 'workspace_editor' | 'workspace_viewer'
//   req.isPlatformAdmin  boolean         shortcut for req.user.role === 'platform_admin'
//
// Resolution order, top wins:
//   1. X-Workspace-Id header                (for explicit per-request override)
//   2. ?workspace_id= query param           (same purpose, easier in browser dev)
//   3. JWT current_workspace_id             (the user's last switched-to workspace)
//   4. First workspace_members row for user (sorted by joined_at ASC)
//   5. For platform_admin only: any workspace

'use strict';

const { db } = require('../db/database');

function membershipOf(userId, workspaceId) {
  return db.prepare(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
  ).get(workspaceId, userId);
}

function loadWorkspace(workspaceId) {
  if (!workspaceId) return null;
  return db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);
}

function firstAccessibleWorkspace(userId) {
  return db.prepare(`
    SELECT w.* FROM workspaces w
    JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = ?
    ORDER BY wm.joined_at ASC
    LIMIT 1
  `).get(userId);
}

// Check whether userId can access workspace. Returns the access context:
// { workspaceRole } or null if no access.
function accessContext(userId, role, workspace) {
  const isPlatformAdmin = role === 'platform_admin';
  const wsMembership = membershipOf(userId, workspace.id);
  if (wsMembership) {
    return { workspaceRole: wsMembership.role };
  }
  if (isPlatformAdmin) {
    return { workspaceRole: null };
  }
  return null;
}

function resolveTenancy(req, res, next) {
  if (!req.user) {
    // Should not happen when chained after requireAuth, but tolerate optionalAuth flows.
    return next();
  }

  const isPlatformAdmin = req.user.role === 'platform_admin';
  req.isPlatformAdmin = isPlatformAdmin;

  // Build the ordered candidate list of workspace_ids to try.
  const candidates = [];
  const headerWs = (req.headers['x-workspace-id'] || '').trim();
  if (headerWs) candidates.push(headerWs);
  if (req.query && req.query.workspace_id) candidates.push(String(req.query.workspace_id));
  if (req.jwtWorkspaceId) candidates.push(req.jwtWorkspaceId);

  let workspace = null;
  let context = null;
  for (const wsId of candidates) {
    const ws = loadWorkspace(wsId);
    if (!ws) continue;
    const ctx = accessContext(req.user.id, req.user.role, ws);
    if (!ctx) continue;
    workspace = ws;
    context = ctx;
    break;
  }

  if (!workspace) {
    // Fall back to the user's first workspace_members row.
    const first = firstAccessibleWorkspace(req.user.id);
    if (first) {
      workspace = first;
      const wm = membershipOf(req.user.id, first.id);
      context = { workspaceRole: wm.role };
    } else if (isPlatformAdmin) {
      // Platform admin with no direct memberships: pick any workspace.
      const any = db.prepare('SELECT * FROM workspaces LIMIT 1').get();
      if (any) {
        workspace = any;
        context = { workspaceRole: null };
      }
    }
  }

  if (workspace) {
    req.workspaceId = workspace.id;
    req.workspace = workspace;
    req.workspaceRole = context.workspaceRole;
  } else {
    req.workspaceId = null;
    req.workspace = null;
    req.workspaceRole = null;
  }

  next();
}

// Enumerate every workspace_id the given user has access to.
// Used by socket.io rooms to scope outbound broadcasts.
function accessibleWorkspaceIds(userId, role) {
  if (!userId) return [];
  if (role === 'platform_admin' || role === 'superadmin') {
    return db.prepare('SELECT id FROM workspaces').all().map(r => r.id);
  }
  return db.prepare(`
    SELECT workspace_id AS id FROM workspace_members WHERE user_id = ?
  `).all(userId).map(r => r.id);
}

module.exports = {
  resolveTenancy,
  // Exported for testing / direct use by routes that need ad-hoc checks.
  accessContext,
  membershipOf,
  firstAccessibleWorkspace,
  accessibleWorkspaceIds,
};
