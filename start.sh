#!/bin/sh
set -e

echo "🚀 Starting Nexo Messenger..."

# Run Prisma migrations
echo "📦 Running database migrations..."
cd /app/apps/server
for i in $(seq 1 15); do
  if npx prisma db push --accept-data-loss; then
    echo "✅ Database schema pushed successfully"
    break
  else
    echo "⏳ DB not ready, retry $i/15..."
    sleep 4
  fi
done

# Generate Prisma client (just in case)
npx prisma generate

# Start server
echo "🌐 Starting server on port $PORT..."
cd /app/apps/server
exec tsx src/index.ts
