/**
 * scripts/initDb.js
 * Kết nối TiDB mà KHÔNG chỉ định database trước,
 * tạo database rồi mới chạy schema.
 */
require('dotenv').config();
const mysql  = require('mysql2/promise');
const fs     = require('fs');
const path   = require('path');

async function initDb() {
  // ── Bước 1: Kết nối không chỉ định database ────────
  const ssl = process.env.TIDB_SSL === 'true' ? { rejectUnauthorized: true } : false;

  let conn;
  try {
    conn = await mysql.createConnection({
      host:           process.env.TIDB_HOST,
      port:           parseInt(process.env.TIDB_PORT || '4000'),
      user:           process.env.TIDB_USER,
      password:       process.env.TIDB_PASS,
      ssl,
      connectTimeout: 15000,
    });
    console.log('✅ Kết nối TiDB thành công');
  } catch (err) {
    console.error('❌ Không kết nối được TiDB:', err.message);
    console.error('   → Kiểm tra TIDB_HOST, TIDB_USER, TIDB_PASS trong backend/.env');
    process.exit(1);
  }

  // ── Bước 2: Tạo database nếu chưa có ───────────────
  const dbName = process.env.TIDB_NAME || 'xianxia_chat';
  try {
    await conn.execute(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.execute(`USE \`${dbName}\``);
    console.log(`✅ Database "${dbName}" sẵn sàng`);
  } catch (err) {
    console.error('❌ Lỗi tạo database:', err.message);
    await conn.end();
    process.exit(1);
  }

  // ── Bước 3: Đọc & chạy schema.sql ──────────────────
  const schemaPath = path.join(__dirname, '../../schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ Không tìm thấy schema.sql tại:', schemaPath);
    await conn.end();
    process.exit(1);
  }

  const raw = fs.readFileSync(schemaPath, 'utf-8');

  // Tách từng lệnh SQL (bỏ comment và dòng trống)
  const statements = raw
    .replace(/--.*$/gm, '')      // xóa comment --
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 3);  // bỏ dòng rỗng / quá ngắn

  let ok = 0, skip = 0;
  for (const sql of statements) {
    // Bỏ qua CREATE DATABASE / USE (đã xử lý trên)
    if (/^(CREATE DATABASE|USE\b)/i.test(sql)) { skip++; continue; }
    try {
      await conn.execute(sql);
      ok++;
    } catch (err) {
      // Bỏ qua "already exists" – chạy idempotent
      if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.errno === 1050) {
        skip++;
      } else {
        console.warn(`⚠️  Bỏ qua: ${sql.substring(0, 60).replace(/\n/g,' ')}…`);
        console.warn(`   Lỗi: ${err.message}`);
        skip++;
      }
    }
  }

  console.log(`\n🎉 Schema khởi tạo xong! (${ok} lệnh thành công, ${skip} bỏ qua)`);
  await conn.end();
  process.exit(0);
}

initDb();
