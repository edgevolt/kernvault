# Changelog

All notable changes to this project will be documented in this file.

## [2.1.0] - 2026-06-14

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
