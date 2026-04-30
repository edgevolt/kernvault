const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, touchSpace, getSpaceIdForStage, getSpaceIdForItem } = require('../db');
const { fetchAndParse } = require('../lib/fetcher');
const { fetchYouTubeTranscript } = require('../lib/youtubeTranscript');

const router = express.Router();

// ─── GET /api/stages/:stageId/items ──────────────────────────────────────────
router.get('/stages/:stageId/items', (req, res) => {
  const items = db.prepare(`SELECT * FROM items WHERE stage_id = ? ORDER BY "order"`).all(req.params.stageId);
  res.json(items);
});

const multer = require('multer');
const pdfParse = require('pdf-parse');
const upload = multer({ storage: multer.memoryStorage() });

// ─── POST /api/stages/:stageId/items ─────────────────────────────────────────
router.post('/stages/:stageId/items', upload.single('pdf'), async (req, res) => {
  const stage = db.prepare('SELECT * FROM stages WHERE id = ?').get(req.params.stageId);
  if (!stage) return res.status(404).json({ error: 'Stage not found.' });

  let { source_url, type = 'article', title: titleOverride, content_html, content_text, intent } = req.body;
  if (!intent || !intent.trim()) return res.status(400).json({ error: 'Intent is required.' });

  const itemId = uuidv4();
  let title, finalHtml, finalText;
  let finalContentType = 'url';

  // File upload mode (PDF)
  if (req.file) {
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are supported for upload.' });
    }
    try {
      const data = await pdfParse(req.file.buffer);
      title = titleOverride?.trim() || req.file.originalname || 'Untitled PDF';
      finalText = data.text;
      // Convert plain text to simple paragraphs for html rendering
      finalHtml = finalText.split('\n\n').map(p => `<p>${p.trim()}</p>`).join('');
      source_url = req.file.originalname; // save filename as attribution
      finalContentType = 'pdf';
      type = type === 'article' ? 'paper' : type; // default to paper for pdf
    } catch (err) {
      return res.status(500).json({ error: 'Failed to parse PDF file.', code: 'PARSE_FAILED' });
    }
  }
  // YouTube mode
  else if (source_url && (source_url.includes('youtube.com') || source_url.includes('youtu.be'))) {
    try {
      const transcript = await fetchYouTubeTranscript(source_url);
      
      title = titleOverride?.trim() || 'YouTube Video';
      finalContentType = 'youtube';
      type = 'video';
      
      // Group transcript into paragraphs (~2 mins each)
      let paragraphs = [];
      let currentPara = [];
      let currentStartTime = 0;
      
      for (let i = 0; i < transcript.length; i++) {
        const item = transcript[i];
        if (currentPara.length === 0) currentStartTime = item.offset;
        currentPara.push(item.text);
        
        // Break paragraph every ~2 minutes or at the end
        if (item.offset - currentStartTime > 120000 || i === transcript.length - 1) {
          const minutes = Math.floor(currentStartTime / 1000 / 60);
          const seconds = Math.floor((currentStartTime / 1000) % 60).toString().padStart(2, '0');
          const timeStr = `${minutes}:${seconds}`;
          paragraphs.push(`<h3>${timeStr}</h3><p>${currentPara.join(' ')}</p>`);
          currentPara = [];
        }
      }
      
      finalHtml = paragraphs.join('');
      finalText = transcript.map(t => t.text).join(' ');
    } catch (err) {
      return res.status(422).json({
        error: 'Could not fetch YouTube transcript. Ensure the video has captions enabled.',
        code: 'FETCH_FAILED',
      });
    }
  }
  // Manual paste mode
  else if (!source_url && content_html) {
    title = titleOverride?.trim() || 'Untitled';
    finalHtml = content_html;
    finalText = content_text || '';
    finalContentType = 'paste';
  } 
  // Standard URL fetch mode
  else if (source_url) {
    try {
      const fetched = await fetchAndParse(source_url);
      title = titleOverride?.trim() || fetched.title || source_url;
      finalHtml = fetched.content_html;
      finalText = fetched.content_text;
    } catch (fetchErr) {
      return res.status(422).json({
        error: fetchErr.message || 'Could not fetch URL.',
        code: fetchErr.code || 'FETCH_FAILED',
      });
    }
  } else {
    return res.status(400).json({ error: 'Source URL, pasted content, or a file is required.' });
  }

  const maxOrder = db.prepare('SELECT MAX("order") AS m FROM items WHERE stage_id = ?').get(stage.id);
  const itemOrder = (maxOrder.m ?? 0) + 1;

  db.prepare(`
    INSERT INTO items (id, stage_id, title, source_url, content_html, content_text, type, "order", intent, content_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(itemId, stage.id, title, source_url || null, finalHtml, finalText, type, itemOrder, intent.trim(), finalContentType);

  touchSpace(stage.space_id);
  res.status(201).json(db.prepare('SELECT * FROM items WHERE id = ?').get(itemId));
});

// ─── GET /api/items/:id ───────────────────────────────────────────────────────
router.get('/items/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  res.json(item);
});

// ─── GET /api/items/:id/highlights ────────────────────────────────────────────
router.get('/items/:id/highlights', (req, res) => {
  const item = db.prepare('SELECT id FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  const highlights = db.prepare('SELECT * FROM highlights WHERE item_id = ? ORDER BY start_offset ASC').all(req.params.id);
  res.json(highlights);
});

// ─── PATCH /api/items/:id ─────────────────────────────────────────────────────
router.patch('/items/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  const { title, status, reflection, type, order, stage_id } = req.body;

  // If moving to a different stage
  if (stage_id && stage_id !== item.stage_id) {
    const targetStage = db.prepare('SELECT * FROM stages WHERE id = ?').get(stage_id);
    if (!targetStage) return res.status(404).json({ error: 'Target stage not found.' });
  }

  // Handle recall scheduling if marked done
  let recallUpdates = '';
  let queryParams = [
    title?.trim() ?? null,
    status ?? null,
    reflection?.trim() ?? null,
    type ?? null,
    order ?? null,
    stage_id ?? null
  ];

  if (status === 'done' && item.recall_level === 0) {
    recallUpdates = `, recall_level = 1, next_recall_at = datetime('now', '+2 days')`;
  } else if (status === 'reading') {
    // Just in case it gets manually moved back to reading from outside recall
    recallUpdates = `, recall_level = 0, next_recall_at = NULL`;
  }

  queryParams.push(req.params.id);

  db.prepare(`
    UPDATE items SET
      title      = COALESCE(?, title),
      status     = COALESCE(?, status),
      reflection = COALESCE(?, reflection),
      type       = COALESCE(?, type),
      "order"    = COALESCE(?, "order"),
      stage_id   = COALESCE(?, stage_id),
      updated_at = datetime('now')
      ${recallUpdates}
    WHERE id = ?
  `).run(...queryParams);

  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  const spaceId = getSpaceIdForItem(req.params.id);
  if (spaceId) touchSpace(spaceId);

  res.json(updated);
});

// ─── DELETE /api/items/:id ────────────────────────────────────────────────────
router.delete('/items/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  const spaceId = getSpaceIdForItem(req.params.id);
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  if (spaceId) touchSpace(spaceId);
  res.status(204).end();
});

// ─── POST /api/items/reorder ────────────────────────────────────────────────────
router.post('/items/reorder', (req, res) => {
  const { items } = req.body; // [{id, order, stage_id?}]
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required.' });

  const update = db.prepare(`
    UPDATE items SET "order" = ?, stage_id = COALESCE(?, stage_id) WHERE id = ?
  `);
  const tx = db.transaction(() =>
    items.forEach(i => update.run(i.order, i.stage_id ?? null, i.id))
  );
  tx();

  if (items.length) {
    const spaceId = getSpaceIdForItem(items[0].id);
    if (spaceId) touchSpace(spaceId);
  }

  res.json({ ok: true });
});

module.exports = router;
