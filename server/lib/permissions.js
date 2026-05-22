// Phase 2.1: permission helpers.
//
// Routes call these as Express middleware to gate access, or as predicate
// functions to branch within a handler. They presume resolveTenancy has
// already attached req.workspaceId / req.workspaceRole / req.isPlatformAdmin.
//
// Layering (top wins):
//   1. req.isPlatformAdmin -> allow anything
//   2. req.workspaceRole in {workspace_admin, workspace_editor, workspace_viewer}
//      gates resource access per the role's bands

'use strict';

function canRead(req) {
  if (req.isPlatformAdmin) return true;
  return !!req.workspaceRole; // any workspace_member can read
}

function canWrite(req) {
  if (req.isPlatformAdmin) return true;
  return req.workspaceRole === 'workspace_admin' || req.workspaceRole === 'workspace_editor';
}

function canAdmin(req) {
  if (req.isPlatformAdmin) return true;
  return req.workspaceRole === 'workspace_admin';
}

// ---- middleware variants ----

function requireWorkspace(req, res, next) {
  if (!req.workspaceId) {
    return res.status(403).json({ error: 'No workspace context' });
  }
  next();
}

function requireWorkspaceRead(req, res, next) {
  if (!canRead(req)) {
    return res.status(403).json({ error: 'Workspace access required' });
  }
  next();
}

function requireWorkspaceWrite(req, res, next) {
  if (!canWrite(req)) {
    return res.status(403).json({ error: 'Workspace editor or admin required' });
  }
  next();
}

function requireWorkspaceAdmin(req, res, next) {
  if (!canAdmin(req)) {
    return res.status(403).json({ error: 'Workspace admin required' });
  }
  next();
}

function requirePlatformAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'platform_admin') {
    return res.status(403).json({ error: 'Platform admin required' });
  }
  next();
}

// Decoupled "can admin this workspace" predicate. Unlike canAdmin(req) above,
// this takes an explicit (user, workspace) pair instead of reading from req,
// so it works for routes that operate on a target workspace specified by URL
// param rather than the caller's currently active one.
function canAdminWorkspace(db, user, workspace) {
  if (!user || !workspace) return false;
  if (user.role === 'platform_admin' || user.role === 'superadmin') return true;
  const wm = db.prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
    .get(workspace.id, user.id);
  return wm && wm.role === 'workspace_admin';
}

module.exports = {
  // boolean predicates
  canRead, canWrite, canAdmin, canAdminWorkspace,
  // express middleware
  requireWorkspace,
  requireWorkspaceRead,
  requireWorkspaceWrite,
  requireWorkspaceAdmin,
  requirePlatformAdmin,
};
