# Environment Variables Example

This file shows example values for your `.env` file in `social-features-service/` directory.

## For Flutter App (Mobile)

```env
# ============================================
# Instagram OAuth Configuration
# ============================================

# Get these from Meta Developer Console:
# https://developers.facebook.com/apps/
# Go to: Your App → Settings → Basic
INSTAGRAM_APP_ID=1234567890123456
INSTAGRAM_APP_SECRET=abc123def456ghi789jkl012mno345pq

# Deep Link for Flutter App
# Format: your_app_scheme://instagram/callback
# Replace 'fluence' with your app's URL scheme
INSTAGRAM_REDIRECT_URI=fluence://instagram/callback

# FRONTEND_URL is NOT needed for Flutter apps
```

## For Web App (React/Vue/Angular)

```env
# ============================================
# Instagram OAuth Configuration
# ============================================

# Get these from Meta Developer Console:
# https://developers.facebook.com/apps/
# Go to: Your App → Settings → Basic
INSTAGRAM_APP_ID=1234567890123456
INSTAGRAM_APP_SECRET=abc123def456ghi789jkl012mno345pq

# OAuth Redirect URI (must match Meta Console exactly)
# For development:
INSTAGRAM_REDIRECT_URI=http://localhost:4007/api/social/instagram/callback
# For production:
# INSTAGRAM_REDIRECT_URI=https://api.yourdomain.com/api/social/instagram/callback

# Frontend URL (where users are redirected after OAuth)
# For development:
FRONTEND_URL=http://localhost:3000
# For production:
# FRONTEND_URL=https://yourdomain.com
```

## Complete Example with All Variables

```env
# ============================================
# Service Configuration
# ============================================
NODE_ENV=development
SOCIAL_FEATURES_PORT=4007

# ============================================
# Database Configuration
# ============================================
SOCIAL_DB_HOST=localhost
SOCIAL_DB_PORT=5432
SOCIAL_DB_NAME=postgres
SOCIAL_DB_USER=your_db_user
SOCIAL_DB_PASSWORD=your_db_password
SOCIAL_DB_SSL=false

# ============================================
# JWT Configuration
# ============================================
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=1d

# ============================================
# Instagram OAuth Configuration
# ============================================

# REQUIRED: Get from Meta Developer Console
# Step 1: Go to https://developers.facebook.com/
# Step 2: Select your app (or create one)
# Step 3: Go to Settings → Basic
# Step 4: Copy App ID and App Secret
INSTAGRAM_APP_ID=1234567890123456
INSTAGRAM_APP_SECRET=abc123def456ghi789jkl012mno345pq

# REQUIRED: OAuth Redirect URI
# For Flutter: Use deep link (e.g., fluence://instagram/callback)
# For Web: Use HTTP/HTTPS URL (e.g., http://localhost:4007/api/social/instagram/callback)
INSTAGRAM_REDIRECT_URI=fluence://instagram/callback

# OPTIONAL: API Version (defaults to v1 if not set)
INSTAGRAM_API_VERSION=v1

# REQUIRED for Web Apps Only (NOT needed for Flutter)
# FRONTEND_URL=http://localhost:3000

# ============================================
# Service URLs (if using other services)
# ============================================
AUTH_SERVICE_URL=http://localhost:4001
POINTS_SERVICE_URL=http://localhost:4005
REFERRAL_SERVICE_URL=http://localhost:4006
NOTIFICATION_SERVICE_URL=http://localhost:4004
```

## Where to Get Real Values

### 1. INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET

**Steps:**
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Log in with your Meta Developer account
3. Click **"My Apps"** → Select your app (or create a new one)
4. Go to **Settings** → **Basic**
5. You'll see:
   - **App ID**: Copy this value (e.g., `1234567890123456`)
   - **App Secret**: Click **"Show"** and copy (e.g., `abc123def456ghi789jkl012mno345pq`)

