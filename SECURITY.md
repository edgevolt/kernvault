# Security

Kernvault is **local-first and private by default**: no accounts, no cloud sync, no
telemetry, and no third-party SDKs at runtime. Your library lives in a single SQLite file
on your own machine.

## Reporting a vulnerability

Please report suspected vulnerabilities privately via GitHub Security Advisories
("Report a vulnerability" on the repository's **Security** tab) rather than opening a public
issue. We aim to acknowledge reports within a few days.

## Supply-chain posture

Third-party/npm supply-chain risk is taken seriously. Controls in place:

### Dependency pinning & integrity
- `package-lock.json` is committed for the root, `client/`, and `server/`. Production images
  build with **`npm ci`**, which installs the exact locked versions and **verifies each
  package tarball's sha512 integrity hash** against the lockfile.
- Direct TTS dependencies are pinned to exact versions (`kokoro-js`, `@huggingface/transformers`).
- Run `npm audit` in each workspace as part of review. As of the latest release, **all three
  workspaces (root, `server/`, `client/`) report 0 known vulnerabilities** — including
  pre-existing/legacy advisories, which were upgraded away (e.g. `axios`, `express`/`qs`,
  `multer`, `uuid`→11, `@mozilla/readability`→0.6, `react-router-dom`→6.30.4, the Vite/esbuild
  dev toolchain →8, and `shell-quote` via `concurrently`).

### Local text-to-speech model (read-aloud)
Read-aloud runs a neural model **entirely on your own server** — no article text or audio is
ever sent to a third party. The model is fetched and verified **only at image-build time**:
- Pinned to an **immutable commit SHA** (not a mutable tag), so builds are reproducible.
- **Every file is integrity-checked** by [`server/scripts/fetch-model.mjs`](server/scripts/fetch-model.mjs):
  large binaries (the ONNX graph and voices) via **sha256** against the Hugging Face LFS
  pointer, and small config/tokenizer files via their **git blob SHA1** from the pinned commit.
  The build **fails closed** on any mismatch or unverifiable file, and rejects unsafe paths.
- The format is **ONNX** (a data graph parsed by the runtime), **not** Python `pickle`, so the
  "malicious code in a model" class of attack does not apply. At runtime `allowRemoteModels`
  is `false` — **nothing is fetched over the network** during synthesis.
- To further verify, pin/override `TTS_MODEL_REVISION` and scan the fetched `.onnx` with a
  model-security scanner. See [`server/models/README.md`](server/models/README.md).

### Native dependencies & build egress
- The TTS runtime uses `onnxruntime-node`, whose **postinstall downloads a prebuilt native
  binary** from a Microsoft-hosted host at install time. Build images in **trusted CI with
  network egress restricted** to the npm registry, Hugging Face, and the onnxruntime download
  host.
- `sharp` and `onnxruntime-web` are transitive dependencies of `@huggingface/transformers`
  (declared upstream, reputable, no known advisories). `sharp` (image processing) is unused by
  the audio path but is a non-optional upstream dependency, so it is accepted rather than
  force-removed. A lean image without the TTS model can be built with
  `--build-arg SKIP_TTS_MODEL=1`.

## Runtime hardening

- `helmet` sets standard security headers; a strict CORS allowlist and `express-rate-limit`
  are applied (with a tighter limit on the CPU-bound `/api/tts` endpoint).
- Ingested HTML is sanitized with DOMPurify; URL fetching validates protocol and rejects
  private/loopback addresses; uploads are size-capped.
- The container runs as a non-root user, and `docker-compose.yml` binds to `127.0.0.1` only.
- The `/api/tts` endpoint validates input (type + length), whitelists voices, clamps the rate,
  and uses hash-derived cache filenames (no user-controlled paths). It is CPU-bound and
  unauthenticated by design (consistent with the app's no-auth, localhost model); the rate
  limit and a synthesis concurrency guard mitigate local abuse. Operators can hard-disable it
  with `TTS_ENABLED=false`.
