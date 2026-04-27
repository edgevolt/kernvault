const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

const router = express.Router();

// ─── GET /api/recall ──────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { item_id } = req.query;

  if (item_id) {
    const items = db.prepare(`
      SELECT i.*, s.id as space_id, s.name as space_name, st.name as stage_name
      FROM items i
      JOIN stages st ON st.id = i.stage_id
      JOIN spaces s ON s.id = st.space_id
      WHERE i.id = ?
    `).all(item_id);
    return res.json(items);
  }

  const items = db.prepare(`
    SELECT i.*, s.id as space_id, s.name as space_name, st.name as stage_name
    FROM items i
    JOIN stages st ON st.id = i.stage_id
    JOIN spaces s ON s.id = st.space_id
    WHERE i.status = 'done' 
      AND i.recall_level > 0 
      AND i.recall_level < 5
      AND i.next_recall_at <= datetime('now')
    ORDER BY i.next_recall_at ASC
  `).all();
  res.json(items);
});

// ─── POST /api/items/:id/recall ────────────────────────────────────────────────
router.post('/items/:id/recall', (req, res) => {
  const { response, outcome, isPractice } = req.body;
  if (!['got_it', 'needs_another_look', 'skip'].includes(outcome)) {
    return res.status(400).json({ error: 'Invalid outcome.' });
  }

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  const sessionId = uuidv4();
  const triggered_by = isPractice ? 'manual' : 'scheduled';
  // interval_days: the interval that triggered this session
  const INTERVALS = [null, 2, 7, 30, 90];
  const interval_days = INTERVALS[item.recall_level] ?? null;

  db.prepare(`
    INSERT INTO recall_sessions (id, item_id, response, recall_response, outcome, interval_days, triggered_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sessionId, item.id, response || null, response || null, outcome, interval_days, triggered_by);

  // Apply scheduling logic
  if (outcome === 'needs_another_look') {
    db.prepare(`
      UPDATE items SET status = 'reading', recall_level = 0, next_recall_at = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(item.id);
  } else if (!isPractice) {
    if (outcome === 'got_it') {
      const nextLevel = item.recall_level + 1;
      let nextDateStr = "'+2 days'";
      if (nextLevel === 2) nextDateStr = "'+7 days'";
      else if (nextLevel === 3) nextDateStr = "'+30 days'";
      else if (nextLevel === 4) nextDateStr = "'+90 days'";
      
      if (nextLevel >= 5) {
        db.prepare(`UPDATE items SET recall_level = 5, next_recall_at = NULL, updated_at = datetime('now') WHERE id = ?`).run(item.id);
      } else {
        db.prepare(`UPDATE items SET recall_level = ?, next_recall_at = datetime('now', ${nextDateStr}), updated_at = datetime('now') WHERE id = ?`).run(nextLevel, item.id);
      }
    } else if (outcome === 'skip') {
      // Keep level same, just bump by current level's interval
      const level = Math.max(1, item.recall_level);
      let nextDateStr = "'+2 days'";
      if (level === 2) nextDateStr = "'+7 days'";
      else if (level === 3) nextDateStr = "'+30 days'";
      else if (level === 4) nextDateStr = "'+90 days'";
      
      db.prepare(`UPDATE items SET next_recall_at = datetime('now', ${nextDateStr}), updated_at = datetime('now') WHERE id = ?`).run(item.id);
    }
  }

  res.json({ ok: true });
});

module.exports = router;
