import { pool } from './db.js';

async function initDB() {
  console.log('Initializing Database Tables...');

  try {
    // Member master list
    await pool.query(`
      CREATE TABLE IF NOT EXISTS members (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        rank_tier VARCHAR(10) NOT NULL,
        is_active BOOLEAN DEFAULT false
      )
    `);

    // Settings (global)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT PRIMARY KEY DEFAULT 1,
        court_fee_per_person DECIMAL(10, 2) DEFAULT 40,
        shuttle_price DECIMAL(10, 2) DEFAULT 25
      )
    `);

    // Ensure settings exists
    await pool.query(`INSERT IGNORE INTO settings (id, court_fee_per_person, shuttle_price) VALUES (1, 40, 25)`);

    // System States
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_states (
        state_key VARCHAR(50) PRIMARY KEY,
        state_value LONGTEXT
      )
    `);

    // Daily Sessions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(50) PRIMARY KEY,
        date BIGINT NOT NULL,
        status ENUM('active', 'completed') DEFAULT 'active'
      )
    `);

    // Session Games
    await pool.query(`
      CREATE TABLE IF NOT EXISTS games (
        id VARCHAR(50) PRIMARY KEY,
        session_id VARCHAR(50) NOT NULL,
        court_id VARCHAR(20) NOT NULL,
        court_name VARCHAR(50) NOT NULL,
        played_at BIGINT NOT NULL,
        shuttles_used INT DEFAULT 1,
        shuttle_cost DECIMAL(10,2) DEFAULT 25,
        court_fee DECIMAL(10,2) DEFAULT 40,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    // Game Players
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        game_id VARCHAR(50) NOT NULL,
        member_id VARCHAR(50) NOT NULL,
        member_name VARCHAR(100) NOT NULL,
        member_rank VARCHAR(10) NOT NULL,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      )
    `);

    // Payments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(50) PRIMARY KEY,
        session_id VARCHAR(50) NOT NULL,
        member_id VARCHAR(50) NOT NULL,
        member_name VARCHAR(100) NOT NULL,
        member_rank VARCHAR(10) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        method VARCHAR(50) DEFAULT 'Cash',
        note VARCHAR(255),
        created_at BIGINT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ Tables created successfully!');
  } catch (err) {
    console.error('❌ Error creating tables:', err);
  } finally {
    await pool.end();
  }
}

initDB();
