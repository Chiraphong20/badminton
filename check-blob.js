const { pool } = require('./backend/db.js');

async function check() {
  try {
    const [rows] = await pool.query("SELECT state_value FROM system_states WHERE state_key = 'sessionHistory'");
    if (rows.length === 0) {
      console.log('No sessionHistory found');
      return;
    }
    const history = JSON.parse(rows[0].state_value);
    console.log('Number of sessions:', history.length);
    history.forEach(s => {
      console.log(`Session ${s.id}: membersSnapshot length: ${s.membersSnapshot?.length}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
