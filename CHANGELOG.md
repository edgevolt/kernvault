# Changelog

All notable changes to this project will be documented in this file.

## [2.2.2] - 2026-07-17

### Changed
- **Read Aloud is now much faster on CPUs without int8 acceleration** — the default model precision changed from int8 (`q8`) to **`fp32`**. On processors without AVX-512/VNNI (e.g. older Intel desktops), int8 is *emulated* and runs slower than realtime, causing per-sentence lag; `fp32` is ~2× faster there (measured real-time factor ~0.5–0.8 vs ~1.3–1.5 for `q8` on an i5-7500T). A smaller `q4f16` build remains available via `--build-arg TTS_MODEL_DTYPE=q4f16`. Setting `TTS_MODEL_DTYPE` at build time now re-bakes the model **and** sets the matching runtime precision in one step, so the baked-in model and the running precision can no longer drift apart. (The `fp32` model adds ~0.9 GB to the image and ~250 MB RAM — negligible for a self-hosted single container.)

## [2.2.1] - 2026-07-17

### Fixed
- **Read Aloud performance** — synthesis was running many times slower than realtime (multi-second delays per sentence) on some hosts because the native ONNX runtime failed to load and the engine silently fell back to a single-threaded WASM backend. The production image now installs the `libgomp1` runtime library the native runtime needs, so synthesis uses the native, multi-core backend. The server now logs the active backend at startup (with a clear warning if it ever falls back) and per-sentence timing, so a slow backend can't go unnoticed. On older CPUs without int8 acceleration, the model precision can be changed at build time via `--build-arg TTS_MODEL_DTYPE=fp32` (or `q4f16`).
- **Read Aloud responsiveness** — the model and first sentence are now warmed in the background as soon as a reader with read-aloud enabled is opened, and playback pre-fetches two sentences ahead, so speech starts sooner and stays ahead. Very long unpunctuated passages are split into smaller chunks to shorten time-to-first-audio.
- **Read-along highlight sync** — the spoken-sentence highlight now advances when a sentence actually begins playing rather than when it is queued, so it no longer runs ahead of the audio during synthesis.
- **Highlighting in Firefox** — creating a highlight from the selection toolbar did nothing in Firefox because the click was lost when the text selection collapsed. The action now fires reliably, and a failed save surfaces a visible message instead of failing silently.

## [2.2.0] - 2026-07-16

### Added
- **Read Aloud (local text-to-speech)** — an optional speaker control in the reader plays articles as speech, sentence by sentence, highlighting each sentence as it is spoken, with adjustable voice and speed. A small neural TTS model (Kokoro-82M) runs **in-process on the host CPU**; no article text or audio is ever sent to a third party, consistent with Kernvault's local-first stance.
  - **Batteries included:** the Docker image ships with the model already baked in (fetched and sha256-verified at build time). No download or vendoring on the admin's part.
  - **Easy in-app control:** a per-browser **Read aloud** switch in the reader's display (Aa) menu turns it on/off for the user. It defaults off, so the host never spends CPU on speech unprompted. The feature is available by default (model present); operators can hard-disable it server-wide with `TTS_ENABLED=false` on low-power hosts.
  - Synthesized audio is cached under `data/tts-cache/` (keyed by model version + voice + rate + text) so re-listens are instant; the cache is regenerable and safe to delete.
  - New endpoints: `GET /api/tts/status` and `POST /api/tts`.

### Security & Hardening
- **Dependency audit — all workspaces now report 0 known vulnerabilities** (root, `server/`, `client/`), including pre-existing/legacy advisories. Server: `axios`, `express`/`qs`, `multer`, `form-data`, `dompurify`, `ws` (via jsdom), plus breaking bumps to `uuid` (→11) and `@mozilla/readability` (→0.6). Client: `react-router-dom` (→6.30.4) and the dev toolchain (`vite`→8 / `@vitejs/plugin-react`→6, clearing the esbuild/babel dev-server advisories). Root: `shell-quote` (via `concurrently`). The new TTS dependencies introduced **no** known vulnerabilities.
- **Supply-chain controls for TTS:** direct TTS deps are pinned to exact versions; lockfiles are committed so `npm ci` verifies every package's integrity hash. The read-aloud model is pinned to an **immutable commit SHA** and **every file is integrity-verified at build** (sha256 for LFS binaries, git blob SHA1 for config/tokenizer), failing closed on mismatch, with path-traversal guards. At runtime nothing is fetched (`allowRemoteModels=false`), and the ONNX (non-pickle) format avoids code-execution-on-load risks. See the new [`SECURITY.md`](SECURITY.md).

### Changed
- The production Docker image base moved from **Alpine to Debian slim** so the TTS engine's native ONNX runtime (glibc) can run in the single container. **User data is unaffected** — the SQLite file is byte-for-byte portable between the two, so existing `kernvault_data` volumes upgrade in place with no migration. The baked-in model grows the image by ~80–170 MB (maintainers can build a lean image with `--build-arg SKIP_TTS_MODEL=1`); with TTS off at runtime there is no CPU cost.

## [2.1.0] - 2026-06-14

> **Requires Node.js 20+** (upgraded from 18 due to epub-gen-memory dependency on the `File` Web API global)

### Added
- **EPUB export** — Articles can now be exported to EPUB format for reading on Kindle, reMarkable, Kobo, and other e-readers. A download icon in the reader toolbar opens an export panel with two modes:
  - *With my notes* — includes existing pause point responses, notes, and highlights
  - *Clean copy* — includes article content and reflection prompts with blank write-in spaces, ready to fill out on a digital notebook device
- Individual toggles to include or exclude pause point responses, notes, and highlights in annotated exports

### Security & Hardening
- HTML content is now sanitized through DOMPurify before storage across all ingestion paths (paste, PDF, YouTube transcript)
- URL fetching validates protocol and rejects requests to private/loopback addresses
- PDF uploads are capped at 50 MB
- Added `helmet` for standard HTTP security headers and `express-rate-limit` for basic request throttling
- "Delete all data" now requires a server-generated token alongside the existing confirmation, reducing the risk of accidental or scripted data loss
- Docker image now runs as a non-root user; `docker-compose.yml` binds to `127.0.0.1` only to avoid unintended LAN exposure
- Minor: tightened CORS allowlist, sanitized PDF filenames, improved error log formatting

## [2.0.1] - 2026-05-01

### Fixed
- Fixed a React render crash on mobile devices (`TypeError: Cannot read properties of null (reading 'addEventListener')`) when opening an article in the ReaderView. The tap handler now properly waits for the article container to be rendered before attaching event listeners.
