const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

const router = express.Router();

// GET /api/items/:itemId/notes
router.get('/items/:itemId/notes', (req, res) => {
  const notes = db.prepare(`
    SELECT * FROM notes WHERE item_id = ? ORDER BY created_at ASC
  `).all(req.params.itemId);
  res.json(notes);
});

// POST /api/items/:itemId/notes
router.post('/items/:itemId/notes', (req, res) => {
  const item = db.prepare('SELECT id FROM items WHERE id = ?').get(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  const { body, source = 'manual' } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Note body is required.' });

  const validSources = ['manual', 'pause_point', 'voice', 'reflection'];
  if (!validSources.includes(source)) {
    return res.status(400).json({ error: `source must be one of: ${validSources.join(', ')}` });
  }

  const id = uuidv4();
  db.prepare('INSERT INTO notes (id, item_id, body, source) VALUES (?, ?, ?, ?)').run(
    id, item.id, body.trim(), source
  );
  res.status(201).json(db.prepare('SELECT * FROM notes WHERE id = ?').get(id));
});

// DELETE /api/notes/:id
router.delete('/notes/:id', (req, res) => {
  const info = db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Note not found.' });
  res.status(204).end();
});

module.exports = router;
