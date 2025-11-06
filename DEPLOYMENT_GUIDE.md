# Fluence Backend - Deployment Guide

## Server Information
- **IP Address**: 161.248.37.235
- **Port**: 5726
- **OS**: Ubuntu 22.04
- **User**: root
- **Specs**: 4 vCore, 4GB RAM, 20GB SSD

## Prerequisites

Before deploying, ensure you have:
1. SSH access to the server
2. All environment variables ready (see `.env.production.example`)
3. Social media API keys configured (if using social features)

## Deployment Methods

### Method 1: Automated Deployment Script (Recommended)

#### Step 1: Transfer Files to Server

From your local machine, run:

```bash
# Create a deployment package
tar -czf fluence-backend.tar.gz \
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
  .env.production.example

# Transfer to server
scp fluence-backend.tar.gz root@161.248.37.235:/root/

# SSH into server
ssh root@161.248.37.235
```

#### Step 2: Extract and Deploy

On the server:

```bash
# Extract files
cd /root
tar -xzf fluence-backend.tar.gz

# Make deploy script executable
chmod +x deploy.sh

# Run deployment script
./deploy.sh
```

The script will:
- Install Docker and Docker Compose
- Set up firewall rules
- Create deployment directory
- Build and start all services
- Verify health checks

### Method 2: Manual Deployment

#### Step 1: Install Docker

```bash
# Update system
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt-get install -y docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

#### Step 2: Setup Project

```bash
# Create deployment directory
mkdir -p /opt/fluence-backend
cd /opt/fluence-backend

# Copy all service directories and files
# (Transfer from your local machine using scp or git)
```

#### Step 3: Configure Environment

```bash
# Copy environment template
cp .env.production.example .env

# Edit with your values
nano .env

# Important: Change these values:
# - POSTGRES_PASSWORD
# - JWT_SECRET
# - REDIS_PASSWORD
# - SMTP credentials
# - Social media API keys
```

#### Step 4: Start Services

```bash
# Build images
docker compose -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

#### Step 5: Configure Firewall

```bash
# Enable firewall
ufw enable

# Allow SSH
ufw allow 22/tcp

# Allow application port
ufw allow 5726/tcp

# Check status
ufw status
```

## Post-Deployment

### Verify Deployment

1. **Check Health Endpoint**:
   ```bash
   curl http://161.248.37.235:5726/health
   ```

2. **Check Service Logs**:
   ```bash
   cd /opt/fluence-backend
   docker compose logs -f
   ```

3. **Check Individual Services**:
   ```bash
   docker compose ps
   docker compose logs auth-service
   docker compose logs nginx
   ```

### Access URLs

- **API Gateway**: `http://161.248.37.235:5726`
- **Health Check**: `http://161.248.37.235:5726/health`
- **Auth Service**: `http://161.248.37.235:5726/api/auth/`
- **Merchant Service**: `http://161.248.37.235:5726/api/merchants/`
- **Cashback Service**: `http://161.248.37.235:5726/api/cashback/`
- **Notification Service**: `http://161.248.37.235:5726/api/notifications/`
- **Wallet Service**: `http://161.248.37.235:5726/api/wallet/`
- **Points Service**: `http://161.248.37.235:5726/api/points/`
- **Referral Service**: `http://161.248.37.235:5726/api/referral/`
- **Social Service**: `http://161.248.37.235:5726/api/social/`

## Management Commands

### View Logs
```bash
cd /opt/fluence-backend

# All services
docker compose logs -f

# Specific service
docker compose logs -f auth-service
docker compose logs -f nginx
```

### Restart Services
```bash
cd /opt/fluence-backend

# Restart all
docker compose restart

# Restart specific service
docker compose restart auth-service
```

### Stop Services
```bash
cd /opt/fluence-backend
docker compose down
```

### Update Services
```bash
cd /opt/fluence-backend

# Pull latest code (if using git)
git pull

# Rebuild and restart
docker compose build
docker compose up -d
```

### Backup Database
```bash
# Create backup
docker exec fluence-pay-postgres pg_dump -U fluence_user fluence_pay > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker exec -i fluence-pay-postgres psql -U fluence_user fluence_pay < backup_file.sql
```

## Troubleshooting

### Services Not Starting

1. **Check Docker**:
   ```bash
   systemctl status docker
   docker ps -a
   ```

2. **Check Logs**:
   ```bash
   docker compose logs
   ```

3. **Check Resources**:
   ```bash
   df -h  # Disk space
   free -h  # Memory
   ```

### Port Already in Use

```bash
# Check what's using the port
netstat -tulpn | grep 5726

# Kill process if needed
kill -9 <PID>
```

### Database Connection Issues

```bash
# Check database container
docker compose logs postgres

# Test connection
docker exec -it fluence-pay-postgres psql -U fluence_user -d fluence_pay
```

### Nginx Issues

```bash
# Check nginx logs
docker compose logs nginx

# Test nginx config
docker exec fluence-pay-nginx nginx -t

# Restart nginx
docker compose restart nginx
```

### Out of Memory

With 4GB RAM, monitor memory usage:

```bash
# Check memory
free -h
docker stats

# If needed, reduce worker connections in nginx.prod.conf
# Or limit container resources in docker-compose.prod.yml
```

## Security Recommendations

1. **Change Default Passwords**: Update all default passwords in `.env`
2. **Use Strong Secrets**: Generate strong JWT secrets and passwords
3. **Enable SSL**: Set up SSL certificates for HTTPS
4. **Regular Updates**: Keep system and Docker images updated
5. **Backup Strategy**: Set up regular database backups
6. **Monitor Logs**: Regularly check logs for suspicious activity
7. **Firewall Rules**: Only open necessary ports

## Monitoring

### Resource Monitoring

```bash
# System resources
htop

# Docker stats
docker stats

# Disk usage
df -h
du -sh /opt/fluence-backend
```

### Health Monitoring

Set up a monitoring script to check service health:

```bash
#!/bin/bash
# health-check.sh
curl -f http://localhost:5726/health || echo "Health check failed"
```

Add to crontab for regular checks:
```bash
crontab -e
# Add: */5 * * * * /opt/fluence-backend/health-check.sh
```

## Support

For issues:
1. Check logs: `docker compose logs`
2. Verify environment variables: `cat .env`
3. Check service status: `docker compose ps`
4. Review this guide for common issues

## Next Steps

After successful deployment:
1. Test all API endpoints
2. Configure SSL/HTTPS (recommended)
3. Set up monitoring and alerts
4. Configure automated backups
5. Update social media redirect URIs to production URLs

