# Endpoint Analysis Report
## Base URL: https://161.248.37.235

## DUPLICATE ENDPOINTS FOUND:

### ⚠️ CRITICAL DUPLICATES:

1. **`/api/admin/*` - CONFLICT BETWEEN SERVICES**
   - **Auth Service**: `/api/admin/*` (mounted at `/api` in auth-service/src/app.js line 81)
   - **Merchant Onboarding Service**: `/api/admin/*` (mounted at `/api/admin` in merchant-onboarding-service/src/app.js line 90)
   - **CONFLICT**: Both services use the same `/api/admin/*` prefix
   - **Auth Service Admin Routes**:
     - POST `/api/admin/users/admin`
     - GET `/api/admin/users`
     - PUT `/api/admin/users/:userId/role`
     - POST `/api/admin/users/:userId/approve`
     - POST `/api/admin/users/:userId/reject`
     - POST `/api/admin/users/:userId/suspend`
     - GET `/api/admin/users/:userId/approval-status`
     - GET `/api/admin/admin/pending-social-posts`
     - PUT `/api/admin/admin/verify-social-post/:postId`
     - GET `/api/admin/admin/jobs/status`
     - POST `/api/admin/admin/jobs/trigger/:jobName`
     - POST `/api/admin/admin/jobs/stop/:jobName`
   - **Merchant Service Admin Routes**:
     - GET `/api/admin/activity/recent-reviews`
     - GET `/api/admin/applications`
     - GET `/api/admin/applications/pending`
     - GET `/api/admin/applications/status/:status`
     - GET `/api/admin/applications/:applicationId`
     - PUT `/api/admin/applications/:applicationId/status`
     - GET `/api/admin/sla/violations`
     - POST `/api/admin/sla/reminders`
     - GET `/api/admin/merchants`
     - GET `/api/admin/merchants/search`
     - GET `/api/admin/stats`

2. **`/api/admin/analytics` - POTENTIAL CONFLICT**
   - **Cashback Budget Service**: `/api/admin/analytics/*` (mounted at `/api/admin/analytics` in cashback-budget-service/src/app.js line 97)
   - **Notification Service**: `/api/admin/notifications/*` (mounted at `/api/admin/notifications` in notification-service/src/app.js line 90)
   - **Social Features Service**: `/api/admin/social/*` (mounted at `/api/admin/social` in social-features-service/src/app.js line 105)
   - These are different but could be confused

### ✅ NO CONFLICTS (Unique Endpoints):

**Auth Service:**
- `/api/auth/*` - Unique
- `/api/guest/*` - Unique

**Merchant Onboarding Service:**
- `/api/applications/*` - Unique
- `/api/profiles/*` - Unique
- `/api/merchant/auth/*` - Unique

**Cashback Budget Service:**
- `/api/transactions/*` - Unique
- `/api/disputes/*` - Unique
- `/api/funds/*` - Unique

**Notification Service:**
- `/api/notifications/*` - Unique
- `/api/content/*` - Unique

**Points Wallet Service:**
- `/api/wallet/*` - Unique
- `/api/points/*` - Unique

**Referral Service:**
- `/api/referral/*` - Unique

**Social Features Service:**
- `/api/social/*` - Unique

## RECOMMENDATIONS:

1. **Fix `/api/admin/*` conflict:**
   - Option A: Change auth-service admin routes to `/api/admin/auth/*`
   - Option B: Change merchant-onboarding-service admin routes to `/api/admin/merchants/*` (but this conflicts with nginx routing)
   - Option C: Change auth-service admin routes to `/api/admin/users/*` and keep merchant routes at `/api/admin/merchants/*`

2. **Nginx routing shows:**
   - `/api/admin/auth/` → auth-service (line 196-199)
   - `/api/admin/merchants/` → merchant-onboarding-service (line 201-204)
   - `/api/admin/analytics/` → cashback-budget-service (line 206-209)
   - `/api/admin/notifications/` → notification-service (line 211-214)
   - `/api/admin/social/` → social-features-service (line 216-219)

3. **The issue:** The app.js files mount routes differently than nginx expects:
   - Auth service mounts admin routes at `/api` (should be `/api/admin/auth`)
   - Merchant service mounts admin routes at `/api/admin` (nginx expects `/api/admin/merchants`)

## DETAILED ENDPOINT LIST:

