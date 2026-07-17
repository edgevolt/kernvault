const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'kernvault.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Create tables (idempotent) ───────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS spaces (
    id                   TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    intent               TEXT NOT NULL,
    methodology          TEXT NOT NULL DEFAULT 'standard',
    pace_weeks           INTEGER,
    target_duration_days INTEGER,
    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stages (
    id                    TEXT PRIMARY KEY,
    space_id              TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    name                  TEXT NOT NULL,
    "order"               INTEGER NOT NULL DEFAULT 1,
    prerequisite_stage_id TEXT,
    created_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS items (
    id                   TEXT PRIMARY KEY,
    stage_id             TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    title                TEXT NOT NULL,
    source_url           TEXT,
    content_html         TEXT,
    content_text         TEXT,
    type                 TEXT NOT NULL DEFAULT 'article'
                           CHECK(type IN ('article','video','book','paper','tutorial','project','other')),
    status               TEXT NOT NULL DEFAULT 'unread'
                           CHECK(status IN ('unread','reading','done')),
    reflection           TEXT,
    recall_level         INTEGER NOT NULL DEFAULT 0,
    recall_interval_days INTEGER,
    next_recall_at       TEXT,
    completed_at         TEXT,
    readability_score    REAL,
    content_type         TEXT,
    "order"              INTEGER NOT NULL DEFAULT 1,
    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notes (
    id          TEXT PRIMARY KEY,
    item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'manual'
                  CHECK(source IN ('manual','pause_point','voice','reflection')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pause_points (
    id          TEXT PRIMARY KEY,
    item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    prompt      TEXT NOT NULL,
    response    TEXT,
    skipped     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recall_sessions (
    id              TEXT PRIMARY KEY,
    item_id         TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    response        TEXT,
    recall_response TEXT,
    outcome         TEXT NOT NULL,
    interval_days   INTEGER,
    triggered_by    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS discovery_questions (
    id           TEXT PRIMARY KEY,
    space_id     TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    body         TEXT NOT NULL,
    answered_by  TEXT REFERENCES items(id) ON DELETE SET NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS item_connections (
    id             TEXT PRIMARY KEY,
    space_id       TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    source_item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    target_item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    label          TEXT,
    cross_space    INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS space_templates (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    stages      TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS highlights (
    id                TEXT PRIMARY KEY,
    item_id           TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    selected_text     TEXT NOT NULL,
    start_offset      INTEGER NOT NULL,
    end_offset        INTEGER NOT NULL,
    annotation        TEXT,
    annotation_state  TEXT NOT NULL DEFAULT 'unannotated',
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS synthesis_nodes (
    id          TEXT PRIMARY KEY,
    space_id    TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK(type IN ('item','highlight','pause_point','freetext')),
    source_id   TEXT,
    content     TEXT NOT NULL DEFAULT '',
    x           REAL NOT NULL DEFAULT 0,
    y           REAL NOT NULL DEFAULT 0,
    width       REAL NOT NULL DEFAULT 220,
    height      REAL NOT NULL DEFAULT 120,
    color       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS synthesis_connections (
    id              TEXT PRIMARY KEY,
    space_id        TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    source_node_id  TEXT NOT NULL REFERENCES synthesis_nodes(id) ON DELETE CASCADE,
    target_node_id  TEXT NOT NULL REFERENCES synthesis_nodes(id) ON DELETE CASCADE,
    label           TEXT,
    has_arrow       INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Safe incremental ALTER TABLE migrations (idempotent) ─────────────────────

const safeAlter = (sql) => { try { db.prepare(sql).run(); } catch (e) {} };

safeAlter("ALTER TABLE spaces ADD COLUMN methodology TEXT NOT NULL DEFAULT 'standard'");
safeAlter("ALTER TABLE spaces ADD COLUMN target_duration_days INTEGER");
safeAlter("ALTER TABLE spaces ADD COLUMN pace_weeks INTEGER");

safeAlter("ALTER TABLE stages ADD COLUMN prerequisite_stage_id TEXT");

safeAlter("ALTER TABLE items ADD COLUMN recall_level INTEGER NOT NULL DEFAULT 0");
safeAlter("ALTER TABLE items ADD COLUMN recall_interval_days INTEGER");
safeAlter("ALTER TABLE items ADD COLUMN next_recall_at TEXT");
safeAlter("ALTER TABLE items ADD COLUMN completed_at TEXT");
safeAlter("ALTER TABLE items ADD COLUMN readability_score REAL");
safeAlter("ALTER TABLE items ADD COLUMN content_type TEXT");
safeAlter("ALTER TABLE items ADD COLUMN intent TEXT");

safeAlter("ALTER TABLE recall_sessions ADD COLUMN recall_response TEXT");
safeAlter("ALTER TABLE recall_sessions ADD COLUMN interval_days INTEGER");
safeAlter("ALTER TABLE recall_sessions ADD COLUMN triggered_by TEXT");

// V1.7 Migrations
safeAlter("DROP TABLE IF EXISTS concept_connections");
safeAlter("DROP TABLE IF EXISTS concept_nodes");

// V2.0 Migrations — Synthesis Mode
safeAlter(`CREATE TABLE IF NOT EXISTS synthesis_nodes (
  id          TEXT PRIMARY KEY,
  space_id    TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK(type IN ('item','highlight','pause_point','freetext')),
  source_id   TEXT,
  content     TEXT NOT NULL DEFAULT '',
  x           REAL NOT NULL DEFAULT 0,
  y           REAL NOT NULL DEFAULT 0,
  width       REAL NOT NULL DEFAULT 220,
  height      REAL NOT NULL DEFAULT 120,
  color       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
)`);
safeAlter(`CREATE TABLE IF NOT EXISTS synthesis_connections (
  id              TEXT PRIMARY KEY,
  space_id        TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  source_node_id  TEXT NOT NULL REFERENCES synthesis_nodes(id) ON DELETE CASCADE,
  target_node_id  TEXT NOT NULL REFERENCES synthesis_nodes(id) ON DELETE CASCADE,
  label           TEXT,
  has_arrow       INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
)`);
safeAlter("ALTER TABLE synthesis_connections ADD COLUMN source_handle TEXT");
safeAlter("ALTER TABLE synthesis_connections ADD COLUMN target_handle TEXT");

// ─── Helpers ───────────────────────────────────────────────────────────────────

function touchSpace(spaceId) {
  db.prepare(`UPDATE spaces SET updated_at = datetime('now') WHERE id = ?`).run(spaceId);
}

function getSpaceIdForStage(stageId) {
  const row = db.prepare('SELECT space_id FROM stages WHERE id = ?').get(stageId);
  return row ? row.space_id : null;
}

function getSpaceIdForItem(itemId) {
  const row = db.prepare(`
    SELECT s.space_id FROM items i JOIN stages s ON s.id = i.stage_id WHERE i.id = ?
  `).get(itemId);
  return row ? row.space_id : null;
}

module.exports = { db, DATA_DIR, touchSpace, getSpaceIdForStage, getSpaceIdForItem };
