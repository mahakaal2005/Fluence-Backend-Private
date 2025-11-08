-- SQL Script to Delete All Data from Database (Alternative - Using DELETE)
-- WARNING: This will delete ALL data from ALL tables!
-- Use with caution - this cannot be undone!
-- This version uses DELETE instead of TRUNCATE for better foreign key handling

BEGIN;

-- ============================================
-- SOCIAL FEATURES SERVICE TABLES
-- ============================================
DELETE FROM social_verification;
DELETE FROM social_rewards;
DELETE FROM social_posts;
DELETE FROM social_accounts;
DELETE FROM social_platforms;
DELETE FROM social_campaigns;

-- ============================================
-- CASHBACK BUDGET SERVICE TABLES
-- ============================================
DELETE FROM disputes;
DELETE FROM budget_alerts;
DELETE FROM cashback_transactions;
DELETE FROM budget_transactions;
DELETE FROM cashback_campaigns;
DELETE FROM merchant_budgets;

-- ============================================
-- POINTS WALLET SERVICE TABLES
-- ============================================
DELETE FROM points_audit_log;
DELETE FROM points_expiration;
DELETE FROM points_redemptions;
DELETE FROM points_transactions;
DELETE FROM wallet_balances;
DELETE FROM user_points_preferences;
DELETE FROM points_categories;

-- ============================================
-- MERCHANT ONBOARDING SERVICE TABLES
-- ============================================
DELETE FROM notification_log;
DELETE FROM application_status_history;
DELETE FROM merchant_profiles;
DELETE FROM merchant_applications;

-- ============================================
-- AUTH SERVICE TABLES
-- ============================================
DELETE FROM login_attempts;
DELETE FROM email_verification_tokens;
DELETE FROM password_reset_tokens;
DELETE FROM user_sessions;
DELETE FROM users;

-- ============================================
-- NOTIFICATION SERVICE TABLES (if exists)
-- ============================================
DELETE FROM notification_analytics;
DELETE FROM notifications;
DELETE FROM notification_preferences;
DELETE FROM help_content;
DELETE FROM faq_content;
DELETE FROM terms_conditions;
DELETE FROM privacy_policy;

-- ============================================
-- REFERRAL SERVICE TABLES (if exists)
-- ============================================
DELETE FROM referral_analytics;
DELETE FROM referral_leaderboard;
DELETE FROM referral_statistics;
DELETE FROM referral_links;
DELETE FROM referral_campaigns;

COMMIT;

-- Reset sequences (optional - uncomment if you want to reset auto-increment counters)
-- ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS merchant_applications_id_seq RESTART WITH 1;
-- (Note: UUID primary keys don't use sequences, but if you have any serial/bigserial columns, reset them here)

