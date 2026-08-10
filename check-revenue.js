import { pool } from './backend/db.js';

async function check() {
  try {
    const sessionId = 'session-1775524180206';
    const [games] = await pool.query('SELECT sum(court_fee) as court_total, sum(shuttle_cost) as shuttle_total FROM games WHERE session_id = ?', [sessionId]);
    const [players] = await pool.query('SELECT count(*) as count FROM game_players p JOIN games g ON p.game_id = g.id WHERE g.session_id = ?', [sessionId]);
    
    // Each game has its costs stored "per person", but in the games table, it's court_fee (total for the court? or per person?).
    // In server.js sync logic: 
    // [gId, sessionId, g.courtId, g.courtName, g.playedAt, g.shuttlesUsed, g.shuttleCostPerPerson, g.courtFeePerPerson]
    // So the games table stores PER PERSON costs.
    
    // Total revenue for games = Sum over all games calculated as (Number of players in that game * (courtFeePerPerson + shuttleCostPerPerson))
    // Wait, in my resync/pullSession logic, I treat them as per person.
    
    const [gamesList] = await pool.query('SELECT * FROM games WHERE session_id = ?', [sessionId]);
    let totalPotential = 0;
    for (const g of gamesList) {
      const [pCount] = await pool.query('SELECT count(*) as count FROM game_players WHERE game_id = ?', [g.id]);
      const count = pCount[0].count;
      totalPotential += count * (Number(g.court_fee) + Number(g.shuttle_cost));
    }
    
    console.log(`Session ${sessionId} Potential Revenue (Games only):`, totalPotential);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
