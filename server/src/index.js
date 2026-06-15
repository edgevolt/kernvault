const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Initialise DB (runs migrations) on startup
require('./db');

const spacesRouter      = require('./routes/spaces');
const itemsRouter       = require('./routes/items');
const notesRouter       = require('./routes/notes');
const pausePointsRouter = require('./routes/pausePoints');
const settingsRouter    = require('./routes/settings');
const recallRouter      = require('./routes/recall');
const learningMapRouter = require('./routes/learningMap');
const searchRouter      = require('./routes/search');
const exportRouter      = require('./routes/export');
const highlightsRouter  = require('./routes/highlights');
const synthesisRouter   = require('./routes/synthesis');

const app = express();
const PORT = process.env.PORT || 9876;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); // CSP managed separately; other headers on
app.use(cors({
  origin: [
    'http://localhost:5173',   // Vite dev server (primary)
    'http://localhost:5174',   // Vite dev server (fallback when 5173 is busy)
    'http://localhost:4173',   // Vite preview
  ],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' })); // articles can be large

// Global rate limit — 200 req/min per IP
app.use('/api', rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));
// Tighter limit on expensive fetch/create routes
app.use('/api/stages', rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false }));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/spaces', spacesRouter);
app.use('/api/recall', recallRouter);
app.use('/api/highlights', highlightsRouter);
app.use('/api', exportRouter);         // /api/spaces/:id/export/annotations
app.use('/api', searchRouter);         // /api/search?q=
app.use('/api', settingsRouter);       // /api/export and /api/data — MUST be before items
app.use('/api', learningMapRouter);    // /api/spaces/:id/map, /api/item-connections/:id, /api/templates
app.use('/api', synthesisRouter);      // /api/spaces/:id/synthesis, /api/synthesis/nodes, /api/synthesis/connections
app.use('/api', itemsRouter);          // /api/stages/:id/items and /api/items/:id
app.use('/api', notesRouter);          // /api/items/:id/notes and /api/notes/:id
app.use('/api', pausePointsRouter);    // /api/items/:id/pause-points and /api/pause-points/:id

// ─── Serve built frontend in production ──────────────────────────────────────
const DIST = path.join(__dirname, '../../client/dist');
const fs = require('fs');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err.message, err.stack);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Kernvault server running on http://localhost:${PORT}`);
});
