import { pool } from './backend/db.js';

async function check() {
  try {
    const [sessions] = await pool.query('SELECT * FROM sessions');
    console.log('Sessions:', sessions);
    
    for (const s of sessions) {
      const [games] = await pool.query('SELECT count(*) as count FROM games WHERE session_id = ?', [s.id]);
      const [payments] = await pool.query('SELECT count(*) as count FROM payments WHERE session_id = ?', [s.id]);
      console.log(`Session ${s.id}: Games: ${games[0].count}, Payments: ${payments[0].count}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
