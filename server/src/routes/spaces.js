const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, touchSpace } = require('../db');

const router = express.Router();

// ─── GET /api/spaces ──────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const spaces = db.prepare(`
    SELECT
      sp.id, sp.name, sp.intent, sp.pace_weeks, sp.target_duration_days,
      sp.created_at, sp.updated_at,
      COUNT(i.id)                                          AS total_items,
      SUM(CASE WHEN i.status = 'done' THEN 1 ELSE 0 END)  AS done_items
    FROM spaces sp
    LEFT JOIN stages st ON st.space_id = sp.id
    LEFT JOIN items  i  ON i.stage_id  = st.id
    GROUP BY sp.id
    ORDER BY sp.updated_at DESC
  `).all();
  res.json(spaces);
});

// ─── POST /api/spaces ─────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const {
    name, intent, stages = [],
    pace_weeks, target_duration_days,
    discovery_questions = []
  } = req.body;

  if (!name?.trim() || !intent?.trim()) {
    return res.status(400).json({ error: 'name and intent are required.' });
  }

  const spaceId = uuidv4();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO spaces (id, name, intent, pace_weeks, target_duration_days)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      spaceId, name.trim(), intent.trim(),
      pace_weeks ?? null,
      target_duration_days ?? null
    );

    const defaultStages = stages.length
      ? stages
      : [
          { name: 'Foundations', order: 1 },
          { name: 'Core Concepts', order: 2 },
          { name: 'Application', order: 3 },
        ];
    defaultStages.forEach((s, idx) => {
      db.prepare('INSERT INTO stages (id, space_id, name, "order") VALUES (?, ?, ?, ?)').run(
        uuidv4(), spaceId, s.name.trim(), s.order ?? idx + 1
      );
    });

    // Insert discovery questions from wizard
    discovery_questions.forEach((q) => {
      db.prepare(`
        INSERT INTO discovery_questions (id, space_id, body)
        VALUES (?, ?, ?)
      `).run(uuidv4(), spaceId, q.trim());
    });
  });
  tx();

  const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(spaceId);
  const stagesResult = db.prepare('SELECT * FROM stages WHERE space_id = ? ORDER BY "order"').all(spaceId);

  res.status(201).json({ ...space, stages: stagesResult });
});

// ─── GET /api/spaces/:id ──────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(req.params.id);
  if (!space) return res.status(404).json({ error: 'Space not found.' });

  const stages = db.prepare(`SELECT * FROM stages WHERE space_id = ? ORDER BY "order"`).all(space.id);

  const stagesWithItems = stages.map(stage => {
    const items = db.prepare(`
      SELECT i.*,
        (SELECT COUNT(*) FROM notes n WHERE n.item_id = i.id) as note_count,
        (SELECT COUNT(*) FROM pause_points p WHERE p.item_id = i.id AND p.response IS NOT NULL AND p.response != '') as pause_point_count
      FROM items i
      WHERE i.stage_id = ?
      ORDER BY i."order"
    `).all(stage.id);
    return { ...stage, items };
  });

  const totals = db.prepare(`
    SELECT
      COUNT(i.id)                                          AS total_items,
      SUM(CASE WHEN i.status = 'done' THEN 1 ELSE 0 END)  AS done_items
    FROM stages st
    LEFT JOIN items i ON i.stage_id = st.id
    WHERE st.space_id = ?
  `).get(space.id);

  res.json({ ...space, stages: stagesWithItems, ...totals });
});

// ─── GET /api/spaces/:id/trail ────────────────────────────────────────────────
router.get('/:id/trail', (req, res) => {
  const space = db.prepare('SELECT id FROM spaces WHERE id = ?').get(req.params.id);
  if (!space) return res.status(404).json({ error: 'Space not found.' });

  // Get item reflections
  const reflections = db.prepare(`
    SELECT 
      i.id as item_id, i.title as item_title, i.reflection as body, 
      i.updated_at as created_at, 'reflection' as type 
    FROM items i
    JOIN stages s ON s.id = i.stage_id
    WHERE s.space_id = ? AND i.reflection IS NOT NULL AND i.reflection != ''
  `).all(space.id);

  // Get notes
  const notes = db.prepare(`
    SELECT 
      n.item_id, i.title as item_title, n.body, n.created_at, n.source as type
    FROM notes n
    JOIN items i ON i.id = n.item_id
    JOIN stages s ON s.id = i.stage_id
    WHERE s.space_id = ? AND n.body IS NOT NULL AND n.body != ''
  `).all(space.id);

  const trail = [...reflections, ...notes].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  res.json(trail);
});

// ─── PATCH /api/spaces/:id ────────────────────────────────────────────────────
router.patch('/:id', (req, res) => {
  const { name, intent, pace_weeks, target_duration_days } = req.body;
  const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(req.params.id);
  if (!space) return res.status(404).json({ error: 'Space not found.' });

  db.prepare(`
    UPDATE spaces SET
      name                 = COALESCE(?, name),
      intent               = COALESCE(?, intent),
      pace_weeks           = COALESCE(?, pace_weeks),
      target_duration_days = COALESCE(?, target_duration_days),
      updated_at           = datetime('now')
    WHERE id = ?
  `).run(
    name?.trim() ?? null,
    intent?.trim() ?? null,
    pace_weeks !== undefined ? pace_weeks : null,
    target_duration_days !== undefined ? target_duration_days : null,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM spaces WHERE id = ?').get(req.params.id));
});

// ─── DELETE /api/spaces/:id ───────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM spaces WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Space not found.' });
  res.status(204).end();
});

// ─── Stage sub-routes ─────────────────────────────────────────────────────────

// POST /api/spaces/:id/stages
router.post('/:id/stages', (req, res) => {
  const space = db.prepare('SELECT id FROM spaces WHERE id = ?').get(req.params.id);
  if (!space) return res.status(404).json({ error: 'Space not found.' });

  const { name, order } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Stage name is required.' });

  const maxOrder = db.prepare('SELECT MAX("order") AS m FROM stages WHERE space_id = ?').get(space.id);
  const stageOrder = order ?? (maxOrder.m ?? 0) + 1;
  const stageId = uuidv4();

  db.prepare('INSERT INTO stages (id, space_id, name, "order") VALUES (?, ?, ?, ?)').run(
    stageId, space.id, name.trim(), stageOrder
  );
  touchSpace(space.id);
  res.status(201).json(db.prepare('SELECT * FROM stages WHERE id = ?').get(stageId));
});

// PATCH /api/stages/:stageId
router.patch('/stages/:stageId', (req, res) => {
  const { name, order, prerequisite_stage_id } = req.body;
  const stage = db.prepare('SELECT * FROM stages WHERE id = ?').get(req.params.stageId);
  if (!stage) return res.status(404).json({ error: 'Stage not found.' });

  // Prevent self-referential prerequisites
  if (prerequisite_stage_id === stage.id) {
    return res.status(400).json({ error: 'A stage cannot be its own prerequisite.' });
  }

  db.prepare(`
    UPDATE stages SET
      name                  = COALESCE(?, name),
      "order"               = COALESCE(?, "order"),
      prerequisite_stage_id = CASE WHEN ? IS NOT NULL THEN ? ELSE prerequisite_stage_id END
    WHERE id = ?
  `).run(
    name?.trim() ?? null,
    order ?? null,
    prerequisite_stage_id !== undefined ? 1 : null,
    prerequisite_stage_id ?? null,
    stage.id
  );

  touchSpace(stage.space_id);
  res.json(db.prepare('SELECT * FROM stages WHERE id = ?').get(stage.id));
});

// DELETE /api/stages/:stageId
router.delete('/stages/:stageId', (req, res) => {
  const stage = db.prepare('SELECT * FROM stages WHERE id = ?').get(req.params.stageId);
  if (!stage) return res.status(404).json({ error: 'Stage not found.' });

  // Require at least 1 stage remaining
  const count = db.prepare('SELECT COUNT(*) AS c FROM stages WHERE space_id = ?').get(stage.space_id);
  if (count.c <= 1) return res.status(400).json({ error: 'A Space must have at least one Stage.' });

  db.prepare('DELETE FROM stages WHERE id = ?').run(stage.id);
  touchSpace(stage.space_id);
  res.status(204).end();
});

// POST /api/spaces/stages/reorder
router.post('/stages/reorder', (req, res) => {
  const { stages } = req.body; // [{id, order}]
  if (!Array.isArray(stages)) return res.status(400).json({ error: 'stages array required.' });

  const update = db.prepare('UPDATE stages SET "order" = ? WHERE id = ?');
  const tx = db.transaction(() => stages.forEach(s => update.run(s.order, s.id)));
  tx();

  // Touch the space of the first stage
  if (stages.length) {
    const first = db.prepare('SELECT space_id FROM stages WHERE id = ?').get(stages[0].id);
    if (first) touchSpace(first.space_id);
  }

  res.json({ ok: true });
});

module.exports = router;
