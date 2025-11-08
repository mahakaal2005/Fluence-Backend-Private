-- Auth Service Database Schema
-- This service handles only authentication and user management

-- Create required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

-- Users table (core authentication only)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  auth_provider TEXT NOT NULL DEFAULT 'password' CHECK (auth_provider IN ('password','google','facebook','phone','guest')),
  provider_id TEXT,
  phone TEXT,
  date_of_birth DATE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin','merchant','moderator')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','deleted','flagged')),
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User sessions table (for session management)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email verification tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User login attempts table (for security)
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email TEXT,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users (auth_provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_is_approved ON users (is_approved);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions (is_active);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens (token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens (token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON email_verification_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON login_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts (email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_address ON login_attempts (ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts (created_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_success ON login_attempts (success);

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM password_reset_tokens WHERE expires_at < NOW();
  DELETE FROM email_verification_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to log login attempts
CREATE OR REPLACE FUNCTION log_login_attempt(
  p_user_id UUID,
  p_email TEXT,
  p_ip_address INET,
  p_user_agent TEXT,
  p_success BOOLEAN,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO login_attempts (
    user_id, email, ip_address, user_agent, success, failure_reason
  ) VALUES (
    p_user_id, p_email, p_ip_address, p_user_agent, p_success, p_failure_reason
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check for suspicious login attempts
CREATE OR REPLACE FUNCTION check_suspicious_login_attempts(
  p_email TEXT,
  p_ip_address INET,
  p_hours INTEGER DEFAULT 24
)
RETURNS INTEGER AS $$
DECLARE
  failed_attempts INTEGER;
BEGIN
  SELECT COUNT(*) INTO failed_attempts
  FROM login_attempts
  WHERE (email = p_email OR ip_address = p_ip_address)
    AND success = false
    AND created_at > NOW() - INTERVAL '1 hour' * p_hours;
  
  RETURN failed_attempts;
END;
$$ LANGUAGE plpgsql;

-- Function to update user last login
CREATE OR REPLACE FUNCTION update_user_last_login(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE users 
  SET updated_at = NOW() 
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;