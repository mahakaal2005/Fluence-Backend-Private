# Complete Instagram Setup Guide - Step by Step

Follow these steps **in order** to set up Instagram integration properly.

## Prerequisites Checklist

Before starting, make sure you have:
- [ ] Meta Developer Account (you have this ✅)
- [ ] Instagram account (must be Business or Creator, not Personal)
- [ ] Access to Meta Developer Console

---

## PART 1: Meta Developer Console Setup

### Step 1: Create/Select Your App

1. Go to https://developers.facebook.com/
2. Click **"My Apps"** → **"Create App"** (or select existing app)
3. Choose **"Business"** as app type
4. Fill in:
   - **App Name**: Your app name
   - **App Contact Email**: Your email
5. Click **"Create App"**

### Step 2: Add Instagram Product

1. In your app dashboard, click **"Add Product"** (left sidebar)
2. Find **"Instagram"** → Click **"Set Up"**
3. You'll see two options:
   - **"Instagram API setup with Instagram login"** ← Choose this one ✅
   - "Instagram API setup with Facebook login" (skip this)
4. Click **"Set Up"** on "Instagram API setup with Instagram login"

### Step 3: Get Your Instagram App ID

1. After setup, go to **Instagram** → **"API setup with Instagram login"** (left sidebar)
2. You'll see:
   - **Instagram App ID**: Copy this number (e.g., `1234567890123456`)
   - **Instagram App Secret**: Click "Show" and copy this
3. **Important**: This is DIFFERENT from your Facebook App ID at the top of the page

### Step 4: Configure Redirect URI (IMPORTANT - Different Location!)

**The redirect URI is NOT in Basic Settings. It's in Instagram product settings:**

1. Go to **Instagram** → **"API setup with Instagram login"** (left sidebar)
2. Look for **"Redirect URIs"** or **"Valid OAuth Redirect URIs"** section
3. Click **"Add URI"** or **"Add Redirect URI"**
4. Enter: `http://localhost:4007/api/social/instagram/callback`
5. Click **"Save Changes"**

**Alternative Location (if not found above):**
- Go to **Instagram** → **"Settings"** (under Instagram product)
- Look for **"Valid OAuth Redirect URIs"** or **"Redirect URIs"**

### Step 4b: Configure App Domains (Optional - Skip if it doesn't work)

**Note:** Some apps don't allow `localhost` as domain. If you can't add it, **skip this step** - it's not always required for development.

1. Go to **Settings** → **Basic**
2. Scroll to **"App Domains"**
   - Try adding: `localhost` (if it allows)
   - Or skip this if it gives error

3. Scroll to **"Platforms"** section (optional)
   - Click **"Add Platform"**
   - Select **"Website"**
   - Site URL: `http://localhost:4007`
   - Click **"Save Changes"**

### Step 5: Add Test User

1. Go to **Roles** → **Roles** (left sidebar)
2. Click **"Add People"**
3. Enter your Instagram account username or email
4. Select role: **"Tester"** or **"Admin"**
5. Click **"Add"**
6. **Important**: Check your Instagram account - you need to accept the invitation

### Step 6: Verify Instagram Account Type

1. Open Instagram app on your phone
2. Go to **Settings** → **Account**
3. Check if it says **"Switch to Professional Account"**
   - If yes → Click it → Choose **Business** or **Creator**
   - If it says "Switch to Personal Account" → You're good ✅

---

## PART 2: Backend Configuration

### Step 7: Set Environment Variables

Create/edit `.env` file in `social-features-service/` directory:

```env
# Instagram OAuth Configuration
# Get these from: Instagram → API setup with Instagram login
INSTAGRAM_APP_ID=your_instagram_app_id_here
INSTAGRAM_APP_SECRET=your_instagram_app_secret_here

# Redirect URI (must match Meta Console exactly)
INSTAGRAM_REDIRECT_URI=http://localhost:4007/api/social/instagram/callback

# Optional
INSTAGRAM_API_VERSION=v1
```

**Where to get values:**
- `INSTAGRAM_APP_ID`: From Step 3 (Instagram App ID, NOT Facebook App ID)
- `INSTAGRAM_APP_SECRET`: From Step 3 (Instagram App Secret)
- `INSTAGRAM_REDIRECT_URI`: Must match exactly what you added in Step 4

