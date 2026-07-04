# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install

# ---- development: source mounted via compose --------------------------------
FROM base AS development
COPY packages ./packages
COPY apps/web ./apps/web
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "dev"]

# ---- production: standalone Next.js build -----------------------------------
FROM base AS builder
COPY packages ./packages
COPY apps/web ./apps/web
ARG NEXT_PUBLIC_API_URL=https://fulvago.itmseg.cloud/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @itour/web build

FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder /app/apps/web/public           ./apps/web/public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
