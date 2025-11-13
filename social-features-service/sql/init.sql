-- Social Features Service Database Schema
-- This service handles all social media integration and features

-- Create required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Social Platforms Table
CREATE TABLE IF NOT EXISTS social_platforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  api_base_url TEXT NOT NULL,
  auth_url TEXT,
  token_url TEXT,
  scope TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Social Accounts Table
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- References auth service users
  platform_id UUID NOT NULL REFERENCES social_platforms(id),
  platform_user_id VARCHAR(255) NOT NULL,
  instagram_user_id VARCHAR(255), -- Instagram professional account ID (IG_ID)
  username VARCHAR(255),
  display_name VARCHAR(255),
  name VARCHAR(255), -- User's full name
  account_type VARCHAR(50), -- Account type (Business, Media_Creator, etc.)
  profile_picture_url TEXT,
  followers_count INTEGER DEFAULT 0,
  follows_count INTEGER DEFAULT 0,
  media_count INTEGER DEFAULT 0,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_connected BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, platform_id)
);

-- Social Posts Table
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- References auth service users
  social_account_id UUID NOT NULL REFERENCES social_accounts(id),
  platform_post_id VARCHAR(255),
  original_transaction_id UUID, -- Optional link to cashback transaction
  content TEXT NOT NULL,
  media_urls TEXT[], -- Array of media URLs
  post_type VARCHAR(20) DEFAULT 'text' CHECK (post_type IN ('text', 'image', 'video', 'link')),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed', 'deleted', 'pending_review', 'approved', 'rejected')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  likes_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  engagement_score DECIMAL(5,2) DEFAULT 0.00,
  -- Post validation fields
  gps_latitude DECIMAL(10, 8),
  gps_longitude DECIMAL(11, 8),
  timestamp TIMESTAMPTZ,
  content_hash VARCHAR(64), -- SHA256 hash for duplicate detection
  merchant_tags TEXT[], -- Array of merchant tags found in content
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (social_account_id, platform_post_id)
);

-- Social Rewards Table
CREATE TABLE IF NOT EXISTS social_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- References auth service users
  post_id UUID NOT NULL REFERENCES social_posts(id),
  reward_type VARCHAR(20) NOT NULL CHECK (reward_type IN ('post_creation', 'engagement', 'milestone', 'bonus')),
  points_amount INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'awarded', 'expired', 'cancelled')),
  description TEXT,
  awarded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Social Campaigns Table
CREATE TABLE IF NOT EXISTS social_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  required_platforms TEXT[], -- Array of required platforms
  required_post_types TEXT[], -- Array of required post types
  points_per_post INTEGER DEFAULT 0,
  points_per_like INTEGER DEFAULT 0,
  points_per_share INTEGER DEFAULT 0,
  points_per_comment INTEGER DEFAULT 0,
  max_posts_per_user INTEGER DEFAULT 0, -- 0 means unlimited
  max_total_posts INTEGER DEFAULT 0, -- 0 means unlimited
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Social Analytics Table
CREATE TABLE IF NOT EXISTS social_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- References auth service users
  platform_id UUID NOT NULL REFERENCES social_platforms(id),
  date DATE NOT NULL,
  posts_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  followers_count INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0.00,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, platform_id, date)
);

