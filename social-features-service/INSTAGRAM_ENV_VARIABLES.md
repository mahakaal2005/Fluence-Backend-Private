# Instagram Environment Variables Guide

This document lists all environment variables needed for Instagram integration.

## Required Variables for Instagram

### 1. `INSTAGRAM_APP_ID` ⚠️ **REQUIRED**
- **Description**: Your Instagram App ID from Meta Developer Console
- **Where to get it**: 
  1. Go to [Meta for Developers](https://developers.facebook.com/)
  2. Select your app
  3. Go to **Settings** → **Basic**
  4. Copy the **App ID**
- **Example**: `INSTAGRAM_APP_ID=1234567890123456`
- **Note**: This is the same as your Facebook App ID if using the same app

### 2. `INSTAGRAM_APP_SECRET` ⚠️ **REQUIRED**
- **Description**: Your Instagram App Secret from Meta Developer Console
- **Where to get it**:
  1. Go to [Meta for Developers](https://developers.facebook.com/)
  2. Select your app
  3. Go to **Settings** → **Basic**
  4. Click **Show** next to App Secret
  5. Copy the **App Secret**
- **Example**: `INSTAGRAM_APP_SECRET=abc123def456ghi789jkl012mno345pq`
- **Security**: Keep this secret! Never commit to version control

### 3. `INSTAGRAM_REDIRECT_URI` ⚠️ **REQUIRED**
- **Description**: The callback URL where Instagram redirects after authorization
- **Format**: Must match EXACTLY what's configured in Meta Developer Console
- **Development Example**: `INSTAGRAM_REDIRECT_URI=http://localhost:4007/api/social/instagram/callback`
- **Production Example**: `INSTAGRAM_REDIRECT_URI=https://yourdomain.com/api/social/instagram/callback`
- **Important**: 
  - Must include protocol (http:// or https://)
  - Must include port if not standard (80/443)
  - No trailing slash
  - Must match Meta Console settings exactly

### 4. `FRONTEND_URL` ⚠️ **REQUIRED for Web Apps Only**
- **Description**: Your frontend application URL for OAuth redirects
- **Purpose**: After Instagram authorization, users are redirected here (web apps only)
- **Development Example**: `FRONTEND_URL=http://localhost:3000`
- **Production Example**: `FRONTEND_URL=https://yourdomain.com`
- **Note**: 
  - **Required for web applications** (React, Vue, Angular, etc.)
  - **NOT required for Flutter/mobile apps** ✅
  - For Flutter apps, use deep links instead (see `INSTAGRAM_FLUTTER_SETUP.md`)

## Optional Variables

### 5. `INSTAGRAM_API_VERSION` (Optional)
- **Description**: Instagram API version to use
- **Default**: `v1` (if not set)
- **Example**: `INSTAGRAM_API_VERSION=v1`
- **Note**: Usually don't need to change this

## Complete .env Example

```env
# ============================================
# Instagram OAuth Configuration
# ============================================

# Required: Get from Meta Developer Console
INSTAGRAM_APP_ID=1234567890123456
INSTAGRAM_APP_SECRET=abc123def456ghi789jkl012mno345pq

# Optional: API Version
INSTAGRAM_API_VERSION=v1

# Required: OAuth Redirect URI
# Development:
INSTAGRAM_REDIRECT_URI=http://localhost:4007/api/social/instagram/callback
# Production:
# INSTAGRAM_REDIRECT_URI=https://yourdomain.com/api/social/instagram/callback

# Required: Frontend URL
# Development:
FRONTEND_URL=http://localhost:3000
# Production:
# FRONTEND_URL=https://yourdomain.com
```

## Quick Setup Checklist

- [ ] Get `INSTAGRAM_APP_ID` from Meta Developer Console
- [ ] Get `INSTAGRAM_APP_SECRET` from Meta Developer Console
- [ ] Set `INSTAGRAM_REDIRECT_URI` (must match Meta Console)
- [ ] Set `FRONTEND_URL` for your frontend app
- [ ] Add redirect URI to Meta Developer Console
- [ ] Test the connection

## Environment-Specific Examples

### Development (.env)
```env
INSTAGRAM_APP_ID=1234567890123456
INSTAGRAM_APP_SECRET=abc123def456ghi789jkl012mno345pq
INSTAGRAM_REDIRECT_URI=http://localhost:4007/api/social/instagram/callback
FRONTEND_URL=http://localhost:3000
```

### Production (.env.production)
```env
INSTAGRAM_APP_ID=1234567890123456
INSTAGRAM_APP_SECRET=abc123def456ghi789jkl012mno345pq
INSTAGRAM_REDIRECT_URI=https://api.yourdomain.com/api/social/instagram/callback
FRONTEND_URL=https://yourdomain.com
```

### Docker/Container (.env.docker)
```env
INSTAGRAM_APP_ID=1234567890123456
INSTAGRAM_APP_SECRET=abc123def456ghi789jkl012mno345pq
INSTAGRAM_REDIRECT_URI=http://social-service:4007/api/social/instagram/callback
FRONTEND_URL=https://yourdomain.com
```

## Common Mistakes to Avoid

1. ❌ **Wrong Redirect URI Format**
   - Wrong: `localhost:4007/api/social/instagram/callback` (missing protocol)
   - Wrong: `http://localhost:4007/api/social/instagram/callback/` (trailing slash)
   - ✅ Correct: `http://localhost:4007/api/social/instagram/callback`

2. ❌ **Mismatch with Meta Console**
   - The redirect URI in `.env` must match EXACTLY what's in Meta Developer Console
   - Check for: http vs https, port numbers, trailing slashes

3. ❌ **Exposing App Secret**
   - Never commit `.env` file to git
   - Add `.env` to `.gitignore`
   - Use environment variables in production (not hardcoded)

4. ❌ **Using Wrong App ID/Secret**
   - Make sure you're using the App ID/Secret from the correct app
   - Check that Instagram Basic Display is enabled in the app

## Verification

After setting up your `.env` file, verify the configuration:

```bash
# Check if variables are loaded (in Node.js)
node -e "require('dotenv').config(); console.log('App ID:', process.env.INSTAGRAM_APP_ID ? 'Set ✓' : 'Missing ✗');"
```

Or test the endpoint:
```bash
curl -X POST http://localhost:4007/api/social/instagram/authorize \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

If you get an error about missing configuration, check your `.env` file.

## Security Best Practices

1. **Never commit `.env` to version control**
   ```bash
   # Add to .gitignore
   echo ".env" >> .gitignore
   echo ".env.local" >> .gitignore
   echo ".env.*.local" >> .gitignore
   ```

2. **Use different values for development and production**
   - Development: Use test app credentials
   - Production: Use production app credentials

3. **Rotate secrets regularly**
   - Change App Secret if compromised
   - Update in Meta Console and `.env` file

4. **Use environment variable injection in production**
   - Docker: Use `-e` flag or `.env` file
   - Kubernetes: Use Secrets
   - Cloud platforms: Use their secret management

## Troubleshooting

### Error: "Instagram OAuth not configured"
- **Cause**: Missing `INSTAGRAM_APP_ID` or `INSTAGRAM_APP_SECRET`
- **Fix**: Add both variables to `.env` file

### Error: "Invalid redirect_uri"
- **Cause**: Redirect URI doesn't match Meta Console
- **Fix**: Check both places match exactly (including http/https, port, trailing slashes)

### Error: "App not found"
- **Cause**: Wrong App ID
- **Fix**: Verify App ID from Meta Developer Console

### Variables not loading
- **Cause**: `.env` file not in correct location or not being loaded
- **Fix**: 
  - Ensure `.env` is in `social-features-service/` directory
  - Restart the service after changing `.env`
  - Check that `dotenv` is configured in your app

