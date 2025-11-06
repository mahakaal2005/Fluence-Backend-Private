# Quick Fix: Can't Find Redirect URI Settings

## The Problem

You can't find "Valid OAuth Redirect URIs" in Basic Settings, and can't add `localhost` as domain.

## Solution: Redirect URI is in Instagram Settings

The redirect URI configuration is **NOT in Basic Settings**. It's in the **Instagram product settings**.

### Where to Find It:

1. **Go to Instagram Product Settings:**
   - Left sidebar → **Instagram** → **"API setup with Instagram login"**
   - OR
   - Left sidebar → **Instagram** → **"Settings"**

2. **Look for:**
   - "Redirect URIs"
   - "Valid OAuth Redirect URIs"
   - "OAuth Redirect URIs"
   - "Authorized Redirect URIs"

3. **Add your redirect URI:**
   - Click "Add URI" or "Add"
   - Enter: `http://localhost:4007/api/social/instagram/callback`
   - Save

## If You Still Can't Find It

### Option 1: Check Instagram Product Setup

1. Go to **Instagram** → **"API setup with Instagram login"**
2. Make sure the setup is **complete**
3. Look for any "Configure" or "Settings" button in that section
4. The redirect URI field should be there

### Option 2: Use ngrok (If localhost doesn't work)

If Meta doesn't accept `localhost`, use ngrok:

1. **Install ngrok:**
   ```bash
   # Download from https://ngrok.com/download
   # Or: npm install -g ngrok
   ```

2. **Start ngrok:**
   ```bash
   ngrok http 4007
   ```

3. **Copy the ngrok URL** (e.g., `https://abc123.ngrok.io`)

4. **Add to Meta Console:**
   - App Domains: `abc123.ngrok.io` (without https://)
   - Redirect URI: `https://abc123.ngrok.io/api/social/instagram/callback`

5. **Update your .env:**
   ```env
   INSTAGRAM_REDIRECT_URI=https://abc123.ngrok.io/api/social/instagram/callback
   ```

### Option 3: Skip Domain (Try Without It)

Some apps work without adding domain. Try:

1. **Skip App Domains** - Don't add anything
2. **Just add Redirect URI** in Instagram settings
3. **Test if it works**

## Exact Steps to Find Redirect URI

1. Open Meta Developer Console
2. Select your app
3. Left sidebar → Click **"Instagram"**
4. You should see:
   - "API setup with Instagram login" ← Click this
   - OR "Settings" ← Click this
5. Look for redirect URI field in that page

## Still Can't Find It?

**Screenshot locations to check:**

1. **Instagram → API setup with Instagram login**
   - Should show Instagram App ID
   - Should have redirect URI field below it

2. **Instagram → Settings**
   - Should have redirect URI configuration

3. **Settings → Basic**
   - Only if you're using Facebook Login (not Instagram Business Login)

## Quick Test

After adding redirect URI:

1. Check your `.env` file matches exactly
2. Restart your service
3. Try the OAuth flow

If it still doesn't work, the redirect URI might be configured differently for your app type. Share what you see in the Instagram product settings page.

