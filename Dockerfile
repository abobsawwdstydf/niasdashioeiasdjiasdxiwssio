# Build stage
FROM node:20-alpine AS builder

# Force rebuild - 2026-04-04 admin auth fix
LABEL rebuild="2026-04-04-admin-fix"

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY apps/server/web/package*.json ./apps/server/web/

# Delete old lock files and reinstall with legacy peer deps
RUN rm -f package-lock.json apps/server/package-lock.json apps/server/web/package-lock.json
RUN npm install --legacy-peer-deps
RUN cd apps/server && npm install --legacy-peer-deps
RUN cd apps/server/web && npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build web app
WORKDIR /app/apps/server/web
RUN npm run build

# Generate Prisma client in builder (where prisma is installed)
WORKDIR /app/apps/server
RUN npx prisma generate

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies + prisma CLI
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/server/package*.json ./apps/server/
RUN npm install --legacy-peer-deps
RUN npm install prisma@6.3.0 --save-dev

# Copy server source
COPY --from=builder /app/apps/server/src ./src
COPY --from=builder /app/apps/server/prisma ./prisma

# Copy generated Prisma client from workspace root node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy built web files (../web/dist relative to src/)
COPY --from=builder /app/apps/server/web/dist ./web/dist

# Create uploads directory
RUN mkdir -p uploads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start server with tsx (apply DB schema first)
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx tsx src/index.ts"]