**Example:**
```
INSTAGRAM_APP_ID=1234567890123456
INSTAGRAM_APP_SECRET=abc123def456ghi789jkl012mno345pq
```

### 2. INSTAGRAM_REDIRECT_URI

**For Flutter App:**
- Use your app's custom URL scheme
- Format: `yourappscheme://instagram/callback`
- Example: `fluence://instagram/callback`
- Must match what you configure in Meta Developer Console

**For Web App:**
- Use your backend API URL
- Development: `http://localhost:4007/api/social/instagram/callback`
- Production: `https://api.yourdomain.com/api/social/instagram/callback`
- Must match exactly what's in Meta Developer Console

**Where to configure in Meta Console:**
1. Go to your app in Meta Developer Console
2. Go to **Settings** → **Basic**
3. Scroll to **"Valid OAuth Redirect URIs"**
4. Add your redirect URI (must match `.env` exactly)

### 3. FRONTEND_URL (Web Apps Only)

**For Web Apps:**
- Development: `http://localhost:3000` (or your frontend dev port)
- Production: `https://yourdomain.com`

**For Flutter Apps:**
- **NOT NEEDED** - Leave it out or comment it out

## Real-World Examples

### Example 1: Flutter App (Development)

```env
INSTAGRAM_APP_ID=9876543210987654
INSTAGRAM_APP_SECRET=xYz789AbC123DeF456GhI789JkL012MnO345Pq
INSTAGRAM_REDIRECT_URI=fluence://instagram/callback
```

### Example 2: Flutter App (Production)

```env
INSTAGRAM_APP_ID=9876543210987654
INSTAGRAM_APP_SECRET=xYz789AbC123DeF456GhI789JkL012MnO345Pq
INSTAGRAM_REDIRECT_URI=fluence://instagram/callback
```

### Example 3: Web App (Development)

```env
INSTAGRAM_APP_ID=9876543210987654
INSTAGRAM_APP_SECRET=xYz789AbC123DeF456GhI789JkL012MnO345Pq
INSTAGRAM_REDIRECT_URI=http://localhost:4007/api/social/instagram/callback
FRONTEND_URL=http://localhost:3000
```

### Example 4: Web App (Production)

```env
INSTAGRAM_APP_ID=9876543210987654
INSTAGRAM_APP_SECRET=xYz789AbC123DeF456GhI789JkL012MnO345Pq
INSTAGRAM_REDIRECT_URI=https://api.fluencepay.com/api/social/instagram/callback
FRONTEND_URL=https://fluencepay.com
```

## Important Notes

1. **Never commit `.env` to git**
   ```bash
   # Add to .gitignore
   echo ".env" >> .gitignore
   ```

2. **Use different values for dev/prod**
   - Development: Use test app credentials
   - Production: Use production app credentials

3. **Redirect URI must match exactly**
   - Check for: http vs https
   - Check for: port numbers
   - Check for: trailing slashes
   - Must match Meta Console settings

4. **App Secret is sensitive**
   - Keep it secret
   - Don't share it
   - Rotate if compromised

## Quick Setup Checklist

- [ ] Get App ID from Meta Developer Console
- [ ] Get App Secret from Meta Developer Console
- [ ] Choose redirect URI format:
  - [ ] Flutter: `yourapp://instagram/callback`
  - [ ] Web: `http://localhost:4007/api/social/instagram/callback`
- [ ] Add redirect URI to Meta Developer Console
- [ ] Add variables to `.env` file
- [ ] Restart your service
- [ ] Test the connection

## Verification

After setting up, verify your configuration:

```bash
# Check if variables are loaded
node -e "require('dotenv').config(); console.log('App ID:', process.env.INSTAGRAM_APP_ID ? '✓ Set' : '✗ Missing');"
```

Or test the endpoint:
```bash
curl -X POST http://localhost:4007/api/social/instagram/authorize \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"redirectUri": "fluence://instagram/callback"}'
```

