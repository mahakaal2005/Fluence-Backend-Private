# Direct Port Access vs Nginx Proxy

You can access services in two ways:

## Option 1: Direct Port Access (Current Setup)

Each service is accessible on its own port:

- **Auth Service**: `http://161.248.37.235:4001` or `https://161.248.37.235:4001`
- **Cashback Service**: `http://161.248.37.235:4002` or `https://161.248.37.235:4002`
- **Merchant Service**: `http://161.248.37.235:4003` or `https://161.248.37.235:4003`
- **Notification Service**: `http://161.248.37.235:4004` or `https://161.248.37.235:4004`
- **Points Service**: `http://161.248.37.235:4005` or `https://161.248.37.235:4005`
- **Referral Service**: `http://161.248.37.235:4006` or `https://161.248.37.235:4006`
- **Social Service**: `http://161.248.37.235:4007` or `https://161.248.37.235:4007`

**Current docker-compose.yml already exposes these ports!**

## Option 2: Nginx Proxy (Port 443)

All services accessible through single HTTPS port:

- **All Services**: `https://161.248.37.235/api/{service}/`

## Using Both (Recommended)

You can use **both methods simultaneously**:

1. **Direct ports** for development/testing
2. **Nginx on 443** for production/frontend

---

## Configuration

### Current Setup (Already Works)

Your `docker-compose.yml` already exposes individual ports:
- Ports 4001-4007 are mapped and accessible
- Nginx on 443 provides unified access

### To Add HTTPS to Individual Ports

If you want HTTPS on individual ports, you need to:

1. **Configure SSL in each service** (complex, not recommended)
2. **Use nginx for HTTPS** (recommended - already done)

---

## Access Examples

### Direct Port Access (HTTP)
```bash
# Auth service
curl http://161.248.37.235:4001/health
curl http://161.248.37.235:4001/api/auth/login

# Merchant service
curl http://161.248.37.235:4003/health
curl http://161.248.37.235:4003/api/applications

# Cashback service
curl http://161.248.37.235:4002/health
curl http://161.248.37.235:4002/api/transactions
```

### Via Nginx (HTTPS - Recommended)
```bash
# All services through port 443
curl -k https://161.248.37.235/api/auth/login
curl -k https://161.248.37.235/api/applications
curl -k https://161.248.37.235/api/transactions
```

---

## Firewall Configuration

If using direct ports, open them:

```bash
# Open individual service ports
sudo ufw allow 4001/tcp  # Auth
sudo ufw allow 4002/tcp  # Cashback
sudo ufw allow 4003/tcp  # Merchant
sudo ufw allow 4004/tcp  # Notification
sudo ufw allow 4005/tcp  # Points
sudo ufw allow 4006/tcp  # Referral
sudo ufw allow 4007/tcp  # Social

# Or open range
sudo ufw allow 4001:4007/tcp
```

---

## Recommendations

### For Development
- Use **direct ports** (4001-4007) - easier debugging
- HTTP is fine for local development

### For Production
- Use **nginx on port 443** - single entry point, HTTPS, better security
- Hide individual ports behind firewall
- Only expose port 443 publicly

---

## Security Best Practice

**Production setup:**
1. Expose only port 443 (nginx) publicly
2. Block direct access to 4001-4007 from internet
3. Keep services on internal Docker network
4. Use nginx as reverse proxy

**Firewall rules:**
```bash
# Allow only nginx port
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp

# Block direct service ports from external access
# (They're still accessible within Docker network)
```

---

## Current Status

✅ **Direct ports already work** - docker-compose.yml exposes them
✅ **Nginx proxy works** - routes all services through 443
✅ **Both can be used simultaneously**

You don't need to change anything - both methods work right now!






