const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, touchSpace } = require('../db');

const router = express.Router();

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getSpaceForNode(nodeId) {
  const row = db.prepare('SELECT space_id FROM synthesis_nodes WHERE id = ?').get(nodeId);
  return row ? row.space_id : null;
}

function validateSourceId(type, sourceId, spaceId) {
  if (type === 'freetext') return true;
  if (!sourceId) return false;

  if (type === 'item') {
    const row = db.prepare(`
      SELECT i.id FROM items i
      JOIN stages s ON s.id = i.stage_id
      WHERE i.id = ? AND s.space_id = ?
    `).get(sourceId, spaceId);
    return !!row;
  }

  if (type === 'highlight') {
    const row = db.prepare(`
      SELECT h.id FROM highlights h
      JOIN items i ON i.id = h.item_id
      JOIN stages s ON s.id = i.stage_id
      WHERE h.id = ? AND s.space_id = ?
    `).get(sourceId, spaceId);
    return !!row;
  }

  if (type === 'pause_point') {
    const row = db.prepare(`
      SELECT p.id FROM pause_points p
      JOIN items i ON i.id = p.item_id
      JOIN stages s ON s.id = i.stage_id
      WHERE p.id = ? AND s.space_id = ?
    `).get(sourceId, spaceId);
    return !!row;
  }

  return false;
}

// ─── GET /api/spaces/:spaceId/synthesis ──────────────────────────────────────
router.get('/spaces/:spaceId/synthesis', (req, res) => {
  const { spaceId } = req.params;
  const space = db.prepare('SELECT id FROM spaces WHERE id = ?').get(spaceId);
  if (!space) return res.status(404).json({ error: 'Space not found.' });

  const nodes = db.prepare(
    'SELECT * FROM synthesis_nodes WHERE space_id = ? ORDER BY created_at'
  ).all(spaceId);

  const connections = db.prepare(
    'SELECT * FROM synthesis_connections WHERE space_id = ? ORDER BY created_at'
  ).all(spaceId);

  res.json({ nodes, connections });
});

