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
# Resolver migrations falhadas se existirem
npx prisma migrate resolve --rolled-back 20260304222000_multi_pixel_support 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260306_fix_conversations_contactid 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260308_add_sent_products 2>/dev/null || true
npx prisma migrate deploy --schema prisma/schema.prisma

echo "🌱 Running database seeds..."
node prisma/seed.js || echo "⚠️ Seed failed but continuing..."

echo "🚀 Starting application..."
exec pnpm start
