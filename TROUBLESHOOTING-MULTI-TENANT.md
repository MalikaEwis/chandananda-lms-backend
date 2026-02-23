# Multi-Tenant Implementation Troubleshooting Guide

## Issue: Getting 500 Internal Server Error on Login

This happens because the database schema hasn't been updated with the new `tenantDomain` column.

## Solution Options

### Option 1: Restart Services (Automatic Schema Update)

Since both services have `synchronize: true` enabled, restarting them will automatically update the database schema.

**Steps:**
1. Stop all running services (Auth, User, API Gateway)
2. Start them again:
   ```bash
   # Terminal 1: Start User Service
   cd apps/user-service
   npm run start:dev

   # Terminal 2: Start Auth Service
   cd apps/auth-service
   npm run start:dev

   # Terminal 3: Start API Gateway
   cd apps/api-gateway
   npm run start:dev
   ```

3. Watch the console output for any errors during startup
4. If you see errors about duplicate columns, proceed to Option 2

### Option 2: Manual Database Migration

If automatic synchronization fails or you prefer manual control:

**Steps:**
1. Connect to your MySQL database
2. Run the migration script:
   ```bash
   mysql -u root -p < migration-add-tenant-domain.sql
   ```

   Or execute it in MySQL Workbench / phpMyAdmin

3. Restart all services

### Option 3: Drop and Recreate Tables (DEVELOPMENT ONLY)

⚠️ **WARNING: This will DELETE ALL DATA**

Only use this in development when you don't have important data:

```sql
-- Drop and let TypeORM recreate
USE user_db;
DROP TABLE users;

USE auth_db;
DROP TABLE auth_accounts;
DROP TABLE refresh_tokens;
```

Then restart the services - TypeORM will recreate tables with the correct schema.

## Verification Steps

After applying the fix, verify it worked:

### 1. Check Database Schema

```sql
-- Check users table
USE user_db;
DESCRIBE users;
-- Should show tenantDomain column

SHOW INDEX FROM users;
-- Should show composite unique index on (email, tenantDomain)

-- Check auth_accounts table
USE auth_db;
DESCRIBE auth_accounts;
-- Should show tenantDomain column

SHOW INDEX FROM auth_accounts;
-- Should show composite unique index on (email, tenantDomain)
```

### 2. Test Registration (Postman)

**Test A: Register with tenant header**
```
POST http://localhost:3000/auth/register
Headers:
  x-tenant-domain: cc.lk
Body:
{
  "email": "teacher1@cc.lk",
  "password": "Test@1234",
  "firstName": "Teacher",
  "lastName": "One",
  "role": "TEACHER"
}
```

Expected Response: ✅ 200/201 with user object and tokens

**Test B: Register same email in different tenant**
```
POST http://localhost:3000/auth/register
Headers:
  x-tenant-domain: school1.edu
Body:
{
  "email": "teacher1@cc.lk",
  "password": "Test@5678",
  "firstName": "Teacher",
  "lastName": "School1",
  "role": "TEACHER"
}
```

Expected Response: ✅ 200/201 (should NOT conflict!)

### 3. Test Login (Postman)

**Test C: Login to cc.lk tenant**
```
POST http://localhost:3000/auth/login
Headers:
  x-tenant-domain: cc.lk
Body:
{
  "email": "teacher1@cc.lk",
  "password": "Test@1234"
}
```

Expected Response: ✅ 200 with tokens

**Test D: Login to school1.edu tenant**
```
POST http://localhost:3000/auth/login
Headers:
  x-tenant-domain: school1.edu
Body:
{
  "email": "teacher1@cc.lk",
  "password": "Test@5678"
}
```

Expected Response: ✅ 200 with tokens (different password!)

**Test E: Wrong tenant**
```
POST http://localhost:3000/auth/login
Headers:
  x-tenant-domain: wrong.tenant
Body:
{
  "email": "teacher1@cc.lk",
  "password": "Test@1234"
}
```

Expected Response: ✅ 401 Unauthorized (Invalid credentials)

## Common Issues

### Issue: Column 'tenantDomain' already exists
**Solution:** The column was partially added. Drop it and run the migration again:
```sql
ALTER TABLE users DROP COLUMN tenantDomain;
ALTER TABLE auth_accounts DROP COLUMN tenantDomain;
```
Then restart services or run migration.

### Issue: Duplicate key error
**Solution:** Old unique index still exists. Drop old indexes:
```sql
-- Check existing indexes
SHOW INDEX FROM users;
SHOW INDEX FROM auth_accounts;

-- Drop the old single-column unique index (use actual index name from SHOW INDEX)
DROP INDEX <old_index_name> ON users;
DROP INDEX <old_index_name> ON auth_accounts;
```

### Issue: Services won't start
**Solution:** Check .env files exist in each service directory with correct DB credentials.

## Database Connection Details

Make sure your `.env` files are configured correctly:

**apps/user-service/.env:**
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=root
DB_NAME=user_db
```

**apps/auth-service/.env:**
```
DB_HOST=localhost
DB_PORT=3307  # Note: different port if running separate MySQL instance
DB_USER=root
DB_PASS=root
DB_NAME=auth_db
JWT_ACCESS_SECRET=your_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
```
