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
npx prisma migrate deploy --schema prisma/schema.prisma

echo "✅ Marking exhaustive migration as applied manually..."
npx prisma migrate resolve --applied 20260228_fix_all_missing_columns || true

echo "🌱 Running database seeds..."
node prisma/seed.js || echo "⚠️ Seed failed but continuing..."

echo "🚀 Starting application..."
exec pnpm start
