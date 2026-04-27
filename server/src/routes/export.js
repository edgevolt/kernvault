const express = require('express');
const { db } = require('../db');

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

module.exports = router;
