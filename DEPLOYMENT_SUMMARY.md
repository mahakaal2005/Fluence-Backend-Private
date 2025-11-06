# Deployment Package Summary

## Files Created

I've created a complete deployment package for your Ubuntu 22 server. Here's what was created:

### 1. **deploy.sh** - Main Deployment Script
   - Automatically installs Docker and Docker Compose
   - Sets up firewall rules
   - Builds and starts all services
   - Configures everything for port 5726

### 2. **docker-compose.prod.yml** - Production Docker Compose
   - Production-ready configuration
   - All 7 microservices configured
   - PostgreSQL and Redis included
   - Nginx reverse proxy on port 5726
   - Health checks and auto-restart enabled

### 3. **nginx.prod.conf** - Production Nginx Configuration
   - Configured for port 5726
   - Rate limiting enabled
   - Security headers
   - All service routes configured

### 4. **remote-deploy.sh** - Remote Deployment Helper
   - Deploys from your local machine to the server
   - Packages and transfers files automatically

### 5. **DEPLOYMENT_GUIDE.md** - Complete Documentation
   - Detailed deployment instructions
   - Troubleshooting guide
   - Management commands
   - Security recommendations

### 6. **QUICK_DEPLOY.md** - Quick Start Guide
   - 3-step deployment process
   - Essential commands
   - Quick troubleshooting

### 7. **env-template.txt** - Environment Variables Template
   - All required environment variables
   - Ready to copy to .env file

## Quick Start

### Option 1: Automated (Recommended)

From your local machine:

```bash
# Make script executable (on Linux/Mac)
chmod +x remote-deploy.sh

# Run deployment
./remote-deploy.sh
```

### Option 2: Manual

1. **Transfer files to server:**
   ```bash
   tar -czf fluence-backend.tar.gz \
     auth-service merchant-onboarding-service cashback-budget-service \
     notification-service points-wallet-service referral-service \
     social-features-service docker-compose.prod.yml nginx.prod.conf \
     init-databases.sh deploy.sh env-template.txt
   
   scp fluence-backend.tar.gz root@161.248.37.235:/root/
   ```

2. **SSH into server:**
   ```bash
   ssh root@161.248.37.235
   # Password: df#Rit6%$714ljk
   ```

3. **Deploy:**
   ```bash
   cd /root
   tar -xzf fluence-backend.tar.gz
   chmod +x deploy.sh
   ./deploy.sh
   ```

## After Deployment

### 1. Configure Environment Variables

```bash
ssh root@161.248.37.235
cd /opt/fluence-backend
nano .env
```

**Important:** Change these values:
- `POSTGRES_PASSWORD` - Strong password
- `JWT_SECRET` - Generate with: `openssl rand -base64 64`
- `REDIS_PASSWORD` - Redis password
- Social media API keys (if using)

### 2. Restart Services

```bash
cd /opt/fluence-backend
docker compose down
docker compose up -d
```

### 3. Test Your API

```bash
curl http://161.248.37.235:5726/health
```

## Access URLs

- **API Gateway**: `http://161.248.37.235:5726`
- **Health Check**: `http://161.248.37.235:5726/health`
- **Auth**: `http://161.248.37.235:5726/api/auth/`
- **Social**: `http://161.248.37.235:5726/api/social/`
- **Merchants**: `http://161.248.37.235:5726/api/merchants/`
- **Cashback**: `http://161.248.37.235:5726/api/cashback/`
- **Notifications**: `http://161.248.37.235:5726/api/notifications/`
- **Wallet**: `http://161.248.37.235:5726/api/wallet/`
- **Points**: `http://161.248.37.235:5726/api/points/`
- **Referral**: `http://161.248.37.235:5726/api/referral/`

## Management Commands

```bash
# View logs
cd /opt/fluence-backend
docker compose logs -f

# Restart services
docker compose restart

# Stop services
docker compose down

# Check status
docker compose ps
```

## Server Specifications

Your server specs (4 vCore, 4GB RAM, 20GB SSD) are suitable for this deployment. The configuration is optimized for these resources.

## Next Steps

1. ✅ Deploy using one of the methods above
2. ✅ Configure environment variables
3. ✅ Test all API endpoints
4. ✅ Set up SSL/HTTPS (recommended)
5. ✅ Configure monitoring and backups
6. ✅ Update social media redirect URIs to production URLs

## Support

- See `DEPLOYMENT_GUIDE.md` for detailed documentation
- See `QUICK_DEPLOY.md` for quick reference
- Check logs: `docker compose logs`

## Important Notes

1. **Security**: Change all default passwords immediately after deployment
2. **Instagram Redirect URI**: Update to `http://161.248.37.235:5726/api/social/instagram/callback` in Meta Console
3. **Firewall**: Port 5726 is automatically opened by the deployment script
4. **Backups**: Set up regular database backups
5. **Monitoring**: Monitor resource usage (4GB RAM may need optimization for high traffic)

Good luck with your deployment! 🚀