-- Social Verification Table
CREATE TABLE IF NOT EXISTS social_verification (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- References auth service users
  post_id UUID NOT NULL REFERENCES social_posts(id),
  verification_type VARCHAR(20) NOT NULL CHECK (verification_type IN ('manual', 'automatic', 'ai')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  verified_by UUID, -- Admin who verified
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  verification_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Social Settings Table
CREATE TABLE IF NOT EXISTS social_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE, -- References auth service users
  auto_post_enabled BOOLEAN DEFAULT false,
  auto_share_enabled BOOLEAN DEFAULT false,
  notification_enabled BOOLEAN DEFAULT true,
  privacy_level VARCHAR(20) DEFAULT 'public' CHECK (privacy_level IN ('public', 'friends', 'private')),
  content_filters TEXT[], -- Array of content filters
  preferred_platforms TEXT[], -- Array of preferred platforms
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_platforms_name ON social_platforms (name);
CREATE INDEX IF NOT EXISTS idx_social_platforms_active ON social_platforms (is_active);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform_id ON social_accounts (platform_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_connected ON social_accounts (is_connected);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform_user_id ON social_accounts (platform_user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_instagram_user_id ON social_accounts (instagram_user_id);

CREATE INDEX IF NOT EXISTS idx_social_posts_user_id ON social_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_social_account_id ON social_posts (social_account_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts (status);
CREATE INDEX IF NOT EXISTS idx_social_posts_published_at ON social_posts (published_at);
CREATE INDEX IF NOT EXISTS idx_social_posts_created_at ON social_posts (created_at);
CREATE INDEX IF NOT EXISTS idx_social_posts_content_hash ON social_posts (content_hash);
CREATE INDEX IF NOT EXISTS idx_social_posts_gps ON social_posts (gps_latitude, gps_longitude);
CREATE INDEX IF NOT EXISTS idx_social_posts_timestamp ON social_posts (timestamp);

CREATE INDEX IF NOT EXISTS idx_social_rewards_user_id ON social_rewards (user_id);
CREATE INDEX IF NOT EXISTS idx_social_rewards_post_id ON social_rewards (post_id);
CREATE INDEX IF NOT EXISTS idx_social_rewards_reward_type ON social_rewards (reward_type);
CREATE INDEX IF NOT EXISTS idx_social_rewards_status ON social_rewards (status);

CREATE INDEX IF NOT EXISTS idx_social_campaigns_active ON social_campaigns (is_active);
CREATE INDEX IF NOT EXISTS idx_social_campaigns_dates ON social_campaigns (start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_social_analytics_user_id ON social_analytics (user_id);
CREATE INDEX IF NOT EXISTS idx_social_analytics_platform_id ON social_analytics (platform_id);
CREATE INDEX IF NOT EXISTS idx_social_analytics_date ON social_analytics (date);

CREATE INDEX IF NOT EXISTS idx_social_verification_user_id ON social_verification (user_id);
CREATE INDEX IF NOT EXISTS idx_social_verification_post_id ON social_verification (post_id);
CREATE INDEX IF NOT EXISTS idx_social_verification_status ON social_verification (status);

CREATE INDEX IF NOT EXISTS idx_social_settings_user_id ON social_settings (user_id);

-- Ensure unique constraint exists for social posts (handles legacy databases)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'social_posts_account_post_unique'
      AND conrelid = 'social_posts'::regclass
  ) THEN
    BEGIN
      ALTER TABLE social_posts
      ADD CONSTRAINT social_posts_account_post_unique
      UNIQUE (social_account_id, platform_post_id);
    EXCEPTION
      WHEN unique_violation THEN
        RAISE NOTICE 'Unable to add unique constraint social_posts_account_post_unique due to existing duplicates';
      WHEN others THEN
        RAISE NOTICE 'Unable to add unique constraint social_posts_account_post_unique: %', SQLERRM;
    END;
  END IF;
END;
$$;

-- Function to update social analytics
CREATE OR REPLACE FUNCTION update_social_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update daily analytics when post is published
  IF NEW.status = 'published' AND OLD.status != 'published' THEN
    INSERT INTO social_analytics (
      user_id, platform_id, date, posts_count, likes_count, shares_count, 
      comments_count, total_engagement, points_earned
    )
    SELECT 
      NEW.user_id,
      sa.platform_id,
      CURRENT_DATE,
      1,
      NEW.likes_count,
      NEW.shares_count,
      NEW.comments_count,
      NEW.likes_count + NEW.shares_count + NEW.comments_count,
      COALESCE(sr.points_amount, 0)
    FROM social_accounts sa
    LEFT JOIN social_rewards sr ON sr.post_id = NEW.id
    WHERE sa.id = NEW.social_account_id
    ON CONFLICT (user_id, platform_id, date) DO UPDATE SET
      posts_count = social_analytics.posts_count + 1,
      likes_count = social_analytics.likes_count + NEW.likes_count,
      shares_count = social_analytics.shares_count + NEW.shares_count,
      comments_count = social_analytics.comments_count + NEW.comments_count,
      total_engagement = social_analytics.total_engagement + (NEW.likes_count + NEW.shares_count + NEW.comments_count),
      points_earned = social_analytics.points_earned + COALESCE(sr.points_amount, 0),
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update social analytics
CREATE TRIGGER trigger_update_social_analytics
  AFTER UPDATE ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_social_analytics();

-- Function to calculate engagement score
CREATE OR REPLACE FUNCTION calculate_engagement_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate engagement score based on likes, shares, and comments
  NEW.engagement_score := (
    (NEW.likes_count * 1.0) + 
    (NEW.shares_count * 2.0) + 
    (NEW.comments_count * 3.0)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to calculate engagement score
CREATE TRIGGER trigger_calculate_engagement_score
  BEFORE INSERT OR UPDATE ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION calculate_engagement_score();

-- Function to generate content hash and extract merchant tags
CREATE OR REPLACE FUNCTION process_post_content()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate content hash for duplicate detection
  NEW.content_hash := encode(digest(lower(trim(NEW.content)), 'sha256'), 'hex');
  
  -- Extract merchant tags from content (@mentions)
  NEW.merchant_tags := ARRAY(
    SELECT DISTINCT word
    FROM unnest(regexp_split_to_array(NEW.content, ' ')) AS word
    WHERE word ~ '^@[a-zA-Z0-9_]+$'
  );
  
  -- Set status to pending_review for new posts
  IF TG_OP = 'INSERT' AND NEW.status = 'draft' THEN
    NEW.status := 'pending_review';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to process post content
CREATE TRIGGER trigger_process_post_content
  BEFORE INSERT OR UPDATE ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION process_post_content();

-- Backfill migration guard: ensure column exists on existing DBs
DO $$ BEGIN
  BEGIN
    ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS original_transaction_id UUID;
  EXCEPTION WHEN duplicate_column THEN
    -- ignore
  END;
END $$;

-- Insert default social platforms
INSERT INTO social_platforms (name, display_name, api_base_url, auth_url, token_url, scope) VALUES
('facebook', 'Facebook', 'https://graph.facebook.com/v18.0', 'https://www.facebook.com/v18.0/dialog/oauth', 'https://graph.facebook.com/v18.0/oauth/access_token', 'publish_pages,manage_pages'),
('twitter', 'Twitter', 'https://api.twitter.com/2', 'https://twitter.com/i/oauth2/authorize', 'https://api.twitter.com/2/oauth2/token', 'tweet.read,tweet.write,users.read'),
('instagram', 'Instagram', 'https://graph.instagram.com', 'https://api.instagram.com/oauth/authorize', 'https://api.instagram.com/oauth/access_token', 'user_profile,user_media'),
('linkedin', 'LinkedIn', 'https://api.linkedin.com/v2', 'https://www.linkedin.com/oauth/v2/authorization', 'https://www.linkedin.com/oauth/v2/accessToken', 'w_member_social'),
('tiktok', 'TikTok', 'https://open-api.tiktok.com', 'https://www.tiktok.com/auth/authorize', 'https://open-api.tiktok.com/oauth/access_token', 'user.info.basic,video.publish')
ON CONFLICT (name) DO NOTHING;
