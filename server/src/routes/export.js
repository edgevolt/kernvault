const express = require('express');
const { db } = require('../db');
const epub = require('epub-gen-memory').default;
const { escHtml } = require('../lib/sanitize');

const router = express.Router();

router.get('/spaces/:id/export/annotations', (req, res) => {
  const spaceId = req.params.id;
  const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(spaceId);
  if (!space) return res.status(404).json({ error: 'Space not found' });

  const stages = db.prepare('SELECT * FROM stages WHERE space_id = ? ORDER BY "order"').all(spaceId);
  const items = db.prepare(`
    SELECT * FROM items 
    WHERE stage_id IN (SELECT id FROM stages WHERE space_id = ?) 
    ORDER BY "order"
  `).all(spaceId);
  
  const notes = db.prepare(`
    SELECT * FROM notes 
    WHERE item_id IN (SELECT id FROM items WHERE stage_id IN (SELECT id FROM stages WHERE space_id = ?))
    ORDER BY created_at ASC
  `).all(spaceId);

  const pausePoints = db.prepare(`
    SELECT * FROM pause_points 
    WHERE item_id IN (SELECT id FROM items WHERE stage_id IN (SELECT id FROM stages WHERE space_id = ?))
    AND skipped = 0 AND response IS NOT NULL AND response != ''
    ORDER BY "position" ASC
  `).all(spaceId);

  let md = `# ${space.name}\n`;
  if (space.intent) md += `*Intent: ${space.intent}*\n\n`;

  for (const stage of stages) {
    const stageItems = items.filter(i => i.stage_id === stage.id);
    if (stageItems.length === 0) continue;

    md += `## ${stage.name}\n\n`;

    for (const item of stageItems) {
      const itemNotes = notes.filter(n => n.item_id === item.id);
      const itemPausePoints = pausePoints.filter(p => p.item_id === item.id);

      // Only include items that have some user-generated thinking
      if (!item.reflection && itemNotes.length === 0 && itemPausePoints.length === 0) continue;

      md += `### ${item.title}\n`;
      if (item.source_url) md += `Source: ${item.source_url}\n`;
      if (item.completed_at) {
        md += `Completed: ${new Date(item.completed_at).toISOString().split('T')[0]}\n`;
      }
      md += '\n';

      if (item.reflection) {
        md += `**Reflection**\n> ${item.reflection}\n\n`;
      }

      if (itemPausePoints.length > 0) {
        md += `**Pause Points**\n`;
        for (const pp of itemPausePoints) {
          md += `- *${pp.prompt}*\n  ${pp.response}\n`;
        }
        md += '\n';
      }

      if (itemNotes.length > 0) {
        md += `**Notes**\n`;
        for (const note of itemNotes) {
          const sourceLabel = note.source === 'manual' ? '' : ` [${note.source}]`;
          md += `- ${note.body}${sourceLabel}\n`;
        }
        md += '\n';
      }
    }
  }

  // Set headers to trigger a download
  const slug = space.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="kernvault-${slug}-annotations.md"`);
  res.send(md);
});

router.get('/items/:id/export/epub', async (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const mode = req.query.mode === 'clean' ? 'clean' : 'annotated';
  const includeNotes       = req.query.includeNotes       !== 'false';
  const includeHighlights  = req.query.includeHighlights  !== 'false';
  const includePausePoints = req.query.includePausePoints !== 'false';

  const pausePoints = db.prepare(
    `SELECT * FROM pause_points WHERE item_id = ? ORDER BY "position" ASC`
  ).all(item.id);

  let notes      = [];
  let highlights = [];

  if (mode === 'annotated') {
    if (includeNotes) {
      notes = db.prepare('SELECT * FROM notes WHERE item_id = ? ORDER BY created_at ASC').all(item.id);
    }
    if (includeHighlights) {
      highlights = db.prepare('SELECT * FROM highlights WHERE item_id = ? ORDER BY start_offset ASC').all(item.id);
    }
  }

  const articleHtml = item.content_html
    || (item.content_text
        ? item.content_text.split('\n').filter(Boolean).map(p => `<p>${escHtml(p)}</p>`).join('')
        : '<p>No content available.</p>');

  let reflHtml = '';

  const activePausePoints = pausePoints.filter(pp => !pp.skipped && pp.prompt);
  if (activePausePoints.length > 0) {
    reflHtml += '<h2>Pause Points</h2>';
    for (const pp of activePausePoints) {
      reflHtml += `<div style="margin-bottom:2em"><p><em>${escHtml(pp.prompt)}</em></p>`;
      if (mode === 'annotated' && includePausePoints && pp.response?.trim()) {
        reflHtml += `<blockquote>${escHtml(pp.response)}</blockquote>`;
      } else {
        reflHtml += '<p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p>';
      }
      reflHtml += '</div>';
    }
  }

  reflHtml += '<h2>Final Reflection</h2>';
  reflHtml += '<p><em>Write one sentence: the core idea of this piece in your own words.</em></p>';
  if (mode === 'annotated' && item.reflection) {
    reflHtml += `<blockquote>${escHtml(item.reflection)}</blockquote>`;
  } else {
    reflHtml += '<p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p>';
  }

  if (highlights.length > 0) {
    reflHtml += '<h2>Highlights</h2>';
    for (const h of highlights) {
      reflHtml += `<blockquote>${escHtml(h.selected_text)}</blockquote>`;
      if (h.annotation) reflHtml += `<p>${escHtml(h.annotation)}</p>`;
    }
  }

  if (notes.length > 0) {
    reflHtml += '<h2>Notes</h2><ul>';
    for (const note of notes) reflHtml += `<li>${escHtml(note.body)}</li>`;
    reflHtml += '</ul>';
  }

  const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  try {
    const buffer = await epub(
      { title: item.title, author: 'Kernvault', description: item.source_url || '', ignoreFailedDownloads: true },
      [
        { title: item.title, content: articleHtml, url: item.source_url || undefined },
        { title: 'Reflections', content: reflHtml },
      ]
    );
    res.setHeader('Content-Type', 'application/epub+zip');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}.epub"`);
    res.send(buffer);
  } catch (err) {
    console.error('EPUB generation failed:', err);
    res.status(500).json({ error: 'Failed to generate EPUB' });
  }
});

module.exports = router;
