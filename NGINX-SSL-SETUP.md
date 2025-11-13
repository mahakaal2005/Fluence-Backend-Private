# Nginx HTTPS Setup Guide for All Microservices

This guide explains how to set up nginx as a reverse proxy with HTTPS for all microservices, routing everything through a single port (443).

## Overview

All microservices are now accessible through **HTTPS on port 443** via nginx reverse proxy:
- **Single Entry Point**: `https://161.248.37.235` (or your domain)
- **HTTP Redirect**: Port 80 automatically redirects to HTTPS
- **All Services**: All 7 microservices accessible through the same port

## Service Routes via HTTPS

All services are accessible through HTTPS:

### Auth Service
- `https://161.248.37.235/api/auth/` - Authentication endpoints
- `https://161.248.37.235/api/guest/` - Guest endpoints
- `https://161.248.37.235/api/admin/auth/` - Admin auth endpoints

### Merchant Onboarding Service
- `https://161.248.37.235/api/applications/` - Merchant applications
- `https://161.248.37.235/api/profiles/` - Merchant profiles
- `https://161.248.37.235/api/merchant/auth/` - Merchant authentication
- `https://161.248.37.235/api/admin/merchants/` - Admin merchant endpoints

### Cashback & Budget Service
- `https://161.248.37.235/api/transactions/` - Transactions
- `https://161.248.37.235/api/disputes/` - Disputes
- `https://161.248.37.235/api/funds/` - Merchant funds
- `https://161.248.37.235/api/budgets/` - Budgets
- `https://161.248.37.235/api/campaigns/` - Campaigns
- `https://161.248.37.235/api/admin/analytics/` - Admin analytics

### Notification Service
- `https://161.248.37.235/api/notifications/` - Notifications
- `https://161.248.37.235/api/content/` - Content
- `https://161.248.37.235/api/admin/notifications/` - Admin notifications

### Points & Wallet Service
- `https://161.248.37.235/api/wallet/` - Wallet operations
- `https://161.248.37.235/api/points/` - Points operations

### Referral Service
- `https://161.248.37.235/api/referral/` - Referral operations

### Social Features Service
- `https://161.248.37.235/api/social/` - Social features
- `https://161.248.37.235/api/admin/social/` - Admin social endpoints

### Health Checks
- `https://161.248.37.235/health` - Default (auth service)
- `https://161.248.37.235/health/auth` - Auth service
- `https://161.248.37.235/health/merchant` - Merchant service
- `https://161.248.37.235/health/cashback` - Cashback service
- `https://161.248.37.235/health/notification` - Notification service
- `https://161.248.37.235/health/points` - Points service
- `https://161.248.37.235/health/referral` - Referral service
- `https://161.248.37.235/health/social` - Social service

---

## SSL Certificate Setup

### Option 1: Self-Signed Certificates (Development/Testing)

#### For Linux/Mac:
```bash
chmod +x generate-ssl.sh
./generate-ssl.sh
```

#### For Windows (PowerShell):
```powershell
# Create ssl directory
New-Item -ItemType Directory -Force -Path ssl

# Generate private key
openssl genrsa -out ssl\key.pem 2048

# Generate certificate
openssl req -new -x509 -key ssl\key.pem -out ssl\cert.pem -days 365 -subj "/C=US/ST=State/L=City/O=Organization/CN=161.248.37.235"
```

**Note**: Browsers will show a security warning for self-signed certificates. Click "Advanced" → "Proceed anyway" for testing.

### Option 2: Let's Encrypt (Production - Recommended)

#### Step 1: Install Certbot
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot

# Or use Docker
docker run -it --rm certbot/certbot --version
```

#### Step 2: Stop nginx temporarily
```bash
docker-compose stop nginx
```

#### Step 3: Generate Let's Encrypt certificate

**If you have a domain name:**
```bash
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

**If using IP only (not recommended, but possible):**
```bash
sudo certbot certonly --standalone -d 161.248.37.235
```

#### Step 4: Copy certificates
```bash
# Create ssl directory if it doesn't exist
mkdir -p ssl

# Copy certificates
sudo cp /etc/letsencrypt/live/161.248.37.235/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/161.248.37.235/privkey.pem ssl/key.pem

# Set permissions
sudo chmod 644 ssl/cert.pem
sudo chmod 600 ssl/key.pem
```

