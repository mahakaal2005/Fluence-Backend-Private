#!/bin/bash

###############################################################################
# Remote Deployment Script - Deploy from Local Machine to Server
# This script helps you deploy to the server using GitHub
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Server Configuration
SERVER_IP="161.248.37.235"
SERVER_PORT="5726"
SERVER_USER="root"
SERVER_PASSWORD="df#Rit6%$714ljk"

# GitHub Repository (required)
GITHUB_REPO="${GITHUB_REPO:-}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Fluence Backend - Remote Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if GitHub repository is provided
if [ -z "$GITHUB_REPO" ]; then
    print_error "GitHub repository URL is required!"
    echo ""
    echo "Usage:"
    echo "  GITHUB_REPO=https://github.com/username/repo.git ./deploy-to-server.sh"
    echo ""
    echo "Example:"
    echo "  GITHUB_REPO=https://github.com/yourusername/Fluence-Backend-Private.git ./deploy-to-server.sh"
    exit 1
fi

print_info "Server: $SERVER_USER@$SERVER_IP"
print_info "Repository: $GITHUB_REPO"
print_info "Branch: $GITHUB_BRANCH"
echo ""

# Check if sshpass is installed (for password authentication)
if ! command -v sshpass &> /dev/null; then
    print_warning "sshpass not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install hudochenkov/sshpass/sshpass
        else
            print_error "Please install sshpass: brew install hudochenkov/sshpass/sshpass"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo apt-get update -qq
        sudo apt-get install -y -qq sshpass
    else
        print_error "Please install sshpass manually"
        exit 1
    fi
fi

print_status "Transferring deployment script to server..."

# Transfer the deployment script to server
if [ -f "deploy-from-github.sh" ]; then
    sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no deploy-from-github.sh $SERVER_USER@$SERVER_IP:/root/
    print_status "Script transferred successfully"
else
    print_error "deploy-from-github.sh not found in current directory"
    exit 1
fi

print_status "Connecting to server and running deployment..."

# Run deployment on server
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP << ENDSSH
chmod +x /root/deploy-from-github.sh
cd /root
GITHUB_REPO="$GITHUB_REPO" GITHUB_BRANCH="$GITHUB_BRANCH" /root/deploy-from-github.sh
ENDSSH

if [ $? -eq 0 ]; then
    echo ""
    print_status "Deployment completed!"
    echo ""
    echo "Your backend is now available at:"
    echo "  - API Gateway: http://$SERVER_IP:$SERVER_PORT"
    echo "  - Health Check: http://$SERVER_IP:$SERVER_PORT/health"
    echo ""
    print_warning "Don't forget to:"
    echo "  1. Update .env file with your production values"
    echo "  2. Configure social media API keys"
    echo "  3. Set up SSL/HTTPS"
else
    print_error "Deployment failed. Please check the error messages above."
    exit 1
fi

