#!/bin/sh
set -e

echo "🚀 Starting N9N Backend..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set!"
  exit 1
fi

# Extract host from DATABASE_URL for pg_isready
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "📋 Database configuration:"
echo "   Host: $DB_HOST"
echo "   User: $DB_USER"
echo "   Database: $DB_NAME"
echo "   DATABASE_URL: ${DATABASE_URL%%@*}@***" # Hide password

# Wait for database to be ready
echo "⌛ Waiting for database..."
RETRIES=30
until pg_isready -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  echo "Waiting for database at $DB_HOST... ($RETRIES retries left)"
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
cd /app/apps/backend

# Verify Prisma CLI is available
if ! command -v prisma &> /dev/null; then
  echo "❌ ERROR: Prisma CLI not found!"
  echo "Trying to use npx prisma instead..."
  npx prisma migrate deploy
else
  echo "✅ Prisma CLI found: $(which prisma)"
  echo "Prisma version: $(prisma --version)"
  
  # Verify schema file exists
  if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ ERROR: prisma/schema.prisma not found!"
    ls -la prisma/ || echo "prisma directory does not exist"
    exit 1
  fi
  
  # Run migrations with verbose output
  echo "Running: prisma migrate deploy"
  echo "DATABASE_URL is set: ${DATABASE_URL:+yes}"
  
  # Try to run migrations
  prisma migrate deploy
  MIGRATION_EXIT_CODE=$?
  
  if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
    echo "✅ Migrations completed successfully!"
  else
    echo "⚠️ Migration exit code: $MIGRATION_EXIT_CODE"
    echo "This might be normal if migrations were already applied."
  fi
fi

# Run seeds
echo "🌱 Running database seeds..."
node -e "
const { execSync } = require('child_process');
try {
  console.log('Starting seed process...');
  execSync('node prisma/seed.js', { stdio: 'inherit' });
  console.log('✅ Seed completed successfully');
} catch(e) {
  console.error('⚠️ Seed failed but continuing startup:', e.message);
}
"

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
