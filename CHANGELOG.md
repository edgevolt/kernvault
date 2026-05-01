# Changelog

All notable changes to this project will be documented in this file.

## [2.0.1] - 2026-05-01

### Fixed
- Fixed a React render crash on mobile devices (`TypeError: Cannot read properties of null (reading 'addEventListener')`) when opening an article in the ReaderView. The tap handler now properly waits for the article container to be rendered before attaching event listeners.
