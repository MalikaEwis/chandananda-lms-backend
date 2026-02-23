/**
 * Diagnostic script to check multi-tenant setup
 * Run with: node diagnose-issue.js
 */

const mysql = require('mysql2/promise');

async function diagnose() {
  console.log('🔍 Multi-Tenant Setup Diagnostic Tool\n');

  // Database configurations
  const databases = [
    {
      name: 'user_db',
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'root',
      database: 'user_db',
      table: 'users'
    },
    {
      name: 'auth_db',
      host: 'localhost',
      port: 3307,
      user: 'root',
      password: 'root',
      database: 'auth_db',
      table: 'auth_accounts'
    }
  ];

  for (const dbConfig of databases) {
    console.log(`\n📊 Checking ${dbConfig.name}...`);

    try {
      const connection = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database
      });

      console.log(`✓ Connected to ${dbConfig.name}`);

      // Check if table exists
      const [tables] = await connection.query(
        `SHOW TABLES LIKE '${dbConfig.table}'`
      );

      if (tables.length === 0) {
        console.log(`✗ Table '${dbConfig.table}' does not exist!`);
        console.log(`  → Services need to be started to create tables`);
        await connection.end();
        continue;
      }

      console.log(`✓ Table '${dbConfig.table}' exists`);

      // Check if tenantDomain column exists
      const [columns] = await connection.query(
        `SHOW COLUMNS FROM ${dbConfig.table} LIKE 'tenantDomain'`
      );

      if (columns.length === 0) {
        console.log(`✗ Column 'tenantDomain' is MISSING from ${dbConfig.table}!`);
        console.log(`  → This is causing the 500 error`);
        console.log(`  → Solution: Run migration-add-tenant-domain.sql or restart services`);
      } else {
        console.log(`✓ Column 'tenantDomain' exists`);
        console.log(`  Type: ${columns[0].Type}`);
        console.log(`  Default: ${columns[0].Default}`);
      }

      // Check indexes
      const [indexes] = await connection.query(
        `SHOW INDEX FROM ${dbConfig.table}`
      );

      console.log(`\n  Indexes on ${dbConfig.table}:`);
      const uniqueIndexes = indexes.filter(idx => idx.Non_unique === 0);

      if (uniqueIndexes.length === 0) {
        console.log(`  ⚠ No unique indexes found`);
      } else {
        const indexGroups = {};
        uniqueIndexes.forEach(idx => {
          if (!indexGroups[idx.Key_name]) {
            indexGroups[idx.Key_name] = [];
          }
          indexGroups[idx.Key_name].push(idx.Column_name);
        });

        Object.entries(indexGroups).forEach(([name, columns]) => {
          const isComposite = columns.length > 1;
          const hasEmailAndTenant = columns.includes('email') && columns.includes('tenantDomain');

          if (hasEmailAndTenant) {
            console.log(`  ✓ ${name}: (${columns.join(', ')}) - CORRECT for multi-tenant`);
          } else if (columns.includes('email') && columns.length === 1) {
            console.log(`  ✗ ${name}: (${columns.join(', ')}) - OLD index, should be composite`);
          } else {
            console.log(`  · ${name}: (${columns.join(', ')})`);
          }
        });
      }

      // Check sample data
      const [rows] = await connection.query(
        `SELECT COUNT(*) as count FROM ${dbConfig.table}`
      );
      console.log(`\n  Records in table: ${rows[0].count}`);

      if (rows[0].count > 0 && columns.length > 0) {
        const [sample] = await connection.query(
          `SELECT email, tenantDomain FROM ${dbConfig.table} LIMIT 3`
        );
        console.log(`  Sample data:`);
        sample.forEach((row, i) => {
          console.log(`    ${i + 1}. ${row.email} → tenant: ${row.tenantDomain}`);
        });
      }

      await connection.end();

    } catch (error) {
      console.log(`✗ Error connecting to ${dbConfig.name}:`);
      console.log(`  ${error.message}`);
      console.log(`  → Check your .env file in apps/${dbConfig.name.replace('_db', '-service')}`);
    }
  }

  console.log('\n\n📋 Summary:');
  console.log('═══════════════════════════════════════════════════════');
  console.log('If you see "✗ Column tenantDomain is MISSING":');
  console.log('  → The database schema needs to be updated');
  console.log('  → Option 1: Run: mysql -u root -p < migration-add-tenant-domain.sql');
  console.log('  → Option 2: Stop all services and restart them (TypeORM will auto-migrate)');
  console.log('\nIf you see "✗ OLD index":');
  console.log('  → Drop the old index and create composite index');
  console.log('  → Run the migration script');
  console.log('\nIf everything shows ✓:');
  console.log('  → Schema is correct! The 500 error might be from something else');
  console.log('  → Check service console logs for actual error messages');
  console.log('═══════════════════════════════════════════════════════\n');
}

diagnose().catch(console.error);
