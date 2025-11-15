#!/bin/bash

echo "=== Checking Docker Services ==="
echo ""
echo "All services status:"
docker-compose ps

echo ""
echo "=== Testing Merchant Service Directly ==="
echo "Testing http://localhost:4003/health"
curl -s http://localhost:4003/health || echo "❌ Service not responding on port 4003"

echo ""
echo "=== Testing from Nginx Container ==="
echo "Testing http://merchant-onboarding-service:4003/health"
docker-compose exec -T nginx wget -q -O- http://merchant-onboarding-service:4003/health || echo "❌ Nginx can't reach merchant service"

echo ""
echo "=== Checking Merchant Service Logs ==="
docker-compose logs --tail=20 merchant-onboarding-service

echo ""
echo "=== Checking Nginx Error Logs ==="
docker-compose exec -T nginx tail -20 /var/log/nginx/error.log 2>/dev/null || echo "No error log found"







