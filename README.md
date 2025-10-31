# Fluence Pay App Backend

A comprehensive microservices-based backend system for the Fluence Pay application, featuring authentication, cashback management, merchant onboarding, notifications, points/wallet management, referral system, and social features.

## Architecture Overview

The system consists of 7 microservices:

- **Auth Service** (Port 4001) - Authentication and user management
- **Cashback Budget Service** (Port 4002) - Budget and campaign management
- **Merchant Onboarding Service** (Port 4003) - Merchant application and profile management
- **Notification Service** (Port 4004) - Notification management
- **Points Wallet Service** (Port 4005) - Points and wallet management
- **Referral Service** (Port 4006) - Referral system management
- **Social Features Service** (Port 4007) - Social media integration and features

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL
- Docker (optional)

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd Fluence-Pay-App-Backend

# Install dependencies for all services
npm install

# Start all services
npm run start:all
```

### Docker Setup
```bash
# Start all services with Docker
docker-compose up -d
```

## API Documentation

### Base URLs
- Auth Service: `http://localhost:4001`
- Cashback Budget Service: `http://localhost:4002`
- Merchant Onboarding Service: `http://localhost:4003`
- Notification Service: `http://localhost:4004`
- Points Wallet Service: `http://localhost:4005`
- Referral Service: `http://localhost:4006`
- Social Features Service: `http://localhost:4007`

---

## 🔐 Auth Service (Port 4001)

### Authentication Endpoints

#### POST `/api/auth/firebase`
Firebase authentication endpoint.

**Request:**
```json
{
  "idToken": "firebase_id_token_here",
  "referralCode": "optional_referral_code"
}
```

**Response:**
```json
{
  "user": {
    "id": "user_uuid",
    "name": "User Name",
    "email": "user@example.com"
  },
  "token": "jwt_token_here",
  "needsProfileCompletion": false
}
```

#### POST `/api/auth/complete-profile`
Complete user profile after initial registration.

**Request:**
```json
{
  "name": "Full Name",
  "phone": "+1234567890",
  "dateOfBirth": "1990-01-01"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile completed successfully",
  "user": {
    "id": "user_uuid",
    "name": "Full Name",
    "email": "user@example.com",
    "phone": "+1234567890"
  }
}
```

#### POST `/api/auth/account/status`
Update account status.

**Request:**
```json
{
  "status": "active"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account status updated successfully"
}
```

### Guest Endpoints

#### POST `/api/guest/login`
Guest user login.

**Request:**
```json
{
  "deviceId": "unique_device_id"
}
```

**Response:**
```json
{
  "success": true,
  "guestId": "guest_uuid",
  "token": "guest_jwt_token"
}
```

### Admin Endpoints

