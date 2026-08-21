# Stage 1: Build Frontend Single-Page App
FROM node:20-alpine AS client-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Build Backend API
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Stage 3: Production Runtime (Unified Single Container)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy built frontend assets
COPY --from=client-builder /app/dist /app/dist

# Copy backend built files and dependencies
WORKDIR /app/server
COPY --from=server-builder /app/server/package*.json ./
RUN npm ci --only=production
COPY --from=server-builder /app/server/dist ./dist

EXPOSE 3001

# Automatically runs database migrations, seeds default demo account, and starts unified server
CMD ["node", "dist/index.js"]
