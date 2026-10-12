/**
 * scripts/migrateFriends.js
 * Migration script to create user_friends table.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const ssl = process.env.TIDB_SSL === 'true' ? { rejectUnauthorized: true } : false;
  const dbName = process.env.TIDB_NAME || 'xianxia_chat';

  console.log(`🌀 Connecting to database: ${dbName}...`);
  let conn;
  try {
    conn = await mysql.createConnection({
      host:           process.env.TIDB_HOST,
      port:           parseInt(process.env.TIDB_PORT || '4000'),
      user:           process.env.TIDB_USER,
      password:       process.env.TIDB_PASS,
      database:       dbName,
      ssl,
      connectTimeout: 15000,
    });
    console.log('✅ Connected successfully!');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }

  // Create user_friends table
  const createFriendsTable = `
    CREATE TABLE IF NOT EXISTS user_friends (
      user_id         BIGINT NOT NULL,
      friend_id       BIGINT NOT NULL,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, friend_id),
      KEY idx_friend_id (friend_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    console.log('🌀 Creating table "user_friends"...');
    await conn.execute(createFriendsTable);
    console.log('✅ Table "user_friends" is ready!');

    console.log('\n🎉 Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await conn.end();
  }
}

migrate();