#### GET `/api/admin/pending-social-posts`
Get pending social posts for verification.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "transactionId": "transaction_uuid",
      "userId": "user_uuid",
      "platform": "instagram",
      "postUrl": "https://instagram.com/p/...",
      "status": "pending"
    }
  ]
}
```

#### PUT `/api/admin/verify-social-post/:transactionId`
Verify a social media post.

**Request:**
```json
{
  "verified": true,
  "notes": "Post verified successfully"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Social post verified successfully"
}
```

#### GET `/api/admin/jobs/status`
Get background job status.

**Response:**
```json
{
  "success": true,
  "data": {
    "socialPostVerification": "running",
    "pointsExpiration": "stopped"
  }
}
```

---

## 💰 Cashback Budget Service (Port 4002)

### Budget Management

#### POST `/api/budgets`
Create a new merchant budget for the authenticated merchant.

Headers:
- Authorization: Bearer <jwt>

**Request:**
```json
{
  "amount": 50000,
  "currency": "AED"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "budget_uuid",
    "merchant_id": "merchant_uuid",
    "current_balance": 50000.00,
    "total_loaded": 50000.00,
    "currency": "AED",
    "status": "active",
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "Budget created successfully"
}
```

#### GET `/api/budgets`
Get user budgets with pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `status` (optional): Filter by status (active, inactive, completed)

**Response:**
```json
{
  "success": true,
  "data": {
    "budgets": [
      {
        "id": "budget_uuid",
        "name": "Monthly Shopping Budget",
        "amount": 1000.00,
        "currency": "USD",
        "status": "active",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

#### GET `/api/budgets/:id`
Get specific budget by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "budget_uuid",
    "name": "Monthly Shopping Budget",
    "amount": 1000.00,
    "currency": "USD",
    "description": "Monthly shopping budget for cashback tracking",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### PUT `/api/budgets/:id`
Update budget.

**Request:**
```json
{
  "name": "Updated Budget Name",
  "amount": 1500.00,
  "description": "Updated description"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "budget_uuid",
    "name": "Updated Budget Name",
    "amount": 1500.00,
    "currency": "USD",
    "description": "Updated description",
    "status": "active",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Budget updated successfully"
}
```

#### DELETE `/api/budgets/:id`
Delete budget.

**Response:**
```json
{
  "success": true,
  "message": "Budget deleted successfully"
}
```

#### GET `/api/budgets/:id/analytics`
Get budget analytics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSpent": 750.00,
    "remainingBudget": 250.00,
    "spentPercentage": 75.0,
    "transactionsCount": 15,
    "averageTransaction": 50.00,
    "trends": {
      "daily": [
        {"date": "2024-01-01", "amount": 100.00},
        {"date": "2024-01-02", "amount": 150.00}
      ]
    }
  }
}
```

### Campaign Management

#### POST `/api/campaigns`
Create a new cashback campaign.

**Request:**
```json
{
  "name": "Summer Sale Campaign",
  "cashbackPercentage": 5.0,
  "startDate": "2025-06-01T00:00:00.000Z",
  "endDate": "2025-08-31T23:59:59.000Z",
  "autoStopThreshold": 50.0,
  "alertThreshold": 60.0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "campaign_uuid",
    "name": "Summer Sale Campaign",
    "merchantId": "merchant_uuid",
    "cashbackPercentage": 5.0,
    "startDate": "2025-06-01T00:00:00.000Z",
    "endDate": "2025-08-31T23:59:59.000Z",
    "status": "active",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Campaign created successfully"
}
```

#### PUT `/api/campaigns/:id`
Update an existing cashback campaign.

**Request (one or more fields):**
```json
{
  "name": "Updated Campaign Name",
  "cashbackPercentage": 7.5,
  "startDate": "2025-06-15T00:00:00.000Z",
  "endDate": "2025-09-15T23:59:59.000Z",
  "autoStopThreshold": 55.0,
  "alertThreshold": 65.0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "campaign_uuid",
    "name": "Updated Campaign Name",
    "cashbackPercentage": 7.5,
    "startDate": "2025-06-15T00:00:00.000Z",
    "endDate": "2025-09-15T23:59:59.000Z",
    "status": "active"
  },
  "message": "Campaign updated successfully"
}
```

#### GET `/api/campaigns`
Get campaigns with filtering.

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): Filter by status
- `budgetId` (optional): Filter by budget ID

**Response:**
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "id": "campaign_uuid",
        "name": "Summer Sale Campaign",
        "cashbackPercentage": 5.0,
        "status": "active",
        "startDate": "2024-06-01T00:00:00.000Z",
        "endDate": "2024-08-31T23:59:59.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

#### POST `/api/campaigns/:id/activate`
Activate campaign.

**Response:**
```json
{
  "success": true,
  "message": "Campaign activated successfully"
}
```

#### POST `/api/campaigns/:id/deactivate`
Deactivate campaign.

**Response:**
```json
{
  "success": true,
  "message": "Campaign deactivated successfully"
}
```

### Transaction Management

#### POST `/api/transactions`
Create a new transaction.

**Request:**
```json
{
  "amount": 100.00,
  "type": "cashback",
  "campaignId": "campaign_uuid",
  "description": "Purchase at Store XYZ",
  "metadata": {
    "storeName": "Store XYZ",
    "category": "electronics"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "transaction_uuid",
    "amount": 100.00,
    "type": "cashback",
    "status": "pending",
    "campaignId": "campaign_uuid",
    "description": "Purchase at Store XYZ",
    "metadata": {
      "storeName": "Store XYZ",
      "category": "electronics"
    },
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Transaction created successfully"
}
```

#### GET `/api/transactions`
Get transactions with filtering.

**Query Parameters:**
- `page`, `limit`: Pagination
- `status`: Filter by status (pending, processed, failed, disputed)
- `type`: Filter by type (cashback, payment, refund)
- `startDate`, `endDate`: Date range filtering

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "transaction_uuid",
        "amount": 100.00,
        "type": "cashback",
        "status": "processed",
        "description": "Purchase at Store XYZ",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

#### GET `/api/transactions/analytics`
Get transaction analytics.

**Query Parameters:**
- `startDate`, `endDate`: Date range
- `type`: Transaction type filter

**Response:**
```json
{
  "success": true,
  "data": {
    "totalAmount": 1500.00,
    "transactionCount": 25,
    "averageAmount": 60.00,
    "byType": {
      "cashback": 1200.00,
      "payment": 300.00
    },
    "byStatus": {
      "completed": 20,
      "pending": 5
    },
    "trends": {
      "daily": [
        {"date": "2024-01-01", "amount": 200.00, "count": 3}
      ]
    }
  }
}
```

#### GET `/api/transactions/:id`
Get a transaction by ID.

#### PUT `/api/transactions/:id`
Update a transaction (amount, type, status, description, metadata).

#### DELETE `/api/transactions/:id`
Delete a transaction.

#### POST `/api/transactions/:id/process`
Process a transaction.

### Dispute Management

#### POST `/api/disputes`
Create a dispute.

**Request:**
```json
{
  "transactionId": "transaction_uuid",
  "type": "chargeback",
  "reason": "Product not received",
  "description": "Order was placed but never delivered",
  "amount": 100.00
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "dispute_uuid",
    "transactionId": "transaction_uuid",
    "type": "chargeback",
    "status": "open",
    "reason": "Product not received",
    "description": "Order was placed but never delivered",
    "amount": 100.00,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Dispute created successfully"
}
```

#### GET `/api/disputes`
Get disputes with filtering.

**Response:**
```json
{
  "success": true,
  "data": {
    "disputes": [
      {
        "id": "dispute_uuid",
        "transactionId": "transaction_uuid",
        "type": "chargeback",
        "status": "open",
        "reason": "Product not received",
        "amount": 100.00,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

#### POST `/api/disputes/:id/resolve`
Resolve a dispute.

**Request:**
```json
{
  "resolution": "Refund processed",
  "notes": "Customer refunded in full"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Dispute resolved successfully"
}
```

---

## 🏪 Merchant Onboarding Service (Port 4003)

### Application Management

#### POST `/api/applications` (Public)
Submit a merchant application. Only one application per email (pending/approved) is allowed.

**Request:**
```json
{
  "businessName": "ABC Store",
  "businessType": "retail",
  "contactPerson": "John Doe",
  "email": "contact@abcstore.com",
  "phone": "+1234567890",
  "businessAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  },
  "businessLicense": "LIC-12345",
  "taxId": "TAX-99999",
  "bankAccountDetails": {
    "accountNumber": "1234567890",
    "bankName": "Example Bank",
    "routingNumber": "021000021"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "application_uuid",
    "business_name": "ABC Store",
    "business_type": "retail",
    "contact_person": "John Doe",
    "email": "contact@abcstore.com",
    "phone": "+1234567890",
    "business_address": "123 Main St, New York, NY, 10001, USA",
    "status": "pending",
    "submitted_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "Application submitted successfully"
}
```

#### GET `/api/applications` (Auth required)
Get applications for the authenticated user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "application_uuid",
      "business_name": "ABC Store",
      "business_type": "retail",
      "business_address": "123 Main St, New York, NY, 10001, USA",
      "status": "pending",
      "submitted_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### GET `/api/applications/:applicationId` (Auth required)
Get a specific application.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "application_uuid",
    "business_name": "ABC Store",
    "business_type": "retail",
    "contact_person": "John Doe",
    "email": "contact@abcstore.com",
    "phone": "+1234567890",
    "business_address": "123 Main St, New York, NY, 10001, USA",
    "status": "pending",
    "submitted_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### PUT `/api/applications/:applicationId` (Auth required)
Update application (only if pending).

**Request (example):**
```json
{
  "businessName": "Updated Store Name",
  "phone": "+1987654321"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "application_uuid",
    "business_name": "Updated Store Name",
    "phone": "+1987654321",
    "business_address": "123 Main St, New York, NY, 10001, USA"
  },
  "message": "Application updated successfully"
}
```

### Profile Management

#### GET `/api/profiles/me`
Get current user's merchant profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "profile_uuid",
    "businessName": "ABC Store",
    "businessType": "retail",
    "status": "active",
    "contactEmail": "contact@abcstore.com",
    "contactPhone": "+1234567890",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### PUT `/api/profiles/me`
Update merchant profile.

**Request:**
```json
{
  "businessName": "Updated Business Name",
  "contactPhone": "+1987654321",
  "businessDescription": "Updated business description"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

#### GET `/api/profiles/active`
Get active merchant profiles (public endpoint).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "profile_uuid",
      "businessName": "ABC Store",
      "businessType": "retail",
      "contactEmail": "contact@abcstore.com",
      "businessDescription": "Retail store selling electronics"
    }
  ]
}
```

### Admin Endpoints

#### GET `/api/admin/applications`
Get all applications (admin only).

**Response:**
```json
{
  "success": true,
  "data": {
    "applications": [
      {
        "id": "application_uuid",
        "businessName": "ABC Store",
        "businessType": "retail",
        "status": "pending",
        "submittedAt": "2024-01-01T00:00:00.000Z",
        "applicantName": "John Doe",
        "applicantEmail": "john@example.com"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

#### PUT `/api/admin/applications/:applicationId/status`
Update application status (admin only).

**Request:**
```json
{
  "status": "approved",
  "notes": "Application approved after review"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Application status updated successfully"
}
```

### Merchant Auth

#### POST `/api/merchant/auth/set-password` (Public)
Set merchant password after approval.

**Request:**
```json
{
  "email": "merchant@example.com",
  "password": "StrongPass!234"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password set successfully",
  "data": { "id": "merchant_id", "email": "merchant@example.com" }
}
```

#### POST `/api/merchant/auth/login` (Public)
Login with email and password; returns JWT when profile is active.

**Request:**
```json
{
  "email": "merchant@example.com",
  "password": "StrongPass!234"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "merchant": {
      "id": "merchant_id",
      "email": "merchant@example.com",
      "businessName": "ABC Store",
      "status": "active"
    }
  },
  "message": "Login successful"
}
```

---

## 🔔 Notification Service (Port 4004)

### Notification Management

#### GET `/api/notifications`
Get user notifications.

**Query Parameters:**
- `page`, `limit`: Pagination
- `type`: Filter by notification type
- `startDate`, `endDate`: Date range filtering

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notification_uuid",
        "type": "cashback_earned",
        "title": "Cashback Earned!",
        "message": "You earned $5.00 cashback from your purchase",
        "isRead": false,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

#### GET `/api/notifications/unread-count`
Get unread notification count.

**Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

#### PUT `/api/notifications/:notificationId/read`
Mark notification as read.

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

#### PUT `/api/notifications/read-all`
Mark all notifications as read.

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

#### DELETE `/api/notifications/:notificationId`
Delete notification.

**Response:**
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

### Notification Settings

#### GET `/api/settings`
Get notification settings.

**Response:**
```json
{
  "success": true,
  "data": {
    "email": {
      "cashback": true,
      "budgetAlerts": true,
      "paymentReminders": false
    },
    "sms": {
      "cashback": false,
      "budgetAlerts": true,
      "paymentReminders": true
    },
    "push": {
      "cashback": true,
      "budgetAlerts": true,
      "paymentReminders": true
    }
  }
}
```

#### PUT `/api/settings`
Update notification settings.

**Request:**
```json
{
  "email": {
    "cashback": true,
    "budgetAlerts": false,
    "paymentReminders": true
  },
  "sms": {
    "cashback": false,
    "budgetAlerts": true,
    "paymentReminders": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification settings updated successfully"
}
```

---

## 💎 Points Wallet Service (Port 4005)

### Points Management

#### POST `/api/points/earn`
Earn points for an action.

**Request:**
```json
{
  "points": 100,
  "source": "purchase",
  "description": "Points earned from purchase",
  "referenceId": "transaction_uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "points_transaction_uuid",
    "points": 100,
    "source": "purchase",
    "description": "Points earned from purchase",
    "referenceId": "transaction_uuid",
    "status": "completed",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Points earned successfully"
}
```

#### GET `/api/points/transactions`
Get points transactions.

**Query Parameters:**
- `page`, `limit`: Pagination
- `source`: Filter by source
- `status`: Filter by status

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "points_transaction_uuid",
        "points": 100,
        "source": "purchase",
        "description": "Points earned from purchase",
        "status": "completed",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

#### GET `/api/points/stats`
Get points statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEarned": 1000,
    "totalRedeemed": 200,
    "currentBalance": 800,
    "bySource": {
      "purchase": 600,
      "referral": 200,
      "social": 200
    }
  }
}
```

### Wallet Management

#### GET `/api/wallet/balance`
Get wallet balance.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalBalance": 150.75,
    "availableBalance": 150.75,
    "pendingBalance": 0.00,
    "currency": "USD",
    "lastUpdated": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET `/api/wallet/balance/history`
Get wallet balance history.

**Response:**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "date": "2024-01-01",
        "balance": 150.75,
        "change": 25.50,
        "description": "Cashback earned"
      }
    ]
  }
}
```

#### POST `/api/wallet/check-balance`
Check if sufficient balance for transaction.

**Request:**
```json
{
  "amount": 50.00
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sufficient": true,
    "currentBalance": 150.75,
    "requestedAmount": 50.00,
    "remainingAfter": 100.75
  }
}
```

---

## 🔗 Referral Service (Port 4006)

### Referral Management

#### POST `/api/referral/code/generate`
Generate referral code.

**Request:**
```json
{
  "campaignId": "campaign_uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "referralCode": "FRIEND2024",
    "campaignId": "campaign_uuid",
    "expiresAt": "2024-12-31T23:59:59.000Z"
  },
  "message": "Referral code generated successfully"
}
```

#### POST `/api/referral/code/validate`
Validate referral code.

**Request:**
```json
{
  "referralCode": "FRIEND2024"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "campaignId": "campaign_uuid",
    "rewardAmount": 10.00,
    "expiresAt": "2024-12-31T23:59:59.000Z"
  }
}
```

#### POST `/api/referral/complete`
Complete referral process.

**Request:**
```json
{
  "referralCode": "FRIEND2024",
  "referredUserId": "user_uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "referrerReward": 10.00,
    "referredReward": 5.00,
    "referralId": "referral_uuid"
  },
  "message": "Referral completed successfully"
}
```

#### GET `/api/referral/stats`
Get referral statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalReferrals": 15,
    "totalEarned": 150.00,
    "activeReferrals": 12,
    "conversionRate": 80.0
  }
}
```

