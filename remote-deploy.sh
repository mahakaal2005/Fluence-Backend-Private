#!/bin/bash

###############################################################################
# Remote Deployment Script
# This script helps you deploy from your local machine to the server
###############################################################################

set -e

# Server Configuration
SERVER_IP="161.248.37.235"
SERVER_USER="root"
DEPLOY_DIR="/opt/fluence-backend"

echo "=========================================="
echo "Fluence Backend - Remote Deployment"
echo "=========================================="
echo ""

# Check if SSH key is set up
echo "Checking SSH connection..."
if ! ssh -o ConnectTimeout=5 $SERVER_USER@$SERVER_IP "echo 'Connection successful'" 2>/dev/null; then
    echo "ERROR: Cannot connect to server."
    echo "Please ensure:"
    echo "  1. You have SSH access to $SERVER_IP"
    echo "  2. Your SSH key is added or password is configured"
    exit 1
fi

echo "✓ SSH connection successful"
echo ""

# Create deployment package
echo "Creating deployment package..."
tar -czf fluence-backend-deploy.tar.gz \
  auth-service \
  merchant-onboarding-service \
  cashback-budget-service \
  notification-service \
  points-wallet-service \
  referral-service \
  social-features-service \
  docker-compose.prod.yml \
  nginx.prod.conf \
  init-databases.sh \
  deploy.sh \
  2>/dev/null || {
    echo "ERROR: Some files are missing. Please ensure you're in the project root."
    exit 1
}

echo "✓ Package created: fluence-backend-deploy.tar.gz"
echo ""

# Transfer to server
echo "Transferring files to server..."
scp fluence-backend-deploy.tar.gz $SERVER_USER@$SERVER_IP:/root/
echo "✓ Files transferred"
echo ""

# Execute deployment on server
echo "Starting deployment on server..."
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
    cd /root
    tar -xzf fluence-backend-deploy.tar.gz
    chmod +x deploy.sh
    ./deploy.sh
ENDSSH

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Your API is available at: http://$SERVER_IP:5726"
echo "Health check: http://$SERVER_IP:5726/health"
echo ""
echo "To check logs: ssh $SERVER_USER@$SERVER_IP 'cd /opt/fluence-backend && docker compose logs -f'"
echo ""

