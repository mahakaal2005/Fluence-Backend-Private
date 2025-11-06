#!/bin/bash

###############################################################################
# Fluence Backend Deployment Script - GitHub Version
# Server: 161.248.37.235:5726
# This script clones from GitHub and deploys the backend
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Server Configuration
SERVER_IP="161.248.37.235"
SERVER_PORT="5726"
SERVER_USER="root"
DEPLOY_DIR="/opt/fluence-backend"

# GitHub Repository (can be overridden with GITHUB_REPO environment variable)
GITHUB_REPO="${GITHUB_REPO:-}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Fluence Backend Deployment from GitHub${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Function to print status
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

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root or with sudo"
    exit 1
fi

# Check if GitHub repository is provided
if [ -z "$GITHUB_REPO" ]; then
    print_error "GitHub repository URL is required!"
    echo ""
    echo "Usage:"
    echo "  GITHUB_REPO=https://github.com/username/repo.git ./deploy-from-github.sh"
    echo "  or"
    echo "  export GITHUB_REPO=https://github.com/username/repo.git"
    echo "  ./deploy-from-github.sh"
    echo ""
    echo "You can also specify a branch:"
    echo "  GITHUB_REPO=https://github.com/username/repo.git GITHUB_BRANCH=develop ./deploy-from-github.sh"
    exit 1
fi

print_info "Repository: $GITHUB_REPO"
print_info "Branch: $GITHUB_BRANCH"
echo ""

# Update system
print_status "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# Install required packages
print_status "Installing required packages..."
apt-get install -y -qq \
    curl \
    wget \
    git \
    ufw \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    openssl

# Install Docker
if ! command -v docker &> /dev/null; then
    print_status "Installing Docker..."
    
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Set up Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    print_status "Docker installed successfully"
else
    print_status "Docker is already installed"
fi

# Verify Docker Compose
if ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not available"
    exit 1
else
    print_status "Docker Compose is available"
fi

# Create deployment directory
print_status "Creating deployment directory..."
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

# Clone or update repository
if [ -d ".git" ]; then
    print_status "Repository already exists, pulling latest changes..."
    git fetch origin
    git checkout $GITHUB_BRANCH 2>/dev/null || git checkout -b $GITHUB_BRANCH origin/$GITHUB_BRANCH
    git pull origin $GITHUB_BRANCH
    print_status "Repository updated"
else
    print_status "Cloning repository from GitHub..."
    git clone -b $GITHUB_BRANCH $GITHUB_REPO .
    print_status "Repository cloned successfully"
fi

# Verify required files exist
print_status "Verifying required files..."
REQUIRED_FILES=("docker-compose.prod.yml" "nginx.prod.conf" "init-databases.sh")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Required file not found: $file"
        exit 1
    fi
done
print_status "All required files found"

# Copy docker-compose.prod.yml to docker-compose.yml for easier use
if [ -f "docker-compose.prod.yml" ]; then
    cp docker-compose.prod.yml docker-compose.yml
    print_status "Copied docker-compose.prod.yml to docker-compose.yml"
fi

# Make init script executable
if [ -f "init-databases.sh" ]; then
    chmod +x init-databases.sh
    print_status "Made init-databases.sh executable"
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    print_warning "Creating .env file from template..."
    if [ -f "env-template.txt" ]; then
        cp env-template.txt .env
        print_warning "Created .env from template. Please review and update with your production values!"
    elif [ -f ".env.production.example" ]; then
        cp .env.production.example .env
        print_warning "Created .env from example. Please review and update with your production values!"
    else
        # Create basic .env
        cat > .env << EOF
# Production Environment Variables
NODE_ENV=production
SERVER_PORT=5726
SERVER_IP=161.248.37.235

# Database
POSTGRES_DB=fluence_pay
POSTGRES_USER=fluence_user
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# JWT Secret (CHANGE THIS!)
JWT_SECRET=$(openssl rand -base64 64)

# Redis Password
REDIS_PASSWORD=$(openssl rand -base64 32)

# Service URLs (internal)
AUTH_SERVICE_URL=http://auth-service:3000
MERCHANT_SERVICE_URL=http://merchant-onboarding-service:3000
CASHBACK_SERVICE_URL=http://cashback-budget-service:3000
NOTIFICATION_SERVICE_URL=http://notification-service:3000
POINTS_SERVICE_URL=http://points-wallet-service:3000
REFERRAL_SERVICE_URL=http://referral-service:3000
SOCIAL_SERVICE_URL=http://social-features-service:3000

# Redis
REDIS_URL=redis://redis:6379

# Instagram Redirect URI
INSTAGRAM_REDIRECT_URI=http://161.248.37.235:5726/api/social/instagram/callback
EOF
        print_warning ".env file created with generated passwords. Please review and update!"
    fi
else
    print_status ".env file already exists, keeping existing configuration"
fi

# Configure firewall
print_status "Configuring firewall..."
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow $SERVER_PORT/tcp  # Application port
ufw allow 80/tcp    # HTTP (if needed)
ufw allow 443/tcp   # HTTPS (if needed)
print_status "Firewall configured"

# Stop any existing containers
print_status "Stopping existing containers..."
cd $DEPLOY_DIR
docker compose down 2>/dev/null || true

# Build and start services
print_status "Building Docker images (this may take a while)..."
docker compose build --no-cache

print_status "Starting services..."
docker compose up -d

# Wait for services to be healthy
print_status "Waiting for services to start..."
sleep 20

# Check service health
print_status "Checking service health..."
HEALTH_CHECK_PASSED=false
for i in {1..30}; do
    if curl -f http://localhost:$SERVER_PORT/health > /dev/null 2>&1; then
        print_status "Services are healthy!"
        HEALTH_CHECK_PASSED=true
        break
    fi
    if [ $i -eq 30 ]; then
        print_warning "Health check timeout. Services may still be starting."
        print_warning "Check logs with: cd $DEPLOY_DIR && docker compose logs"
    fi
    sleep 2
done

# Display service status
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Service URLs:"
echo "  - API Gateway: http://$SERVER_IP:$SERVER_PORT"
echo "  - Health Check: http://$SERVER_IP:$SERVER_PORT/health"
echo ""
echo "Management Commands:"
echo "  - View logs: cd $DEPLOY_DIR && docker compose logs -f"
echo "  - Stop services: cd $DEPLOY_DIR && docker compose down"
echo "  - Restart services: cd $DEPLOY_DIR && docker compose restart"
echo "  - View status: cd $DEPLOY_DIR && docker compose ps"
echo "  - Update from GitHub: cd $DEPLOY_DIR && git pull && docker compose up -d --build"
echo ""

if [ "$HEALTH_CHECK_PASSED" = true ]; then
    print_status "Deployment completed successfully!"
    print_warning "IMPORTANT: Please review and update the .env file with your production values!"
    print_warning "Location: $DEPLOY_DIR/.env"
else
    print_warning "Deployment completed but health check failed. Please check logs."
fi

