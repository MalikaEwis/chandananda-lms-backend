-- Quick diagnostic script to check if tenantDomain columns exist
-- Run this to see the current state of your database schema

-- Check User Service Database
USE user_db;
SELECT 'USERS TABLE STRUCTURE:' as '';
DESCRIBE users;

SELECT '' as '';
SELECT 'USERS TABLE INDEXES:' as '';
SHOW INDEX FROM users;

-- Check Auth Service Database
USE auth_db;
SELECT '' as '';
SELECT 'AUTH_ACCOUNTS TABLE STRUCTURE:' as '';
DESCRIBE auth_accounts;

SELECT '' as '';
SELECT 'AUTH_ACCOUNTS TABLE INDEXES:' as '';
SHOW INDEX FROM auth_accounts;

-- Check if tenantDomain columns exist
SELECT '' as '';
SELECT 'CHECKING TENANT DOMAIN COLUMNS:' as '';

SELECT
    'users.tenantDomain' as table_column,
    CASE
        WHEN COUNT(*) > 0 THEN '✓ EXISTS'
        ELSE '✗ MISSING'
    END as status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'user_db'
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'tenantDomain'

UNION ALL

SELECT
    'auth_accounts.tenantDomain' as table_column,
    CASE
        WHEN COUNT(*) > 0 THEN '✓ EXISTS'
        ELSE '✗ MISSING'
    END as status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'auth_db'
  AND TABLE_NAME = 'auth_accounts'
  AND COLUMN_NAME = 'tenantDomain';
