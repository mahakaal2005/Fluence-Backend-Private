# PowerShell script to generate SSL certificates using Docker
# This is the easiest method if you have Docker installed

Write-Host "Generating SSL certificates using Docker..." -ForegroundColor Cyan

# Check if Docker is available
$dockerPath = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerPath) {
    Write-Host "Docker not found. Please install Docker Desktop:" -ForegroundColor Red
    Write-Host "https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternative: Install OpenSSL or use Git Bash" -ForegroundColor Yellow
    exit 1
}

# Create ssl directory if it doesn't exist
if (-not (Test-Path "ssl")) {
    New-Item -ItemType Directory -Path "ssl"
    Write-Host "Created ssl directory" -ForegroundColor Green
}

Write-Host "Generating private key and certificate..." -ForegroundColor Yellow

# Generate both key and certificate in one command
docker run --rm -v "${PWD}/ssl:/ssl" alpine/openssl req -x509 -newkey rsa:2048 -keyout /ssl/key.pem -out /ssl/cert.pem -days 365 -nodes -subj "/CN=161.248.37.235"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to generate certificates" -ForegroundColor Red
    exit 1
}

# Verify files were created
if ((Test-Path "ssl\key.pem") -and (Test-Path "ssl\cert.pem")) {
    Write-Host ""
    Write-Host "✅ SSL certificates generated successfully!" -ForegroundColor Green
    Write-Host "📁 Certificates are in .\ssl\ directory" -ForegroundColor Cyan
    Write-Host "⚠️  These are self-signed certificates for testing only" -ForegroundColor Yellow
    Write-Host "🔒 For production, use Let's Encrypt (certbot) instead" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Start nginx: docker-compose up -d nginx" -ForegroundColor White
    Write-Host "2. Test: curl -k https://161.248.37.235/health" -ForegroundColor White
} else {
    Write-Host "❌ Certificate files not found. Something went wrong." -ForegroundColor Red
    exit 1
}

