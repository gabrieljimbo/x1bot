#!/bin/sh
set -e

echo "ðŸš€ Starting N9N Backend..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "âŒ ERROR: DATABASE_URL environment variable is not set!"
  exit 1
fi

# Extract host from DATABASE_URL for pg_isready
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "ðŸ“‹ Database configuration:"
echo "   Host: $DB_HOST"
echo "   User: $DB_USER"
echo "   Database: $DB_NAME"
echo "   DATABASE_URL: ${DATABASE_URL%%@*}@***" # Hide password

# Wait for database to be ready
echo "â³ Waiting for database..."
RETRIES=30
until pg_isready -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  echo "Waiting for database at $DB_HOST... ($RETRIES retries left)"
  RETRIES=$((RETRIES-1))
  sleep 2
done

if [ $RETRIES -eq 0 ]; then
  echo "âŒ Database connection failed!"
  exit 1
fi

echo "âœ… Database is ready!"

# Run migrations
echo "ðŸ“¦ Running database migrations..."
cd /app/apps/backend

# Verify Prisma CLI is available
if ! command -v prisma &> /dev/null; then
  echo "âŒ ERROR: Prisma CLI not found!"
  echo "Trying to use npx prisma instead..."
  npx prisma migrate deploy
else
  echo "âœ… Prisma CLI found: $(which prisma)"
  echo "Prisma version: $(prisma --version)"
  
  # Verify schema file exists
  if [ ! -f "prisma/schema.prisma" ]; then
    echo "âŒ ERROR: prisma/schema.prisma not found!"
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
    echo "âœ… Migrations completed successfully!"
  else
    echo "âš ï¸ Migration exit code: $MIGRATION_EXIT_CODE"
    echo "This might be normal if migrations were already applied."
  fi
fi

# Run seeds
echo "ðŸŒ± Running database seeds..."
if [ -f "prisma/seed.js" ]; then
  echo "Running seeds using node prisma/seed.js..."
  node prisma/seed.js
  SEED_EXIT_CODE=$?
  
  if [ $SEED_EXIT_CODE -eq 0 ]; then
    echo "âœ… Seeds completed successfully!"
  else
    echo "âš ï¸ Seed exit code: $SEED_EXIT_CODE"
    echo "This might be normal if seeds were already applied."
  fi
else
  echo "âš ï¸ prisma/seed.ts not found, skipping seeds..."
fi

# Start the application
echo "ðŸš€ Starting application..."
# Ensure we're in the correct directory
cd /app/apps/backend
# Verify main.js exists
if [ ! -f "dist/apps/backend/src/main.js" ]; then
  echo "âŒ ERROR: dist/apps/backend/src/main.js not found!"
  echo "Contents of /app/apps/backend:"
  ls -la /app/apps/backend/
  echo "Looking for main.js:"
  find /app/apps/backend/dist -name "main.js" || echo "main.js not found"
  exit 1
fi
exec node dist/apps/backend/src/main.js

