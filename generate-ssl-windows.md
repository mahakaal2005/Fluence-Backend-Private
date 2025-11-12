# Generate SSL Certificates on Windows

Since OpenSSL is not installed, here are several options:

## Option 1: Install OpenSSL (Recommended)

### Using Chocolatey (Easiest)
```powershell
# Install Chocolatey first (if not installed)
# Run PowerShell as Administrator
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install OpenSSL
choco install openssl -y
```

### Using Win64 OpenSSL (Manual)
1. Download from: https://slproweb.com/products/Win32OpenSSL.html
2. Download the "Win64 OpenSSL v3.x.x" installer
3. Install it (default location: `C:\Program Files\OpenSSL-Win64`)
4. Add to PATH:
   ```powershell
   # Add to system PATH (run as Administrator)
   [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\OpenSSL-Win64\bin", "Machine")
   ```
5. Restart PowerShell and try again

### Using Git Bash (If Git is installed)
If you have Git for Windows installed, it includes OpenSSL:
```powershell
# Use Git Bash instead
"C:\Program Files\Git\usr\bin\openssl.exe" genrsa -out ssl\key.pem 2048
"C:\Program Files\Git\usr\bin\openssl.exe" req -new -x509 -key ssl\key.pem -out ssl\cert.pem -days 365 -subj "/CN=161.248.37.235"
```

## Option 2: Use Docker to Generate Certificates

If you have Docker installed, you can use a container:

```powershell
# Create ssl directory
New-Item -ItemType Directory -Force -Path ssl

# Generate certificates using Docker
docker run --rm -v ${PWD}/ssl:/ssl alpine/openssl genrsa -out /ssl/key.pem 2048
docker run --rm -v ${PWD}/ssl:/ssl alpine/openssl req -new -x509 -key /ssl/key.pem -out /ssl/cert.pem -days 365 -subj "/CN=161.248.37.235"
```

## Option 3: Use PowerShell to Generate Self-Signed Certificate (Simplest)

This uses Windows built-in certificate tools:

```powershell
# Create ssl directory
New-Item -ItemType Directory -Force -Path ssl

# Generate self-signed certificate using PowerShell
$cert = New-SelfSignedCertificate -DnsName "161.248.37.235" -CertStoreLocation "Cert:\CurrentUser\My" -KeyExportPolicy Exportable -KeySpec Signature -KeyLength 2048 -KeyAlgorithm RSA -HashAlgorithm SHA256

# Export certificate to PEM format
$pwd = ConvertTo-SecureString -String "temp" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath ssl\temp.pfx -Password $pwd

# Convert PFX to PEM (requires OpenSSL or use online converter)
# OR use certutil to extract
certutil -encode ssl\temp.pfx ssl\cert.pem
```

## Option 4: Use Online Tools (Quick but Less Secure)

1. Go to: https://www.selfsignedcertificate.com/
2. Enter: `161.248.37.235`
3. Download certificate and key
4. Save as `ssl/cert.pem` and `ssl/key.pem`

## Option 5: Skip SSL for Local Development

For local testing, you can temporarily modify nginx.conf to use HTTP only:

```nginx
# Comment out SSL in nginx.conf temporarily
# listen 443 ssl http2;
listen 80;
```

Then access via: `http://localhost` (not recommended for production)

---

## Recommended: Quick Docker Method

If you have Docker, this is the fastest:

```powershell
# One-liner to generate both files
docker run --rm -v ${PWD}/ssl:/ssl alpine/openssl req -x509 -newkey rsa:2048 -keyout /ssl/key.pem -out /ssl/cert.pem -days 365 -nodes -subj "/CN=161.248.37.235"
```

This creates both `key.pem` and `cert.pem` in one command!

