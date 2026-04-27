const express = require('express');
const { db } = require('../db');

const router = express.Router();

// GET /api/export — full JSON dump
router.get('/export', (req, res) => {
  const spaces     = db.prepare('SELECT * FROM spaces').all();
  const stages     = db.prepare('SELECT * FROM stages').all();
  const items      = db.prepare('SELECT * FROM items').all();
  const notes      = db.prepare('SELECT * FROM notes').all();
  const pausePoints = db.prepare('SELECT * FROM pause_points').all();

  const payload = {
    exported_at: new Date().toISOString(),
    version: '1.0',
    spaces,
    stages,
    items,
    notes,
    pause_points: pausePoints,
  };

  res.setHeader('Content-Disposition', 'attachment; filename="kernvault-export.json"');
  res.setHeader('Content-Type', 'application/json');
  res.json(payload);
});

// GET /api/digest — weekly summary
router.get('/digest', (req, res) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString();

  const completedItems = db.prepare('SELECT COUNT(*) as c FROM items WHERE status = "done" AND completed_at > ?').get(cutoff);
  const recallSessions = db.prepare('SELECT COUNT(*) as c FROM recall_sessions WHERE created_at > ?').get(cutoff);
  const notesAdded = db.prepare('SELECT COUNT(*) as c FROM notes WHERE created_at > ?').get(cutoff);

  res.json({
    completed_items: completedItems.c,
    recall_sessions: recallSessions.c,
    notes_added: notesAdded.c
  });
});

// DELETE /api/data — wipe everything
router.delete('/data', (req, res) => {
  const { confirm } = req.body;
  if (confirm !== 'DELETE_ALL') {
    return res.status(400).json({
      error: 'Send { confirm: "DELETE_ALL" } to confirm data deletion.',
    });
  }

  db.transaction(() => {
    db.prepare('DELETE FROM pause_points').run();
    db.prepare('DELETE FROM notes').run();
    db.prepare('DELETE FROM items').run();
    db.prepare('DELETE FROM stages').run();
    db.prepare('DELETE FROM spaces').run();
  })();

  res.json({ ok: true, message: 'All data deleted.' });
});

module.exports = router;
