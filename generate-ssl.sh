#!/bin/bash

# Generate SSL certificates for HTTPS
# This creates self-signed certificates for testing/development
# For production, use Let's Encrypt (certbot) instead

# Create ssl directory if it doesn't exist
mkdir -p ssl

# Generate private key
openssl genrsa -out ssl/key.pem 2048

# Generate certificate signing request
openssl req -new -key ssl/key.pem -out ssl/cert.csr -subj "/C=US/ST=State/L=City/O=Organization/CN=161.248.37.235"

# Generate self-signed certificate (valid for 365 days)
openssl x509 -req -days 365 -in ssl/cert.csr -signkey ssl/key.pem -out ssl/cert.pem

# Set proper permissions
chmod 600 ssl/key.pem
chmod 644 ssl/cert.pem

# Clean up CSR file
rm ssl/cert.csr

echo "✅ SSL certificates generated successfully!"
echo "📁 Certificates are in ./ssl/ directory"
echo "⚠️  These are self-signed certificates for testing only"
echo "🔒 For production, use Let's Encrypt (certbot) instead"








