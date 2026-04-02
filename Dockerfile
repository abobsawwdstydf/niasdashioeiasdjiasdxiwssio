# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY apps/web/package*.json ./apps/web/

RUN npm ci

# Copy source code
COPY . .

# Build web app
WORKDIR /app/apps/web
RUN npm run build

# Build server
WORKDIR /app/apps/server
RUN npx prisma generate
RUN npx prisma migrate deploy

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
COPY --from=builder /app/apps/server/src/shared.ts ./apps/server/src/
COPY --from=builder /app/apps/server/src/encrypt.ts ./apps/server/src/
COPY --from=builder /app/apps/web/dist ./apps/web/dist

WORKDIR /app/apps/server

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start server
CMD ["node", "dist/index.js"]