#### Step 5: Update nginx.conf server_name (if using domain)
Change `server_name 161.248.37.235;` to `server_name yourdomain.com;`

#### Step 6: Start nginx
```bash
docker-compose up -d nginx
```

#### Step 7: Set up auto-renewal
```bash
# Add to crontab (runs monthly)
sudo crontab -e

# Add this line:
0 0 1 * * certbot renew --quiet && docker-compose restart nginx
```

---

## Docker Setup

### 1. Ensure SSL certificates exist
```bash
# Check if certificates exist
ls -la ssl/

# Should see:
# cert.pem
# key.pem
```

### 2. Start all services with Docker
```bash
docker-compose up -d
```

### 3. Verify nginx is running
```bash
docker-compose ps nginx
docker-compose logs nginx
```

### 4. Test HTTPS connection
```bash
# Test from command line
curl -k https://161.248.37.235/health

# Or visit in browser
https://161.248.37.235
```

---

## Firewall Configuration

Make sure ports 80 and 443 are open:

### Ubuntu (UFW)
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### CentOS/RHEL (firewalld)
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### Windows Firewall
```powershell
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

---

## Testing the Setup

### 1. Test HTTP to HTTPS redirect
```bash
curl -I http://161.248.37.235
# Should return: HTTP/1.1 301 Moved Permanently
```

### 2. Test HTTPS connection
```bash
curl -k https://161.248.37.235/health
# Should return JSON with service status
```

### 3. Test individual services
```bash
# Auth service
curl -k https://161.248.37.235/api/auth/login

# Merchant service
curl -k https://161.248.37.235/health/merchant

# All services
curl -k https://161.248.37.235
```

### 4. Test from browser
Visit `https://161.248.37.235` in your browser. You should see:
```json
{
  "success": true,
  "message": "Fluence Pay API Gateway",
  "version": "1.0.0",
  "services": ["auth", "merchants", "cashback", "notifications", "wallet", "points", "referral", "social"]
}
```

---

## Troubleshooting

### Nginx won't start
```bash
# Check nginx logs
docker-compose logs nginx

# Check if SSL certificates exist
ls -la ssl/

# Verify certificate paths in nginx.conf
grep ssl_certificate nginx.conf
```

### Certificate errors
- **Self-signed**: This is normal, accept the warning in browser
- **Let's Encrypt**: Make sure port 80 is accessible for validation
- **Expired**: Renew certificates with `certbot renew`

### Port already in use
```bash
# Check what's using port 80/443
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443

# Stop conflicting services
sudo systemctl stop apache2  # if Apache is running
```

### Services not accessible
```bash
# Check if services are running
docker-compose ps

# Check service logs
docker-compose logs auth-service
docker-compose logs merchant-onboarding-service

# Test service directly (bypassing nginx)
curl http://localhost:4001/health
```

### 502 Bad Gateway
- Services might not be running
- Check docker-compose logs
- Verify service health endpoints work directly

### CORS errors
- Update CORS settings in individual services to allow your domain
- Check nginx is forwarding headers correctly

---

## Security Features

The nginx configuration includes:

1. **SSL/TLS**: TLS 1.2 and 1.3 only
2. **Security Headers**: HSTS, X-Frame-Options, CSP, etc.
3. **Rate Limiting**: Prevents abuse
4. **HTTP to HTTPS Redirect**: Forces secure connections
5. **Gzip Compression**: Reduces bandwidth usage
6. **Proxy Headers**: Properly forwards client information

---

## Production Checklist

- [ ] Use Let's Encrypt certificates (not self-signed)
- [ ] Set up certificate auto-renewal
- [ ] Configure proper domain name (not just IP)
- [ ] Update CORS settings in all services
- [ ] Enable firewall rules
- [ ] Set up monitoring and logging
- [ ] Configure backup SSL certificates
- [ ] Test all service endpoints
- [ ] Set up health check monitoring
- [ ] Review and adjust rate limits

---

## Additional Resources

- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [SSL Labs Test](https://www.ssllabs.com/ssltest/) - Test your SSL configuration

