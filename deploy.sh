#!/bin/bash

# Deployment script for habit-quit-tracker
# Usage: ./deploy.sh "commit message"

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REMOTE_HOST="root@46.101.66.88"
REMOTE_DIR="/root/habit-quit-tracker"
CONTAINER_NAME="habit-quit-tracker"

echo -e "${YELLOW}🚀 Starting deployment process...${NC}\n"

# Check if commit message provided
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: Please provide a commit message${NC}"
    echo "Usage: ./deploy.sh \"your commit message\""
    exit 1
fi

COMMIT_MSG="$1"

# Step 1: Git add and commit
echo -e "${YELLOW}📝 Committing changes...${NC}"
git add -A
git commit -m "$COMMIT_MSG

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>" || {
    echo -e "${RED}❌ No changes to commit or commit failed${NC}"
    exit 1
}

# Step 2: Push to GitHub
echo -e "${YELLOW}📤 Pushing to GitHub...${NC}"
git push origin main || {
    echo -e "${RED}❌ Failed to push to GitHub${NC}"
    exit 1
}

echo -e "${GREEN}✅ Code pushed to GitHub${NC}\n"

# Step 3: Push to production remote (optional - for direct git deployment)
echo -e "${YELLOW}📤 Pushing to production remote...${NC}"
git push production main || {
    echo -e "${YELLOW}⚠️  Direct push to production failed, continuing with SSH pull method${NC}"
}

# Step 4: Deploy to production via SSH
echo -e "${YELLOW}🔧 Deploying to production server...${NC}"

ssh $REMOTE_HOST << 'ENDSSH'
set -e
echo "📥 Pulling latest changes..."
cd /root/habit-quit-tracker
git pull origin main

echo "🐳 Rebuilding Docker containers..."
docker compose down
docker compose build
docker compose up -d

echo "⏳ Waiting for container to be healthy..."
sleep 5

# Check container status
if docker compose ps | grep -q "healthy"; then
    echo "✅ Container is healthy"
else
    echo "⚠️ Container may not be healthy, please check manually"
fi

# Check HTTP endpoint
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8882/api/health | grep -q "200"; then
    echo "✅ Application is responding correctly"
else
    echo "⚠️ Application may not be responding, please check manually"
fi
ENDSSH

echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}📱 Application is running at: http://46.101.66.88:8882${NC}"