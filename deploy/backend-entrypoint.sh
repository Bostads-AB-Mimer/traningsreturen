#!/bin/sh
# Runs migrations (creating the database if needed) before starting the API.
set -e
cd /app/backend

echo "Running database migrations..."
node dist/db/migrate.js

if [ "$SEED_DEMO_DATA" = "true" ]; then
  echo "Seeding demo data..."
  node dist/db/seed/run.js
fi

echo "Starting backend..."
exec node dist/index.js