#### GET `/api/referral/leaderboard`
Get referral leaderboard (public endpoint).

**Response:**
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "userId": "user_uuid",
        "referralCount": 25,
        "totalEarned": 250.00
      }
    ]
  }
}
```

---

## 📱 Social Features Service (Port 4007)

### Social Account Management

#### POST `/api/social/accounts/connect`
Connect social media account.

**Request:**
```json
{
  "platform": "instagram",
  "accessToken": "social_access_token",
  "accountId": "social_account_id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "social_account_uuid",
    "platform": "instagram",
    "accountId": "social_account_id",
    "username": "user_instagram",
    "connectedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Social account connected successfully"
}
```

#### GET `/api/social/accounts`
Get connected social accounts.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "social_account_uuid",
      "platform": "instagram",
      "username": "user_instagram",
      "connectedAt": "2024-01-01T00:00:00.000Z",
      "status": "active"
    }
  ]
}
```

#### DELETE `/api/social/accounts/:accountId`
Disconnect social account.

**Response:**
```json
{
  "success": true,
  "message": "Social account disconnected successfully"
}
```

### Social Post Management

#### POST `/api/social/posts`
Create social media post.

**Request:**
```json
{
  "platform": "instagram",
  "content": "Check out this amazing deal! #FluencePay",
  "mediaUrls": ["https://example.com/image.jpg"],
  "scheduledAt": "2024-01-01T12:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "social_post_uuid",
    "platform": "instagram",
    "content": "Check out this amazing deal! #FluencePay",
    "status": "scheduled",
    "scheduledAt": "2024-01-01T12:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Social post created successfully"
}
```

