# Kernvault

Kernvault is a local-first knowledge processing studio built around a single conviction: saving something is not the same as learning it. Most bookmarking and read-later tools make hoarding effortless and reflection optional. Kernvault reverses that. Every piece of content you bring into the system requires you to state your intent upfront, engage with deliberate interruptions while you read, prove comprehension before marking something done, and revisit it later through a spaced-recall cycle.

The result is a library that represents knowledge you have actually processed, not a graveyard of links you meant to get to.

---

## Table of Contents

- [Philosophy](#philosophy)
- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Data Model](#data-model)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Data and Privacy](#data-and-privacy)
- [Contributing](#contributing)
- [License](#license)

---

## Philosophy

Kernvault is built around four principles that inform every design decision.

**Intent before capture.** You cannot add a link, PDF, or video transcript to Kernvault without first answering the question "Why are you adding this?" That answer becomes part of the permanent record of the item and shapes how pause points prompt you while you read.

**Friction is a feature.** Deliberate friction at the right moments -- when you are tempted to skim, when you are about to mark something done too quickly, when you have not typed a reflection -- is what separates a tool that produces learning from one that produces the feeling of learning.

**Local and private by default.** There are no accounts, no cloud sync, and no telemetry. Your entire library lives in a single SQLite file on your own machine. You own the data completely.

**Proof over progress.** Reading progress bars and page counts measure motion, not understanding. Kernvault measures understanding: a completion gate that requires a written reflection, a recall system that surfaces items on a schedule and asks you to reconstruct what you learned, and a synthesis canvas that challenges you to show how ideas connect.

---

## Features

### Spaces and Stages

A Space is the top-level unit of learning. It has a name, a stated intent, and a set of Stages. Stages are ordered columns (similar to a Kanban board) that let you organize content into phases such as "Foundations", "Deep Dive", and "Review". Each Stage can optionally declare a prerequisite Stage, which signals that items in it should not be started until the earlier Stage is complete.

Spaces support two learning methodologies: `standard` (freeform reading pace) and `cornell` (note-taking format adapted to the pause point prompts). Both can optionally track a target pace in weeks.

### Items and Content Ingestion

An Item is a piece of content assigned to a Stage. Kernvault supports four ingestion modes:

- **URL fetch**: paste any article or web page URL and the server extracts clean readable text using Mozilla Readability.
- **YouTube transcript**: paste a YouTube video URL and the server fetches the full timed transcript from the YouTube InnerTube API, grouped into timestamped paragraphs.
- **PDF upload**: upload a PDF file and the server extracts its text via `pdf-parse`.
- **Manual paste**: paste raw HTML or plain text directly.

Each Item stores the extracted `content_html`, `content_text`, original `source_url`, a `readability_score`, and a `content_type` flag (`url`, `youtube`, `pdf`, `paste`) so the reader can render appropriate context banners.

### Reader View

The reader is a distraction-free single-column reading experience with the following behaviors:

- A 2px reading progress bar at the very top of the viewport tracks scroll position.
- A session timer (optional, toggled in Settings) tracks active reading time with a 60-second idle threshold.
- Text highlighting is supported on both desktop (mouse selection) and mobile (sentence-tap selection). Every highlight requires a written annotation before it is saved -- attempting to save without one shows an inline validation error.
- Highlights persist to the database and are re-rendered on every page load via character-offset mapping into the article DOM.
- Pause Points interrupt reading every four paragraphs with a prompt that the user must respond to before continuing. Responses are saved as Notes attached to the Item.
- A slide-in Notes panel lets you capture freeform thoughts at any point without leaving the page.
- A Completion Gate at the bottom of every Item requires a written reflection before the status can be set to "done". Marking done automatically schedules the first recall session.

### Spaced Recall

When an Item is marked done it enters the recall queue at level 1. The system uses a fixed interval ladder: 2 days, 7 days, 30 days, and 90 days. At each scheduled interval the Home screen surfaces a prompt to start a recall session. During a session, the user reconstructs what they remember in their own words and rates the outcome as "got it", "needs another look", or "skip".

- "Got it" advances the item to the next level and schedules the next session.
- "Needs another look" resets the item to `reading` status at level 0 so the user re-reads it with fresh eyes.
- "Skip" keeps the level the same and re-schedules at the current interval.
- An item that reaches level 5 exits the recall queue entirely.

Recall sessions can also be triggered manually (practice mode) from the Space view without advancing the schedule.

### Highlights and Annotations

Highlights are stored as character-offset pairs (`start_offset`, `end_offset`) relative to the plain text of the item, making them resilient to minor HTML changes. Each highlight has an `annotation_state` of either `unannotated` or `annotated`. Attempting to save a highlight without typing an annotation produces an inline error and blocks the save -- the annotation is required, not optional.

### Synthesis Mode

Each Space has a Synthesis canvas, a free-form node graph for connecting ideas. Nodes can represent Items, specific Highlights, Pause Point responses, or freetext thoughts. Connections between nodes can carry labels and optional directional arrows. Node positions and sizes are persisted to the database so the canvas is fully restored on each visit.

### Learning Map

The Learning Map provides a structured view of item connections within (and optionally across) Spaces. Unlike the Synthesis canvas, which is open-ended, the Learning Map is centered on the item graph: which pieces of content informed which other pieces, and how discovery questions link to the items that answered them.

### Discovery Questions

When creating or editing a Space, you can define open questions you want the material to answer. As you read, you can link a discovery question to the Item that provided the answer, tracking how your understanding develops over time.

### Space Templates

Commonly used Stage configurations can be saved as reusable Templates. Templates store a name, description, and a JSON array of stage definitions. When creating a new Space, selecting a template pre-populates the Stage structure.

### Weekly Digest

Every Monday the Home screen automatically shows a Weekly Digest overlay summarizing your reading activity for the past week. The digest is dismissed once per day per device using a `localStorage` flag and does not require a server roundtrip.

### Full-Text Search

A global search endpoint (`/api/search?q=`) performs case-insensitive substring matching across item titles, content text, and notes bodies. Results include the parent Space and Stage for each match.

### Data Export

The Settings screen exposes two data operations: a full JSON export of all Spaces, Stages, Items, Notes, and Highlights (via `/api/export`), and a destructive "delete all data" operation that requires passing a `confirm: "DELETE_ALL"` body to prevent accidental data loss.

---

## Architecture Overview

Kernvault is a monorepo containing a React frontend and a Node.js/Express backend. In development the two run as separate processes. In production (including Docker) the Express server builds and serves the React bundle statically, meaning the entire application is served from a single port.

```
Browser
  |
  | HTTP (dev: localhost:5173 proxied to localhost:9876)
  | HTTP (prod: localhost:9876 for both API and static assets)
  |
Express Server (Node.js)
  |
  |-- /api/spaces          Spaces and Stages CRUD
  |-- /api/recall          Recall queue and session submission
  |-- /api/highlights      Highlight CRUD
  |-- /api/search          Full-text search
  |-- /api/export          JSON export and data deletion
  |-- /api/<space>/map     Learning Map and item connections
  |-- /api/synthesis/*     Synthesis nodes and connections
  |-- /api/stages/*/items  Item CRUD and content ingestion
  |-- /api/items/*         Item reads, updates, notes, pause points
  |
SQLite (data/kernvault.db)
```

### Frontend

The frontend is a React 18 single-page application built with Vite. State management uses Zustand with a single global store (`useStore`) that holds Spaces, per-item Highlights, Notes, and user Settings. The store is not persisted to `localStorage` -- all state is loaded from the API on mount. Settings (font size, font family, session timer toggle, onboarding flags) are persisted on the server in a `settings` key-value table and re-fetched at startup.

Client-side routing is handled by React Router. The main routes are:

| Route | Component | Purpose |
|---|---|---|
| `/` | `Home` | Space list and recall queue indicator |
| `/welcome` | `Welcome` | First-launch onboarding |
| `/spaces/new` | `NewSpace` | Space creation wizard |
| `/spaces/:id` | `SpaceView` | Stage columns, item cards, Space settings |
| `/spaces/:id/item/:itemId` | `ReaderView` | Full reading experience |
| `/spaces/:id/synthesis` | `SynthesisView` | Synthesis canvas |
| `/recall` | `RecallView` | Scheduled and manual recall sessions |
| `/search` | `SearchView` | Global full-text search |
| `/settings` | `SettingsView` | App preferences and data management |

### Backend

The backend is a CommonJS Express application. Database access is synchronous via `better-sqlite3`, which is intentional: SQLite with WAL mode handles the concurrency requirements of a single-user local application without the overhead of async query management.

All route modules are registered in `src/index.js`. The database schema is created and migrated at startup in `src/db.js` using idempotent `CREATE TABLE IF NOT EXISTS` statements plus a series of `safeAlter` calls that catch and ignore errors on columns that already exist. This allows the application to upgrade live databases without running separate migration scripts.

Content ingestion for YouTube uses a direct call to the YouTube InnerTube player endpoint, which returns caption track URLs. The timed-text XML returned by those URLs is parsed locally with a regular expression. No YouTube API key is required. Article URLs are fetched server-side via `axios` and parsed with Mozilla Readability running inside a JSDOM instance.

### Docker

The Dockerfile uses a two-stage build. Stage 1 installs client dependencies and runs `vite build` to produce the static bundle. Stage 2 installs only production server dependencies (including native compilation of `better-sqlite3` via `python3`, `make`, and `g++`), copies the server source, and copies the built client bundle from Stage 1. The resulting image serves both the API and the frontend from port 9876. The `/app/data` directory should be mounted as a volume to persist the SQLite database across container restarts.

---

## Data Model

The following tables are defined in `src/db.js`.

| Table | Purpose |
|---|---|
| `spaces` | Top-level learning containers with intent, methodology, and pace settings |
| `stages` | Ordered columns within a Space; support optional prerequisite linking |
| `items` | Content records with extracted HTML/text, status, recall scheduling, and reflection |
| `notes` | Free-text notes attached to Items; source can be `manual`, `pause_point`, `voice`, or `reflection` |
| `pause_points` | Stored prompts and user responses at specific positions within an Item |
| `recall_sessions` | Individual recall events with outcome, interval, and trigger type |
| `discovery_questions` | Open questions attached to a Space, linkable to the Item that answered them |
| `item_connections` | Directed or undirected edges between Items, used by the Learning Map |
| `space_templates` | Saved Stage configurations for reuse when creating new Spaces |
| `highlights` | Character-offset highlight ranges with annotation text and state |
| `synthesis_nodes` | Canvas nodes (item, highlight, pause_point, freetext) with position and size |
| `synthesis_connections` | Edges between synthesis nodes with optional labels and arrows |

All primary keys are UUIDs. All timestamps are stored as ISO 8601 strings in UTC via SQLite `datetime('now')`. Foreign keys are enforced with `ON DELETE CASCADE` so deleting a Space removes all its descendant records automatically.

---

## API Reference

All endpoints are prefixed with `/api`. Request and response bodies are JSON unless the endpoint handles file uploads (multipart/form-data) or binary downloads.

### Spaces

| Method | Path | Description |
|---|---|---|
| GET | `/spaces` | List all Spaces ordered by `updated_at` desc |
| POST | `/spaces` | Create a Space |
| GET | `/spaces/:id` | Get a single Space with its Stages and Items |
| PATCH | `/spaces/:id` | Update Space fields |
| DELETE | `/spaces/:id` | Delete a Space and all cascading records |
| GET | `/spaces/:id/trail` | Get recent activity for a Space |
| GET | `/spaces/:id/map` | Get the Learning Map graph for a Space |
| GET | `/spaces/:id/synthesis` | Get all synthesis nodes and connections for a Space |

### Stages

| Method | Path | Description |
|---|---|---|
| POST | `/spaces/:spaceId/stages` | Create a Stage in a Space |
| PATCH | `/spaces/stages/:id` | Update a Stage |
| DELETE | `/spaces/stages/:id` | Delete a Stage |
| POST | `/spaces/stages/reorder` | Bulk reorder Stages |

### Items

| Method | Path | Description |
|---|---|---|
| GET | `/stages/:stageId/items` | List Items in a Stage |
| POST | `/stages/:stageId/items` | Create an Item (URL, YouTube, PDF, or paste) |
| GET | `/items/:id` | Get a single Item |
| PATCH | `/items/:id` | Update Item fields (title, status, reflection, etc.) |
| DELETE | `/items/:id` | Delete an Item |
| POST | `/items/reorder` | Bulk reorder Items across Stages |

### Notes, Highlights, Pause Points

| Method | Path | Description |
|---|---|---|
| GET | `/items/:id/notes` | List Notes for an Item |
| POST | `/items/:id/notes` | Create a Note |
| DELETE | `/notes/:id` | Delete a Note |
| GET | `/items/:id/highlights` | List Highlights for an Item |
| POST | `/highlights` | Create a Highlight |
| PATCH | `/highlights/:id` | Update a Highlight (add/edit annotation) |
| DELETE | `/highlights/:id` | Delete a Highlight |
| GET | `/items/:id/pause-points` | List Pause Points for an Item |
| POST | `/items/:id/pause-points` | Create a Pause Point |
| PATCH | `/pause-points/:id` | Submit a response to a Pause Point |

### Recall

| Method | Path | Description |
|---|---|---|
| GET | `/recall` | Get items due for recall (ordered by `next_recall_at`) |
| POST | `/items/:id/recall` | Submit a recall session outcome |

### Synthesis

| Method | Path | Description |
|---|---|---|
| POST | `/synthesis/nodes` | Create a synthesis node |
| PATCH | `/synthesis/nodes/:id` | Update node content, position, or size |
| DELETE | `/synthesis/nodes/:id` | Delete a node and its connections |
| POST | `/synthesis/connections` | Create a connection between nodes |
| PATCH | `/synthesis/connections/:id` | Update connection label or arrow |
| DELETE | `/synthesis/connections/:id` | Delete a connection |

### Data and Settings

| Method | Path | Description |
|---|---|---|
| GET | `/search?q=` | Full-text search across items and notes |
| GET | `/export` | Download all data as a JSON file |
| DELETE | `/data` | Delete all data (requires `confirm: "DELETE_ALL"` in body) |
| GET | `/digest` | Get weekly reading activity summary |
| GET | `/templates` | List Space templates |
| POST | `/templates` | Create a template |
| DELETE | `/templates/:id` | Delete a template |

---

## Project Structure

```
kernvault/
├── client/                     React + Vite frontend
│   └── src/
│       ├── api/client.js       Typed API wrapper (all backend calls go here)
│       ├── components/         Reusable UI components
│       ├── hooks/              Custom React hooks
│       ├── pages/              Top-level route components
│       ├── store/useStore.js   Zustand global state store
│       └── utils/              Helpers (highlighting, sentence splitting)
├── server/
│   └── src/
│       ├── db.js               Database init, schema, and migration
│       ├── index.js            Express app setup and route registration
│       ├── lib/
│       │   ├── fetcher.js      URL fetching and Readability parsing
│       │   └── youtubeTranscript.js  InnerTube transcript fetcher
│       └── routes/             One file per resource group
├── data/                       SQLite database file (gitignored)
├── Dockerfile                  Multi-stage production build
└── package.json                Root scripts for running and building
```

---

## Getting Started

### Option 1: Docker Compose (Recommended)

The easiest way to deploy Kernvault is using the pre-built image from the GitHub Container Registry. A `docker-compose.yml` file is provided in the root of the project.

```bash
# Start the container in the background
docker compose up -d
```

The application will be available at `http://localhost:9876`. A Docker volume named `kernvault_data` is automatically created to persist your SQLite database across container restarts.

#### Building Docker Locally (Alternative)

If you prefer to build the image yourself from source instead of pulling from GHCR:

```bash
# Build the image
npm run docker:build

# Run with persistent data volume mapped to ./data
npm run docker:run
```

### Option 2: Local Development

```bash
# Install dependencies for the root, server, and client
npm run install:all

# Start both the frontend dev server and the backend concurrently
npm start
```

- Frontend (Vite): `http://localhost:5173`
- Backend (Express): `http://localhost:9876`

In development, the Vite dev server proxies API requests to the Express backend. The proxy configuration is in `client/vite.config.js`.

To run frontend and backend independently:

```bash
# Backend only
npm run server

# Frontend only
npm run client
```

To produce a production build of the frontend without Docker:

```bash
npm run build
```

This outputs the static bundle to `client/dist/`, which the Express server will detect and serve automatically on its next start.

---

## Configuration

Kernvault uses no environment configuration files by default. The only runtime variable is `PORT`, which defaults to `9876` if not set.

```bash
PORT=8080 node server/src/index.js
```

The database path is derived at startup: `<project-root>/data/kernvault.db`. In Docker the data directory is `/app/data`.

---

## Data and Privacy

- All data is stored locally in `data/kernvault.db`. Nothing is transmitted to any external service except the HTTP requests made during content ingestion (fetching URLs, fetching YouTube transcripts).
- The database is a standard SQLite file. You can open it with any SQLite client, copy it for backup, or delete it to reset the application completely.
- The full export at `GET /api/export` produces a single JSON document containing every record in the database.
- There are no analytics, crash reporting agents, or third-party SDKs in either the frontend or the backend.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push the branch: `git push origin feature/your-feature`
5. Open a pull request

Please keep pull requests focused on a single concern and include a clear description of what changed and why.

---

## License

Distributed under the MIT License. See `LICENSE` for details.
