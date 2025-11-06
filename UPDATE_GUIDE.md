# Code Update Guide

This guide explains how to update your deployed application when you make code changes.

## Quick Update Process

### Method 1: Automated Update (Recommended)

Create an update script that handles everything:

```bash
# On your local machine - create update package
tar -czf update.tar.gz \
  auth-service merchant-onboarding-service cashback-budget-service \
  notification-service points-wallet-service referral-service \
  social-features-service docker-compose.prod.yml nginx.prod.conf

# Transfer to server
scp update.tar.gz root@161.248.37.235:/root/

# SSH and update
ssh root@161.248.37.235
cd /opt/fluence-backend
tar -xzf /root/update.tar.gz
docker compose build
docker compose up -d
```

### Method 2: Manual Update Steps

#### Step 1: Transfer Updated Code

```bash
# From your local machine, package updated services
tar -czf code-update.tar.gz \
  auth-service merchant-onboarding-service cashback-budget-service \
  notification-service points-wallet-service referral-service \
  social-features-service

# Transfer to server
scp code-update.tar.gz root@161.248.37.235:/root/
```

#### Step 2: Update on Server

```bash
# SSH into server
ssh root@161.248.37.235

# Go to deployment directory
cd /opt/fluence-backend

# Backup current deployment (optional but recommended)
cp -r auth-service auth-service.backup
# Repeat for other services if needed

# Extract updated code
tar -xzf /root/code-update.tar.gz

# Rebuild affected services
docker compose build auth-service
# Or rebuild all services
docker compose build

# Restart services (zero-downtime with health checks)
docker compose up -d

# Verify services are running
docker compose ps
```

## Update Strategies

### 1. Update Single Service

If you only changed one service:

```bash
cd /opt/fluence-backend

# Rebuild specific service
docker compose build auth-service

# Restart only that service
docker compose up -d auth-service

# Check logs
docker compose logs -f auth-service
```

### 2. Update Multiple Services

```bash
cd /opt/fluence-backend

# Rebuild specific services
docker compose build auth-service social-features-service

# Restart them
docker compose up -d auth-service social-features-service
```

### 3. Update All Services

```bash
cd /opt/fluence-backend

# Rebuild all
docker compose build

# Restart all
docker compose up -d

# Verify
docker compose ps
curl http://localhost:5726/health
```

## Zero-Downtime Updates

For production, use rolling updates:

```bash
cd /opt/fluence-backend

# 1. Build new images
docker compose build

# 2. Start new containers (they'll wait for old ones to stop)
docker compose up -d --no-deps --build auth-service

# 3. Wait for health check
sleep 10

# 4. Restart the service
docker compose restart auth-service

# 5. Repeat for other services
```

## Using Git (If Repository is on Server)

If you have git set up on the server:

```bash
cd /opt/fluence-backend

# Pull latest changes
git pull origin main  # or your branch name

# Rebuild and restart
docker compose build
docker compose up -d
```

## Update Script

Create `update.sh` on the server for easy updates:

```bash
#!/bin/bash
# Save as /opt/fluence-backend/update.sh

set -e

DEPLOY_DIR="/opt/fluence-backend"
cd $DEPLOY_DIR

echo "Starting update process..."

# Backup current deployment
echo "Creating backup..."
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR
cp -r auth-service merchant-onboarding-service cashback-budget-service \
  notification-service points-wallet-service referral-service \
  social-features-service $BACKUP_DIR/ 2>/dev/null || true

# Extract new code (if transferred)
if [ -f "/root/update.tar.gz" ]; then
    echo "Extracting update package..."
    tar -xzf /root/update.tar.gz
fi

# Rebuild services
echo "Rebuilding services..."
docker compose build

# Restart services
echo "Restarting services..."
docker compose up -d

# Wait for health check
echo "Waiting for services to be healthy..."
sleep 15

# Check health
if curl -f http://localhost:5726/health > /dev/null 2>&1; then
    echo "✓ Update successful! Services are healthy."
else
    echo "⚠ Warning: Health check failed. Check logs: docker compose logs"
fi

echo "Update complete!"
```

Make it executable:
```bash
chmod +x /opt/fluence-backend/update.sh
```

Then use it:
```bash
/opt/fluence-backend/update.sh
```

## Database Migrations

If your update includes database changes:

```bash
cd /opt/fluence-backend

# 1. Backup database first!
docker exec fluence-pay-postgres pg_dump -U fluence_user fluence_pay > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Run migration scripts (if any)
# Example for auth-service:
docker exec fluence-pay-auth node migrate.js
# Or run SQL directly:
docker exec -i fluence-pay-postgres psql -U fluence_user -d auth_service < sql/migration.sql
```

## Rollback Procedure

If something goes wrong:

### Quick Rollback

