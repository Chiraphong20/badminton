import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { pool } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// Trust the first proxy hop (Docker/nginx/reverse proxy) so req.ip reflects the
// real client for login rate-limiting instead of the proxy's own address.
app.set('trust proxy', 1);

// CORS — restrict browser cross-origin access to known frontend origin(s) instead
// of reflecting every origin. Configure via CORS_ORIGIN (comma-separated) to match
// wherever the frontend is actually deployed (Vercel, a custom domain, etc.).
// Falls back to the local Vite dev origin so `npm run dev` keeps working out of
// the box. Requests with no Origin header (curl, server-to-server, same-origin
// page loads) are always allowed — this only gates browser cross-origin fetches.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

if (!process.env.CORS_ORIGIN) {
  console.warn(`⚠️  CORS_ORIGIN ไม่ได้ตั้งใน .env — อนุญาตแค่ ${allowedOrigins.join(', ')} (dev) ตั้งค่าเป็นโดเมนจริงของ frontend ก่อน deploy จริง`);
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} ไม่อยู่ใน allowlist`));
  }
}));
app.use(express.json({ limit: '50mb' }));

// เซฟตี้เน็ต: DB อยู่คนละ VPS กับ backend ผ่านอินเทอร์เน็ตสาธารณะ — บางครั้ง connection ค้าง
// เงียบๆ โดยไม่ error (ไม่มี query timeout ตั้งไว้) ทำให้ request ค้างไม่ตอบกลับเลย ถ้าเกิดขึ้น
// ให้ตอบ 503 หลัง 20 วิแทนที่จะปล่อยให้ client รอไม่รู้จบ
app.use((req, res, next) => {
  res.setTimeout(20000, () => {
    if (!res.headersSent) res.status(503).json({ error: 'เซิร์ฟเวอร์ตอบสนองช้าเกินไป กรุณาลองใหม่อีกครั้ง' });
  });
  next();
});

// Serve static assets from the frontend build
app.use(express.static(path.join(__dirname, '../dist')));

// ── AUTH ─────────────────────────────────────────────────────────────────
// Single shared admin PIN, verified server-side. The PIN never lives on the
// client — only its hash sits in `settings`. A correct /api/login exchanges
// it for a signed, expiring bearer token (HMAC, no session store needed).
// Every /api/* route requires that token EXCEPT the ones explicitly marked
// public below: /api/health, /api/login, and GET /api/state (the public
// no-login Queue View screen reads live state from that last one).
const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.AUTH_SECRET) {
  console.warn('⚠️  AUTH_SECRET ไม่ได้ตั้งใน .env — ใช้ค่าสุ่มชั่วคราว (ทุกคนจะหลุด login เมื่อ restart เซิร์ฟเวอร์) ตั้ง AUTH_SECRET ใน .env เพื่อให้ session อยู่ข้าม restart ได้');
}
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 ชั่วโมง ต่อการ login หนึ่งครั้ง

function hashPin(pin) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(String(pin)).digest('hex');
}

function timingSafeStringEqual(a, b) {
  const aBuf = Buffer.from(String(a || ''));
  const bBuf = Buffer.from(String(b || ''));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  if (!timingSafeStringEqual(sig, expectedSig)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบก่อนใช้งาน' });
  req.auth = data;
  next();
}

// Basic brute-force throttle on PIN login — PINs are short (4-8 digits), so
// attempts must be limited. Not a hard guarantee (best-effort per IP), but it
// meaningfully slows down blind guessing.
const loginAttempts = new Map(); // ip -> { count, resetAt }
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

function isRateLimited(ip) {
  const rec = loginAttempts.get(ip);
  if (!rec || Date.now() > rec.resetAt) return false;
  return rec.count >= MAX_LOGIN_ATTEMPTS;
}
function recordFailedLogin(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || now > rec.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    rec.count += 1;
  }
}
function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// SERVER TIME — public. ใช้เป็นเวลาอ้างอิงตอนเริ่ม session แทนนาฬิกาเครื่องลูกค้า
// (เครื่องลูกค้าบางเครื่องตั้งวันที่ผิด ทำให้ข้อมูลถูกไปลงวันที่ผิดถ้าใช้ Date.now() ฝั่ง client)
app.get('/api/time', (req, res) => {
  res.json({ now: Date.now() });
});

// LIST CLUBS — public, no PIN/settings exposed. Powers the login screen's club picker.
app.get('/api/clubs', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, slug FROM clubs ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE CLUB — gated by a server-only secret (CLUB_BOOTSTRAP_SECRET), separate from the
// per-club PIN system. This is how the app owner provisions a new club (via curl) — not a
// public self-serve sign-up flow.
app.post('/api/clubs', async (req, res) => {
  const secret = req.headers['x-bootstrap-secret'];
  if (!process.env.CLUB_BOOTSTRAP_SECRET || secret !== process.env.CLUB_BOOTSTRAP_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { name, slug, pin } = req.body;
  if (!name || !slug || !pin) return res.status(400).json({ error: 'ต้องระบุ name, slug, pin' });
  if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: 'slug ต้องเป็นตัวพิมพ์เล็ก/ตัวเลข/ขีดกลางเท่านั้น' });
  if (!/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: 'PIN ต้องเป็นตัวเลข 4-8 หลัก' });
  try {
    const id = 'club-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await pool.query(
      'INSERT INTO clubs (id, name, slug, pin_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, name, slug, hashPin(pin), Date.now()]
    );
    res.json({ success: true, club: { id, name, slug } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'slug นี้ถูกใช้ไปแล้ว' });
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// LOGIN — pick a club, trade its PIN for a bearer token scoped to that club
app.post('/api/login', async (req, res) => {
  const ip = req.ip;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'ลองผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่' });
  }
  const { clubSlug, pin } = req.body;
  if (!pin || typeof pin !== 'string') return res.status(400).json({ error: 'กรุณาระบุ PIN' });

  try {
    let club;
    if (clubSlug && typeof clubSlug === 'string') {
      const [rows] = await pool.query('SELECT id, name, slug, pin_hash FROM clubs WHERE slug = ?', [clubSlug]);
      club = rows[0];
    } else {
      // Backward-compat: a frontend build from before multi-club shipped still sends only
      // {pin}, no clubSlug (e.g. the live frontend hasn't redeployed yet). If this DB has
      // exactly one club, log straight into it instead of breaking existing logins — once
      // there's more than one club we can no longer guess which one, so require clubSlug.
      const [rows] = await pool.query('SELECT id, name, slug, pin_hash FROM clubs');
      if (rows.length === 1) club = rows[0];
      else return res.status(400).json({ error: 'กรุณาเลือกก๊วน' });
    }
    if (!club || !club.pin_hash || !timingSafeStringEqual(hashPin(pin), club.pin_hash)) {
      recordFailedLogin(ip);
      return res.status(401).json({ error: 'PIN ไม่ถูกต้อง' });
    }
    clearLoginAttempts(ip);
    const exp = Date.now() + TOKEN_TTL_MS;
    const token = signToken({ role: 'admin', clubId: club.id, exp });
    res.json({ success: true, token, expiresAt: exp, club: { id: club.id, name: club.name, slug: club.slug } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// CHANGE PIN — requires a valid session AND the current PIN, scoped to the caller's club
app.post('/api/change-pin', requireAuth, async (req, res) => {
  const { currentPin, newPin } = req.body;
  if (!newPin || !/^\d{4,8}$/.test(newPin)) {
    return res.status(400).json({ error: 'PIN ใหม่ต้องเป็นตัวเลข 4-8 หลัก' });
  }
  try {
    const [rows] = await pool.query('SELECT pin_hash FROM clubs WHERE id = ?', [req.auth.clubId]);
    const storedHash = rows[0]?.pin_hash;
    if (!storedHash || !timingSafeStringEqual(hashPin(currentPin), storedHash)) {
      return res.status(401).json({ error: 'PIN ปัจจุบันไม่ถูกต้อง' });
    }
    await pool.query('UPDATE clubs SET pin_hash = ? WHERE id = ?', [hashPin(newPin), req.auth.clubId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Auto-migrate: ensure payments.details, sessions.members_snapshot, settings.admin_pin_hash,
// settings.promptpay_id exist
(async () => {
  try {
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS details JSON`);
    await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS members_snapshot LONGTEXT`);
    await pool.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS admin_pin_hash VARCHAR(255)`);
    await pool.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS promptpay_id VARCHAR(20)`);
    console.log('✅ DB migration: members_snapshot, payments.details, settings.admin_pin_hash, settings.promptpay_id ensured');
  } catch (e) {
    // MySQL < 8.0 doesn't support IF NOT EXISTS on ALTER TABLE
    try {
      await pool.query(`ALTER TABLE payments ADD COLUMN details LONGTEXT NULL`);
      await pool.query(`ALTER TABLE sessions ADD COLUMN members_snapshot LONGTEXT NULL`);
      await pool.query(`ALTER TABLE settings ADD COLUMN admin_pin_hash VARCHAR(255) NULL`);
      await pool.query(`ALTER TABLE settings ADD COLUMN promptpay_id VARCHAR(20) NULL`);
      console.log('✅ DB migration: columns added');
    } catch (e2) {
      // Columns already exist - that's fine
      console.log('ℹ️  columns already exist');
    }
  }

  // ── Multi-club migration ────────────────────────────────────────────────
  // เดิม: settings มีแถวเดียว (id=1) ใช้ร่วมกันทั้ง DB = ล็อกอินเดียว/ก๊วนเดียวต่อ DB
  // ใหม่: ตาราง clubs (หลายแถว = หลายก๊วน ในโปรแกรมเดียว/DB เดียว) + club_id บน members/sessions/
  // system_states เพื่อแยกข้อมูลแต่ละก๊วนออกจากกัน ล็อกอินต้องเลือกก๊วนก่อนถึงจะใส่ PIN ได้
  const ensureCompositePrimaryKey = async (table, cols) => {
    try {
      const [pkCols] = await pool.query(
        `SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'`,
        [table]
      );
      const have = pkCols.map(r => r.COLUMN_NAME);
      if (cols.every(c => have.includes(c)) && have.length === cols.length) return; // already correct
      await pool.query(`ALTER TABLE ${table} DROP PRIMARY KEY, ADD PRIMARY KEY (${cols.join(', ')})`);
      console.log(`✅ Multi-club migration: ${table} primary key changed to (${cols.join(', ')})`);
    } catch (e) {
      console.warn(`⚠️  Could not verify/update ${table} primary key:`, e.message);
    }
  };

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clubs (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(50) NOT NULL UNIQUE,
        pin_hash VARCHAR(255),
        court_fee_per_person DECIMAL(10,2) DEFAULT 40,
        shuttle_price DECIMAL(10,2) DEFAULT 25,
        promptpay_id VARCHAR(20),
        created_at BIGINT NOT NULL
      )
    `);

    for (const table of ['members', 'sessions', 'system_states']) {
      try {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS club_id VARCHAR(50)`);
      } catch (e) {
        try { await pool.query(`ALTER TABLE ${table} ADD COLUMN club_id VARCHAR(50) NULL`); } catch (e2) { /* already exists */ }
      }
    }

    // Backfill: รันครั้งเดียว (idempotent — เช็คว่ามีก๊วนอยู่แล้วหรือยังก่อน) สร้างก๊วนแรกจาก
    // settings เดิม (id=1) แล้วย้ายข้อมูลที่ยังไม่มี club_id ทั้งหมดให้เป็นของก๊วนนี้ — คง PIN เดิมไว้
    // ให้ล็อกอินได้เหมือนเดิม ไม่มีใครหลุดออกจากระบบ
    const [existingClubs] = await pool.query('SELECT id FROM clubs LIMIT 1');
    if (existingClubs.length === 0) {
      const [settingsRows] = await pool.query('SELECT * FROM settings WHERE id = 1');
      const s = settingsRows[0] || {};
      const defaultClubId = 'club-' + Date.now().toString(36);
      const defaultSlug = process.env.DEFAULT_CLUB_SLUG || 'default';
      await pool.query(
        'INSERT INTO clubs (id, name, slug, pin_hash, court_fee_per_person, shuttle_price, promptpay_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [defaultClubId, process.env.DEFAULT_CLUB_NAME || 'ก๊วนของฉัน', defaultSlug, s.admin_pin_hash || null,
         s.court_fee_per_person ?? 40, s.shuttle_price ?? 25, s.promptpay_id || null, Date.now()]
      );
      await pool.query('UPDATE members SET club_id = ? WHERE club_id IS NULL', [defaultClubId]);
      await pool.query('UPDATE sessions SET club_id = ? WHERE club_id IS NULL', [defaultClubId]);
      await pool.query('UPDATE system_states SET club_id = ? WHERE club_id IS NULL', [defaultClubId]);
      console.log(`✅ Multi-club migration: created club "${defaultSlug}" (PIN carried over) and backfilled existing data into it`);
    }

    // NOT NULL หลัง backfill เสร็จ — กันบั๊กในอนาคตที่ลืมใส่ club_id ให้แถวใหม่แบบเงียบๆ
    for (const table of ['members', 'sessions', 'system_states']) {
      try {
        await pool.query(`ALTER TABLE ${table} MODIFY COLUMN club_id VARCHAR(50) NOT NULL`);
      } catch (e) {
        console.warn(`⚠️  Could not enforce NOT NULL on ${table}.club_id yet:`, e.message);
      }
    }

    // Primary key ต้องผูกกับ club_id ด้วย ไม่งั้นสองก๊วนที่บังเอิญสุ่ม id/state_key ซ้ำกัน
    // (เช่น members.id หรือ system_states.state_key = "courts") จะทับข้อมูลกันข้ามก๊วนได้
    await ensureCompositePrimaryKey('members', ['club_id', 'id']);
    await ensureCompositePrimaryKey('system_states', ['club_id', 'state_key']);
  } catch (e) {
    console.error('❌ Multi-club migration failed:', e);
  }
})();

