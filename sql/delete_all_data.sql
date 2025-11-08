-- SQL Script to Delete All Data from Database
-- WARNING: This will delete ALL data from ALL tables!
-- Use with caution - this cannot be undone!

BEGIN;

-- Disable foreign key checks temporarily (PostgreSQL doesn't support this directly, so we'll delete in order)

-- ============================================
-- SOCIAL FEATURES SERVICE TABLES
-- ============================================
TRUNCATE TABLE social_verification CASCADE;
TRUNCATE TABLE social_rewards CASCADE;
TRUNCATE TABLE social_posts CASCADE;
TRUNCATE TABLE social_accounts CASCADE;
TRUNCATE TABLE social_platforms CASCADE;
TRUNCATE TABLE social_campaigns CASCADE;

-- ============================================
-- CASHBACK BUDGET SERVICE TABLES
-- ============================================
TRUNCATE TABLE disputes CASCADE;
TRUNCATE TABLE budget_alerts CASCADE;
TRUNCATE TABLE cashback_transactions CASCADE;
TRUNCATE TABLE budget_transactions CASCADE;
TRUNCATE TABLE cashback_campaigns CASCADE;
TRUNCATE TABLE merchant_budgets CASCADE;

-- ============================================
-- POINTS WALLET SERVICE TABLES
-- ============================================
TRUNCATE TABLE points_audit_log CASCADE;
TRUNCATE TABLE points_expiration CASCADE;
TRUNCATE TABLE points_redemptions CASCADE;
TRUNCATE TABLE points_transactions CASCADE;
TRUNCATE TABLE wallet_balances CASCADE;
TRUNCATE TABLE user_points_preferences CASCADE;
TRUNCATE TABLE points_categories CASCADE;

-- ============================================
-- MERCHANT ONBOARDING SERVICE TABLES
-- ============================================
TRUNCATE TABLE notification_log CASCADE;
TRUNCATE TABLE application_status_history CASCADE;
TRUNCATE TABLE merchant_profiles CASCADE;
TRUNCATE TABLE merchant_applications CASCADE;

-- ============================================
-- AUTH SERVICE TABLES
-- ============================================
TRUNCATE TABLE login_attempts CASCADE;
TRUNCATE TABLE email_verification_tokens CASCADE;
TRUNCATE TABLE password_reset_tokens CASCADE;
TRUNCATE TABLE user_sessions CASCADE;
TRUNCATE TABLE users CASCADE;

-- ============================================
-- NOTIFICATION SERVICE TABLES (if exists)
-- ============================================
TRUNCATE TABLE notification_analytics CASCADE;
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE notification_preferences CASCADE;
TRUNCATE TABLE help_content CASCADE;
TRUNCATE TABLE faq_content CASCADE;
TRUNCATE TABLE terms_conditions CASCADE;
TRUNCATE TABLE privacy_policy CASCADE;

-- ============================================
-- REFERRAL SERVICE TABLES (if exists)
-- ============================================
TRUNCATE TABLE referral_analytics CASCADE;
TRUNCATE TABLE referral_leaderboard CASCADE;
TRUNCATE TABLE referral_statistics CASCADE;
TRUNCATE TABLE referral_links CASCADE;
TRUNCATE TABLE referral_campaigns CASCADE;

COMMIT;

-- Verify deletion (optional - uncomment to check)
-- SELECT 
--   'users' as table_name, COUNT(*) as row_count FROM users
-- UNION ALL
-- SELECT 'merchant_applications', COUNT(*) FROM merchant_applications
-- UNION ALL
-- SELECT 'merchant_profiles', COUNT(*) FROM merchant_profiles
-- UNION ALL
-- SELECT 'cashback_transactions', COUNT(*) FROM cashback_transactions
-- UNION ALL
-- SELECT 'points_transactions', COUNT(*) FROM points_transactions
-- UNION ALL
-- SELECT 'social_posts', COUNT(*) FROM social_posts
-- UNION ALL
-- SELECT 'social_accounts', COUNT(*) FROM social_accounts
-- UNION ALL
-- SELECT 'merchant_budgets', COUNT(*) FROM merchant_budgets;

