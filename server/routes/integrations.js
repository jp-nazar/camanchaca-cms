const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');
const config = require('../config');
const path = require('path');
const fs = require('fs');

// List integrations in the caller's workspace
router.get('/', (req, res) => {
  if (!req.workspaceId) return res.json([]);
  const integrations = db.prepare(`
    SELECT i.*, c.filename as content_filename, c.filepath as content_filepath,
           c.mime_type as content_mime_type, c.thumbnail_path as content_thumbnail
    FROM integrations i
    LEFT JOIN content c ON i.content_id = c.id
    WHERE i.workspace_id = ?
    ORDER BY i.created_at DESC
  `).all(req.workspaceId);
  res.json(integrations.map(i => ({
    ...i,
    config: JSON.parse(i.config || '{}')
  })));
});

// Get single integration
router.get('/:id', (req, res) => {
  const int = db.prepare(`
    SELECT i.*, c.filename as content_filename, c.filepath as content_filepath,
           c.mime_type as content_mime_type, c.thumbnail_path as content_thumbnail
    FROM integrations i
    LEFT JOIN content c ON i.content_id = c.id
    WHERE i.id = ?
  `).get(req.params.id);
  if (!int) return res.status(404).json({ error: 'Integration not found' });
  if (int.workspace_id && int.workspace_id !== req.workspaceId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json({ ...int, config: JSON.parse(int.config || '{}') });
});

// Create integration
router.post('/', (req, res) => {
  if (!req.workspaceId) return res.status(403).json({ error: 'No workspace context' });
  const { name, integration_type, config: intConfig } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!['powerbi', 'looker_studio', 'custom_url'].includes(integration_type)) {
    return res.status(400).json({ error: 'Invalid integration type' });
  }
  const id = uuidv4();
  db.prepare(`
    INSERT INTO integrations (id, workspace_id, name, integration_type, config, next_fetch_at)
    VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
  `).run(id, req.workspaceId, name, integration_type, JSON.stringify(intConfig || {}));
  const created = db.prepare('SELECT * FROM integrations WHERE id = ?').get(id);
  res.status(201).json({ ...created, config: JSON.parse(created.config) });
});

// Update integration
router.put('/:id', (req, res) => {
  const int = db.prepare('SELECT * FROM integrations WHERE id = ?').get(req.params.id);
  if (!int) return res.status(404).json({ error: 'Integration not found' });
  if (int.workspace_id && int.workspace_id !== req.workspaceId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { name, integration_type, config: intConfig, enabled } = req.body;
  if (name !== undefined) db.prepare('UPDATE integrations SET name = ? WHERE id = ?').run(name, req.params.id);
  if (intConfig !== undefined) {
    db.prepare('UPDATE integrations SET config = ?, updated_at = strftime(\'%s\',\'now\') WHERE id = ?')
      .run(JSON.stringify(intConfig), req.params.id);
  }
  if (enabled !== undefined) db.prepare('UPDATE integrations SET enabled = ?, updated_at = strftime(\'%s\',\'now\') WHERE id = ?').run(enabled ? 1 : 0, req.params.id);
  // Reset next_fetch so worker runs soon
  db.prepare('UPDATE integrations SET next_fetch_at = strftime(\'%s\',\'now\'), updated_at = strftime(\'%s\',\'now\') WHERE id = ?').run(req.params.id);
  const updated = db.prepare('SELECT * FROM integrations WHERE id = ?').get(req.params.id);
  res.json({ ...updated, config: JSON.parse(updated.config) });
});

// Delete integration
router.delete('/:id', (req, res) => {
  const int = db.prepare('SELECT * FROM integrations WHERE id = ?').get(req.params.id);
  if (!int) return res.status(404).json({ error: 'Integration not found' });
  if (int.workspace_id && int.workspace_id !== req.workspaceId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  // Remove orphan content if integration had one
  if (int.content_id) {
    const content = db.prepare('SELECT filepath FROM content WHERE id = ?').get(int.content_id);
    if (content && content.filepath) {
      try { fs.unlinkSync(path.join(config.contentDir, content.filepath)); } catch {}
    }
    db.prepare('DELETE FROM content WHERE id = ?').run(int.content_id);
  }
  db.prepare('DELETE FROM integrations WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Manual refresh — triggers immediate fetch by resetting next_fetch_at
router.post('/:id/refresh', (req, res) => {
  const int = db.prepare('SELECT * FROM integrations WHERE id = ?').get(req.params.id);
  if (!int) return res.status(404).json({ error: 'Integration not found' });
  if (int.workspace_id && int.workspace_id !== req.workspaceId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  db.prepare('UPDATE integrations SET next_fetch_at = strftime(\'%s\',\'now\'), status = \'idle\', updated_at = strftime(\'%s\',\'now\') WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
