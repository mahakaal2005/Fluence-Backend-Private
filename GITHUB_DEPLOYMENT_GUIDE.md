# GitHub Deployment Guide

This guide will help you deploy the Fluence Backend to your Ubuntu server using GitHub.

## Server Information
- **IP Address**: 161.248.37.235
- **Port**: 5726
- **OS**: Ubuntu 22.04
- **User**: root
- **Password**: df#Rit6%$714ljk

## Prerequisites

1. **GitHub Repository**: Your code must be pushed to a GitHub repository
2. **SSH Access**: You need SSH access to the server
3. **Repository URL**: The GitHub repository URL (HTTPS or SSH)

## Quick Deployment

### Step 1: Connect to Your Server

```bash
ssh root@161.248.37.235
# Password: df#Rit6%$714ljk
```

### Step 2: Download the Deployment Script

On the server, download the deployment script:

```bash
# Option 1: If you have the script in your GitHub repo, clone it first
# Option 2: Create the script directly on the server
cat > /root/deploy-from-github.sh << 'SCRIPT_END'
# (The script content will be here - you can copy it from the file)
SCRIPT_END

# Make it executable
chmod +x /root/deploy-from-github.sh
```

### Step 3: Run the Deployment

Replace `YOUR_GITHUB_REPO_URL` with your actual GitHub repository URL:

```bash
# For public repositories (HTTPS)
GITHUB_REPO=https://github.com/yourusername/your-repo.git ./deploy-from-github.sh

# For private repositories (HTTPS with token)
GITHUB_REPO=https://YOUR_TOKEN@github.com/yourusername/your-repo.git ./deploy-from-github.sh

# For SSH (requires SSH key setup)
GITHUB_REPO=git@github.com:yourusername/your-repo.git ./deploy-from-github.sh

# To use a specific branch
GITHUB_REPO=https://github.com/yourusername/your-repo.git GITHUB_BRANCH=develop ./deploy-from-github.sh
```

## Complete Deployment Process

### Method 1: One-Command Deployment (Recommended)

From your local machine, you can deploy directly:

```bash
# SSH into server and run deployment
ssh root@161.248.37.235 << 'ENDSSH'
# Download or create the deployment script
curl -o /root/deploy-from-github.sh https://raw.githubusercontent.com/yourusername/your-repo/main/deploy-from-github.sh
chmod +x /root/deploy-from-github.sh

# Run deployment
GITHUB_REPO=https://github.com/yourusername/your-repo.git /root/deploy-from-github.sh
ENDSSH
```

### Method 2: Manual Step-by-Step

#### 1. Connect to Server

```bash
ssh root@161.248.37.235
```

#### 2. Install Git (if not already installed)

```bash
apt-get update
apt-get install -y git
```

#### 3. Clone Repository

```bash
cd /opt
git clone https://github.com/yourusername/your-repo.git fluence-backend
cd fluence-backend
```

#### 4. Run Deployment Script

```bash
# Make script executable
chmod +x deploy-from-github.sh

# Run with your repository URL
GITHUB_REPO=https://github.com/yourusername/your-repo.git ./deploy-from-github.sh
```

## What the Script Does

The deployment script will:

1. ✅ Update system packages
2. ✅ Install Docker and Docker Compose
3. ✅ Clone/update code from GitHub
4. ✅ Verify required files exist
5. ✅ Create `.env` file from template
6. ✅ Configure firewall (ports 22, 5726, 80, 443)
7. ✅ Build Docker images
8. ✅ Start all services
9. ✅ Verify health checks

## After Deployment

### 1. Configure Environment Variables

Edit the `.env` file with your production values:

```bash
cd /opt/fluence-backend
nano .env
```

**Important values to update:**
- `POSTGRES_PASSWORD` - Strong database password
- `JWT_SECRET` - Generate with: `openssl rand -base64 64`
- `REDIS_PASSWORD` - Redis password
- `SMTP_*` - Email configuration
- Social media API keys (Instagram, Facebook, etc.)

### 2. Restart Services

After updating `.env`:

```bash
cd /opt/fluence-backend
docker compose down
docker compose up -d
```

### 3. Test Your API

```bash
# Health check
curl http://161.248.37.235:5726/health

# Should return JSON with service status
```

## Updating from GitHub

To update your deployment with latest code:

```bash
cd /opt/fluence-backend

# Pull latest changes
git pull origin main  # or your branch name

# Rebuild and restart
docker compose down
docker compose build
docker compose up -d
```

## Managing Services

### View Logs

```bash
cd /opt/fluence-backend

# All services
docker compose logs -f

# Specific service
docker compose logs -f auth-service
docker compose logs -f nginx
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

## Troubleshooting

### Repository Access Issues

**For Private Repositories:**

1. **Using Personal Access Token (HTTPS):**
   ```bash
   GITHUB_REPO=https://YOUR_TOKEN@github.com/username/repo.git ./deploy-from-github.sh
   ```

2. **Using SSH Key:**
   ```bash
   # First, add your SSH key to the server
   ssh-keygen -t ed25519 -C "deployment@server"
   cat ~/.ssh/id_ed25519.pub
   # Add this to your GitHub account (Settings > SSH and GPG keys)
   
   # Then use SSH URL
   GITHUB_REPO=git@github.com:username/repo.git ./deploy-from-github.sh
   ```

### Services Not Starting

```bash
# Check Docker status
systemctl status docker

# Check container logs
cd /opt/fluence-backend
docker compose logs

# Check system resources
free -h
df -h
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

## Security Recommendations

1. **Change Default Passwords**: Update all passwords in `.env` immediately
2. **Use Strong Secrets**: Generate strong JWT secrets
3. **Enable SSL**: Set up SSL certificates for HTTPS
4. **Regular Updates**: Keep system and Docker images updated
5. **Backup Strategy**: Set up regular database backups
6. **Monitor Logs**: Regularly check logs for suspicious activity
7. **Firewall Rules**: Only open necessary ports

## Backup and Restore

### Backup Database

```bash
# Create backup
docker exec fluence-pay-postgres pg_dump -U fluence_user fluence_pay > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker exec -i fluence-pay-postgres psql -U fluence_user fluence_pay < backup_file.sql
```

## Next Steps

After successful deployment:

1. ✅ Test all API endpoints
2. ✅ Configure environment variables
3. ✅ Set up SSL/HTTPS (recommended)
4. ✅ Configure monitoring and alerts
5. ✅ Set up automated backups
6. ✅ Update social media redirect URIs to production URLs

## Support

For issues:
1. Check logs: `docker compose logs`
2. Verify environment variables: `cat .env`
3. Check service status: `docker compose ps`
4. Review this guide for common issues

