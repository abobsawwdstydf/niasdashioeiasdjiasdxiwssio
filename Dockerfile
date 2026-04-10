FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY apps/server/web/package*.json ./apps/server/web/
RUN npm install --legacy-peer-deps
RUN cd apps/server && npm install --legacy-peer-deps
RUN cd apps/server/web && npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build web app
RUN cd apps/server/web && npm run build

# Generate Prisma client
RUN cd apps/server && npx prisma generate

# Install tsx globally
RUN npm install -g tsx@4.19.2

# Create uploads directory
RUN mkdir -p apps/server/uploads

# Environment
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start
CMD ["sh", "-c", "cd apps/server && \
  for i in $(seq 1 10); do \
    npx prisma@6.3.0 db push --accept-data-loss && break || \
    { echo \"DB not ready, retry $i/10...\"; sleep 3; }; \
  done && \
  tsx src/index.ts"]
