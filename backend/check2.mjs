import mysql from 'mysql2/promise';
const pool = mysql.createPool({
  host: '152.42.227.103', user: 'root', password: 'megroup@72147321',
  database: 'smashpang_db', port: 3306, connectTimeout: 10000
});
const [sessions] = await pool.query(`SELECT id, date, members_snapshot FROM sessions WHERE id IN ('session-1783683864811','session-1783706027892')`);
sessions.forEach(s => {
  console.log('---session', s.id, new Date(Number(s.date)).toString());
  const snap = JSON.parse(s.members_snapshot || '[]');
  const m = snap.find(x => x.name && x.name.includes('แบงค์'));
  console.log('snapshot member:', JSON.stringify(m));
});
const [pays] = await pool.query(`SELECT p.session_id, p.member_name, p.amount, p.details FROM payments p WHERE p.session_id IN ('session-1783683864811','session-1783706027892') AND p.member_name LIKE '%แบงค์%'`);
console.log('payments:', JSON.stringify(pays, null, 2));
await pool.end();
