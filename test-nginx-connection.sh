#!/bin/bash

echo "=== Testing Merchant Service Connectivity ==="
echo ""

echo "1. Testing merchant service directly (localhost):"
curl -s http://localhost:4003/health | jq . || curl -s http://localhost:4003/health
echo ""
echo ""

echo "2. Testing merchant service from nginx container:"
docker-compose exec -T nginx wget -q -O- http://merchant-onboarding-service:4003/health 2>&1
echo ""
echo ""

echo "3. Testing the actual endpoint:"
curl -s http://localhost:4003/api/merchant/auth/set-password -X POST -H "Content-Type: application/json" -d '{}' | head -c 200
echo ""
echo ""

echo "4. Checking nginx error log:"
docker-compose exec -T nginx tail -10 /var/log/nginx/error.log 2>/dev/null || echo "No error log"
echo ""

echo "5. Testing nginx config:"
docker-compose exec -T nginx nginx -t
echo ""






