const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, touchSpace } = require('../db');

const router = express.Router();

// ─── GET /api/spaces/:id/map ────────────────────────────────────────────────
router.get('/spaces/:spaceId/map', (req, res) => {
  const { spaceId } = req.params;
  const space = db.prepare('SELECT id FROM spaces WHERE id = ?').get(spaceId);
  if (!space) return res.status(404).json({ error: 'Space not found.' });

  // Get stages and items
  const stages = db.prepare(`SELECT * FROM stages WHERE space_id = ? ORDER BY "order"`).all(spaceId);
  const items = db.prepare(`
    SELECT i.* 
    FROM items i 
    JOIN stages s ON s.id = i.stage_id 
    WHERE s.space_id = ? 
    ORDER BY i."order"
  `).all(spaceId);

  // Group items by stage
  const stagesWithItems = stages.map(s => ({
    ...s,
    items: items.filter(i => i.stage_id === s.id)
  }));

  // Get discovery questions
  const discovery_questions = db.prepare(`
    SELECT * FROM discovery_questions WHERE space_id = ?
  `).all(spaceId);

  // Get item connections
  const item_connections = db.prepare(`
    SELECT * FROM item_connections WHERE space_id = ?
  `).all(spaceId);

  res.json({ stages: stagesWithItems, discovery_questions, item_connections });
});

// ─── PATCH /api/questions/:id ─────────────────────────────────────────────
router.patch('/questions/:id', (req, res) => {
  const q = db.prepare('SELECT * FROM discovery_questions WHERE id = ?').get(req.params.id);
  if (!q) return res.status(404).json({ error: 'Question not found.' });

  const { answered_by } = req.body;
  db.prepare(`
    UPDATE discovery_questions SET answered_by = ?, updated_at = datetime('now') WHERE id = ?
  `).run(answered_by ?? null, q.id);

  touchSpace(q.space_id);
  res.json(db.prepare('SELECT * FROM discovery_questions WHERE id = ?').get(q.id));
});

// ─── POST /api/item-connections ─────────────────────────────────────────────
router.post('/item-connections', (req, res) => {
  const { space_id, source_item_id, target_item_id, label, cross_space } = req.body;
  if (!space_id || !source_item_id || !target_item_id) {
    return res.status(400).json({ error: 'space_id, source_item_id, target_item_id required.' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO item_connections (id, space_id, source_item_id, target_item_id, label, cross_space)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, space_id, source_item_id, target_item_id, label || null, cross_space ? 1 : 0);

  touchSpace(space_id);
  res.status(201).json(db.prepare('SELECT * FROM item_connections WHERE id = ?').get(id));
});

// ─── PATCH /api/item-connections/:id ───────────────────────────────────────────────
router.patch('/item-connections/:id', (req, res) => {
  const conn = db.prepare('SELECT * FROM item_connections WHERE id = ?').get(req.params.id);
  if (!conn) return res.status(404).json({ error: 'Connection not found.' });

  const { label } = req.body;
  db.prepare(`
    UPDATE item_connections SET label = ?, updated_at = datetime('now') WHERE id = ?
  `).run(label ?? null, conn.id);

  touchSpace(conn.space_id);
  res.json(db.prepare('SELECT * FROM item_connections WHERE id = ?').get(conn.id));
});

// ─── DELETE /api/item-connections/:id ──────────────────────────────────────────────
router.delete('/item-connections/:id', (req, res) => {
  const conn = db.prepare('SELECT * FROM item_connections WHERE id = ?').get(req.params.id);
  if (!conn) return res.status(404).json({ error: 'Connection not found.' });

  db.prepare('DELETE FROM item_connections WHERE id = ?').run(conn.id);
  touchSpace(conn.space_id);
  res.status(204).end();
});

// ─── GET /api/templates ───────────────────────────────────────────────────────
router.get('/templates', (req, res) => {
  res.json(db.prepare('SELECT * FROM space_templates ORDER BY created_at DESC').all());
});

// ─── POST /api/templates ──────────────────────────────────────────────────────
router.post('/templates', (req, res) => {
  const { name, description = '', stages = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required.' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO space_templates (id, name, description, stages) VALUES (?, ?, ?, ?)
  `).run(id, name.trim(), description.trim(), JSON.stringify(stages));

  res.status(201).json(db.prepare('SELECT * FROM space_templates WHERE id = ?').get(id));
});

// ─── DELETE /api/templates/:id ────────────────────────────────────────────────
router.delete('/templates/:id', (req, res) => {
  const info = db.prepare('DELETE FROM space_templates WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Template not found.' });
  res.status(204).end();
});

module.exports = router;
