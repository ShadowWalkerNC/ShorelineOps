FROM node:24-bookworm-slim AS build
WORKDIR /service
COPY control-plane/package.json control-plane/package-lock.json ./
RUN npm ci --workspaces=false
COPY control-plane/tsconfig.json ./
COPY control-plane/src ./src
RUN npm run build && npm prune --omit=dev --workspaces=false

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /service
COPY --from=build --chown=node:node /service/package.json ./
COPY --from=build --chown=node:node /service/node_modules ./node_modules
COPY --from=build --chown=node:node /service/dist ./dist
COPY --chown=node:node control-plane/public ./public
COPY --chown=node:node control-plane/migrations ./migrations
USER node
EXPOSE 3101
CMD ["node", "dist/index.js"]