```bash
cd /opt/fluence-backend

# Stop current services
docker compose down

# Restore from backup
rm -rf auth-service
cp -r backup_YYYYMMDD_HHMMSS/auth-service ./
# Repeat for other services

# Rebuild and restart
docker compose build
docker compose up -d
```

### Rollback Using Previous Docker Images

```bash
cd /opt/fluence-backend

# List previous images
docker images | grep fluence-pay

# Use previous image (if available)
docker compose down
docker compose up -d --force-recreate
```

## Best Practices

### 1. Always Backup Before Updates

```bash
# Backup code
cd /opt/fluence-backend
tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  auth-service merchant-onboarding-service cashback-budget-service \
  notification-service points-wallet-service referral-service \
  social-features-service

# Backup database
docker exec fluence-pay-postgres pg_dump -U fluence_user fluence_pay > db_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Test Updates in Staging First

If possible, test updates on a staging server before production.

### 3. Update During Low Traffic

Schedule updates during low-traffic periods if possible.

### 4. Monitor After Updates

```bash
# Watch logs after update
docker compose logs -f

# Monitor resource usage
docker stats

# Check health endpoints
curl http://localhost:5726/health
```

### 5. Keep Environment Variables Separate

Don't overwrite your `.env` file during updates:

```bash
# Make .env read-only to prevent accidental overwrites
chmod 400 /opt/fluence-backend/.env
```

## Update Checklist

- [ ] Backup current code
- [ ] Backup database (if schema changes)
- [ ] Transfer updated code to server
- [ ] Rebuild Docker images
- [ ] Restart services
- [ ] Verify health checks
- [ ] Test critical endpoints
- [ ] Monitor logs for errors
- [ ] Check resource usage

## Common Update Scenarios

### Scenario 1: Bug Fix in Auth Service

```bash
cd /opt/fluence-backend

# Transfer only auth-service
scp -r auth-service root@161.248.37.235:/opt/fluence-backend/

# On server:
docker compose build auth-service
docker compose up -d auth-service
docker compose logs -f auth-service
```

### Scenario 2: New Feature in Social Service

```bash
cd /opt/fluence-backend

# Update social-features-service
scp -r social-features-service root@161.248.37.235:/opt/fluence-backend/

# On server:
docker compose build social-features-service
docker compose up -d social-features-service

# Update nginx if routes changed
scp nginx.prod.conf root@161.248.37.235:/opt/fluence-backend/
docker compose restart nginx
```

### Scenario 3: Environment Variable Changes

```bash
cd /opt/fluence-backend

# Edit .env file
nano .env

# Restart affected services
docker compose restart
```

### Scenario 4: Configuration File Changes

```bash
cd /opt/fluence-backend

# Update nginx config
scp nginx.prod.conf root@161.248.37.235:/opt/fluence-backend/

# On server:
docker compose restart nginx

# Update docker-compose
scp docker-compose.prod.yml root@161.248.37.235:/opt/fluence-backend/
docker compose down
docker compose up -d
```

## Troubleshooting Updates

### Services Won't Start After Update

```bash
# Check logs
docker compose logs

# Check for build errors
docker compose build --no-cache

# Verify environment variables
cat .env

# Check disk space
df -h
```

### Health Check Failing

```bash
# Check individual service health
docker compose ps
docker compose logs auth-service

# Test service directly
docker exec fluence-pay-auth curl http://localhost:3000/health
```

### Rollback Needed

```bash
# Quick rollback to previous version
cd /opt/fluence-backend
docker compose down
# Restore from backup or use git
git checkout HEAD~1  # if using git
docker compose build
docker compose up -d
```

## Automated Update Script

Save this as `auto-update.sh` on your local machine:

```bash
#!/bin/bash
# Auto-update script for local machine

SERVER="root@161.248.37.235"
DEPLOY_DIR="/opt/fluence-backend"

echo "Packaging updates..."
tar -czf update.tar.gz \
  auth-service merchant-onboarding-service cashback-budget-service \
  notification-service points-wallet-service referral-service \
  social-features-service docker-compose.prod.yml nginx.prod.conf

echo "Transferring to server..."
scp update.tar.gz $SERVER:/root/

echo "Updating on server..."
ssh $SERVER << 'ENDSSH'
    cd /opt/fluence-backend
    tar -xzf /root/update.tar.gz
    docker compose build
    docker compose up -d
    sleep 10
    curl -f http://localhost:5726/health && echo "✓ Update successful!" || echo "⚠ Health check failed"
ENDSSH

echo "Update complete!"
```

Make executable and use:
```bash
chmod +x auto-update.sh
./auto-update.sh
```

## Summary

**Quick Update Command:**
```bash
# On server
cd /opt/fluence-backend
docker compose build && docker compose up -d
```

**Safe Update Process:**
1. Backup current code and database
2. Transfer updated code
3. Rebuild Docker images
4. Restart services
5. Verify health checks
6. Monitor logs

For detailed deployment info, see `DEPLOYMENT_GUIDE.md`.

