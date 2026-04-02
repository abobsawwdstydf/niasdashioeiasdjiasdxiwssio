# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY apps/web/package*.json ./apps/web/

# Delete old lock files and reinstall
RUN rm -f package-lock.json apps/server/package-lock.json apps/web/package-lock.json
RUN npm install
RUN cd apps/server && npm install
RUN cd apps/web && npm install

# Copy source code
COPY . .

# Build web app only
WORKDIR /app/apps/web
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install all dependencies (including tsx for runtime compilation)
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/server/package*.json ./apps/server/
WORKDIR /app/apps/server
RUN npm install

# Copy built web files
COPY --from=builder /app/apps/web/dist ../web/dist

# Copy server source (no compilation needed - using tsx)
COPY --from=builder /app/apps/server/src ./src
COPY --from=builder /app/apps/server/prisma ./prisma

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

# Start server with tsx (no TypeScript compilation needed)
CMD ["npx", "tsx", "src/index.ts"]