// PULL MASTER DATA — scoped to the caller's club
app.get('/api/master', requireAuth, async (req, res) => {
  try {
    const [membersRows] = await pool.query('SELECT * FROM members WHERE club_id = ?', [req.auth.clubId]);
    const [clubRows] = await pool.query('SELECT * FROM clubs WHERE id = ?', [req.auth.clubId]);

    // Format for React App
    const rankMemory = {};
    const membersList = membersRows.map(r => {
      rankMemory[r.name] = r.rank_tier;
      return {
        id: r.id,
        name: r.name,
        rank: r.rank_tier,
        gamesPlayed: 0,
        status: r.is_active ? 'waiting' : 'resting',
        checkInTime: Date.now(),
        balance: 0, courtBalance: 0, shuttleBalance: 0, snackBalance: 0, shuttleCount: 0, snackHistory: [], paidCourtFee: false
      };
    });

    res.json({
      members: membersList,
      rankMemory,
      club: clubRows.length > 0 ? { id: clubRows[0].id, name: clubRows[0].name, slug: clubRows[0].slug } : null,
      settings: clubRows.length > 0 ? {
        courtFeePerPerson: Number(clubRows[0].court_fee_per_person),
        shuttlePrice: Number(clubRows[0].shuttle_price),
        promptPayId: clubRows[0].promptpay_id || ''
      } : {}
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUSH MASTER DATA — scoped to the caller's club
app.post('/api/master', requireAuth, async (req, res) => {
  const { members, settings } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Update settings (now lives on the club's own row, not a shared singleton)
    if (settings) {
      await conn.query(
        'UPDATE clubs SET court_fee_per_person = ?, shuttle_price = ?, promptpay_id = ? WHERE id = ?',
        [settings.courtFeePerPerson, settings.shuttlePrice, settings.promptPayId ?? null, req.auth.clubId]
      );
    }

    // Update members
    if (members && members.length > 0) {
      for (const m of members) {
        await conn.query(
          'INSERT INTO members (id, club_id, name, rank_tier, is_active) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), rank_tier = VALUES(rank_tier), is_active = VALUES(is_active)',
          [m.id, req.auth.clubId, m.name, m.rank, m.status !== 'resting']
        );
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// PUSH SESSION DATA — called continuously as games/payments happen (live-sync),
// and once more with final:true when the admin closes the day ("เริ่มวันใหม่").
// `games`/`payments` are always the client's FULL current list for this session,
// so this endpoint treats them as authoritative: existing rows get updated (e.g.
// editGame changing shuttle count), and rows the client no longer has get removed
// (e.g. ยกเลิกเกม / ล้างกระดาน) instead of lingering in the DB forever.
app.post('/api/sync', requireAuth, async (req, res) => {
  const { timestamp, members, games, payments, final } = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // clubId ในตัว session id กัน id ชนกันข้ามก๊วน (เผื่อสองก๊วนเริ่ม session ที่ timestamp เดียวกันพอดี)
    const sessionId = `session-${req.auth.clubId}-${timestamp}`;
    const dateInt = new Date(timestamp).getTime();
    const membersSnapshot = JSON.stringify(members);
    const status = final ? 'completed' : 'active';

    // Insert/refresh Session
    await conn.query(
      'INSERT INTO sessions (id, club_id, date, status, members_snapshot) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), members_snapshot = VALUES(members_snapshot)',
      [sessionId, req.auth.clubId, dateInt, status, membersSnapshot]
    );

    // Upsert Games (update instead of skip, so an edit after the game was already live-synced still applies)
    const incomingGameIds = [];
    for (const g of (games || [])) {
      const gId = g.id || `game-${Date.now()}-${Math.random()}`;
      incomingGameIds.push(gId);
      await conn.query(
        `INSERT INTO games (id, session_id, court_id, court_name, played_at, shuttles_used, shuttle_cost, court_fee)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE court_id = VALUES(court_id), court_name = VALUES(court_name),
           played_at = VALUES(played_at), shuttles_used = VALUES(shuttles_used),
           shuttle_cost = VALUES(shuttle_cost), court_fee = VALUES(court_fee)`,
        [gId, sessionId, g.courtId, g.courtName, g.playedAt, g.shuttlesUsed, g.shuttleCostPerPerson, g.courtFeePerPerson]
      );

      // Re-sync players for this game (safe re-insert)
      await conn.query('DELETE FROM game_players WHERE game_id = ?', [gId]);
      for (const p of (g.players || [])) {
        await conn.query(
          'INSERT INTO game_players (game_id, member_id, member_name, member_rank) VALUES (?, ?, ?, ?)',
          [gId, p.id, p.name, p.rank]
        );
      }
    }
    // Remove games the client no longer has (Undo Game / ล้างกระดาน)
    if (games) {
      if (incomingGameIds.length > 0) {
        await conn.query(
          `DELETE FROM games WHERE session_id = ? AND id NOT IN (${incomingGameIds.map(() => '?').join(',')})`,
          [sessionId, ...incomingGameIds]
        );
      } else {
        await conn.query('DELETE FROM games WHERE session_id = ?', [sessionId]);
      }
    }

    // Upsert Payments (append-only in the app today, but kept authoritative for consistency)
    const incomingPaymentIds = [];
    for (const p of (payments || [])) {
      const pId = p.id || `payment-${Date.now()}-${Math.random()}`;
      incomingPaymentIds.push(pId);
      const detailsStr = p.details ? JSON.stringify(p.details) : null;
      await conn.query(
        'INSERT IGNORE INTO payments (id, session_id, member_id, member_name, member_rank, amount, method, note, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [pId, sessionId, p.memberId, p.memberName, p.memberRank, p.amount, p.method, p.note || '', detailsStr, p.timestamp]
      );
    }
    if (payments) {
      if (incomingPaymentIds.length > 0) {
        await conn.query(
          `DELETE FROM payments WHERE session_id = ? AND id NOT IN (${incomingPaymentIds.map(() => '?').join(',')})`,
          [sessionId, ...incomingPaymentIds]
        );
      } else {
        await conn.query('DELETE FROM payments WHERE session_id = ?', [sessionId]);
      }
    }

    await conn.commit();
    res.json({ success: true, sessionId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// GET ALL SESSION DATES
app.get('/api/sessions', requireAuth, async (req, res) => {
  try {
    const [sessions] = await pool.query('SELECT id, date FROM sessions WHERE club_id = ? ORDER BY date DESC', [req.auth.clubId]);
    res.json(sessions.map(s => ({ id: s.id, date: Number(s.date) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET MEMBER PLAY HISTORY (supports multi-name: "เน็ต,เน็ตน่ารัก")
app.get('/api/member-history', requireAuth, async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'Missing name' });

  // แยกชื่อหลายชื่อด้วย , / ; / |
  const names = name.split(/[,;|]/).map(n => n.trim()).filter(Boolean);

  try {
    const dateMap = new Map();
    const dayKey = (ts) => { const d = new Date(Number(ts)); d.setHours(0,0,0,0); return d.getTime(); };

    const [clubRows] = await pool.query('SELECT court_fee_per_person, shuttle_price FROM clubs WHERE id = ?', [req.auth.clubId]);
    const courtFee = Number(clubRows[0]?.court_fee_per_person || 40);
    const shuttlePrice = Number(clubRows[0]?.shuttle_price || 25);

    const likeNames = names.map(n => `%${n}%`);
    const whereName = likeNames.map(() => 'gp.member_name LIKE ?').join(' OR ');
    const whereSnap = likeNames.map(() => 'members_snapshot LIKE ?').join(' OR ');
    const wherePay  = likeNames.map(() => 'p.member_name LIKE ?').join(' OR ');

    // Source 1: game_players
    const [gameRows] = await pool.query(`
      SELECT s.id as session_id, s.date,
             COUNT(DISTINCT gp.game_id) as games_played,
             SUM(g.shuttle_cost) as shuttle_total
      FROM sessions s
      JOIN games g ON g.session_id = s.id
      JOIN game_players gp ON gp.game_id = g.id
      WHERE s.club_id = ? AND (${whereName})
      GROUP BY s.id, s.date
    `, [req.auth.clubId, ...likeNames]);

    gameRows.forEach(r => {
      const key = dayKey(r.date);
      const entry = dateMap.get(key) || { date: Number(r.date), gamesPlayed: 0, cost: 0, paid: 0, shuttlesUsed: 0 };
      entry.gamesPlayed += Number(r.games_played);
      entry.cost += (Number(r.shuttle_total) || 0) + courtFee;
      // จำนวนลูกจริง (ไม่ใช่ ฿) = แปลงจากยอดค่าลูกที่จ่ายไป / ราคาต่อลูก — วิธีเดียวกับที่ /api/session
      // ใช้ reconstruct shuttlesUsed จาก shuttle_cost อยู่แล้ว
      entry.shuttlesUsed = (entry.shuttlesUsed || 0) + Math.round((Number(r.shuttle_total) || 0) / shuttlePrice);
      dateMap.set(key, entry);
    });

    // Source 2: members_snapshot
    const [snapRows] = await pool.query(
      `SELECT date, members_snapshot FROM sessions WHERE club_id = ? AND (${whereSnap})`,
      [req.auth.clubId, ...likeNames]
    );

    snapRows.forEach(r => {
      try {
        const snapshot = JSON.parse(r.members_snapshot);
        // หาสมาชิกที่ตรงกับชื่อใดชื่อหนึ่ง
        const member = snapshot.find(m => m.name && names.some(n => m.name.toLowerCase().includes(n.toLowerCase())));
        if (!member) return;

        const games = member.gamesPlayed || 0;
        const court = member.courtBalance || 0;
        const shuttle = member.shuttleBalance || 0;
        const snack = member.snackBalance || 0;
        const key = dayKey(r.date);

        // ข้ามถ้าไม่มีข้อมูลเลย
        if (games === 0 && court === 0 && shuttle === 0 && snack === 0) return;

        if (!dateMap.has(key)) {
          let cost = court + shuttle + snack;
          // balance=0 แต่เล่นไปแล้ว = จ่ายแล้ว ประมาณค่าจาก settings
          if (cost === 0 && games > 0) cost = courtFee + (games * shuttlePrice);
          const paid = (cost > 0 && court === 0 && shuttle === 0) ? cost : 0;
          // เดา shuttlesUsed จากยอด ฿ ค่าลูก (snapshot เก่าไม่ได้เก็บจำนวนลูกตรงๆ)
          const shuttlesUsed = Math.round(shuttle / shuttlePrice);
          dateMap.set(key, { date: Number(r.date), gamesPlayed: games, cost, paid, shuttlesUsed });
        } else {
          const entry = dateMap.get(key);
          if (snack > 0) entry.cost += snack;
        }
      } catch (e) {}
    });

    // แก้ไข entry ที่ cost=0 แต่มี gamesPlayed (ก่อนถึง snapshot loop)
    dateMap.forEach((entry) => {
      if (entry.cost === 0 && entry.gamesPlayed > 0) {
        entry.cost = courtFee + (entry.gamesPlayed * shuttlePrice);
        entry.paid = entry.cost;
      }
    });

    // Source 3: payments
    const [payRows] = await pool.query(`
      SELECT p.session_id, s.date, p.amount, p.details
      FROM payments p JOIN sessions s ON s.id = p.session_id
      WHERE s.club_id = ? AND (${wherePay}) ORDER BY s.date DESC
    `, [req.auth.clubId, ...likeNames]);

    const payDayMap = new Map();
    payRows.forEach(r => {
      const key = dayKey(r.date);
      if (!payDayMap.has(key)) payDayMap.set(key, { date: Number(r.date), paid: 0, court: 0, shuttle: 0, snack: 0 });
      const e = payDayMap.get(key);
      e.paid += Number(r.amount);
      try {
        const det = JSON.parse(r.details);
        e.court   += det.courtBalance || 0;
        e.shuttle += det.shuttleBalance || 0;
        e.snack   += (det.snackHistory || []).reduce((a, s) => a + (s.price || 0), 0);
      } catch {}
    });

    payDayMap.forEach((pay, key) => {
      if (dateMap.has(key)) {
        const entry = dateMap.get(key);
        entry.paid = pay.paid;
        const payTotal = pay.court + pay.shuttle + pay.snack;
        if (payTotal > 0) entry.cost = payTotal;
      } else {
        const payTotal = pay.court + pay.shuttle + pay.snack;
        if (payTotal > 0 || pay.paid > 0) {
          const shuttlesUsed = Math.round(pay.shuttle / shuttlePrice);
          dateMap.set(key, { date: pay.date, gamesPlayed: 0, cost: payTotal || pay.paid, paid: pay.paid, shuttlesUsed });
        }
      }
    });

    res.json(Array.from(dateMap.values()).sort((a, b) => b.date - a.date));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PULL SESSION (Historical data)
app.get('/api/session', requireAuth, async (req, res) => {
  const { date } = req.query; // YYYY-MM-DD
  if (!date) return res.status(400).json({ error: 'Missing date parameter' });

  try {
    // Robust date parsing (YYYY-MM-DD or timestamp)
    let dateInt = Number(date);
    if (isNaN(dateInt)) dateInt = new Date(date).getTime();
    if (isNaN(dateInt)) return res.status(400).json({ error: 'Invalid date format' });

    const startOfDay = new Date(dateInt);
    startOfDay.setHours(0, 0, 0, 0);
    // Extend window to 36 hours (covering the full day + up to 12 PM next day)
    // to catch sessions that started late and were saved the next morning.
    const endWindow = new Date(startOfDay.getTime() + 36 * 60 * 60 * 1000);

    const [sessions] = await pool.query(
      'SELECT * FROM sessions WHERE club_id = ? AND date >= ? AND date <= ? ORDER BY date DESC LIMIT 1',
      [req.auth.clubId, startOfDay.getTime(), endWindow.getTime()]
    );

    if (sessions.length === 0) {
      return res.json({ date: startOfDay.getTime(), membersSnapshot: [], gameHistory: [], paymentHistory: [] });
    }

    const sessionId = sessions[0].id;
    const sessionDate = Number(sessions[0].date);
    const storedSnapshotJson = sessions[0].members_snapshot;

    // GET the club's settings for default court fee and shuttle price (used in reconstruction)
    const [clubRows] = await pool.query('SELECT court_fee_per_person, shuttle_price FROM clubs WHERE id = ?', [req.auth.clubId]);
    const defaultCourtFee = Number(clubRows[0]?.court_fee_per_person || 40);
    const defaultShuttlePrice = Number(clubRows[0]?.shuttle_price || 25);

    // Get games
    const [games] = await pool.query('SELECT * FROM games WHERE session_id = ? ORDER BY played_at DESC', [sessionId]);
    const [players] = await pool.query('SELECT p.* FROM game_players p JOIN games g ON p.game_id = g.id WHERE g.session_id = ?', [sessionId]);

    const formattedGames = games.map(g => {
      const gPlayers = players.filter(p => p.game_id === g.id).map(p => ({
        id: p.member_id, name: p.member_name, rank: p.member_rank
      }));

      const shuttleCostPerPerson = Number(g.shuttle_cost);
      let shuttlesUsed = g.shuttles_used;

      // RECONSTRUCT SHUTTLES USED: If the cost per person implies more shuttles
      // than recorded (common in legacy data), adjust shuttlesUsed for accurate summary.
      // Calculation: (CostPerPerson * NumPlayers) / PricePerShuttle
      const totalCostForGame = shuttleCostPerPerson * gPlayers.length;
      const impliedShuttles = Math.round(totalCostForGame / defaultShuttlePrice);
      if (impliedShuttles > shuttlesUsed) {
        shuttlesUsed = impliedShuttles;
      }

      return {
        id: g.id,
        courtId: g.court_id,
        courtName: g.court_name,
        playedAt: Number(g.played_at),
        shuttlesUsed: shuttlesUsed,
        shuttleCostPerPerson: shuttleCostPerPerson,
        courtFeePerPerson: Number(g.court_fee),
        players: gPlayers
      };
    });

    // Get payments
    const [payments] = await pool.query('SELECT * FROM payments WHERE session_id = ? ORDER BY created_at DESC', [sessionId]);
    const formattedPayments = payments.map(p => {
      let parsedDetails = undefined;
      if (p.details) {
        try { parsedDetails = JSON.parse(p.details); } catch (e) { }
      }
      return {
        id: p.id,
        memberId: p.member_id,
        memberName: p.member_name,
        memberRank: p.member_rank,
        amount: Number(p.amount),
        method: p.method,
        note: p.note,
        details: parsedDetails,
        timestamp: Number(p.created_at)
      };
    });

    // Try to use stored snapshot first for 100% data fidelity
    let snapshot = null;
    if (storedSnapshotJson) {
      try {
        snapshot = JSON.parse(storedSnapshotJson);
      } catch (e) {
        console.error('Error parsing stored members_snapshot:', e);
      }
    }

    // Reconstruct simplified members snapshot from games & payments for historical view (Fallback)
    if (!snapshot || snapshot.length === 0) {
      const membersMap = new Map();

      // Process Games for individual costs
      formattedGames.forEach(g => {
        g.players.forEach(p => {
          if (!membersMap.has(p.id)) {
            membersMap.set(p.id, {
              id: p.id, name: p.name, rank: p.rank, gamesPlayed: 0, status: 'paid',
              balance: 0, courtBalance: 0, shuttleBalance: 0, snackBalance: 0,
              shuttleCount: 0, snackHistory: [], paidCourtFee: true, checkInTime: 0
            });
          }
          const m = membersMap.get(p.id);
          m.gamesPlayed += 1;
          const gameFee = Number(g.courtFeePerPerson);
          m.courtBalance += gameFee;
          const sCost = Number(g.shuttleCostPerPerson);
          m.shuttleBalance += sCost;
          // Reconstruct shuttle quantity: based on the cost they paid / price per shuttle
          // If each shuttle is ฿25 and they paid ฿25, they used 1 shuttle effectively.
          m.shuttleCount += (sCost / defaultShuttlePrice);
        });
      });

      // 1. BACKFILL: If courtBalance is still 0 (e.g. because game.court_fee was 0),
      // but they played games, apply a ONE-TIME default court fee.
      membersMap.forEach(m => {
        if ((m.courtBalance || 0) === 0 && m.gamesPlayed > 0) {
          m.courtBalance = defaultCourtFee;
        }
        // Round shuttle count for neatness
        m.shuttleCount = Math.round(m.shuttleCount * 10) / 10;
      });

      // Process Payments for snack history and actual amount paid
      const memberPaidTotal = new Map(); // Track how much they actually paid
      formattedPayments.forEach(p => {
        // 1. Add snack costs from payment details if they exists
        if (p.details && p.details.snackHistory) {
          p.details.snackHistory.forEach(s => {
            if (!membersMap.has(p.memberId)) { // Create member if only payment exists
              membersMap.set(p.memberId, { id: p.memberId, name: p.memberName, rank: p.memberRank, gamesPlayed: 0, status: 'paid', balance: 0, courtBalance: 0, shuttleBalance: 0, snackBalance: 0, shuttleCount: 0, snackHistory: [], paidCourtFee: true, checkInTime: 0 });
            }
            const m = membersMap.get(p.memberId);
            m.snackHistory.push(s);
            m.snackBalance += Number(s.price);
          });
        }

        // 2. Map included members (if any) to have their debt cleared in balance calc
        const includedIds = p.details?.includedMemberIds || [p.memberId];
        includedIds.forEach(id => {
          const currentPaid = memberPaidTotal.get(id) || 0;
          memberPaidTotal.set(id, currentPaid + (p.amount / includedIds.length));
        });
      });

      // Final balance calculation and status (incorporate payments & snacks)
      membersMap.forEach((m, id) => {
        const totalPaid = memberPaidTotal.get(id) || 0;
        // Total costs identified FROM GAMES
        const gameCosts = (m.courtBalance || 0) + (m.shuttleBalance || 0);

        // RECONSTRUCT SNACKS: If they paid more than their court+shuttle cost,
        // and we have NO snack history, attribute the difference to snackBalance.
        // This handles cases where older sync data lost the snack detail objects.
        if (totalPaid > (gameCosts + (m.snackBalance || 0))) {
          const diff = totalPaid - (gameCosts + (m.snackBalance || 0));
          m.snackBalance = (m.snackBalance || 0) + diff;
          m.snackHistory.push({
            id: `re-snack-${Date.now()}-${id}`,
            name: 'สินค้า/น้ำ (กู้คืนจากยอดจ่าย)',
            price: diff,
            time: sessionDate
          });
        }

        const totalIncurred = gameCosts + (m.snackBalance || 0);
        m.balance = Math.max(0, totalIncurred - totalPaid);
        m.status = m.balance > 0 ? 'resting' : 'paid';

        // Add total fields for Dashboard consistency
        m.totalCourt = m.courtBalance;
        m.totalShuttle = m.shuttleBalance;
        m.totalSnack = m.snackBalance;
      });

      snapshot = Array.from(membersMap.values());
    }

    res.json({
      id: sessionId,
      date: sessionDate,
      membersSnapshot: snapshot,
      gameHistory: formattedGames,
      paymentHistory: formattedPayments
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET FULL LIVE STATE (Replaces initial localStorage read)
// Deliberately PUBLIC (no requireAuth): the no-login Queue View screen (/?queue&club=<slug>,
// meant for a TV/monitor at the shop) reads live court/queue data from here. Requires an
// explicit ?club= slug — never falls back to "any club", that would leak data across clubs.
app.get('/api/state', async (req, res) => {
  const { club } = req.query;
  try {
    let clubId;
    if (club && typeof club === 'string') {
      const [clubRows] = await pool.query('SELECT id FROM clubs WHERE slug = ?', [club]);
      if (clubRows.length === 0) return res.status(404).json({ error: 'ไม่พบก๊วนนี้' });
      clubId = clubRows[0].id;
    } else {
      // Backward-compat: pre-multi-club frontend builds (queue view AND the logged-in app's
      // initial load both) call this with no ?club= at all. Same one-club fallback as /api/login.
      const [clubRows] = await pool.query('SELECT id FROM clubs');
      if (clubRows.length === 1) clubId = clubRows[0].id;
      else return res.status(400).json({ error: 'Missing club' });
    }

    const [states] = await pool.query('SELECT * FROM system_states WHERE club_id = ?', [clubId]);
    const result = {};
    states.forEach(row => {
      try {
        result[row.state_key] = JSON.parse(row.state_value);
      } catch (e) {
        result[row.state_key] = row.state_value;
      }
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// SAVE FULL LIVE STATE (Replaces localStorage.setItem) — scoped to the caller's club
app.post('/api/state', requireAuth, async (req, res) => {
  const stateObj = req.body;
  const conn = await pool.getConnection();

  try {
    // Stale-client guard: a device left open since before someone else ran "จบวันและ
    // สรุปยอด" elsewhere still holds the OLD sessionStartDate in memory and keeps pushing
    // it back on its own periodic autosave, silently resurrecting a day that's already
    // been closed server-side. If the server currently has no active session (null) but
    // this write tries to set one from more than an hour ago, it's almost certainly a
    // stale client re-sending old memory, not a real "new session just started" — drop
    // just that one field rather than rejecting the whole save.
    if (Object.prototype.hasOwnProperty.call(stateObj, 'sessionStartDate') && stateObj.sessionStartDate != null) {
      const [[currentRow]] = await pool.query(
        "SELECT state_value FROM system_states WHERE club_id = ? AND state_key = 'sessionStartDate'",
        [req.auth.clubId]
      );
      let currentVal = null;
      if (currentRow) { try { currentVal = JSON.parse(currentRow.state_value); } catch { currentVal = currentRow.state_value; } }
      const ONE_HOUR_MS = 60 * 60 * 1000;
      if (currentVal === null && (Date.now() - Number(stateObj.sessionStartDate)) > ONE_HOUR_MS) {
        console.warn(`[stale-guard] club ${req.auth.clubId}: ignored stale sessionStartDate=${stateObj.sessionStartDate} (server already reset)`);
        delete stateObj.sessionStartDate;
      }
    }

    await conn.beginTransaction();
    for (const [key, value] of Object.entries(stateObj)) {
      await conn.query(
        'INSERT INTO system_states (club_id, state_key, state_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE state_value = VALUES(state_value)',
        [req.auth.clubId, key, JSON.stringify(value)]
      );
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 SmashIT Server running on port ${port}`);
});

// RE-SYNC: Recover all session data from system_states blob into proper tables
app.post('/api/resync', requireAuth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await pool.query(
      "SELECT state_value FROM system_states WHERE club_id = ? AND state_key = 'sessionHistory'",
      [req.auth.clubId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'No sessionHistory found in system_states' });

    const sessionHistory = JSON.parse(rows[0].state_value);
    let synced = 0;

    await conn.beginTransaction();
    for (const session of sessionHistory) {
      const sessionId = session.id || `session-${req.auth.clubId}-${session.date}`;
      const dateInt = Number(session.date);
      const membersSnapshot = session.membersSnapshot ? JSON.stringify(session.membersSnapshot) : null;

      await conn.query(
        'INSERT INTO sessions (id, club_id, date, status, members_snapshot) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), members_snapshot = VALUES(members_snapshot)',
        [sessionId, req.auth.clubId, dateInt, 'completed', membersSnapshot]
      );

      for (const g of (session.gameHistory || [])) {
        const gId = g.id || `game-${g.playedAt}`;
        await conn.query(
          'INSERT IGNORE INTO games (id, session_id, court_id, court_name, played_at, shuttles_used, shuttle_cost, court_fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [gId, sessionId, g.courtId, g.courtName, g.playedAt, g.shuttlesUsed, g.shuttleCostPerPerson, g.courtFeePerPerson]
        );
        await conn.query('DELETE FROM game_players WHERE game_id = ?', [gId]);
        for (const p of (g.players || [])) {
          await conn.query(
            'INSERT INTO game_players (game_id, member_id, member_name, member_rank) VALUES (?, ?, ?, ?)',
            [gId, p.id, p.name, p.rank]
          );
        }
      }

      for (const p of (session.paymentHistory || [])) {
        const pId = p.id || `pay-${p.timestamp}`;
        const detailsStr = p.details ? JSON.stringify(p.details) : null;
        await conn.query(
          'INSERT IGNORE INTO payments (id, session_id, member_id, member_name, member_rank, amount, method, note, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [pId, sessionId, p.memberId, p.memberName, p.memberRank, p.amount, p.method, p.note || '', detailsStr, p.timestamp]
        );
      }
      synced++;
    }

    await conn.commit();
    res.json({ success: true, sessionsSynced: synced });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// Fallback for SPA routing: serve index.html for all other requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});
