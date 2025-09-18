#!/bin/bash
# This hook runs AUTOMATICALLY when you push to the droplet
# Install at: /root/habit-quit-tracker/.git/hooks/post-receive

echo "🚀 Received push - automatically deploying..."

cd /root/habit-quit-tracker

# The files are already updated by git because of receive.denyCurrentBranch=updateInstead
echo "📦 Files updated. Rebuilding Docker..."

# Rebuild Docker
docker compose down
docker compose build
docker compose up -d

# Clean up
docker image prune -f

echo "✅ Automatic deployment complete!"