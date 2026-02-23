-- Migration to add tenantDomain column to users and auth_accounts tables
-- Run this script against both user_db and auth_db databases

-- ============================================
-- FOR USER_DB (User Service Database)
-- ============================================
USE user_db;

-- Add tenantDomain column if it doesn't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS tenantDomain VARCHAR(100) NOT NULL DEFAULT 'cc.lk';

-- Drop the old unique index on email only (if exists)
-- Note: MySQL requires you to know the index name. It might be different.
-- Check with: SHOW INDEX FROM users;
DROP INDEX IF EXISTS IDX_97672ac88f789774dd47f7c8be ON users;
DROP INDEX IF EXISTS email ON users;

-- Create composite unique index on (email, tenantDomain)
CREATE UNIQUE INDEX IDX_email_tenantDomain ON users(email, tenantDomain);

-- ============================================
-- FOR AUTH_DB (Auth Service Database)
-- ============================================
USE auth_db;

-- Add tenantDomain column if it doesn't exist
ALTER TABLE auth_accounts
ADD COLUMN IF NOT EXISTS tenantDomain VARCHAR(100) NOT NULL DEFAULT 'cc.lk';

-- Drop the old unique index on email only (if exists)
-- Note: MySQL requires you to know the index name. It might be different.
-- Check with: SHOW INDEX FROM auth_accounts;
DROP INDEX IF EXISTS IDX_c414beb6f8961120c0a4e0b8e3 ON auth_accounts;
DROP INDEX IF EXISTS email ON auth_accounts;

-- Create composite unique index on (email, tenantDomain)
CREATE UNIQUE INDEX IDX_email_tenantDomain ON auth_accounts(email, tenantDomain);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify the changes

-- Check users table structure
USE user_db;
DESCRIBE users;
SHOW INDEX FROM users;

-- Check auth_accounts table structure
USE auth_db;
DESCRIBE auth_accounts;
SHOW INDEX FROM auth_accounts;
