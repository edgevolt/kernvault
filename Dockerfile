# syntax=docker/dockerfile:1


# ─── Stage 1: Build the React client ─────────────────────────────────────────
FROM node:20-alpine AS client-builder

WORKDIR /build/client

# Install client deps
COPY client/package*.json ./
RUN npm ci --prefer-offline

# Copy source and build
COPY client/ ./
RUN npm run build


# ─── Stage 1b: Fetch the local TTS model ─────────────────────────────────────
# Downloads + sha256-verifies the read-aloud model so it is baked into the image.
# Read-aloud stays OFF until the admin sets TTS_ENABLED=true — this only ensures
# the model is already present when they do. Pin TTS_MODEL_REVISION for
# reproducible builds. Build with --build-arg SKIP_TTS_MODEL=1 for a lean image
# without the model (read-aloud then reports disabled).
FROM node:20-slim AS model-fetch
WORKDIR /model
ARG TTS_MODEL_ID=onnx-community/Kokoro-82M-v1.0-ONNX
# Pinned to an immutable commit SHA for reproducible, verifiable builds.
ARG TTS_MODEL_REVISION=1939ad2a8e416c0acfeecc08a694d14ef25f2231
ARG TTS_MODEL_DTYPE=q8
ARG SKIP_TTS_MODEL=
COPY server/scripts/fetch-model.mjs ./fetch-model.mjs
RUN node fetch-model.mjs --out /model/out --id "$TTS_MODEL_ID" \
      --revision "$TTS_MODEL_REVISION" --dtype "$TTS_MODEL_DTYPE" ${SKIP_TTS_MODEL:+--skip}


# ─── Stage 2: Production image ────────────────────────────────────────────────
# Debian "slim" (glibc) rather than Alpine (musl): the in-process text-to-speech
# engine's native ONNX runtime ships glibc binaries. SQLite data is byte-for-byte
# portable between the two, so existing volumes upgrade in place with no data change.
FROM node:20-slim AS production
LABEL org.opencontainers.image.source="https://github.com/edgevolt/kernvault"

# Install native build tools needed by better-sqlite3 (and onnxruntime-node)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install server deps (production only)
COPY server/package*.json ./server/
RUN npm ci --prefix server --omit=dev --prefer-offline

# Copy server source
COPY server/ ./server/

# Copy the built client into the location Express expects
COPY --from=client-builder /build/client/dist ./client/dist

# Bake in the local TTS model fetched above. Read-aloud stays OFF until the admin
# sets TTS_ENABLED=true; this just means the model is already there when they do.
# (If built with SKIP_TTS_MODEL=1 this is an empty tree and read-aloud stays
# unavailable.) The app runs fine either way.
COPY --from=model-fetch /model/out/ ./server/models/

# Data directory — mount a volume here for persistence
RUN mkdir -p /app/data

# Run as non-root user
RUN groupadd -r kv && useradd -r -g kv kv && chown -R kv:kv /app
USER kv

# Expose the single port
EXPOSE 9876

# Health check (Node's global fetch — Debian slim has no wget/curl)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:9876/api/spaces').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Run the server (serves both API and static frontend)
CMD ["node", "server/src/index.js"]
