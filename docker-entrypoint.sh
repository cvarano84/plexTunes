#!/bin/sh
set -e

echo "🎵 Plex Jukebox - Starting up..."

# Wait for database to be ready and run migrations
echo "📦 Waiting for database..."
MAX_RETRIES=30
RETRY_COUNT=0
until npx prisma db push --skip-generate 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "⚠️  Database not ready after $MAX_RETRIES attempts. Starting anyway..."
    break
  fi
  echo "  Waiting for database... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

echo "✅ Database ready!"
echo "🚀 Starting Plex Jukebox server..."
exec "$@"
