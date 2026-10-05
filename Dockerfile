# Stage 1: Build Unified Static Apps (Marketing + Demo + Gatekept SaaS)
FROM node:24-slim AS client-builder
WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
COPY marketing/package*.json ./marketing/
RUN ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
COPY . .
RUN npm run build

# Stage 2: Build Backend API (TypeScript compilation)
FROM node:24-slim AS server-builder
WORKDIR /app/server
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY server/package*.json ./
RUN npm ci && npm_config_build_from_source=true npm rebuild sqlite3
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# Stage 3: Production Runtime (Unified Single-Port Container)
FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Install curl for container healthcheck and cleanup apt cache
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Copy built frontend assets
COPY --from=client-builder --chown=node:node /app/dist /app/dist

# Copy backend built files and dependencies
WORKDIR /app/server
COPY --from=server-builder --chown=node:node /app/server/package*.json ./
# Retain SQLite built against this same base image's libc rather than fetching
# a prebuilt native addon that may require a newer GLIBC at runtime.
COPY --from=server-builder --chown=node:node /app/server/node_modules ./node_modules
COPY --from=server-builder --chown=node:node /app/server/dist ./dist

USER node

EXPOSE 3001

# Readiness probe: orchestrators must gate traffic on /ready (database +
# migrations verified). /health is liveness only and stays 200 while /ready
# reports 503 during startup or database outages.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/ready || exit 1

# Runs migrations and starts Express; production demo seeding stays disabled.
CMD ["node", "dist/index.js"]
