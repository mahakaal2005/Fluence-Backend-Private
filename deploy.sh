#!/bin/bash

###############################################################################
# Fluence Backend Deployment Script for Ubuntu 22
# Server: 161.248.37.235:5726
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Server Configuration
SERVER_IP="161.248.37.235"
SERVER_PORT="5726"
SERVER_USER="root"
DEPLOY_DIR="/opt/fluence-backend"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Fluence Backend Deployment Script${NC}"
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

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root or with sudo"
    exit 1
fi

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
    lsb-release

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

# Install Docker Compose (standalone if not using plugin)
if ! docker compose version &> /dev/null; then
    print_status "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    print_status "Docker Compose installed successfully"
else
    print_status "Docker Compose is already installed"
fi

# Create deployment directory
print_status "Creating deployment directory..."
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

# Copy project files (assuming we're running from project root)
print_status "Setting up project files..."
if [ -f "../docker-compose.prod.yml" ]; then
    cp ../docker-compose.prod.yml ./docker-compose.yml
    print_status "Copied production docker-compose.yml"
elif [ -f "./docker-compose.prod.yml" ]; then
    cp ./docker-compose.prod.yml ./docker-compose.yml
    print_status "Copied production docker-compose.yml"
fi

if [ -f "../nginx.prod.conf" ]; then
    cp ../nginx.prod.conf ./nginx.prod.conf
    print_status "Copied production nginx.conf"
elif [ -f "./nginx.prod.conf" ]; then
    print_status "nginx.prod.conf already in place"
fi

# Copy all service directories
print_status "Copying service directories..."
for service in auth-service merchant-onboarding-service cashback-budget-service notification-service points-wallet-service referral-service social-features-service; do
    if [ -d "../$service" ]; then
        cp -r "../$service" ./
        print_status "Copied $service"
    fi
done

# Copy init script
if [ -f "../init-databases.sh" ]; then
    cp ../init-databases.sh ./
    chmod +x ./init-databases.sh
    print_status "Copied init-databases.sh"
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    print_warning "Creating .env file from template..."
    if [ -f "../.env.production.example" ]; then
        cp ../.env.production.example ./.env
        print_warning "Please edit .env file with your production values!"
    else
        # Create basic .env
        cat > .env << EOF
# Production Environment Variables
NODE_ENV=production

# Database
POSTGRES_DB=fluence_pay
POSTGRES_USER=fluence_user
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# JWT Secret (CHANGE THIS!)
JWT_SECRET=$(openssl rand -base64 64)

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
EOF
        print_warning ".env file created with generated passwords. Please review and update!"
    fi
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
print_status "Building Docker images..."
docker compose build --no-cache

print_status "Starting services..."
docker compose up -d

# Wait for services to be healthy
print_status "Waiting for services to start..."
sleep 15

# Get server port from environment or use default
SERVER_PORT=${SERVER_PORT:-5726}

# Check service health
print_status "Checking service health..."
for i in {1..30}; do
    if curl -f http://localhost:$SERVER_PORT/health > /dev/null 2>&1; then
        print_status "Services are healthy!"
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
echo ""
print_status "Deployment completed successfully!"

