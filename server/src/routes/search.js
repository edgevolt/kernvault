const express = require('express');
const { db } = require('../db');

const router = express.Router();

// ─── GET /api/search?q=... ────────────────────────────────────────────────────
// Full-text search across spaces, items (title + content + intent), and notes.
// Returns grouped results with a short text snippet around the match.
router.get('/search', (req, res) => {
  const raw = (req.query.q || '').trim();
  if (!raw) return res.json({ spaces: [], items: [], notes: [] });

  // Limit to reasonable length
  const q = raw.slice(0, 200);
  const like = `%${q}%`;

  // ── Spaces ────────────────────────────────────────────────────────────────
  const spaces = db.prepare(`
    SELECT id, name, intent, created_at
    FROM   spaces
    WHERE  name   LIKE ? ESCAPE '\\'
    OR     intent LIKE ? ESCAPE '\\'
    ORDER  BY name
    LIMIT  20
  `).all(like, like).map(s => ({
    ...s,
    _type: 'space',
    snippet: snippet(s.intent || s.name, q),
  }));

  // ── Items ─────────────────────────────────────────────────────────────────
  const rawItems = db.prepare(`
    SELECT i.id, i.title, i.type, i.status, i.intent, i.source_url,
           i.content_text, i.stage_id,
           st.name  AS stage_name,
           st.space_id,
           sp.name  AS space_name
    FROM   items   i
    JOIN   stages  st ON st.id = i.stage_id
    JOIN   spaces  sp ON sp.id = st.space_id
    WHERE  i.title        LIKE ? ESCAPE '\\'
    OR     i.intent       LIKE ? ESCAPE '\\'
    OR     i.content_text LIKE ? ESCAPE '\\'
    OR     i.source_url   LIKE ? ESCAPE '\\'
    ORDER  BY i.title
    LIMIT  30
  `).all(like, like, like, like);

  const items = rawItems.map(item => ({
    id:         item.id,
    title:      item.title,
    type:       item.type,
    status:     item.status,
    stage_id:   item.stage_id,
    stage_name: item.stage_name,
    space_id:   item.space_id,
    space_name: item.space_name,
    source_url: item.source_url,
    _type:      'item',
    snippet:    snippet(item.content_text || item.intent || item.title, q),
  }));

  // ── Notes ─────────────────────────────────────────────────────────────────
  const rawNotes = db.prepare(`
    SELECT n.id, n.body, n.created_at,
           i.id    AS item_id,
           i.title AS item_title,
           st.space_id,
           sp.name AS space_name
    FROM   notes  n
    JOIN   items  i  ON i.id = n.item_id
    JOIN   stages st ON st.id = i.stage_id
    JOIN   spaces sp ON sp.id = st.space_id
    WHERE  n.body LIKE ? ESCAPE '\\'
    ORDER  BY n.created_at DESC
    LIMIT  20
  `).all(like);

  const notes = rawNotes.map(n => ({
    id:         n.id,
    content:    n.body,
    item_id:    n.item_id,
    item_title: n.item_title,
    space_id:   n.space_id,
    space_name: n.space_name,
    created_at: n.created_at,
    _type:      'note',
    snippet:    snippet(n.body, q),
  }));

  res.json({
    query:  q,
    total:  spaces.length + items.length + notes.length,
    spaces,
    items,
    notes,
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract a ~160-character window of text centred on the first match of `term`.
 * Falls back to the first 160 characters if no match found in body.
 */
function snippet(body, term) {
  if (!body) return '';
  const lower = body.toLowerCase();
  const idx   = lower.indexOf(term.toLowerCase());
  if (idx === -1) return body.slice(0, 160);
  const start = Math.max(0, idx - 60);
  const end   = Math.min(body.length, idx + term.length + 100);
  return (start > 0 ? '…' : '') + body.slice(start, end) + (end < body.length ? '…' : '');
}

module.exports = router;
