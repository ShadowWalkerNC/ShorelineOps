# Stage 1: Build Frontend Single-Page App (PWA)
FROM node:20-alpine AS client-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Build Backend API (TypeScript compilation)
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Stage 3: Production Runtime (Unified Single-Port Container)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Install curl for container healthcheck
RUN apk add --no-cache curl

# Copy built frontend assets
COPY --from=client-builder --chown=node:node /app/dist /app/dist

# Copy backend built files and dependencies
WORKDIR /app/server
COPY --from=server-builder --chown=node:node /app/server/package*.json ./
RUN npm ci --only=production
COPY --from=server-builder --chown=node:node /app/server/dist ./dist

USER node

EXPOSE 3001

# Native Docker Healthcheck targeting /health probe
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Automatically runs database migrations, seeds default system state, and starts Express server
CMD ["node", "dist/index.js"]
