# Build and run the Träningsreturen backend. Build context is the repo root.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile --filter @traningsreturen/backend
COPY backend backend
RUN pnpm --filter @traningsreturen/backend run build

FROM node:22-alpine
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile --prod --filter @traningsreturen/backend
COPY --from=build /app/backend/dist backend/dist
COPY deploy/backend-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["/entrypoint.sh"]
