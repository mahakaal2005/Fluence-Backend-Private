# PowerShell script to generate SSL certificates for Windows
# This creates self-signed certificates for testing/development
# For production, use Let's Encrypt (certbot) instead

# Create ssl directory if it doesn't exist
if (-not (Test-Path "ssl")) {
    New-Item -ItemType Directory -Path "ssl"
    Write-Host "Created ssl directory" -ForegroundColor Green
}

# Check if OpenSSL is available
$opensslPath = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $opensslPath) {
    Write-Host "OpenSSL not found. Please install OpenSSL:" -ForegroundColor Red
    Write-Host "1. Download from: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Yellow
    Write-Host "2. Or install via Chocolatey: choco install openssl" -ForegroundColor Yellow
    Write-Host "3. Or use Git Bash (includes OpenSSL)" -ForegroundColor Yellow
    exit 1
}

Write-Host "Generating SSL certificates..." -ForegroundColor Cyan

# Generate private key
Write-Host "Generating private key..." -ForegroundColor Yellow
& openssl genrsa -out ssl\key.pem 2048
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to generate private key" -ForegroundColor Red
    exit 1
}

# Generate certificate signing request
Write-Host "Generating certificate signing request..." -ForegroundColor Yellow
& openssl req -new -key ssl\key.pem -out ssl\cert.csr -subj "/C=US/ST=State/L=City/O=Organization/CN=161.248.37.235"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to generate CSR" -ForegroundColor Red
    exit 1
}

# Generate self-signed certificate (valid for 365 days)
Write-Host "Generating self-signed certificate..." -ForegroundColor Yellow
& openssl x509 -req -days 365 -in ssl\cert.csr -signkey ssl\key.pem -out ssl\cert.pem
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to generate certificate" -ForegroundColor Red
    exit 1
}

# Set proper permissions (Windows)
Write-Host "Setting file permissions..." -ForegroundColor Yellow
icacls ssl\key.pem /inheritance:r /grant:r "$env:USERNAME:(R)"
icacls ssl\cert.pem /inheritance:r /grant:r "$env:USERNAME:(R)"

# Clean up CSR file
Remove-Item ssl\cert.csr -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ SSL certificates generated successfully!" -ForegroundColor Green
Write-Host "📁 Certificates are in .\ssl\ directory" -ForegroundColor Cyan
Write-Host "⚠️  These are self-signed certificates for testing only" -ForegroundColor Yellow
Write-Host "🔒 For production, use Let's Encrypt (certbot) instead" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Start nginx: docker-compose up -d nginx" -ForegroundColor White
Write-Host "2. Test: curl -k https://161.248.37.235/health" -ForegroundColor White

