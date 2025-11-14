# Troubleshooting 502 Bad Gateway Error

## Issue
Getting `502 Bad Gateway` when accessing `https://161.248.37.235/api/merchant/auth/set-password`

## Common Causes

### 1. Service Not Running
The merchant-onboarding-service container might not be running.

**Check:**
```bash
# Check if service is running
docker-compose ps merchant-onboarding-service

# Check service logs
docker-compose logs merchant-onboarding-service

# Start the service if not running
docker-compose up -d merchant-onboarding-service
```

### 2. Service Not Accessible
The service might be running but nginx can't reach it.

**Check:**
```bash
# Test service directly (bypassing nginx)
curl http://localhost:4003/health
curl http://localhost:4003/api/merchant/auth/set-password

# Test from within Docker network
docker-compose exec nginx wget -O- http://merchant-onboarding-service:4003/health
```

### 3. Nginx Configuration Issue
The proxy_pass might be incorrect.

**Check nginx config:**
```bash
# Test nginx configuration
docker-compose exec nginx nginx -t

# Check nginx logs
docker-compose logs nginx

# Reload nginx
docker-compose restart nginx
```

### 4. Network Issues
Services might not be on the same Docker network.

**Check:**
```bash
# Verify services are on same network
docker network inspect fluence-backend-private_fluence-pay-network

# Check if merchant service is in network
docker-compose exec merchant-onboarding-service ping nginx
```

## Quick Fix Steps

### Step 1: Verify Service is Running
```bash
docker-compose ps
```

All services should show "Up" status.

### Step 2: Check Service Health
```bash
# Test merchant service directly
curl http://localhost:4003/health

# Should return JSON with service status
```

### Step 3: Check Nginx Can Reach Service
```bash
# From nginx container, test connection
docker-compose exec nginx wget -O- http://merchant-onboarding-service:4003/health
```

### Step 4: Restart Services
```bash
# Restart merchant service
docker-compose restart merchant-onboarding-service

# Restart nginx
docker-compose restart nginx

# Or restart all
docker-compose restart
```

### Step 5: Check Logs
```bash
# Merchant service logs
docker-compose logs -f merchant-onboarding-service

# Nginx logs
docker-compose logs -f nginx

# Look for errors like "connection refused" or "upstream timeout"
```

## Debugging Commands

```bash
# 1. Check all running containers
docker-compose ps

# 2. Check service logs
docker-compose logs merchant-onboarding-service | tail -50

# 3. Test service endpoint directly
curl -v http://localhost:4003/api/merchant/auth/set-password

# 4. Test from nginx container
docker-compose exec nginx curl http://merchant-onboarding-service:4003/health

# 5. Check nginx error logs
docker-compose exec nginx cat /var/log/nginx/error.log | tail -20

# 6. Verify docker network
docker network ls
docker network inspect fluence-backend-private_fluence-pay-network
```

## Common Solutions

### Solution 1: Service Not Started
```bash
docker-compose up -d merchant-onboarding-service
docker-compose restart nginx
```

### Solution 2: Port Conflict
```bash
# Check if port 4003 is already in use
sudo netstat -tulpn | grep 4003

# If in use, stop conflicting service or change port in docker-compose.yml
```

### Solution 3: Network Issue
```bash
# Recreate network
docker-compose down
docker-compose up -d
```

### Solution 4: Nginx Config Error
```bash
# Test config
docker-compose exec nginx nginx -t

# If error, fix nginx.conf and restart
docker-compose restart nginx
```

## Expected Behavior

### Working Setup:
```bash
# Direct service access (should work)
curl http://localhost:4003/health
# Returns: {"success":true,"service":"merchant-onboarding-service",...}

# Via nginx (should work)
curl -k https://161.248.37.235/api/merchant/auth/set-password
# Returns: Service response or validation error (not 502)
```

## If Still Not Working

1. **Check docker-compose.yml** - Ensure merchant service is defined correctly
2. **Check service dependencies** - Merchant service might depend on auth-service
3. **Check environment variables** - Service might be failing to start
4. **Check database connection** - Service might be waiting for DB
5. **Full restart**:
   ```bash
   docker-compose down
   docker-compose up -d
   ```




