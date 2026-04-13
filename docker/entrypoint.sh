#!/bin/sh
set -e

echo "Duck Analytics - Starting..."

# Run database migrations
echo "Running database migrations..."
cd /app/backend
npx prisma migrate deploy
echo "Migrations completed."

# Start supervisord (nginx + backend)
echo "Starting services..."
exec supervisord -c /etc/supervisord.conf
