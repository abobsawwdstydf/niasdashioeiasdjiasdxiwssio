#!/bin/sh
set -e

echo "🚀 Starting Nexo Messenger..."
echo "📍 Working directory: $(pwd)"
echo "🌍 NODE_ENV: $NODE_ENV"
echo "🔌 PORT: $PORT"

# Run Prisma migrations with retry
echo "📦 Running database migrations..."
cd /app/apps/server

MAX_RETRIES=15
RETRY=0
until npx prisma db push --accept-data-loss 2>&1; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "❌ Database migration failed after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "⏳ DB not ready, retry $RETRY/$MAX_RETRIES... (waiting 5s)"
  sleep 5
done

echo "✅ Database schema pushed successfully"

# Generate Prisma client (ensure it's up to date)
npx prisma generate

# Start server
echo "🌐 Starting server on port ${PORT:-3001}..."
exec tsx src/index.ts
