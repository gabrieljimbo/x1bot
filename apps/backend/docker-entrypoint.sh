#!/bin/sh
set -e

echo "🚀 Starting N9N Backend Entrypoint..."

# Wait for database (optional but recommended)
if [ -n "$DATABASE_URL" ]; then
    echo "⌛ Waiting for database connection..."
    # Simple wait logic or just proceed to migrate which will fail if DB not ready
fi

# Ensure we are in the correct directory
cd /app/apps/backend

echo "📦 Running database migrations..."
pnpm prisma migrate deploy --schema prisma/schema.prisma

echo "🌱 Running database seeds..."
node prisma/seed.js || echo "⚠️ Seed failed but continuing..."

echo "🚀 Starting application..."
exec pnpm start
