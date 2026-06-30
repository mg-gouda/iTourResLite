# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install

# ---- development: source mounted via compose; entrypoint pushes schema + seeds ----
FROM base AS development
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @itour/db generate
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["sh", "/app/apps/api/docker-entrypoint.sh"]

# ---- production (runs via tsx; workspace packages export TS source) ----
FROM base AS production
ENV NODE_ENV=production
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @itour/db generate
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter @itour/db migrate:deploy && pnpm --filter @itour/api start"]
