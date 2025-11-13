# Ubuntu Setup Guide - Nginx HTTPS for All Microservices

## Quick Setup Steps

### 1. Generate SSL Certificates

```bash
# Create ssl directory
mkdir -p ssl

# Generate self-signed certificates (for testing)
openssl genrsa -out ssl/key.pem 2048
openssl req -new -x509 -key ssl/key.pem -out ssl/cert.pem -days 365 -subj "/CN=161.248.37.235"

# Set permissions
chmod 600 ssl/key.pem
chmod 644 ssl/cert.pem
```

**OR use the existing script:**
```bash
chmod +x generate-ssl.sh
./generate-ssl.sh
```

### 2. Start Services with Docker

```bash
# Start all services
docker-compose up -d

# Check nginx logs
docker-compose logs nginx

# Verify services are running
docker-compose ps
```

### 3. Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# Check firewall status
sudo ufw status
```

### 4. Test HTTPS

```bash
# Test health endpoint
curl -k https://161.248.37.235/health

# Test auth service
curl -k https://161.248.37.235/api/auth/login
```

---

## Production Setup (Let's Encrypt)

### 1. Install Certbot

```bash
sudo apt update
sudo apt install certbot -y
```

### 2. Stop nginx temporarily

```bash
docker-compose stop nginx
```

### 3. Generate Let's Encrypt certificate

```bash
# If you have a domain
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# If using IP only (not recommended)
sudo certbot certonly --standalone -d 161.248.37.235
```

### 4. Copy certificates

```bash
# Copy to ssl directory
sudo cp /etc/letsencrypt/live/161.248.37.235/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/161.248.37.235/privkey.pem ssl/key.pem

# Set permissions
sudo chmod 644 ssl/cert.pem
sudo chmod 600 ssl/key.pem
```

### 5. Update nginx.conf (if using domain)

Edit `nginx.conf` and change:
```nginx
server_name yourdomain.com;  # Instead of 161.248.37.235
```

### 6. Start nginx

```bash
docker-compose up -d nginx
```

### 7. Auto-renewal setup

```bash
# Add to crontab
sudo crontab -e

# Add this line (runs monthly)
0 0 1 * * certbot renew --quiet && docker-compose restart nginx
```

---

## Service URLs

All services accessible via HTTPS on port 443:

- **Auth**: `https://161.248.37.235/api/auth/`
- **Merchants**: `https://161.248.37.235/api/applications/`
- **Cashback**: `https://161.248.37.235/api/transactions/`
- **Notifications**: `https://161.248.37.235/api/notifications/`
- **Wallet**: `https://161.248.37.235/api/wallet/`
- **Points**: `https://161.248.37.235/api/points/`
- **Referral**: `https://161.248.37.235/api/referral/`
- **Social**: `https://161.248.37.235/api/social/`

---

## Troubleshooting

```bash
# Check nginx logs
docker-compose logs nginx

# Check if certificates exist
ls -la ssl/

# Test nginx config
docker-compose exec nginx nginx -t

# Restart nginx
docker-compose restart nginx

# Check if ports are open
sudo netstat -tulpn | grep :443
sudo netstat -tulpn | grep :80
```

---

## Quick Commands Reference

```bash
# Generate SSL (self-signed)
./generate-ssl.sh

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f nginx

# Restart nginx
docker-compose restart nginx

# Stop all services
docker-compose down

# Test HTTPS
curl -k https://161.248.37.235/health
```

