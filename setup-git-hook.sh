#!/bin/bash
# Script to set up git hook on droplet for automatic Docker deployment

cat << 'EOF' > /root/habit-quit-tracker/.git/hooks/post-merge
#!/bin/bash
# Git post-merge hook for Docker deployment

echo "Post-merge hook triggered. Rebuilding Docker containers..."

cd /root/habit-quit-tracker

# Pull latest changes
echo "Pulling latest changes..."
git pull origin main

# Rebuild and restart Docker containers
echo "Stopping existing containers..."
docker-compose down

echo "Building new Docker images..."
docker-compose build --no-cache

echo "Starting updated containers..."
docker-compose up -d

# Clean up old images
echo "Cleaning up old Docker images..."
docker image prune -f

echo "Deployment complete!"
echo "Containers running:"
docker ps
EOF

# Make the hook executable
chmod +x /root/habit-quit-tracker/.git/hooks/post-merge

echo "Git hook installed successfully!"
echo "Now when you push to production, run: git push production main"
echo "Then SSH in and run: cd /root/habit-quit-tracker && git pull origin main"
echo "The hook will automatically rebuild Docker containers"