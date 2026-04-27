# Kernvault

> The only learning tool that makes you process information before it gets filed — so your library is made of things you actually know, not things you meant to read.

## Quick Start — Docker (recommended)

```bash
# Build the image (~2 min first time)
npm run docker:build

# Run it — data is persisted in ./data on your host
npm run docker:run
# → open http://localhost:3001
```

Or manually:

```bash
docker build -t kernvault .
docker run -p 3001:3001 -v "$(pwd)/data:/app/data" kernvault
```

The `./data` directory on your host holds the SQLite database. It will be created automatically. Back it up like any other file.

## Quick Start — Local development

```bash
# 1. Install all dependencies (one-time)
npm run install:all

# 2. Start backend (port 3001) + frontend dev server (port 5173)
npm start
# → Frontend: http://localhost:5173
# → API:      http://localhost:3001/api
```

## What it is

Kernvault is a local-first, personal knowledge processing studio. It helps you:

1. **Define learning intent** before capturing anything (Space creation wizard)
2. **Organise content** into structured learning Stages
3. **Read with forced reflection** — Pause Points interrupt reading to keep you engaged
4. **Prove understanding** — items are only marked "done" after writing a one-sentence summary in your own words

## Architecture

```
kernvault/
├── server/    Node.js + Express backend (port 3001)
│              SQLite via better-sqlite3
│              Mozilla Readability for URL parsing
├── client/    React + Vite frontend (port 5173 in dev)
│              Tailwind CSS, Zustand, React Router v6
└── data/      kernvault.db (auto-created, gitignored)
```

## Production

```bash
# Build the client
cd client && npm run build

# Run the server (serves built client too)
cd server && npm start
# → Visit http://localhost:3001
```

## Data

All data is stored in `data/kernvault.db` (SQLite). To export:

- Via the app: Settings → Export JSON
- Via API: `GET http://localhost:3001/api/export`

## No cloud required

Kernvault runs entirely on your machine. No account, no sync, no telemetry.
