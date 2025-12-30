#!/bin/sh
set -e

echo "🚀 Starting N9N Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
RETRIES=30
until pg_isready -h postgres -U postgres -d n9n > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  echo "Waiting for database... ($RETRIES retries left)"
  RETRIES=$((RETRIES-1))
  sleep 2
done

if [ $RETRIES -eq 0 ]; then
  echo "❌ Database connection failed!"
  exit 1
fi

echo "✅ Database is ready!"

# Run migrations
echo "📦 Running database migrations..."
pnpm db:migrate:prod || echo "⚠️ Migration failed or already applied"

# Start the application
echo "🚀 Starting application..."
exec pnpm start

