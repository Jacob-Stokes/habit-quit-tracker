#!/bin/bash
set -e

echo "🚀 Starting Habit Quit Tracker..."

# Run database initialization
echo "📊 Setting up database..."
node scripts/db-setup.js

# Start the main application
echo "🌟 Starting application server..."
exec "$@"