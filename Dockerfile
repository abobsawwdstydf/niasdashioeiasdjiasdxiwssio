# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (sharp, etc.)
RUN apk add --no-cache python3 make g++ vips-dev

# Copy package files
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY apps/server/web/package*.json ./apps/server/web/

# Install dependencies
RUN npm install --legacy-peer-deps
RUN cd apps/server && npm install --legacy-peer-deps
RUN cd apps/server/web && npm install --legacy-peer-deps

# Copy all source code
COPY . .

# Build frontend
RUN cd apps/server/web && npm run build

# Generate Prisma client
RUN cd apps/server && npx prisma generate

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies for sharp and other native modules
RUN apk add --no-cache vips

# Install tsx globally
RUN npm install -g tsx@4.19.2

# Copy built artifacts from builder
COPY --from=builder /app/apps/server/package*.json ./apps/server/
COPY --from=builder /app/apps/server/web/package*.json ./apps/server/web/
COPY --from=builder /app/apps/server/web/dist ./apps/server/web/dist
COPY --from=builder /app/apps/server/web/public ./apps/server/web/public
COPY --from=builder /app/apps/server/src ./apps/server/src
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
COPY --from=builder /app/apps/server/tsconfig.json ./apps/server/tsconfig.json
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules

# Create required directories
RUN mkdir -p apps/server/uploads apps/server/storage

# Copy start script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Environment
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["/app/start.sh"]