### Step 8: Restart Your Service

```bash
# Stop your service (Ctrl+C)
# Then restart
npm run dev
# or
npm start
```

---

## PART 3: Testing

### Step 9: Test the Authorization Endpoint

**Using Postman or curl:**

```bash
POST http://localhost:4007/api/social/instagram/authorize
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
  Content-Type: application/json

Body:
{
  "redirectUri": "http://localhost:4007/api/social/instagram/callback"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://api.instagram.com/oauth/authorize?...",
    "redirectUri": "http://localhost:4007/api/social/instagram/callback",
    "method": "Instagram Graph API (Business Login - Default, NO Facebook required)"
  }
}
```

### Step 10: Complete OAuth Flow

1. Copy the `authUrl` from the response
2. Open it in your browser
3. You should see Instagram login page
4. Log in with your Instagram account (the one you added as tester)
5. Authorize the app
6. Instagram will redirect to: `http://localhost:4007/api/social/instagram/callback?code=...`
7. Backend automatically processes and connects the account

### Step 11: Verify Connection

```bash
GET http://localhost:4007/api/social/accounts
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
```

You should see your connected Instagram account.

---

## Troubleshooting

### Error: "Invalid platform app"

**Fix:**
- Make sure you selected "Instagram API setup with Instagram login" (not Facebook login)
- Verify you're using Instagram App ID (not Facebook App ID)
- Check that Instagram product is properly set up

### Error: "Invalid redirect_uri"

**Fix:**
- Check redirect URI matches EXACTLY in:
  - Meta Console → Settings → Basic → Valid OAuth Redirect URIs
  - Your `.env` file
- No trailing slashes
- Include `http://` and port number

### Error: "User not authorized"

**Fix:**
- Add your Instagram account as Tester in Meta Console
- Accept the invitation in your Instagram account
- Make sure Instagram account is Business/Creator type

### Error: "Error saving redirect URIs"

**Fix:**
1. Add `localhost` to App Domains first
2. Add Website platform with `http://localhost:4007`
3. Then add redirect URI

### Error: "Invalid OAuth 2.0 Access Token"

**Fix:**
- Make sure you're using Instagram App ID (not Facebook App ID)
- Verify token exchange endpoints are correct
- Check that scopes are properly requested

---

## Quick Reference

### Meta Console Locations

| What | Where |
|------|-------|
| Instagram App ID | Instagram → API setup with Instagram login |
| App Secret | Instagram → API setup with Instagram login → Show |
| Add Redirect URI | Settings → Basic → Valid OAuth Redirect URIs |
| Add Test User | Roles → Roles → Add People |
| App Domains | Settings → Basic → App Domains |

### Environment Variables

```env
INSTAGRAM_APP_ID=<from Instagram API setup>
INSTAGRAM_APP_SECRET=<from Instagram API setup>
INSTAGRAM_REDIRECT_URI=http://localhost:4007/api/social/instagram/callback
```

### API Endpoints

- **Authorize**: `POST /api/social/instagram/authorize`
- **Callback**: `GET /api/social/instagram/callback` (automatic)
- **List Accounts**: `GET /api/social/accounts`

---

## Still Stuck?

If you're still having issues, check:

1. **App ID**: Are you using Instagram App ID or Facebook App ID?
   - Should be from: Instagram → API setup with Instagram login

2. **Redirect URI**: Does it match exactly?
   - Meta Console: `http://localhost:4007/api/social/instagram/callback`
   - .env file: `http://localhost:4007/api/social/instagram/callback`

3. **Test User**: Is your Instagram account added as tester?
   - Check: Roles → Roles
   - Did you accept the invitation?

4. **Account Type**: Is Instagram account Business/Creator?
   - Check: Instagram App → Settings → Account

5. **Service Running**: Is your backend service running?
   - Check: `http://localhost:4007/health`

---

## Success Checklist

When everything is working, you should be able to:

- [ ] Call `/api/social/instagram/authorize` and get authUrl
- [ ] Open authUrl in browser and see Instagram login
- [ ] Log in and authorize successfully
- [ ] Get redirected to callback URL
- [ ] Account appears in `/api/social/accounts`

If all checked ✅, you're done!

