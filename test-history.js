import { pool } from './backend/db.js';

async function testHistory() {
  const dateInt = 1775524180206; // April 7th
  console.log('Testing date:', dateInt);
  
  // 1. Get Session
  const [sessions] = await pool.query('SELECT * FROM sessions WHERE date = ?', [dateInt]);
  if (sessions.length === 0) { console.log('Session not found'); process.exit(1); }
  const sessionId = sessions[0].id;
  console.log('Session ID:', sessionId);

  // 2. Get Games
  const [games] = await pool.query('SELECT * FROM games WHERE session_id = ?', [sessionId]);
  console.log('Games count:', games.length);

  // 3. Get Game Players
  const gameIds = games.map(g => g.id);
  const [players] = await pool.query('SELECT * FROM game_players WHERE game_id IN (?)', [gameIds]);
  console.log('Total player records (duplicate per game):', players.length);

  // 4. Group by player
  const memberCosts = new Map();
  players.forEach(p => {
    if (!memberCosts.has(p.member_id)) {
      memberCosts.set(p.member_id, { shuttle: 0, court: 0, games: 0 });
    }
    const m = memberCosts.get(p.member_id);
    m.games++;
    const g = games.find(x => x.id === p.game_id);
    m.shuttle += Number(g.shuttle_cost);
  });

  // Apply default court fee
  let totalPotential = 0;
  memberCosts.forEach(m => {
    m.court = 40; // Default
    totalPotential += m.shuttle + m.court;
  });

  console.log('Calculated Potential Revenue:', totalPotential);
  process.exit(0);
}

testHistory();
