# 🛡️ Kernvault

> **Intent before capture.** The only learning tool that makes you process information before it gets filed.

Kernvault is a local-first, personal knowledge processing studio designed to stop "hoarding" and start "learning." Unlike traditional bookmarking tools, Kernvault forces you to define your learning intent and prove your understanding before content is archived.

---

## ✨ Key Features

*   **🎯 Intent-First Spaces**: Don't just save links. Create "Spaces" with defined learning objectives and structured stages (e.g., "Intro", "Deep Dive", "Review").
*   **🧘 Forced Reflection**: Integrated "Pause Points" interrupt your reading flow to ensure you're actually absorbing the material, not just skimming.
*   **✅ Proof of Understanding**: Items aren't marked as "done" just because you scrolled to the bottom. You must summarize your key takeaway in your own words to "graduate" the content.
*   **🗺️ Learning Maps**: Visualize your progress across different topics and see your knowledge grow over time.
*   **🏠 Local-First & Private**: Your data never leaves your machine. Powered by SQLite and served locally for maximum speed and privacy.

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)
The fastest way to get running without managing dependencies.

```bash
# Build the image
npm run docker:build

# Run it — your data persists in the ./data folder
npm run docker:run
# → Access at http://localhost:3001
```

### Option 2: Manual Development
Best for customizing the code.

```bash
# 1. Install all dependencies
npm run install:all

# 2. Start both Frontend & Backend
npm start
# → Frontend: http://localhost:5173
# → Backend API: http://localhost:3001/api
```

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Zustand (State Management)
- **Backend**: Node.js, Express
- **Database**: SQLite (via `better-sqlite3`)
- **Content Extraction**: Mozilla Readability
- **Deployment**: Docker, production-ready static serving via Express

---

## 📁 Project Structure

```text
kernvault/
├── client/         # React + Vite frontend
├── server/         # Express backend + SQLite logic
├── data/           # Local SQLite database (gitignored)
└── Dockerfile      # Multi-stage production build
```

---

## 📊 Data & Privacy

- **No Cloud**: No accounts, no tracking, no telemetry.
- **SQLite**: Your data is stored in a single file: `data/kernvault.db`.
- **Exportable**: Easily export your entire library to JSON via the Settings menu or `/api/export` endpoint.

---

## 🤝 Contributing

Contributions are welcome! Whether it's a bug fix, new feature, or documentation improvement:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with 🧠 by Mike
</p>

