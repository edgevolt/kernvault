const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

const router = express.Router();

// GET /api/items/:itemId/pause-points
router.get('/items/:itemId/pause-points', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM pause_points WHERE item_id = ? ORDER BY position ASC
  `).all(req.params.itemId);
  res.json(rows);
});

// POST /api/items/:itemId/pause-points
router.post('/items/:itemId/pause-points', (req, res) => {
  const item = db.prepare('SELECT id FROM items WHERE id = ?').get(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  const { position, prompt, response, skipped = false } = req.body;
  if (position === undefined || !prompt?.trim()) {
    return res.status(400).json({ error: 'position and prompt are required.' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO pause_points (id, item_id, position, prompt, response, skipped)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, item.id, position, prompt.trim(), response?.trim() ?? null, skipped ? 1 : 0);

  res.status(201).json(db.prepare('SELECT * FROM pause_points WHERE id = ?').get(id));
});

// PATCH /api/pause-points/:id  (save response or mark skipped)
router.patch('/pause-points/:id', (req, res) => {
  const pp = db.prepare('SELECT * FROM pause_points WHERE id = ?').get(req.params.id);
  if (!pp) return res.status(404).json({ error: 'Pause point not found.' });

  const { response, skipped } = req.body;
  db.prepare(`
    UPDATE pause_points SET
      response = COALESCE(?, response),
      skipped  = COALESCE(?, skipped)
    WHERE id = ?
  `).run(response?.trim() ?? null, skipped !== undefined ? (skipped ? 1 : 0) : null, pp.id);

  res.json(db.prepare('SELECT * FROM pause_points WHERE id = ?').get(pp.id));
});

module.exports = router;
