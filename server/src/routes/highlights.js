const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

const router = express.Router();

// Create new highlight
router.post('/', (req, res) => {
  const { item_id, selected_text, start_offset, end_offset, annotation, annotation_state } = req.body;

  if (!item_id || selected_text == null || start_offset == null || end_offset == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate item exists
  const item = db.prepare('SELECT id FROM items WHERE id = ?').get(item_id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const id = uuidv4();
  const state = annotation_state || 'unannotated';
  
  db.prepare(`
    INSERT INTO highlights (id, item_id, selected_text, start_offset, end_offset, annotation, annotation_state)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, item_id, selected_text, start_offset, end_offset, annotation || null, state);

  const highlight = db.prepare('SELECT * FROM highlights WHERE id = ?').get(id);
  res.status(201).json(highlight);
});

// Update highlight
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { annotation, annotation_state } = req.body;

  const existing = db.prepare('SELECT * FROM highlights WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Highlight not found' });
  }

  let sql = 'UPDATE highlights SET updated_at = datetime("now")';
  const params = [];

  if (annotation !== undefined) {
    sql += ', annotation = ?';
    params.push(annotation);
  }
  if (annotation_state !== undefined) {
    sql += ', annotation_state = ?';
    params.push(annotation_state);
  }

  sql += ' WHERE id = ?';
  params.push(id);

  db.prepare(sql).run(...params);

  const updated = db.prepare('SELECT * FROM highlights WHERE id = ?').get(id);
  res.json(updated);
});

// Delete highlight
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM highlights WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Highlight not found' });
  }
  res.status(204).send();
});

module.exports = router;
