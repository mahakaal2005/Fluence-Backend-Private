# Quick GitHub Deployment Guide

## Server Details
- **IP**: 161.248.37.235
- **Port**: 5726
- **User**: root
- **Password**: df#Rit6%$714ljk

## Fastest Way to Deploy

### Option 1: From Your Local Machine (Easiest)

1. **Set your GitHub repository URL and run:**

```bash
# Make script executable
chmod +x deploy-to-server.sh

# Deploy (replace with your actual GitHub repo URL)
GITHUB_REPO=https://github.com/yourusername/your-repo.git ./deploy-to-server.sh
```

That's it! The script will:
- Connect to your server
- Install Docker and dependencies
- Clone your code from GitHub
- Deploy all services

### Option 2: Directly on Server

1. **SSH into your server:**
```bash
ssh root@161.248.37.235
# Password: df#Rit6%$714ljk
```

2. **Download the deployment script:**
```bash
# Option A: If script is in your repo, clone it first
git clone https://github.com/yourusername/your-repo.git /tmp/repo
cp /tmp/repo/deploy-from-github.sh /root/
chmod +x /root/deploy-from-github.sh

# Option B: Create it manually (copy content from deploy-from-github.sh)
```

3. **Run deployment:**
```bash
GITHUB_REPO=https://github.com/yourusername/your-repo.git /root/deploy-from-github.sh
```

## After Deployment

### 1. Test Your API
```bash
curl http://161.248.37.235:5726/health
```

### 2. Configure Environment Variables
```bash
ssh root@161.248.37.235
cd /opt/fluence-backend
nano .env
```

**Update these important values:**
- `POSTGRES_PASSWORD` - Strong password
- `JWT_SECRET` - Generate: `openssl rand -base64 64`
- `REDIS_PASSWORD` - Redis password
- Social media API keys

### 3. Restart Services
```bash
cd /opt/fluence-backend
docker compose down
docker compose up -d
```

## Updating Your Deployment

To update with latest code from GitHub:

```bash
ssh root@161.248.37.235
cd /opt/fluence-backend
git pull origin main
docker compose down
docker compose build
docker compose up -d
```

## Common Commands

```bash
# View logs
cd /opt/fluence-backend && docker compose logs -f

# Check status
cd /opt/fluence-backend && docker compose ps

# Restart services
cd /opt/fluence-backend && docker compose restart

# Stop services
cd /opt/fluence-backend && docker compose down
```

## Access URLs

- **API Gateway**: http://161.248.37.235:5726
- **Health Check**: http://161.248.37.235:5726/health
- **Auth**: http://161.248.37.235:5726/api/auth/
- **Social**: http://161.248.37.235:5726/api/social/
- **Merchants**: http://161.248.37.235:5726/api/merchants/
- **Cashback**: http://161.248.37.235:5726/api/cashback/
- **Notifications**: http://161.248.37.235:5726/api/notifications/
- **Wallet**: http://161.248.37.235:5726/api/wallet/
- **Points**: http://161.248.37.235:5726/api/points/
- **Referral**: http://161.248.37.235:5726/api/referral/

## Troubleshooting

### Private Repository Access

**Using Personal Access Token:**
```bash
GITHUB_REPO=https://YOUR_TOKEN@github.com/username/repo.git ./deploy-to-server.sh
```

**Using SSH:**
1. Add SSH key to server
2. Add public key to GitHub
3. Use SSH URL: `git@github.com:username/repo.git`

### Services Not Starting

```bash
# Check logs
cd /opt/fluence-backend
docker compose logs

# Check Docker
systemctl status docker
```

## Need Help?

See `GITHUB_DEPLOYMENT_GUIDE.md` for detailed documentation.

