/**
 * scripts/migrateDms.js
 * Migration script to create direct_messages and user_blocks tables.
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

  // 1. Create direct_messages table
  const createDmsTable = `
    CREATE TABLE IF NOT EXISTS direct_messages (
      id          BIGINT    NOT NULL AUTO_RANDOM PRIMARY KEY,
      sender_id   BIGINT    NOT NULL,
      receiver_id BIGINT    NOT NULL,
      content     TEXT      NOT NULL,
      type        ENUM('text','sticker','image','file','voice','system') DEFAULT 'text',
      file_url    VARCHAR(1000) DEFAULT NULL,
      file_path   VARCHAR(500)  DEFAULT NULL,
      file_name   VARCHAR(255)  DEFAULT NULL,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_read     TINYINT   DEFAULT 0,
      KEY idx_sender_receiver (sender_id, receiver_id, created_at),
      KEY idx_receiver_created (receiver_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  // 2. Create user_blocks table
  const createBlocksTable = `
    CREATE TABLE IF NOT EXISTS user_blocks (
      user_id         BIGINT NOT NULL,
      blocked_user_id BIGINT NOT NULL,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, blocked_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    console.log('🌀 Creating table "direct_messages"...');
    await conn.execute(createDmsTable);
    console.log('✅ Table "direct_messages" is ready!');

    console.log('🌀 Creating table "user_blocks"...');
    await conn.execute(createBlocksTable);
    console.log('✅ Table "user_blocks" is ready!');

    console.log('\n🎉 All migrations completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await conn.end();
  }
}

migrate();