### Auth Service (`/api/auth/*`, `/api/guest/*`, `/api/admin/*`)
- POST `/api/auth/login`
- POST `/api/auth/phone/request-otp`
- POST `/api/auth/phone/verify-otp`
- POST `/api/auth/firebase`
- GET `/api/auth/profile`
- POST `/api/auth/complete-profile`
- POST `/api/auth/account/status`
- GET `/api/auth/sessions/active`
- GET `/api/auth/sessions/stats`
- POST `/api/guest/login`
- POST `/api/admin/users/admin` ⚠️ CONFLICT
- GET `/api/admin/users` ⚠️ CONFLICT
- PUT `/api/admin/users/:userId/role` ⚠️ CONFLICT
- POST `/api/admin/users/:userId/approve` ⚠️ CONFLICT
- POST `/api/admin/users/:userId/reject` ⚠️ CONFLICT
- POST `/api/admin/users/:userId/suspend` ⚠️ CONFLICT
- GET `/api/admin/users/:userId/approval-status` ⚠️ CONFLICT
- GET `/api/admin/admin/pending-social-posts` ⚠️ CONFLICT
- PUT `/api/admin/admin/verify-social-post/:postId` ⚠️ CONFLICT
- GET `/api/admin/admin/jobs/status` ⚠️ CONFLICT
- POST `/api/admin/admin/jobs/trigger/:jobName` ⚠️ CONFLICT
- POST `/api/admin/admin/jobs/stop/:jobName` ⚠️ CONFLICT

### Merchant Onboarding Service (`/api/applications/*`, `/api/profiles/*`, `/api/admin/*`, `/api/merchant/auth/*`)
- POST `/api/applications`
- GET `/api/applications/:applicationId`
- GET `/api/applications` (protected)
- GET `/api/applications/stats`
- GET `/api/applications/sla-check`
- PUT `/api/applications/:applicationId`
- DELETE `/api/applications/:applicationId`
- GET `/api/profiles/active`
- GET `/api/profiles/business-type/:businessType`
- GET `/api/profiles/search`
- GET `/api/profiles/stats`
- GET `/api/profiles/top/cashback`
- GET `/api/profiles/by-instagram/:instagramId`
- PUT `/api/profiles/:merchantId/avatar`
- GET `/api/profiles/me`
- PUT `/api/profiles/me`
- GET `/api/profiles/admin/all`
- GET `/api/profiles/admin/:profileId`
- GET `/api/profiles/admin/:profileId/activity`
- PUT `/api/profiles/admin/:profileId/status`
- POST `/api/merchant/auth/set-password`
- POST `/api/merchant/auth/login`
- GET `/api/admin/activity/recent-reviews` ⚠️ CONFLICT
- GET `/api/admin/applications` ⚠️ CONFLICT
- GET `/api/admin/applications/pending` ⚠️ CONFLICT
- GET `/api/admin/applications/status/:status` ⚠️ CONFLICT
- GET `/api/admin/applications/:applicationId` ⚠️ CONFLICT
- PUT `/api/admin/applications/:applicationId/status` ⚠️ CONFLICT
- GET `/api/admin/sla/violations` ⚠️ CONFLICT
- POST `/api/admin/sla/reminders` ⚠️ CONFLICT
- GET `/api/admin/merchants` ⚠️ CONFLICT
- GET `/api/admin/merchants/search` ⚠️ CONFLICT
- GET `/api/admin/stats` ⚠️ CONFLICT

### Cashback Budget Service (`/api/transactions/*`, `/api/disputes/*`, `/api/funds/*`, `/api/admin/analytics/*`)
- POST `/api/transactions`
- GET `/api/transactions`
- GET `/api/transactions/analytics`
- GET `/api/transactions/:id`
- PUT `/api/transactions/:id`
- DELETE `/api/transactions/:id`
- POST `/api/transactions/:id/process`
- POST `/api/disputes`
- GET `/api/disputes`
- GET `/api/disputes/analytics`
- GET `/api/disputes/:id`
- PUT `/api/disputes/:id`
- DELETE `/api/disputes/:id`
- POST `/api/disputes/:id/resolve`
- GET `/api/funds`
- POST `/api/funds/add`
- PUT `/api/funds/cashback-percentage`
- GET `/api/funds/transactions`
- GET `/api/admin/analytics/platform/transactions`
- GET `/api/admin/analytics/platform/health`
- GET `/api/admin/analytics/platform/trends`
- GET `/api/admin/analytics/platform/dashboard`
- GET `/api/admin/analytics/merchants/performance`
- GET `/api/admin/analytics/merchants/settlements`
- GET `/api/admin/analytics/transactions/errors`
- GET `/api/admin/analytics/transactions/failed-payments`
- GET `/api/admin/analytics/transactions/late-payments`

