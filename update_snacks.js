import { pool } from './backend/db.js';

const NEW_SNACKS = [
  { id: 'water-s', name: 'น้ำเปล่า (เล็ก)', price: 10, icon: '💧', image: '/น้ำเล็ก.jpg' },
  { id: 'water-l', name: 'น้ำเปล่า (ใหญ่)', price: 20, icon: '💧', image: '/น้ำ ใหญ่.jpg' },
  { id: 'gatorade-s', name: 'เกเตอเรด (เล็ก)', price: 17, icon: '⚡', image: '/เกตาเล็ต เล็ก.jpg' },
  { id: 'gatorade-l', name: 'เกเตอเรด (ใหญ่)', price: 25, icon: '⚡', image: '/เกตาเล็ต ใหญ่.jpg' },
  { id: 'sponsor', name: 'สปอนเซอร์', price: 15, icon: '⚡', image: '/สปอนเซอร์.jpg' },
  { id: 'm150', name: 'M-150', price: 15, icon: '🔥', image: '/M150.jpg' },
  { id: 'pepsi', name: 'แป๊ปซี่', price: 17, icon: '🥤', image: '/แปปซี่.webp' },
  { id: 'lipton-s', name: 'ลิปตัน (เล็ก)', price: 20, icon: '🥤', image: '/ลิปตันเล็ก.jpg' },
  { id: 'lipton-l', name: 'ลิปตัน (ใหญ่)', price: 25, icon: '🥤', image: '/ลิบตันใหญ่.jpg' },
  { id: 'kato', name: 'กาโตะ', price: 15, icon: '🧃', image: '/กาโตะ.jpg' },
  { id: 'coconut', name: 'น้ำมะพร้าว', price: 25, icon: '🥥', image: '/น้ำมะพร้าว.jpg' },
  { id: 'ichitan', name: 'อิชิตัน', price: 25, icon: '🍃', image: '/อิชิตัน.jpg' },
  { id: 'oishi', name: 'โออิชิ', price: 20, icon: '🍃', image: '/โออิชิ.jpg' },
  { id: 'vitamilk', name: 'ไวตามิ้ลค์', price: 15, icon: '🥛', image: '/ไวตามิล.jpg' },
  { id: 'singha', name: 'เบียร์สิงห์', price: 60, icon: '🍺', image: '/เบียร์สิงห์.jpg' },
  { id: 'shuttle', name: 'ลูกแบด', price: 100, icon: '🏸' },
];

async function updateSnacks() {
  try {
    const [rows] = await pool.query('SELECT state_value FROM system_states WHERE state_key = "state"');
    let state = {};
    if (rows.length > 0 && rows[0].state_value) {
      state = JSON.parse(rows[0].state_value);
    }
    
    state.snacks = NEW_SNACKS;
    
    await pool.query(
      'INSERT INTO system_states (state_key, state_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_value = VALUES(state_value)',
      ['state', JSON.stringify(state)]
    );
    
    console.log('✅ Updated snacks in Database successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error updating snacks:', err);
    process.exit(1);
  }
}

updateSnacks();
