# syntax=docker/dockerfile:1


# ─── Stage 1: Build the React client ─────────────────────────────────────────
FROM node:18-alpine AS client-builder

WORKDIR /build/client

# Install client deps
COPY client/package*.json ./
RUN npm ci --prefer-offline

# Copy source and build
COPY client/ ./
RUN npm run build


# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:18-alpine AS production
LABEL org.opencontainers.image.source="https://github.com/edgevolt/kernvault"

# Install native build tools needed by better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install server deps (production only)
COPY server/package*.json ./server/
RUN npm ci --prefix server --omit=dev --prefer-offline

# Copy server source
COPY server/ ./server/

# Copy the built client into the location Express expects
COPY --from=client-builder /build/client/dist ./client/dist

# Data directory — mount a volume here for persistence
RUN mkdir -p /app/data

# Expose the single port
EXPOSE 9876

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:9876/api/spaces || exit 1

# Run the server (serves both API and static frontend)
CMD ["node", "server/src/index.js"]