### Notification Service (`/api/notifications/*`, `/api/content/*`, `/api/admin/notifications/*`)
- POST `/api/notifications/internal/create`
- POST `/api/notifications/internal/admin/new-post`
- POST `/api/notifications/internal/admin/new-merchant-application`
- GET `/api/notifications`
- GET `/api/notifications/sent-with-stats`
- GET `/api/notifications/unread-count`
- GET `/api/notifications/type/:type`
- GET `/api/notifications/date-range`
- GET `/api/notifications/stats`
- PUT `/api/notifications/:notificationId/read`
- PUT `/api/notifications/read-all`
- PUT `/api/notifications/opened-all`
- DELETE `/api/notifications/:notificationId`
- GET `/api/notifications/settings`
- PUT `/api/notifications/settings`
- GET `/api/content/help`
- GET `/api/content/faq`
- GET `/api/content/terms`
- GET `/api/content/privacy`
- POST `/api/content/:contentType/:contentId/view`
- POST `/api/content/help`
- POST `/api/content/faq`
- PUT `/api/content/faq/:faqId`
- DELETE `/api/content/faq/:faqId`
- POST `/api/content/terms`
- POST `/api/content/privacy`
- GET `/api/content/templates`
- PUT `/api/content/templates/:templateId`
- GET `/api/content/analytics`
- POST `/api/admin/notifications/send`
- GET `/api/admin/notifications/user-count`
- GET `/api/admin/notifications/analytics`

### Points Wallet Service (`/api/wallet/*`, `/api/points/*`)
- GET `/api/wallet/balance`
- GET `/api/wallet/balance/summary`
- GET `/api/wallet/balance/history`
- GET `/api/wallet/balance/trends`
- GET `/api/wallet/balance/alerts`
- GET `/api/wallet/balance/date-range`
- GET `/api/wallet/balance/transaction-type/:transactionType`
- GET `/api/wallet/balance/comparison/:comparisonUserId`
- POST `/api/wallet/check-balance`
- POST `/api/points/earn`
- GET `/api/points/transactions`
- GET `/api/points/transactions/:transactionId`
- PUT `/api/points/transactions/:transactionId/status`
- PUT `/api/points/transactions/:transactionId/social-post`
- PUT `/api/points/verify-social/:id`
- DELETE `/api/points/transactions/:transactionId`
- GET `/api/points/transactions/requiring-social-posts`
- GET `/api/points/transactions/time-buffer`
- GET `/api/points/transactions/reference/:referenceId`
- GET `/api/points/stats`
- GET `/api/points/stats/daily-summary`
- GET `/api/points/stats/total-earned`
- GET `/api/points/stats/total-redeemed`

### Referral Service (`/api/referral/*`)
- POST `/api/referral/code/generate`
- POST `/api/referral/code/validate`
- POST `/api/referral/complete`
- GET `/api/referral/stats`
- GET `/api/referral/rewards`
- GET `/api/referral/links`
- GET `/api/referral/leaderboard`
- GET `/api/referral/campaigns`
- GET `/api/referral/analytics`

### Social Features Service (`/api/social/*`, `/api/admin/social/*`)
- GET `/api/social/instagram/callback`
- POST `/api/social/instagram/authorize`
- GET `/api/social/instagram/posts`
- POST `/api/social/instagram/sync-posts`
- GET `/api/social/get-all-instagram-data`
- POST `/api/social/accounts/connect`
- GET `/api/social/accounts`
- DELETE `/api/social/accounts/:accountId`
- POST `/api/social/posts`
- GET `/api/social/posts`
- PUT `/api/social/posts/:postId`
- DELETE `/api/social/posts/:postId`
- GET `/api/social/analytics`
- GET `/api/social/rewards`
- GET `/api/social/merchant/reports`
- GET `/api/social/merchant/influencer-scoring`
- GET `/api/social/merchant/analytics`
- GET `/api/social/settings`
- PUT `/api/social/settings`
- GET `/api/social/campaigns`
- GET `/api/social/platforms`
- GET `/api/social/influencer-ranking`
- GET `/api/admin/social/activity/recent-verifications`
- GET `/api/admin/social/posts`
- GET `/api/admin/social/posts/pending`
- GET `/api/admin/social/posts/:postId`
- POST `/api/admin/social/posts/:postId/approve`
- POST `/api/admin/social/posts/:postId/reject`
- GET `/api/admin/social/posts/:postId/validate`
- GET `/api/admin/social/posts/:postId/duplicates`
- GET `/api/admin/social/posts/attention`
- GET `/api/admin/social/posts/stats`
- GET `/api/admin/social/users/:userId/limits`
- POST `/api/admin/social/users/:userId/limits`

