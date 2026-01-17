#!/bin/bash

# Script to reset database and apply migrations from scratch
# This should be run to test the migrations in a clean environment

echo "🔄 Resetting database and applying migrations..."

# Check if we're in Docker or need to use docker exec
if [ -f /.dockerenv ]; then
    # We're inside Docker
    cd /app/apps/backend
    
    echo "⚠️  WARNING: This will delete ALL data in the database!"
    echo "🗑️  Dropping and recreating database..."
    
    # Reset the database (drops all tables and re-applies migrations)
    npx prisma migrate reset --force --skip-seed
    
    echo "✅ Database reset complete!"
else
    # We're outside Docker, use docker exec
    echo "⚠️  WARNING: This will delete ALL data in the database!"
    echo "Running inside Docker container (n9n-backend)..."
    
    docker exec n9n-backend sh -c "cd /app/apps/backend && npx prisma migrate reset --force --skip-seed"
    
    if [ $? -eq 0 ]; then
        echo "✅ Database reset and migrations applied successfully!"
    else
        echo "❌ Failed to reset database"
        exit 1
    fi
fi

echo "✅ Done!"