// ─── POST /api/synthesis/nodes ───────────────────────────────────────────────
router.post('/synthesis/nodes', (req, res) => {
  const {
    space_id, type, source_id = null, content = '',
    x = 100, y = 100, width = 220, height = 120, color = null
  } = req.body;

  if (!space_id || !type) {
    return res.status(400).json({ error: 'space_id and type are required.' });
  }

  const validTypes = ['item', 'highlight', 'pause_point', 'freetext'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}.` });
  }

  const space = db.prepare('SELECT id FROM spaces WHERE id = ?').get(space_id);
  if (!space) return res.status(404).json({ error: 'Space not found.' });

  if (!validateSourceId(type, source_id, space_id)) {
    return res.status(400).json({ error: 'source_id is invalid or does not belong to this Space.' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO synthesis_nodes
      (id, space_id, type, source_id, content, x, y, width, height, color, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(id, space_id, type, source_id, content, x, y, width, height, color);

  touchSpace(space_id);
  res.status(201).json(db.prepare('SELECT * FROM synthesis_nodes WHERE id = ?').get(id));
});

// ─── PATCH /api/synthesis/nodes/:id ─────────────────────────────────────────
router.patch('/synthesis/nodes/:id', (req, res) => {
  const node = db.prepare('SELECT * FROM synthesis_nodes WHERE id = ?').get(req.params.id);
  if (!node) return res.status(404).json({ error: 'Node not found.' });

  const { x, y, width, height, content, color } = req.body;

  const updates = {};
  if (x !== undefined) updates.x = x;
  if (y !== undefined) updates.y = y;
  if (width !== undefined) updates.width = width;
  if (height !== undefined) updates.height = height;
  if (content !== undefined) updates.content = content;
  if ('color' in req.body) updates.color = color ?? null;

  if (Object.keys(updates).length === 0) {
    return res.json(node);
  }

  const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), node.id];

  db.prepare(`
    UPDATE synthesis_nodes SET ${setClause}, updated_at = datetime('now') WHERE id = ?
  `).run(...values);

  touchSpace(node.space_id);
  res.json(db.prepare('SELECT * FROM synthesis_nodes WHERE id = ?').get(node.id));
});

// ─── DELETE /api/synthesis/nodes/:id ────────────────────────────────────────
router.delete('/synthesis/nodes/:id', (req, res) => {
  const node = db.prepare('SELECT * FROM synthesis_nodes WHERE id = ?').get(req.params.id);
  if (!node) return res.status(404).json({ error: 'Node not found.' });

  // Cascades to synthesis_connections via FK ON DELETE CASCADE
  db.prepare('DELETE FROM synthesis_nodes WHERE id = ?').run(node.id);
  touchSpace(node.space_id);
  res.status(204).end();
});

// ─── POST /api/synthesis/connections ────────────────────────────────────────
router.post('/synthesis/connections', (req, res) => {
  const { space_id, source_node_id, target_node_id, label = null, source_handle = null, target_handle = null } = req.body;

  if (!space_id || !source_node_id || !target_node_id) {
    return res.status(400).json({ error: 'space_id, source_node_id, target_node_id are required.' });
  }

  if (source_node_id === target_node_id) {
    return res.status(400).json({ error: 'Self-connections are not allowed.' });
  }

  const space = db.prepare('SELECT id FROM spaces WHERE id = ?').get(space_id);
  if (!space) return res.status(404).json({ error: 'Space not found.' });

  // Validate both nodes exist and belong to this space
  const srcNode = db.prepare('SELECT * FROM synthesis_nodes WHERE id = ? AND space_id = ?').get(source_node_id, space_id);
  const tgtNode = db.prepare('SELECT * FROM synthesis_nodes WHERE id = ? AND space_id = ?').get(target_node_id, space_id);

  if (!srcNode) return res.status(400).json({ error: 'source_node_id not found in this Space.' });
  if (!tgtNode) return res.status(400).json({ error: 'target_node_id not found in this Space.' });

  // Prevent duplicate connections (same direction)
  const existing = db.prepare(`
    SELECT id FROM synthesis_connections
    WHERE space_id = ? AND source_node_id = ? AND target_node_id = ? AND (source_handle = ? OR (source_handle IS NULL AND ? IS NULL)) AND (target_handle = ? OR (target_handle IS NULL AND ? IS NULL))
  `).get(space_id, source_node_id, target_node_id, source_handle, source_handle, target_handle, target_handle);

  if (existing) {
    return res.status(409).json({ error: 'A connection between these nodes already exists.' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO synthesis_connections
      (id, space_id, source_node_id, target_node_id, label, source_handle, target_handle, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(id, space_id, source_node_id, target_node_id, label, source_handle, target_handle);

  touchSpace(space_id);
  res.status(201).json(db.prepare('SELECT * FROM synthesis_connections WHERE id = ?').get(id));
});

// ─── PATCH /api/synthesis/connections/:id ───────────────────────────────────
router.patch('/synthesis/connections/:id', (req, res) => {
  const conn = db.prepare('SELECT * FROM synthesis_connections WHERE id = ?').get(req.params.id);
  if (!conn) return res.status(404).json({ error: 'Connection not found.' });

  const { label, has_arrow } = req.body;
  const updates = {};
  if ('label' in req.body) updates.label = label ?? null;
  if ('has_arrow' in req.body) updates.has_arrow = has_arrow ? 1 : 0;

  if (Object.keys(updates).length === 0) return res.json(conn);

  const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), conn.id];

  db.prepare(`
    UPDATE synthesis_connections SET ${setClause}, updated_at = datetime('now') WHERE id = ?
  `).run(...values);

  touchSpace(conn.space_id);
  res.json(db.prepare('SELECT * FROM synthesis_connections WHERE id = ?').get(conn.id));
});

// ─── DELETE /api/synthesis/connections/:id ──────────────────────────────────
router.delete('/synthesis/connections/:id', (req, res) => {
  const conn = db.prepare('SELECT * FROM synthesis_connections WHERE id = ?').get(req.params.id);
  if (!conn) return res.status(404).json({ error: 'Connection not found.' });

  db.prepare('DELETE FROM synthesis_connections WHERE id = ?').run(conn.id);
  touchSpace(conn.space_id);
  res.status(204).end();
});

module.exports = router;
