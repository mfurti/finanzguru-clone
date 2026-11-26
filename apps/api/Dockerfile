# syntax=docker/dockerfile:1
# Build context: repository root.  docker build -f apps/api/Dockerfile .

FROM node:26-bookworm-slim AS base
# corepack is no longer bundled with Node 26; install the pinned pnpm directly.
RUN npm install -g pnpm@12.18.0 && npm cache clean --force

FROM base AS build
# Toolchain for native modules (better-sqlite3) if no prebuilt binary matches.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @finance/shared build \
  && pnpm --filter api build \
  && pnpm deploy --filter api --prod --legacy /out

FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production \
  PORT=3001 \
  DATABASE_PATH=/data/app.db \
  TZ=Europe/Berlin
WORKDIR /app
COPY --from=build --chown=node:node /out ./
# Data lives in a bind mount at /data (no VOLUME instruction on purpose).
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
