# Deployment Instructions - Ubuntu Server

## Server Information
- **IP Address**: 161.248.37.235
- **Port**: 5726
- **OS**: Ubuntu 22.04
- **User**: root
- **Password**: df#Rit6%$714ljk
- **Specs**: 4 vCore, 4GB RAM, 20GB SSD

## Quick Start (Choose One Method)

### Method 1: Deploy from Local Machine (Easiest)

**Prerequisites:**
- Your code must be in a GitHub repository
- You need `sshpass` installed (script will try to install it)

**Steps:**

1. **Make scripts executable:**
   ```bash
   chmod +x deploy-to-server.sh deploy-from-github.sh
   ```

2. **Run deployment (replace with your GitHub repo URL):**
   ```bash
   GITHUB_REPO=https://github.com/yourusername/your-repo.git ./deploy-to-server.sh
   ```

   **For private repositories:**
   ```bash
   # Using personal access token
   GITHUB_REPO=https://YOUR_TOKEN@github.com/yourusername/your-repo.git ./deploy-to-server.sh
   
   # Or using SSH (requires SSH key setup on server)
   GITHUB_REPO=git@github.com:yourusername/your-repo.git ./deploy-to-server.sh
   ```

3. **Wait for deployment to complete** (takes 5-10 minutes)

### Method 2: Deploy Directly on Server

1. **SSH into your server:**
   ```bash
   ssh root@161.248.37.235
   # Password: df#Rit6%$714ljk
   ```

2. **Download the deployment script:**
   
   **Option A: If script is in your GitHub repo:**
   ```bash
   git clone https://github.com/yourusername/your-repo.git /tmp/repo
   cp /tmp/repo/deploy-from-github.sh /root/
   chmod +x /root/deploy-from-github.sh
   ```
   
   **Option B: Create it manually:**
   ```bash
   # Copy the content of deploy-from-github.sh and create it on the server
   nano /root/deploy-from-github.sh
   # Paste the script content, save and exit
   chmod +x /root/deploy-from-github.sh
   ```

3. **Run deployment:**
   ```bash
   GITHUB_REPO=https://github.com/yourusername/your-repo.git /root/deploy-from-github.sh
   ```

## What Happens During Deployment

The deployment script will:

1. ✅ Update system packages
2. ✅ Install Docker and Docker Compose
3. ✅ Install Git (if not already installed)
4. ✅ Clone your code from GitHub to `/opt/fluence-backend`
5. ✅ Verify all required files exist
6. ✅ Create `.env` file from template
7. ✅ Configure firewall (ports 22, 5726, 80, 443)
8. ✅ Build Docker images for all services
9. ✅ Start all services
10. ✅ Verify health checks

**Expected time:** 5-10 minutes depending on your internet connection and server speed.

## After Deployment

### 1. Test Your API

```bash
# From your local machine
curl http://161.248.37.235:5726/health

# Should return JSON with service status
```

### 2. Configure Environment Variables

**SSH into server:**
```bash
ssh root@161.248.37.235
```

**Edit .env file:**
```bash
cd /opt/fluence-backend
nano .env
```

**Important values to update:**

```bash
# Database Password (generate strong password)
POSTGRES_PASSWORD=your_strong_password_here

# JWT Secret (generate with: openssl rand -base64 64)
JWT_SECRET=your_jwt_secret_here

# Redis Password
REDIS_PASSWORD=your_redis_password_here

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Social Media API Keys
INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret
INSTAGRAM_REDIRECT_URI=http://161.248.37.235:5726/api/social/instagram/callback

# Add other social media keys as needed
```

**Save and restart services:**
```bash
cd /opt/fluence-backend
docker compose down
docker compose up -d
```

### 3. Verify Services

```bash
# Check all services are running
cd /opt/fluence-backend
docker compose ps

# View logs
docker compose logs -f

# Test health endpoint
curl http://localhost:5726/health
```

## Access URLs

After deployment, your services will be available at:

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

## Updating Your Deployment

To update with latest code from GitHub:

```bash
ssh root@161.248.37.235
cd /opt/fluence-backend

# Pull latest changes
git pull origin main  # or your branch name

# Rebuild and restart
docker compose down
docker compose build
docker compose up -d
```