#### GET `/api/social/posts`
Get social posts.

**Response:**
```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": "social_post_uuid",
        "platform": "instagram",
        "content": "Check out this amazing deal! #FluencePay",
        "status": "published",
        "publishedAt": "2024-01-01T12:00:00.000Z",
        "engagement": {
          "likes": 25,
          "comments": 5,
          "shares": 3
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

#### GET `/api/social/analytics`
Get social media analytics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPosts": 50,
    "totalEngagement": 1250,
    "averageEngagement": 25.0,
    "topPerformingPost": {
      "id": "post_uuid",
      "engagement": 150,
      "platform": "instagram"
    },
    "byPlatform": {
      "instagram": 30,
      "twitter": 20
    }
  }
}
```

#### GET `/api/social/campaigns`
Get social campaigns (public endpoint).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "campaign_uuid",
      "name": "Summer Sale Campaign",
      "description": "Share your summer purchases and earn rewards!",
      "rewardAmount": 10.00,
      "startDate": "2024-06-01T00:00:00.000Z",
      "endDate": "2024-08-31T23:59:59.000Z",
      "status": "active"
    }
  ]
}
```

---

## 🔧 Health Checks

All services provide health check endpoints:

### GET `/health`
**Response:**
```json
{
  "success": true,
  "service": "service-name",
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

---

## 🔒 Authentication

Most endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Guest Authentication
Some endpoints support guest authentication for limited functionality.

### Admin Endpoints
Admin endpoints require additional admin role verification.

---

## 📊 Error Responses

All services return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Rate Limited
- `500` - Internal Server Error

---

## 🚀 Development

### Running Individual Services
```bash
# Auth Service
cd auth-service && npm start

# Cashback Budget Service
cd cashback-budget-service && npm start

# Merchant Onboarding Service
cd merchant-onboarding-service && npm start

# Notification Service
cd notification-service && npm start

# Points Wallet Service
cd points-wallet-service && npm start

# Referral Service
cd referral-service && npm start

# Social Features Service
cd social-features-service && npm start
```

## 🌐 Sharing Your Local Backend

### Quick Setup with Ngrok (Recommended)

1. **Install Ngrok:**
   ```bash
   # Download from https://ngrok.com/download
   # Or install via package manager
   npm install -g ngrok
   ```

2. **Get your auth token:**
   - Sign up at https://ngrok.com
   - Get your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
   - Update `ngrok.yml` with your token

3. **Start all services:**
   ```bash
   # Start all microservices
   npm run start:all
   # or use the provided scripts
   ./start-services.sh  # Linux/Mac
   start-services.bat   # Windows
   ```

4. **Start tunneling:**
   ```bash
   # Linux/Mac
   ./start-ngrok.sh
   
   # Windows
   start-ngrok.bat
   ```

5. **Share the URLs:**
   After running the script, you'll get public URLs like:
   - Auth Service: `https://fluence-auth.ngrok.io`
   - Cashback Service: `https://fluence-cashback.ngrok.io`
   - Merchant Service: `https://fluence-merchant.ngrok.io`
   - And so on...

### Alternative Tunneling Options

#### Cloudflare Tunnel (Free & Secure)
```bash
# Install Cloudflare Tunnel
# Download from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

# Login and create tunnel
cloudflared tunnel login
cloudflared tunnel create fluence-backend

# Start tunnel for all services
cloudflared tunnel --config tunnel.yml run
```

#### LocalTunnel (Simple)
```bash
# Install
npm install -g localtunnel

# Start tunnels for each service
lt --port 4001 --subdomain fluence-auth
lt --port 4002 --subdomain fluence-cashback
lt --port 4003 --subdomain fluence-merchant
# ... continue for all services
```

#### Serveo (No Installation)
```bash
# SSH-based tunneling (no installation needed)
ssh -R 80:localhost:4001 serveo.net
ssh -R 80:localhost:4002 serveo.net
# ... continue for all services
```

### Important Notes

- **Free ngrok URLs change** every time you restart (unless you have a paid plan)
- **HTTPS is provided** by default with most tunneling services
- **Rate limiting** may apply on free tiers
- **Security**: Be cautious about exposing your local development environment
- **Database**: Make sure your database is accessible or use a cloud database for sharing

### Testing
```bash
# Run tests for all services
npm test

# Run tests for specific service
cd <service-name> && npm test
```

### Environment Variables
Each service requires specific environment variables. See individual service README files for details.

---

## 📝 License

This project is licensed under the MIT License.