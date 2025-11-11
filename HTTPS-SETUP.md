# HTTPS Setup Guide

## Quick Setup (Self-Signed Certificates - For Testing)

1. **Generate SSL certificates:**
   ```bash
   chmod +x generate-ssl.sh
   ./generate-ssl.sh
   ```

2. **Restart nginx:**
   ```bash
   docker-compose restart nginx
   ```

3. **Access your services:**
   - HTTPS: `https://161.248.37.235`
   - HTTP will automatically redirect to HTTPS

⚠️ **Note:** Browsers will show a security warning for self-signed certificates. Click "Advanced" → "Proceed anyway" for testing.

---

## Production Setup (Let's Encrypt - Recommended)

For production, use Let's Encrypt to get trusted SSL certificates:

### Option 1: Using Certbot (Recommended)

1. **Install certbot on your server:**
   ```bash
   sudo apt update
   sudo apt install certbot
   ```

2. **Stop nginx temporarily:**
   ```bash
   docker-compose stop nginx
   ```

3. **Generate Let's Encrypt certificate:**
   ```bash
   sudo certbot certonly --standalone -d 161.248.37.235
   ```
   
   If you have a domain name pointing to this IP:
   ```bash
   sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
   ```

4. **Copy certificates to ssl directory:**
   ```bash
   sudo cp /etc/letsencrypt/live/161.248.37.235/fullchain.pem ssl/cert.pem
   sudo cp /etc/letsencrypt/live/161.248.37.235/privkey.pem ssl/key.pem
   sudo chmod 644 ssl/cert.pem
   sudo chmod 600 ssl/key.pem
   ```

5. **Update nginx.conf server_name** (if using domain):
   Change `server_name 161.248.37.235;` to `server_name yourdomain.com;`

6. **Start nginx:**
   ```bash
   docker-compose up -d nginx
   ```

7. **Set up auto-renewal:**
   ```bash
   # Add to crontab (runs monthly)
   sudo crontab -e
   # Add this line:
   0 0 1 * * certbot renew --quiet && docker-compose restart nginx
   ```

### Option 2: Using Certbot with Docker

1. **Run certbot in a container:**
   ```bash
   docker run -it --rm \
     -v $(pwd)/ssl:/etc/letsencrypt \
     -p 80:80 \
     certbot/certbot certonly --standalone -d 161.248.37.235
   ```

2. **Copy certificates:**
   ```bash
   cp ssl/live/161.248.37.235/fullchain.pem ssl/cert.pem
   cp ssl/live/161.248.37.235/privkey.pem ssl/key.pem
   ```

3. **Restart nginx:**
   ```bash
   docker-compose restart nginx
   ```

---

## Firewall Configuration

Make sure ports 80 and 443 are open:

```bash
# Ubuntu UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# Or if using iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
```

---

## Testing HTTPS

After setup, test your HTTPS connection:

```bash
# Test from command line
curl -k https://161.248.37.235/health

# Or visit in browser
https://161.248.37.235
```

---

## Service URLs via HTTPS

Once HTTPS is configured, access your services:

- Auth: `https://161.248.37.235/api/auth/`
- Merchants: `https://161.248.37.235/api/merchants/`
- Cashback: `https://161.248.37.235/api/cashback/`
- Notifications: `https://161.248.37.235/api/notifications/`
- Wallet: `https://161.248.37.235/api/wallet/`
- Points: `https://161.248.37.235/api/points/`
- Referral: `https://161.248.37.235/api/referral/`
- Social: `https://161.248.37.235/api/social/`

---

## Troubleshooting

**Nginx won't start:**
- Check if SSL certificates exist: `ls -la ssl/`
- Check nginx logs: `docker-compose logs nginx`
- Verify certificate paths in nginx.conf

**Certificate errors:**
- For self-signed: This is normal, accept the warning in browser
- For Let's Encrypt: Make sure port 80 is accessible for validation

**Port already in use:**
- Check what's using port 80/443: `sudo netstat -tulpn | grep :80`
- Stop conflicting services