## Management Commands

### View Logs

```bash
cd /opt/fluence-backend

# All services
docker compose logs -f

# Specific service
docker compose logs -f auth-service
docker compose logs -f nginx
docker compose logs -f postgres
```

### Check Status

```bash
cd /opt/fluence-backend
docker compose ps
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

### Start Services

```bash
cd /opt/fluence-backend
docker compose up -d
```

## Troubleshooting

### Services Not Starting

```bash
# Check Docker status
systemctl status docker

# Check container logs
cd /opt/fluence-backend
docker compose logs

# Check system resources
free -h  # Memory
df -h    # Disk space
```

### Port Already in Use

```bash
# Check what's using port 5726
netstat -tulpn | grep 5726

# Kill process if needed
kill -9 <PID>
```

### Database Connection Issues

```bash
# Check database container
cd /opt/fluence-backend
docker compose logs postgres

# Test connection
docker exec -it fluence-pay-postgres psql -U fluence_user -d fluence_pay
```

### Repository Access Issues

**For Private Repositories:**

1. **Using Personal Access Token:**
   ```bash
   # Create token at: https://github.com/settings/tokens
   GITHUB_REPO=https://YOUR_TOKEN@github.com/username/repo.git ./deploy-to-server.sh
   ```

2. **Using SSH Key:**
   ```bash
   # On server, generate SSH key
   ssh-keygen -t ed25519 -C "deployment@server"
   cat ~/.ssh/id_ed25519.pub
   
   # Add public key to GitHub (Settings > SSH and GPG keys)
   # Then use SSH URL
   GITHUB_REPO=git@github.com:username/repo.git ./deploy-to-server.sh
   ```

### Out of Memory

With 4GB RAM, monitor memory usage:

```bash
# Check memory
free -h
docker stats

# If needed, restart services to free memory
cd /opt/fluence-backend
docker compose restart
```

## Backup and Restore

### Backup Database

```bash
# Create backup
cd /opt/fluence-backend
docker exec fluence-pay-postgres pg_dump -U fluence_user fluence_pay > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker exec -i fluence-pay-postgres psql -U fluence_user fluence_pay < backup_file.sql
```

## Security Recommendations

1. **Change Default Passwords**: Update all passwords in `.env` immediately after deployment
2. **Use Strong Secrets**: Generate strong JWT secrets with `openssl rand -base64 64`
3. **Enable SSL**: Set up SSL certificates for HTTPS (recommended for production)
4. **Regular Updates**: Keep system and Docker images updated
5. **Backup Strategy**: Set up regular database backups
6. **Monitor Logs**: Regularly check logs for suspicious activity
7. **Firewall Rules**: Only open necessary ports (already configured)

## Next Steps

After successful deployment:

1. ✅ Test all API endpoints
2. ✅ Configure environment variables (`.env` file)
3. ✅ Set up SSL/HTTPS (recommended)
4. ✅ Configure monitoring and alerts
5. ✅ Set up automated backups
6. ✅ Update social media redirect URIs in Meta Console to production URLs

## Support

For detailed documentation, see:
- `GITHUB_DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `QUICK_GITHUB_DEPLOY.md` - Quick reference
- `DEPLOYMENT_GUIDE.md` - Original deployment guide

For issues:
1. Check logs: `docker compose logs`
2. Verify environment variables: `cat .env`
3. Check service status: `docker compose ps`
4. Review troubleshooting section above

## Important Notes

1. **First Deployment**: The `.env` file is created with auto-generated passwords. **You must update it** with your production values.

2. **Instagram Redirect URI**: After deployment, update your Instagram redirect URI in Meta Console to:
   `http://161.248.37.235:5726/api/social/instagram/callback`

3. **Firewall**: Port 5726 is automatically opened by the deployment script.

4. **Resource Limits**: With 4GB RAM, monitor resource usage. The configuration is optimized for these specs.

5. **GitHub Repository**: Make sure your repository contains:
   - `docker-compose.prod.yml`
   - `nginx.prod.conf`
   - `init-databases.sh`
   - All service directories
   - `env-template.txt` (optional but recommended)

Good luck with your deployment! 🚀

