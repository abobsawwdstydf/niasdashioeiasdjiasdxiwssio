FROM node:20-alpine

WORKDIR /app

# System deps for sharp (image processing)
RUN apk add --no-cache python3 make g++ vips-dev

# ── Server dependencies ──────────────────────────────────
COPY apps/server/package.json ./apps/server/
RUN cd apps/server && npm install --legacy-peer-deps

# ── Web dependencies ─────────────────────────────────────
COPY apps/server/web/package.json ./apps/server/web/
RUN cd apps/server/web && npm install --legacy-peer-deps

# ── Copy server source ───────────────────────────────────
COPY apps/server/src ./apps/server/src
COPY apps/server/prisma ./apps/server/prisma
COPY apps/server/tsconfig.json ./apps/server/tsconfig.json

# ── Copy web source ──────────────────────────────────────
COPY apps/server/web/src ./apps/server/web/src
COPY apps/server/web/index.html ./apps/server/web/index.html
COPY apps/server/web/vite.config.ts ./apps/server/web/vite.config.ts
COPY apps/server/web/tsconfig.json ./apps/server/web/tsconfig.json
COPY apps/server/web/vitest.config.ts ./apps/server/web/vitest.config.ts
COPY apps/server/web/public ./apps/server/web/public

# ── Build frontend ───────────────────────────────────────
RUN cd apps/server/web && npm run build

# ── Generate Prisma client ───────────────────────────────
RUN cd apps/server && npx prisma generate

# ── Runtime dirs ─────────────────────────────────────────
RUN mkdir -p apps/server/uploads apps/server/storage

# ── Start script ─────────────────────────────────────────
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD wget -q --spider http://localhost:3001/api/health || exit 1

CMD ["/app/start.sh"]
