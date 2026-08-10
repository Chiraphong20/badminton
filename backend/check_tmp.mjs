import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: '152.42.227.103', user: 'root', password: 'megroup@72147321',
  database: 'smashpang_db', port: 3306, connectTimeout: 10000
});

const [rows] = await pool.query(`
  SELECT s.id as session_id, s.date, gp.member_name, gp.member_id, g.id as game_id, g.shuttle_cost
  FROM sessions s
  JOIN games g ON g.session_id = s.id
  JOIN game_players gp ON gp.game_id = g.id
  WHERE gp.member_name LIKE '%แบงค์%'
  AND s.date >= 1783616400000 AND s.date <= 1783789200000
  ORDER BY s.date, gp.member_name
`);
console.log(JSON.stringify(rows, null, 2));
await pool.end();
