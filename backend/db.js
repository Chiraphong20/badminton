import 'dotenv/config';
import mysql from 'mysql2/promise';

const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Missing required DB env var(s): ${missing.join(', ')}. ` +
    `Copy .env.example to .env (project root) and fill in real values.`
  );
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  // DB อยู่คนละเครื่องกับ backend (VPS แยกกัน) — กัน connection หลุด/ECONNRESET
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 20000,
});

// ทดสอบการเชื่อมต่อทันทีตอน server เริ่มทำงาน จะได้เห็น error ชัดๆ ใน log ถ้าต่อ DB ไม่ติด
pool.getConnection()
  .then(connection => {
    console.log('✅ เชื่อมต่อ Database สำเร็จแล้ว! (Keep-Alive Enabled)');
    connection.release();
  })
  .catch(err => {
    console.error('❌ เชื่อมต่อ Database ไม่สำเร็จ:', err.message);
  });
