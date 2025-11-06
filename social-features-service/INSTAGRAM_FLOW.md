# Instagram Integration Flow

This document explains the complete flow of Instagram account connection using Instagram Basic Display API (direct Instagram login).

## Overview

The flow allows users to connect their Instagram Business/Creator accounts to your app by logging in directly with Instagram credentials (no Facebook required).

## Complete Flow Diagram

```
┌─────────────┐
│   User      │
│  (Frontend) │
└──────┬──────┘
       │
       │ 1. User clicks "Connect Instagram"
       │
       ▼
┌─────────────────────────────────────┐
│  Frontend calls:                    │
│  POST /api/social/instagram/        │
│       authorize                     │
│  Headers: Authorization: Bearer JWT │
└──────┬──────────────────────────────┘
       │
       │ 2. Backend generates OAuth URL
       │
       ▼
┌─────────────────────────────────────┐
│  Backend Response:                  │
│  {                                  │
│    authUrl: "https://api.instagram. │
│              com/oauth/authorize?.."│
│    redirectUri: "...",              │
│    state: "base64_encoded_state"   │
│  }                                  │
└──────┬──────────────────────────────┘
       │
       │ 3. Frontend redirects user to authUrl
       │
       ▼
┌─────────────────────────────────────┐
│  Instagram OAuth Page              │
│  (User sees Instagram login)       │
│  - User enters Instagram username │
│  - User enters Instagram password │
│  - User clicks "Authorize"         │
└──────┬──────────────────────────────┘
       │
       │ 4. User authorizes app
       │
       ▼
┌─────────────────────────────────────┐
│  Instagram redirects to:           │
│  /api/social/instagram/callback?   │
│  code=AUTHORIZATION_CODE&          │
│  state=ENCODED_STATE               │
└──────┬──────────────────────────────┘
       │
       │ 5. Backend receives callback
       │
       ▼
┌─────────────────────────────────────┐
│  Backend Processing:                │
│  1. Extract code and state          │
│  2. Exchange code for short-lived  │
│     token                           │
│  3. Exchange for long-lived token   │
│  4. Get Instagram profile           │
│  5. Save to database                │
└──────┬──────────────────────────────┘
       │
       │ 6. Redirect to frontend
       │
       ▼
┌─────────────────────────────────────┐
│  Frontend Success Page              │
│  /social/instagram/success?        │
│  accountId=UUID                     │
└─────────────────────────────────────┘
```

## Step-by-Step Flow

### Step 1: User Initiates Connection

**Frontend Action:**
```javascript
// User clicks "Connect Instagram" button
const response = await fetch('/api/social/instagram/authorize', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userJwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    redirectUri: 'http://localhost:4007/api/social/instagram/callback'
  })
});

const { data } = await response.json();
// data.authUrl contains the Instagram OAuth URL
```

**Backend Processing:**
- Validates user JWT token
- Generates state parameter (contains userId + timestamp, base64 encoded)
- Creates Instagram OAuth URL: `https://api.instagram.com/oauth/authorize?client_id=...&redirect_uri=...&scope=user_profile,user_media&response_type=code&state=...`
- Returns authUrl to frontend

**Response:**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://api.instagram.com/oauth/authorize?client_id=123&redirect_uri=...&scope=user_profile,user_media&response_type=code&state=eyJ1c2VySWQiOiIuLi4ifQ==",
    "redirectUri": "http://localhost:4007/api/social/instagram/callback",
    "state": "eyJ1c2VySWQiOiIuLi4ifQ==",
    "method": "Instagram Basic Display API (Direct Login)"
  }
}
```

---

### Step 2: User Redirected to Instagram

**Frontend Action:**
```javascript
// Redirect user to Instagram authorization page
window.location.href = data.authUrl;
```

**What User Sees:**
- Instagram login page
- User enters their Instagram username and password
- User sees what permissions the app is requesting:
  - Access to profile information
  - Access to media
- User clicks "Authorize" or "Cancel"

---

### Step 3: Instagram Authorization

**User Action:**
- User logs in with Instagram credentials
- User authorizes the app
- Instagram generates an authorization code

**Instagram Processing:**
- Validates user credentials
- Checks if app is authorized (in development, user must be added as tester)
- Generates authorization code
- Redirects back to your callback URL

---

### Step 4: Instagram Redirects to Callback

**Instagram Redirect:**
```
GET /api/social/instagram/callback?
  code=AQBx...&
  state=eyJ1c2VySWQiOiIuLi4ifQ==
