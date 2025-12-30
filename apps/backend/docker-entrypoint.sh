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
# Use prisma directly since it's installed globally
cd /app/apps/backend
prisma migrate deploy || echo "⚠️ Migration failed or already applied"

# Start the application
echo "🚀 Starting application..."
# Ensure we're in the correct directory
cd /app/apps/backend
# Verify main.js exists
if [ ! -f "dist/apps/backend/src/main.js" ]; then
  echo "❌ ERROR: dist/apps/backend/src/main.js not found!"
  echo "Contents of /app/apps/backend:"
  ls -la /app/apps/backend/
  echo "Looking for main.js:"
  find /app/apps/backend/dist -name "main.js" || echo "main.js not found"
  exit 1
fi
exec pnpm start

