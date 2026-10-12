/**
 * config/db.js – TiDB connection pool (mysql2/promise)
 *
 * TiDB Cloud Serverless bắt buộc SSL.
 * TiDB self-hosted không cần SSL – set TIDB_SSL=false trong .env
 */
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

// ── SSL config ────────────────────────────────────────
function buildSsl() {
  if (process.env.TIDB_SSL !== 'true') return false;

  const caPath = process.env.TIDB_CA_PATH;
  if (caPath) {
    return { ca: fs.readFileSync(path.resolve(caPath)) };
  }
  // Fallback: trust system CA bundle (works for TiDB Cloud)
  return { rejectUnauthorized: true };
}

const pool = mysql.createPool({
  host:               process.env.TIDB_HOST     || 'localhost',
  port:               parseInt(process.env.TIDB_PORT || '4000'),
  user:               process.env.TIDB_USER     || 'root',
  password:           process.env.TIDB_PASS     || '',
  database:           process.env.TIDB_NAME     || 'xianxia_chat',
  ssl:                buildSsl(),
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',
  supportBigNumbers:  true,
  bigNumberStrings:   true,
  // TiDB Serverless has stricter timeout
  connectTimeout:     10000,
});

// ── Health check on startup ───────────────────────────
pool.getConnection()
  .then(conn => {
    console.log(`✅ TiDB connected  host=${process.env.TIDB_HOST}  db=${process.env.TIDB_NAME}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌ TiDB connection failed:', err.message);
    console.error('   Code:', err.code, '| Errno:', err.errno);
    console.error('   → Kiểm tra TIDB_HOST/USER/PASS/NAME trong backend/.env');
    console.error('   → TiDB Cloud: database phải được tạo trước bằng npm run db:init');
    process.exit(1);
  });

module.exports = pool;
