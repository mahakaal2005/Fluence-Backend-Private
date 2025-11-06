# Quick Deployment Guide

## Server Details
- **IP**: 161.248.37.235
- **Port**: 5726
- **User**: root
- **Password**: df#Rit6%$714ljk

## Quick Start (3 Steps)

### Option 1: Automated Remote Deployment

From your local machine (in project root):

```bash
# Make script executable
chmod +x remote-deploy.sh

# Run deployment
./remote-deploy.sh
```

This will:
1. Package all files
2. Transfer to server
3. Run deployment automatically

### Option 2: Manual Deployment

#### Step 1: Connect to Server
```bash
ssh root@161.248.37.235
# Password: df#Rit6%$714ljk
```

#### Step 2: Transfer Files
From your local machine:
```bash
# Create package
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
  deploy.sh

# Transfer
scp fluence-backend.tar.gz root@161.248.37.235:/root/
```

#### Step 3: Deploy on Server
On the server:
```bash
cd /root
tar -xzf fluence-backend.tar.gz
chmod +x deploy.sh
./deploy.sh
```

## After Deployment

### Test Your API
```bash
curl http://161.248.37.235:5726/health
```

### View Logs
```bash
ssh root@161.248.37.235
cd /opt/fluence-backend
docker compose logs -f
```

### Stop Services
```bash
cd /opt/fluence-backend
docker compose down
```

### Restart Services
```bash
cd /opt/fluence-backend
docker compose restart
```

## Important: Configure Environment Variables

After first deployment, edit the `.env` file:

```bash
ssh root@161.248.37.235
cd /opt/fluence-backend
nano .env
```

**Must change:**
- `POSTGRES_PASSWORD` - Strong database password
- `JWT_SECRET` - Generate with: `openssl rand -base64 64`
- `REDIS_PASSWORD` - Redis password
- Social media API keys (if using)

Then restart:
```bash
docker compose down
docker compose up -d
```

## Access Your API

- **Base URL**: `http://161.248.37.235:5726`
- **Health**: `http://161.248.37.235:5726/health`
- **Auth**: `http://161.248.37.235:5726/api/auth/`
- **Social**: `http://161.248.37.235:5726/api/social/`

## Troubleshooting

### Can't connect?
```bash
# Check if services are running
docker ps

# Check logs
docker compose logs
```

### Port already in use?
```bash
# Find what's using port 5726
netstat -tulpn | grep 5726
```

### Out of memory?
```bash
# Check memory
free -h
docker stats
```

## Full Documentation

See `DEPLOYMENT_GUIDE.md` for complete documentation.