```

**Backend Receives:**
- `code`: Authorization code (short-lived, expires quickly)
- `state`: Encoded state parameter containing userId

---

### Step 5: Backend Processes Callback

**Backend Processing (Automatic):**

#### 5.1 Extract and Validate
```javascript
// Extract code and state from query parameters
const { code, state } = req.query;

// Decode state to get userId
const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
const userId = stateData.userId;
```

#### 5.2 Exchange Code for Short-Lived Token
```javascript
// POST to Instagram
POST https://api.instagram.com/oauth/access_token
{
  client_id: INSTAGRAM_APP_ID,
  client_secret: INSTAGRAM_APP_SECRET,
  grant_type: 'authorization_code',
  redirect_uri: 'http://localhost:4007/api/social/instagram/callback',
  code: 'AQBx...'
}

// Response:
{
  access_token: 'IGQW...',  // Short-lived (1 hour)
  user_id: '17841405309211844'
}
```

#### 5.3 Exchange for Long-Lived Token
```javascript
// GET from Instagram Graph API
GET https://graph.instagram.com/access_token?
  grant_type=ig_exchange_token&
  client_secret=INSTAGRAM_APP_SECRET&
  access_token=IGQW...

// Response:
{
  access_token: 'IGQW...',  // Long-lived (60 days)
  token_type: 'bearer',
  expires_in: 5184000  // 60 days in seconds
}
```

#### 5.4 Get Instagram Profile
```javascript
// GET user profile
GET https://graph.instagram.com/me?
  access_token=IGQW...&
  fields=id,username,account_type,media_count

// Response:
{
  id: '17841405309211844',
  username: 'instagram_username',
  account_type: 'BUSINESS',
  media_count: 150
}
```

#### 5.5 Save to Database
```sql
INSERT INTO social_accounts (
  user_id,
  platform_id,
  platform_user_id,
  username,
  display_name,
  access_token,
  token_expires_at
) VALUES (
  'user-uuid',
  'instagram-platform-uuid',
  '17841405309211844',
  'instagram_username',
  'instagram_username',
  'IGQW...',
  '2024-03-01 12:00:00'  -- 60 days from now
)
```

---

### Step 6: Redirect to Frontend

**Backend Action:**
```javascript
// Redirect to frontend success page
res.redirect(`${FRONTEND_URL}/social/instagram/success?accountId=${accountId}`);
```

**Frontend Receives:**
- User is redirected to: `http://localhost:3000/social/instagram/success?accountId=uuid`
- Frontend can display success message
- Frontend can fetch connected accounts to show updated list

---

## Error Flow

If any step fails:

```
┌─────────────────────┐
│  Error Occurs       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Backend catches error               │
│  - Logs error details                │
│  - Redirects to error page           │
└──────────┬───────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Frontend Error Page                │
│  /social/instagram/error?           │
│  error=Error%20message              │
└─────────────────────────────────────┘
```

**Common Errors:**
- User denies authorization → `error=access_denied`
- Invalid redirect URI → `error=redirect_uri_mismatch`
- Invalid code → `error=invalid_grant`
- User not a tester → `error=user_not_authorized`

---

## Token Lifecycle

```
┌─────────────────────┐
│ Authorization Code  │
│ (expires in ~10min) │
└──────────┬──────────┘
           │
           ▼ Exchange
┌─────────────────────┐
│ Short-Lived Token   │
│ (expires in 1 hour) │
└──────────┬──────────┘
           │
           ▼ Exchange
┌─────────────────────┐
│ Long-Lived Token     │
│ (expires in 60 days)│
└──────────┬──────────┘
           │
           ▼ Refresh (before expiry)
┌─────────────────────┐
│ Refreshed Token     │
│ (another 60 days)   │
└─────────────────────┘
```

