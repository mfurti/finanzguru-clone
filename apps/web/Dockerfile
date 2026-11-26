# syntax=docker/dockerfile:1
# Build context: repository root.  docker build -f apps/web/Dockerfile .

FROM node:26-bookworm-slim AS base
# corepack is no longer bundled with Node 26; install the pinned pnpm directly.
RUN npm install -g pnpm@12.18.0 && npm cache clean --force

FROM base AS build
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter web... --ignore-scripts
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @finance/shared build && pnpm --filter web build

FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3000 \
  NUXT_API_BASE_URL=http://finance-api:3001 \
  TZ=Europe/Berlin
WORKDIR /app
# Nitro output is self-contained; no node_modules needed at runtime.
COPY --from=build --chown=node:node /repo/apps/web/.output ./.output
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