**Token Refresh:**
- Long-lived tokens can be refreshed before they expire
- Call `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=CURRENT_TOKEN`
- Returns a new token valid for another 60 days

---

## Data Stored in Database

After successful connection:

```sql
social_accounts table:
- id: UUID (primary key)
- user_id: UUID (references your app's user)
- platform_id: UUID (references 'instagram' platform)
- platform_user_id: '17841405309211844' (Instagram user ID)
- username: 'instagram_username'
- display_name: 'instagram_username'
- access_token: 'IGQW...' (encrypted/stored securely)
- token_expires_at: '2024-03-01 12:00:00'
- is_connected: true
- created_at: '2024-01-01 12:00:00'
- updated_at: '2024-01-01 12:00:00'
```

---

## Frontend Integration Example

```javascript
// Complete frontend flow
async function connectInstagram() {
  try {
    // Step 1: Get authorization URL
    const response = await fetch('/api/social/instagram/authorize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getUserToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        redirectUri: window.location.origin + '/api/social/instagram/callback'
      })
    });

    const { data } = await response.json();

    // Step 2: Redirect to Instagram
    window.location.href = data.authUrl;
    
    // Step 3: User authorizes on Instagram
    // Step 4: Instagram redirects to callback
    // Step 5: Backend processes and redirects to success page
    
  } catch (error) {
    console.error('Failed to initiate Instagram connection:', error);
  }
}

// Handle success page
function handleSuccess() {
  const urlParams = new URLSearchParams(window.location.search);
  const accountId = urlParams.get('accountId');
  
  // Fetch updated accounts list
  fetchConnectedAccounts();
  
  // Show success message
  showNotification('Instagram account connected successfully!');
}

// Handle error page
function handleError() {
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  
  // Show error message
  showNotification(`Failed to connect: ${error}`, 'error');
}
```

---

## Security Considerations

1. **State Parameter**: Prevents CSRF attacks
   - Contains userId + timestamp
   - Base64 encoded
   - Validated on callback

2. **HTTPS in Production**: All OAuth redirects must use HTTPS

3. **Token Storage**: Access tokens stored securely in database
   - Consider encryption at rest
   - Never expose tokens in frontend

4. **Token Expiration**: Tokens expire after 60 days
   - Implement refresh logic
   - Check expiration before API calls

5. **Scope Limitation**: Only request necessary permissions
   - `user_profile`: Basic profile info
   - `user_media`: User's media/posts

---

## Testing the Flow

### 1. Development Testing
```bash
# Start your backend
npm run dev

# Test authorization endpoint
curl -X POST http://localhost:4007/api/social/instagram/authorize \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"redirectUri": "http://localhost:4007/api/social/instagram/callback"}'
```

### 2. Manual Testing
1. Call `/api/social/instagram/authorize`
2. Copy the `authUrl` from response
3. Open in browser
4. Log in with Instagram test account
5. Authorize the app
6. Should redirect to callback → success page

### 3. Check Database
```sql
SELECT * FROM social_accounts 
WHERE platform_id = (SELECT id FROM social_platforms WHERE name = 'instagram')
AND user_id = 'your-user-id';
```

---

## Summary

**Simple Flow:**
1. User clicks "Connect" → Frontend calls backend
2. Backend returns Instagram login URL
3. User logs in with Instagram → Authorizes app
4. Instagram redirects to callback with code
5. Backend exchanges code → Gets token → Gets profile → Saves
6. User redirected to success page

**Key Points:**
- ✅ No Facebook required
- ✅ Direct Instagram login
- ✅ Works with Business/Creator accounts
- ✅ Tokens valid for 60 days
- ✅ Automatic token refresh available
- ✅ Secure state parameter prevents CSRF

