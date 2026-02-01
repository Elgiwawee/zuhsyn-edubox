// dbHelper.js
import { getDBConnection } from './database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

/**
 * dbHelper.js (extended)
 * - Subject prices & enrollments with payment metadata
 * - Offline payment simulation & pending payments for manual/online methods
 * - Daily-login streaks awarding points & special rewards:
 *     * 2 points per daily login
 *     * 50 bonus points after 30 consecutive daily logins (one-time)
 *     * free subject unlock after 90 consecutive daily logins (one-time)
 *
 * Note: All functions call ensureInitialized() so tables exist.
 */

/* ---------------------------
 * Utilities
 * --------------------------- */
const hashPassword = (plain) => {
  const salt = 'edubox_salt_v1';
  return CryptoJS.SHA256(plain + salt).toString();
};

const rowsToArray = (results) => {
  try {
    const res = results[0];
    const rows = [];
    for (let i = 0; i < (res.rows?.length || 0); i++) {
      rows.push(res.rows.item(i));
    }
    return rows;
  } catch (e) {
    return [];
  }
};

/* ---------------------------
 * Initialization
 * --------------------------- */
let _initialized = false;

const ensureAllTablesExist = async (db) => {
  // USERS
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      total_score INTEGER DEFAULT 0,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      last_subject TEXT DEFAULT 'Maths',
      is_logged_in INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure role column and default admin
try {
  await db.executeSql(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';`);
} catch (e) {
  // ignore if column exists
}

try {
  // Create default admin if not exists
  const adminEmail = 'edubox.zuhsyn@zuhsyn.com.ng';
  const adminPasswordPlain = '@HassanCEO001!'; // change before production
  const hashed = CryptoJS.SHA256(adminPasswordPlain + 'edubox_salt_v1').toString();

  const res = await db.executeSql(`SELECT id FROM users WHERE email = ? LIMIT 1;`, [adminEmail]);
  if ((res[0].rows?.length || 0) === 0) {
    await db.executeSql(
      `INSERT INTO users (name, email, password, total_score, xp, level, last_subject, is_logged_in, role) VALUES (?, ?, ?, 0, 0, 1, 'Maths', 0, 'admin');`,
      ['Admin', adminEmail, hashed]
    );
    console.log('Default admin created:', adminEmail);
  }
} catch (e) {
  console.warn('Default admin insert failed', e);
}

try {
  await db.executeSql(`ALTER TABLE users ADD COLUMN admin_pin_hash TEXT;`);
} catch (e) {}

  await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);

  // SUBJECTS (with track & category)
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      price INTEGER DEFAULT 0,
      is_free INTEGER DEFAULT 0,
      track TEXT,
      category TEXT
    );
  `);


  try { 
  await db.executeSql(`ALTER TABLE subjects ADD COLUMN track TEXT;`); 
} catch (e) {}

try { 
  await db.executeSql(`ALTER TABLE subjects ADD COLUMN category TEXT;`); 
} catch (e) {}


  // LESSONS / QUIZZES / PROGRESS (unchanged)
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER,
      title TEXT NOT NULL,
      content TEXT,
      conclusion TEXT,
      FOREIGN KEY (subject_id) REFERENCES subjects(id)
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      answer TEXT NOT NULL,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id)
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      lesson_id INTEGER,
      score INTEGER,
      progress REAL DEFAULT 0,
      completed INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (lesson_id) REFERENCES lessons(id)
    );
  `);
  await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);`);

  // LEADERBOARD & SCORES
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      subject TEXT,
      score INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_leaderboard_user ON leaderboard(user_id);`);
  await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_leaderboard_subject ON leaderboard(subject);`);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS user_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      subject TEXT,
      points INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await db.executeSql(`CREATE INDEX IF NOT EXISTS idx_user_scores_user ON user_scores(user_id);`);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS daily_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      points INTEGER,
      date TEXT
    );
  `);


  // QUIZ DAILY COUNTER (NEEDED FOR Streak Popup Logic)
await db.executeSql(`
  CREATE TABLE IF NOT EXISTS quiz_daily (
    user_id INTEGER,
    date TEXT,
    quiz_count INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, date)
  );
`);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS weekly_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      points INTEGER,
      week TEXT
    );
  `);
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS monthly_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      points INTEGER,
      month TEXT
    );
  `);

  // STREAKS (activity streak)
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS streaks (
      user_id INTEGER PRIMARY KEY,
      streak INTEGER DEFAULT 0,
      last_active_date TEXT
    );
  `);

  // DAILY LOGIN STREAKS (separate table for daily-login rewards and flags)
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS daily_logins (
      user_id INTEGER PRIMARY KEY,
      streak INTEGER DEFAULT 0,
      last_login_date TEXT,
      logged_in_today INTEGER DEFAULT 0,    
      counted INTEGER DEFAULT 0,
      quiz_count_today INTEGER DEFAULT 0,      
      monthly_awarded INTEGER DEFAULT 0, -- whether 30-day 50points given
      ninety_awarded INTEGER DEFAULT 0 -- whether 90-day free subject given
    );
  `);



  // DAILY_ACTIVITY — tracks login + quizzes for the day BEFORE marking streak
await db.executeSql(`
  CREATE TABLE IF NOT EXISTS daily_activity (
    user_id INTEGER PRIMARY KEY,
    date TEXT,
    logged_in_today INTEGER DEFAULT 0,
    quiz_count INTEGER DEFAULT 0,
    streak_counted INTEGER DEFAULT 0
  );
`);


await db.executeSql(`
  CREATE TABLE IF NOT EXISTS quiz_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date_string TEXT
  );
`);

  // Pending payments (for manual/external flows)
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS pending_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      subject_name TEXT,
      subject_id INTEGER,
      amount INTEGER,
      payment_method TEXT,
      status TEXT DEFAULT 'pending', -- pending|paid|failed
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Free unlock claims (records of free unlocks granted/claimed)
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS free_unlocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      subject_id INTEGER,
      subject_name TEXT,
      granted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      claimed INTEGER DEFAULT 0 -- 0/1
    );
  `);

  // ACHIEVEMENTS
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      badge TEXT,
      date TEXT
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      subject_id INTEGER,
      subject TEXT,
      amount INTEGER,
      method TEXT,        -- 'code' | 'manual' | 'online'
      reference TEXT,     -- for manual/online reference or code value
      status TEXT,        -- 'pending' | 'completed' | 'failed'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);


  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS offline_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      subject_id INTEGER,    -- NULL = any subject / package
      subject TEXT,          -- human friendly (optional)
      amount INTEGER DEFAULT 0,
      redeemed INTEGER DEFAULT 0,    -- 0 = unused, 1 = used
      redeemed_by INTEGER,           -- user_id
      redeemed_at DATETIME
    );
  `);

  /* user_pieces: total pieces available (accumulated from 2 pieces/day) */
await db.executeSql(`
  CREATE TABLE IF NOT EXISTS user_pieces (
    user_id INTEGER PRIMARY KEY,
    pieces INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

await db.executeSql(`
  CREATE TABLE IF NOT EXISTS daily_login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    date TEXT,
    pieces_awarded INTEGER
  );
`);

await db.executeSql(`
  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    subject_name TEXT,
    subject_id INTEGER,
    amount INTEGER DEFAULT 0,
    amount_pieces INTEGER DEFAULT 0,
    paid INTEGER DEFAULT 0,
    payment_method TEXT,
    payment_status TEXT DEFAULT 'pending',
    unlocked_via_reward INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    start_date TEXT,
    expiry_date TEXT
  );
`);

await db.executeSql(`
  CREATE TABLE IF NOT EXISTS last_subject (
    user_id INTEGER PRIMARY KEY,
    subject_id INTEGER,
    subject_name TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);


// -------------------- Analytics & Audit Tables --------------------
// notifications - stored for each user, shown when they open app
await db.executeSql(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    body TEXT,
    data TEXT,
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// payment audit (admin actions)
await db.executeSql(`
  CREATE TABLE IF NOT EXISTS payment_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pending_id INTEGER,
    admin_user_id INTEGER,
    action TEXT, -- 'approved' | 'rejected'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

await db.executeSql(`
  CREATE TABLE IF NOT EXISTS user_game_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    subject TEXT,
    level INTEGER,
    coins INTEGER,
    fails INTEGER,
    updated_at TEXT
  );
`);
await db.executeSql(`
  CREATE TABLE IF NOT EXISTS user_game_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    asset_key TEXT,
    title TEXT,
    created_at TEXT
  );
`);
await db.executeSql(`
  CREATE TABLE IF NOT EXISTS shop_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE,
    title TEXT,
    price INTEGER
  );
`);
await db.executeSql(`
  CREATE TABLE IF NOT EXISTS equipped_skins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    asset_key TEXT,
    equipped_at TEXT
  );
`);

await db.executeSql(`
  CREATE TABLE IF NOT EXISTS lesson_progress (
    user_id INTEGER,
    subject_id TEXT,
    lesson_key TEXT,
    PRIMARY KEY (user_id, subject_id, lesson_key)
  );
`);

await db.executeSql(`
  CREATE TABLE IF NOT EXISTS last_lesson (
    user_id INTEGER PRIMARY KEY,
    subject_id INTEGER,
    lesson_id INTEGER,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

await db.executeSql(`
  CREATE TABLE IF NOT EXISTS daily_streak (
    user_id INTEGER,
    date TEXT,
    completed INTEGER,
    PRIMARY KEY (user_id, date)
);
`);

await db.executeSql(`
  INSERT OR IGNORE INTO subjects (id, name, description, price, is_free, track, category) VALUES
    (1, 'Agriculture', 'Agricultural Science', 0, 1, 'OLevel', 'JAMB'),
    (2, 'Biology', 'Biology', 0, 1, 'OLevel', 'JAMB'),
    (3, 'Chemistry', 'Chemistry', 3000, 0, 'OLevel', 'JAMB'),
    (4, 'English', 'English', 0, 1, 'OLevel', 'JAMB'),
    (5, 'Maths', 'Maths', 3000, 0, 'OLevel', 'JAMB'),
    (6, 'Physics', 'Physics', 3000, 0, 'OLevel', 'JAMB');
`);
};

export const ensureInitialized = async () => {
  if (_initialized) return;
  const db = await getDBConnection();
  try {
    await ensureAllTablesExist(db);
    _initialized = true;
    // debug list of tables
    try {
      const res = await db.executeSql(`SELECT name FROM sqlite_master WHERE type='table';`);
      const trows = rowsToArray(res);
      console.log('📋 Tables present:', trows.map((r) => r.name));
    } catch (e) {
      console.warn('Could not list tables:', e);
    }
  } catch (err) {
    console.error('❌ ensureInitialized error:', err);
    throw err;
  }
};

/* ---------------------------
 * Auth & User helpers (unchanged)
 * --------------------------- */
export const createUser = async (name, email, password) => {
  await ensureInitialized();
  if (!name || !email || !password) throw new Error('Missing required fields');
  const db = await getDBConnection();
  const hashed = hashPassword(password);

  try {
    const results = await db.executeSql(
      `INSERT INTO users (name, email, password, level, last_subject, is_logged_in, xp, total_score) VALUES (?, ?, ?, 1, 'Maths', 0, 0, 0);`,
      [name.trim(), email.trim().toLowerCase(), hashed]
    );
    const insertId = results?.[0]?.insertId;
    return insertId || null;
  } catch (err) {
    console.error('createUser error:', err);
    throw err;
  }
};

export const getUserByEmail = async (email) => {
  await ensureInitialized();
  if (!email) return null;
  const db = await getDBConnection();
  const lower = email.trim().toLowerCase();

  try {
    const results = await db.executeSql(`SELECT * FROM users WHERE email = ? LIMIT 1;`, [lower]);
    const rows = rowsToArray(results);
    return rows.length ? rows[0] : null;
  } catch (err) {
    console.error('getUserByEmail error:', err);
    return null;
  }
};

export const loginUser = async (email, password) => {
  await ensureInitialized();
  const user = await getUserByEmail(email);
  if (!user) return null;
  if (hashPassword(password) !== user.password) return null;

  const db = await getDBConnection();
  try {
    await db.executeSql(`UPDATE users SET is_logged_in = 1 WHERE id = ?;`, [user.id]);

    await AsyncStorage.setItem(
      'edubox_user',
      JSON.stringify({ id: user.id, email: user.email, name: user.name })
    );

    // ALSO record daily login streak (award daily points)
    try {
      await recordDailyLogin(user.id);
    } catch (e) {
      console.warn('recordDailyLogin failed on login:', e);
    }

    return user;
  } catch (err) {
    console.error('loginUser error:', err);
    throw err;
  }
};


export const logoutUser = async () => {
  await ensureInitialized();
  const current = await getCurrentUser();
  if (!current) return true;

  const db = await getDBConnection();
  try {
    await db.executeSql(
      `UPDATE users SET is_logged_in = 0 WHERE id = ?;`,
      [current.id]
    );
    return true;
  } catch (err) {
    console.error('logoutUser error:', err);
    throw err;
  }
};


export const getCurrentUser = async () => {
  // no DB access needed
  try {
    const json = await AsyncStorage.getItem('edubox_user');
    return json ? JSON.parse(json) : null;
  } catch (err) {
    console.error('getCurrentUser error:', err);
    return null;
  }
};

/* ---------------------------
 * Subjects & Pricing
 * --------------------------- */
export const getAllSubjects = async () => {
  await ensureInitialized();
  const db = await getDBConnection();

  try {
    const res = await db.executeSql(
      `SELECT id, name, description, price, is_free FROM subjects ORDER BY id;`
    );

    const rows = rowsToArray(res);

    // convert all SQLite values into correct numeric types
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      description: row.description,
      price: row.price != null ? Number(row.price) : 0,
      is_free: row.is_free != null ? Number(row.is_free) : 0,
    }));
  } catch (err) {
    console.error("getAllSubjects error:", err);
    return [];
  }
};


export const getSubjectByName = async (name) => {
  await ensureInitialized();
  if (!name) return null;

  const db = await getDBConnection();

  try {
    const res = await db.executeSql(
      `SELECT * FROM subjects WHERE LOWER(name) = LOWER(?) LIMIT 1`,
      [name.trim()]
    );

    const rows = rowsToArray(res);
    return rows.length ? rows[0] : null;
  } catch (err) {
    console.error('getSubjectByName error:', err);
    return null;
  }
};

export const setSubjectPrice = async (subjectId, price = 0, isFree = false) => {
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    await db.executeSql(`UPDATE subjects SET price = ?, is_free = ? WHERE id = ?;`, [price, isFree ? 1 : 0, subjectId]);
    return true;
  } catch (err) {
    console.error('setSubjectPrice error:', err);
    throw err;
  }
};


/* -------------------------
 * Offline codes & payments helpers
 * ------------------------- */

export const generateOfflineCodes = async (
  count = 50,
  opts = { subjectId: null, subject: null, amount: 0 }
) => {
  await ensureInitialized();
  const db = await getDBConnection();
  const codes = [];

  const makeCode = () =>
    "EDU-" +
    Math.random().toString(36).substring(2, 6).toUpperCase() + "-" +
    Math.random().toString(36).substring(2, 6).toUpperCase() + "-" +
    Math.random().toString(36).substring(2, 6).toUpperCase();

  try {
    for (let i = 0; i < count; i++) {
      let saved = false;

      while (!saved) {
        const newCode = makeCode();
        try {
          await db.executeSql(
            `INSERT INTO offline_codes (code, subject_id, subject, amount, redeemed)
             VALUES (?, ?, ?, ?, 0);`,
            [newCode, opts.subjectId, opts.subject, opts.amount]
          );

          codes.push({
            code: newCode,
            subject: opts.subject,
            amount: opts.amount,
          });

          saved = true;

        } catch (e) {
          // duplicate → retry
          console.log("Duplicate, retrying…");
        }
      }
    }

    return codes;

  } catch (err) {
    console.error("generateOfflineCodes error:", err);
    throw err;
  }
};



export const redeemOfflineCode = async (userId, codeValue, subjectId = null) => {
  await ensureInitialized();
  const db = await getDBConnection();

  try {
    // 1️⃣ Fetch code
    const res = await db.executeSql(
      `SELECT * FROM offline_codes WHERE code = ? LIMIT 1;`,
      [codeValue]
    );
    const rows = rowsToArray(res);

    if (!rows.length) {
      throw new Error("Code not found");
    }

    const codeRow = rows[0];

    // 2️⃣ Validate code
    if (Number(codeRow.redeemed) === 1) {
      throw new Error("Code already used");
    }

    if (codeRow.subject_id && subjectId && Number(codeRow.subject_id) !== Number(subjectId)) {
      throw new Error("Code not valid for this subject");
    }

    // 3️⃣ Mark code as redeemed
    await db.executeSql(
      `UPDATE offline_codes 
       SET redeemed = 1, redeemed_by = ?, redeemed_at = datetime('now')
       WHERE id = ?;`,
      [userId, codeRow.id]
    );

    // 4️⃣ Insert into payments
    await db.executeSql(
      `INSERT INTO payments 
       (user_id, subject_id, subject, amount, method, reference, status)
       VALUES (?, ?, ?, ?, 'code', ?, 'completed');`,
      [
        userId,
        subjectId || codeRow.subject_id,
        codeRow.subject || null,
        codeRow.amount || 0,
        codeValue
      ]
    );

    // 5️⃣ Determine subject name
    let enrollSubjectName = codeRow.subject;

    if (!enrollSubjectName) {
      if (subjectId) {
        const sres = await db.executeSql(
          `SELECT name FROM subjects WHERE id = ? LIMIT 1;`,
          [subjectId]
        );
        const srows = rowsToArray(sres);
        enrollSubjectName = srows.length ? srows[0].name : "Unknown";
      } else {
        enrollSubjectName = "Unknown";
      }
    }

    // 6️⃣ Enroll the user
    await db.executeSql(
      `INSERT OR IGNORE INTO enrollments
       (user_id, subject_name, subject_id, amount, paid, payment_method, payment_status, start_date, expiry_date)
       VALUES (?, ?, ?, ?, 1, 'code', 'completed', datetime('now'), datetime('now','+3 months'));`,
      [
        userId,
        enrollSubjectName,
        subjectId || codeRow.subject_id,
        codeRow.amount || 0
      ]
    );

    // 7️⃣ Return success for UI
    return { message: "Code redeemed successfully." };

  } catch (err) {
    console.error("redeemOfflineCode error:", err);
    throw new Error(err?.message || String(err) || "Unknown error occurred");
  }
};


export const rejectPendingPayment = async (pendingId, reason = null) => {
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    await db.executeSql(`UPDATE pending_payments SET status = 'failed' WHERE id = ?`, [pendingId]);
    // Optional: update related payments rows too
    await db.executeSql(`UPDATE payments SET status = 'failed' WHERE reference = (SELECT reference FROM payments WHERE id IN (SELECT id FROM payments WHERE user_id = (SELECT user_id FROM pending_payments WHERE id = ?) LIMIT 1) LIMIT 1);`, [pendingId]).catch(()=>{});
    return true;
  } catch (err) {
    console.error('rejectPendingPayment error', err);
    throw err;
  }
};


export const saveManualPayment = async (userId, subjectId, subjectName, amount, reference, metadata = {}) => {
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    // We will treat manual payment as completed immediately (auto-approve) since you requested automatic approval
    await db.executeSql(
      `INSERT INTO payments (user_id, subject_id, subject, amount, method, reference, status) VALUES (?, ?, ?, ?, 'manual', ?, 'completed');`,
      [userId, subjectId, subjectName, amount, reference]
    );

    // enroll user immediately
    await db.executeSql(`INSERT OR IGNORE INTO enrollments (user_id, subject_name) VALUES (?, ?);`, [
      userId,
      subjectName,
    ]);

    return { ok: true };
  } catch (err) {
    console.error('saveManualPayment error', err);
    throw err;
  }
};

/**
 * createOnlinePaymentRecord
 * Used if user chooses the optional online flow — we store the reference they paste after paying in browser.
 * As we can't call Paystack online from offline app, the user will paste the online reference after paying.
 */
export const createOnlinePaymentRecord = async (userId, subjectId, subjectName, amount, reference) => {
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    // mark as completed immediately (auto-approve)
    await db.executeSql(
      `INSERT INTO payments (user_id, subject_id, subject, amount, method, reference, status) VALUES (?, ?, ?, ?, 'online', ?, 'completed');`,
      [userId, subjectId, subjectName, amount, reference]
    );

    // enroll user
    await db.executeSql(`INSERT OR IGNORE INTO enrollments (user_id, subject_name) VALUES (?, ?);`, [
      userId,
      subjectName,
    ]);
    return { ok: true };
  } catch (err) {
    console.error('createOnlinePaymentRecord error', err);
    throw err;
  }
};



/* ---------------------------
 * Enrollment & Payments
 * --------------------------- */
/**
 * ENROLL USER IN A SUBJECT
 * Handles:
 * - free enrollment
 * - pieces enrollment
 * - offline_local (simulated payment)
 * - manual/external payment (pending -> complete later)
 * - start_date + 3-month expiry
 * - renewal if expired
 */
export const enrollInSubject = async (
  userId,
  subjectName,
  options = { paymentMethod: 'manual_external', simulateLocalPayment: false }
) => {
  await ensureInitialized();
  const db = await getDBConnection();

  // Ensure user ID
  if (!userId) {
    userId = await getCurrentUserId();
    if (!userId) throw new Error('User not logged in!');
  }

  if (!subjectName) throw new Error('Missing subjectName');

  // Fetch subject info
  const subject = await getSubjectByName(subjectName);
  if (!subject) throw new Error('Subject not found');

  const amount = Number(subject.price || 0);
  const isFree = subject.is_free === 1 || amount === 0;

  // Build dates
  const now = new Date();
  const startDate = now.toISOString();

  const expiryDateObj = new Date();
  expiryDateObj.setMonth(expiryDateObj.getMonth() + 3);
  const expiryDate = expiryDateObj.toISOString();

  //--------------------------------------------------------------------
  // 1. CHECK EXISTING ENROLLMENT
  //--------------------------------------------------------------------
  const existing = await db.executeSql(
    `SELECT id, expiry_date, paid FROM enrollments 
     WHERE user_id = ? AND subject_name = ?`,
    [userId, subjectName]
  );

  if (existing[0].rows.length > 0) {
    const row = existing[0].rows.item(0);

    // Missing expiry_date → treat as expired & fix
    if (!row.expiry_date) {
      await db.executeSql(
        `UPDATE enrollments
         SET start_date = ?, expiry_date = ?, payment_method = ?
         WHERE id = ?`,
        [startDate, expiryDate, options.paymentMethod || 'free', row.id]
      );

      return { renewed: true };
    }

    const exp = new Date(row.expiry_date);
    if (exp > new Date()) {
      // Still active
      return { alreadyActive: true };
    }

    // expired → renew
    await db.executeSql(
      `UPDATE enrollments
       SET start_date = ?, expiry_date = ?, payment_method = ?
       WHERE id = ?`,
      [startDate, expiryDate, options.paymentMethod || 'renew', row.id]
    );

    return { renewed: true };
  }

  //--------------------------------------------------------------------
  // 2. NEW ENROLLMENT
  //--------------------------------------------------------------------

  // FREE SUBJECT
  if (isFree) {
    await db.executeSql(
      `INSERT INTO enrollments 
        (user_id, subject_name, start_date, expiry_date, payment_method, paid, payment_status)
       VALUES (?, ?, ?, ?, 'free', 1, 'paid')`,
      [userId, subjectName, startDate, expiryDate]
    );

    return { created: true, method: 'free' };
  }

  //--------------------------------------------------------------------
  // PIECES PAYMENT
  //--------------------------------------------------------------------
  if (options.paymentMethod === 'pieces') {
    const NAIRA_PER_PIECE = 8.3;
    const piecesNeeded = Math.ceil(amount / NAIRA_PER_PIECE);

    // Deduct pieces
    await deductUserPieces(userId, piecesNeeded);

    const res = await db.executeSql(
      `INSERT INTO enrollments
        (user_id, subject_name, subject_id, amount, amount_pieces, paid, payment_method, payment_status, start_date, expiry_date)
       VALUES (?, ?, ?, ?, ?, 1, 'pieces', 'paid', ?, ?)`,
      [userId, subject.name, subject.id, amount, piecesNeeded, startDate, expiryDate]
    );

    return {
      created: true,
      method: 'pieces',
      piecesUsed: piecesNeeded,
      enrollmentId: res[0].insertId
    };
  }

  //--------------------------------------------------------------------
  // OFFLINE INSTANT PAYMENT
  //--------------------------------------------------------------------
  if (options.simulateLocalPayment || options.paymentMethod === 'offline_local') {
    const res = await db.executeSql(
      `INSERT INTO enrollments
        (user_id, subject_name, subject_id, amount, paid, payment_method, payment_status, start_date, expiry_date)
       VALUES (?, ?, ?, ?, 1, 'offline_local', 'paid', ?, ?)`,
      [userId, subjectName, subject.id, amount, startDate, expiryDate]
    );

    return { created: true, method: 'offline_local', enrollmentId: res[0].insertId };
  }

  //--------------------------------------------------------------------
  // MANUAL / EXTERNAL PAYMENT (pending)
  //--------------------------------------------------------------------
  const enrollRes = await db.executeSql(
    `INSERT INTO enrollments
      (user_id, subject_name, subject_id, amount, paid, payment_method, payment_status, start_date, expiry_date)
     VALUES (?, ?, ?, ?, 0, ?, 'pending', ?, ?)`,
    [userId, subjectName, subject.id, amount, options.paymentMethod, startDate, expiryDate]
  );

  const enrollmentId = enrollRes[0].insertId;

  await db.executeSql(
    `INSERT INTO pending_payments
      (user_id, subject_name, subject_id, amount, payment_method, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [userId, subjectName, subject.id, amount, options.paymentMethod]
  );

  return {
    created: true,
    pending: true,
    enrollmentId,
    method: options.paymentMethod
  };
};


export const markPendingPaymentAsPaid = async (pendingPaymentId, adminUserId = null, options = { notifyUser: true }) => {
  await ensureInitialized();
  const db = await getDBConnection();

  try {
    // 1. Fetch the pending payment
    const res = await db.executeSql(
      `SELECT * FROM pending_payments WHERE id = ? LIMIT 1`,
      [pendingPaymentId]
    );
    const rows = rowsToArray(res);
    if (!rows.length) throw new Error('Pending payment not found');

    const p = rows[0];

    // 1.5: Find associated payment(s) (pending payments may have a payment row)
    const paymentsRes = await db.executeSql(`SELECT * FROM payments WHERE user_id = ? AND subject_id = ? AND amount = ? AND status = 'pending' ORDER BY created_at DESC;`, [p.user_id, p.subject_id, p.amount]);
    const pendingPaymentsRows = rowsToArray(paymentsRes);

    // 2. Mark pending_payments as paid
    await db.executeSql(`UPDATE pending_payments SET status = 'paid' WHERE id = ?`, [pendingPaymentId]);

    // 3. Build new 3-month expiry window
    const startDate = new Date().toISOString();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 3);
    const expiryISO = expiryDate.toISOString();

    // 4. Update the corresponding enrollment (pay the matching pending enrollment)
    await db.executeSql(
      `UPDATE enrollments 
       SET paid = 1, 
           payment_status = 'paid', 
           payment_method = ?, 
           start_date = ?, 
           expiry_date = ?
       WHERE user_id = ? 
         AND subject_id = ?
         AND amount = ?
         AND paid = 0`,
      [
        p.payment_method || 'manual',
        startDate,
        expiryISO,
        p.user_id,
        p.subject_id,
        p.amount
      ]
    );

    // 5. Update an associated payments rows (set status completed) OR create one if none
    if (pendingPaymentsRows.length) {
      for (let r of pendingPaymentsRows) {
        await db.executeSql(`UPDATE payments SET status = 'completed' WHERE id = ?;`, [r.id]);
      }
    } else {
      await db.executeSql(
        `INSERT INTO payments (user_id, subject_id, subject, amount, method, reference, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)`,
        [p.user_id, p.subject_id, p.subject_name, p.amount, p.payment_method || 'manual', p.reference || null, startDate]
      );
    }

    // 6. Audit: record admin approval
    if (adminUserId) {
      await db.executeSql(
        `INSERT INTO payment_audit (pending_id, admin_user_id, action, notes) VALUES (?, ?, 'approved', ?);`,
        [pendingPaymentId, adminUserId, options.notes || null]
      );
    } else {
      await db.executeSql(
        `INSERT INTO payment_audit (pending_id, admin_user_id, action, notes) VALUES (?, NULL, 'approved', ?);`,
        [pendingPaymentId, options.notes || null]
      );
    }

    // 7. Notify user (store notification)
    try {
      await notifyUser(p.user_id, 'Payment verified', `Your payment of ₦${p.amount} for ${p.subject_name} has been verified by admin.`, { pendingId: pendingPaymentId });
    } catch (nerr) {
      console.warn('notifyUser after approval failed', nerr);
    }

    return true;
  } catch (err) {
    console.error('markPendingPaymentAsPaid error:', err);
    throw err;
  }
};



/**
 * submitManualPaymentPending
 * Creates a pending payment record — admin must verify & approve
 */
export const submitManualPaymentPending = async (userId, subjectId, subjectName, amount, reference, metadata = {}) => {
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    const now = new Date().toISOString();
    const res = await db.executeSql(
      `INSERT INTO pending_payments (user_id, subject_name, subject_id, amount, payment_method, status, created_at) VALUES (?, ?, ?, ?, 'manual', 'pending', ?);`,
      [userId, subjectName, subjectId, amount, now]
    );
    const pendingId = res[0].insertId;

    // record into payments table as pending too (keeps audit trail)
    await db.executeSql(
      `INSERT INTO payments (user_id, subject_id, subject, amount, method, reference, status, created_at) VALUES (?, ?, ?, ?, 'manual', ?, 'pending', ?);`,
      [userId, subjectId, subjectName, amount, reference, now]
    );

    // ensure enrollment placeholder exists (not paid yet)
    await db.executeSql(
      `INSERT OR IGNORE INTO enrollments (user_id, subject_name, subject_id, amount, paid, payment_method, payment_status, start_date) VALUES (?, ?, ?, ?, 0, 'manual', 'pending', NULL);`,
      [userId, subjectName, subjectId, amount]
    );

    // optional check for existing pending
    const exist = await db.executeSql(`SELECT id FROM pending_payments WHERE user_id = ? AND subject_id = ? AND status = 'pending' LIMIT 1;`, [userId, subjectId]);
    if (exist[0].rows.length) throw new Error('A pending payment already exists for this item. Wait for verification.');

    return { ok: true, pendingId };
  } catch (err) {
    console.error('submitManualPaymentPending error', err);
    throw err;
  }
};

/**
 * submitOnlinePaymentPending
 * Same as manual but marks payment method as 'online'
 */
export const submitOnlinePaymentPending = async (userId, subjectId, subjectName, amount, reference, metadata = {}) => {
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    const now = new Date().toISOString();
    const res = await db.executeSql(
      `INSERT INTO pending_payments (user_id, subject_name, subject_id, amount, payment_method, status, created_at) VALUES (?, ?, ?, ?, 'online', 'pending', ?);`,
      [userId, subjectName, subjectId, amount, now]
    );
    const pendingId = res[0].insertId;

    await db.executeSql(
      `INSERT INTO payments (user_id, subject_id, subject, amount, method, reference, status, created_at) VALUES (?, ?, ?, ?, 'online', ?, 'pending', ?);`,
      [userId, subjectId, subjectName, amount, reference, now]
    );

    await db.executeSql(
      `INSERT OR IGNORE INTO enrollments (user_id, subject_name, subject_id, amount, paid, payment_method, payment_status, start_date) VALUES (?, ?, ?, ?, 0, 'online', 'pending', NULL);`,
      [userId, subjectName, subjectId, amount]
    );

    return { ok: true, pendingId };
  } catch (err) {
    console.error('submitOnlinePaymentPending error', err);
    throw err;
  }
};

/**
 * payEnrollmentLocally
 * - simulates an in-app/offline payment for a given enrollment row (enrollmentId)
 * - sets paid=1, payment_method='offline_local', payment_status='paid'
 */
export const payEnrollmentLocally = async (enrollmentId) => {
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    await db.executeSql(
      `UPDATE enrollments SET paid = 1, payment_method = 'offline_local', payment_status = 'paid' WHERE id = ?;`,
      [enrollmentId]
    );
    return true;
  } catch (err) {
    console.error('payEnrollmentLocally error:', err);
    throw err;
  }
};

/**
 * getUserEnrollments
 */
export const getUserEnrollments = async (userId) => {
  await ensureInitialized();
  const db = await getDBConnection();

  try {
    // 1) Load all enrollments for that user
    const res = await db.executeSql(
      `SELECT * FROM enrollments WHERE user_id = ? ORDER BY created_at DESC;`,
      [userId]
    );

    const rows = rowsToArray(res);
    const now = new Date();

    const active = [];
    const expiredIds = [];

    // 2) Loop through results and check expiration
    rows.forEach((row) => {
      if (!row.expiry_date) {
        // No expiry date means old enrollment → consider expired for safety
        expiredIds.push(row.id);
        return;
      }

      const exp = new Date(row.expiry_date);

      if (isNaN(exp.getTime()) || exp < now) {
        // invalid date OR expired
        expiredIds.push(row.id);
      } else {
        // valid active enrollment
        active.push({
          ...row,
          expired: false,           // useful for UI badges
          expiry_date: row.expiry_date,
        });
      }
    });

    // 3) Remove expired enrollments automatically
    if (expiredIds.length > 0) {
      const placeholders = expiredIds.map(() => '?').join(',');
      await db.executeSql(
        `DELETE FROM enrollments WHERE id IN (${placeholders})`,
        expiredIds
      );
    }

    // 4) Return only active ones
    return active;
  } catch (err) {
    console.error('getUserEnrollments error:', err);
    return [];
  }
};

export const getUserLastSubject = async (userId) => {
  await ensureInitialized();
  const db = await getDBConnection();

  try {
    const res = await db.executeSql(
      `SELECT subject_id, subject_name FROM last_subject WHERE user_id = ? LIMIT 1;`,
      [userId]
    );

    const rows = rowsToArray(res);
    if (rows.length) {
      return {
        subjectId: rows[0].subject_id,
        subjectName: rows[0].subject_name,
      };
    }
    return null;
  } catch (err) {
    console.error('getUserLastSubject error:', err);
    return null;
  }
};

export const setUserLastSubject = async (userId, subjectId, subjectName) => {
  await ensureInitialized();
  const db = await getDBConnection();

  try {
    await db.executeSql(
      `INSERT OR REPLACE INTO last_subject (user_id, subject_id, subject_name)
       VALUES (?, ?, ?);`,
      [userId, subjectId, subjectName]
    );
  } catch (err) {
    console.error('setUserLastSubject error:', err);
  }
};

/* ---------------------
 * Scores & Leaderboard (reuse/expand existing patterns)
 * --------------------------- */

/**
 * updateUserProgress
 * - inserts into user_scores
 * - updates users.total_score
 * - optionally records period tables and leaderboard
 */
export const updateUserProgress = async (
  userId,
  subject,
  points,
  options = { saveToLeaderboard: true, username: null, recordPeriod: true }
) => {
  await ensureInitialized();
  const db = await getDBConnection();

  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        // ensure table exists (defensive)
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS user_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            subject TEXT,
            points INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          );`
        );

        tx.executeSql(`INSERT INTO user_scores (user_id, subject, points) VALUES (?, ?, ?);`, [userId, subject, points]);

        tx.executeSql(
          `UPDATE users SET total_score = (
             SELECT IFNULL(SUM(points), 0) FROM user_scores WHERE user_id = ?
           ) WHERE id = ?;`,
          [userId, userId]
        );
      },
      (err) => {
        console.error('updateUserProgress transaction error:', err);
        reject(err);
      },
      async () => {
        try {
          const username = options.username || (await _resolveUsername(userId)) || 'Unknown';
          if (options.recordPeriod) {
            await recordScores(userId, username, points);
          }
          if (options.saveToLeaderboard) {
            await saveToLeaderboard(userId, username, subject, points);
          }
          resolve(true);
        } catch (e) {
          console.error('updateUserProgress post-transaction error:', e);
          reject(e);
        }
      }
    );
  });
};

export const saveToLeaderboard = async (userId, username, subject, score) => {
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    await db.executeSql(
      `INSERT INTO leaderboard (user_id, username, subject, score, timestamp) VALUES (?, ?, ?, ?, datetime('now'));`,
      [userId, username, subject, score]
    );
    return true;
  } catch (err) {
    console.error('saveToLeaderboard error:', err);
    throw err;
  }
};

export const recordScores = async (userId, username, points) => {
  await ensureInitialized();
  const db = await getDBConnection();

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const now = new Date();
  const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDaysOfYear = Math.floor((now - firstDayOfYear) / 86400000);
  const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  const week = `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
  const month = today.substring(0, 7); // YYYY-MM

  try {
    await db.executeSql(`INSERT INTO daily_scores (user_id, username, points, date) VALUES (?, ?, ?, ?);`, [userId, username, points, today]);
    await db.executeSql(`INSERT INTO weekly_scores (user_id, username, points, week) VALUES (?, ?, ?, ?);`, [userId, username, points, week]);
    await db.executeSql(`INSERT INTO monthly_scores (user_id, username, points, month) VALUES (?, ?, ?, ?);`, [userId, username, points, month]);
    return true;
  } catch (err) {
    console.error('recordScores error:', err);
    throw err;
  }
};

/* ---------------------------
 * Leaderboard retrieval (same as before)
 * --------------------------- */
export const getLeaderboardAdvanced = async ({
  mode = 'overall',
  subject = null,
  period = 'allTime',
  page = 1,
  pageSize = 50,
} = {}) => {
  await ensureInitialized();
  const db = await getDBConnection();
  const offset = Math.max(0, (page - 1) * pageSize);
  let sql = '';
  let params = [];

  try {
    if (period === 'daily') {
      const today = new Date().toISOString().split('T')[0];
      if (mode === 'subject' && subject) {
        sql = `
          SELECT ds.username, SUM(ds.points) AS points, COUNT(ds.id) AS quiz_count
          FROM daily_scores ds
          JOIN leaderboard l ON l.username = ds.username AND l.subject = ?
          WHERE ds.date = ?
          GROUP BY ds.username
          ORDER BY points DESC
          LIMIT ? OFFSET ?;
        `;
        params = [subject, today, pageSize, offset];
      } else {
        sql = `
          SELECT username, SUM(points) AS points, COUNT(id) AS quiz_count
          FROM daily_scores
          WHERE date = ?
          GROUP BY username
          ORDER BY points DESC
          LIMIT ? OFFSET ?;
        `;
        params = [today, pageSize, offset];
      }
    } else if (period === 'weekly') {
      if (mode === 'subject' && subject) {
        sql = `
          SELECT w.username, SUM(w.points) AS points, COUNT(w.id) AS quiz_count
          FROM weekly_scores w
          JOIN leaderboard l ON l.username = w.username AND l.subject = ?
          GROUP BY w.username
          ORDER BY points DESC
          LIMIT ? OFFSET ?;
        `;
        params = [subject, pageSize, offset];
      } else {
        sql = `
          SELECT username, SUM(points) AS points, COUNT(id) AS quiz_count
          FROM weekly_scores
          GROUP BY username
          ORDER BY points DESC
          LIMIT ? OFFSET ?;
        `;
        params = [pageSize, offset];
      }
    } else if (period === 'monthly') {
      if (mode === 'subject' && subject) {
        sql = `
          SELECT m.username, SUM(m.points) AS points, COUNT(m.id) AS quiz_count
          FROM monthly_scores m
          JOIN leaderboard l ON l.username = m.username AND l.subject = ?
          GROUP BY m.username
          ORDER BY points DESC
          LIMIT ? OFFSET ?;
        `;
        params = [subject, pageSize, offset];
      } else {
        sql = `
          SELECT username, SUM(points) AS points, COUNT(id) AS quiz_count
          FROM monthly_scores
          GROUP BY username
          ORDER BY points DESC
          LIMIT ? OFFSET ?;
        `;
        params = [pageSize, offset];
      }
    } else {
      // allTime
      if (mode === 'subject' && subject) {
        sql = `
          SELECT username, SUM(score) AS points, COUNT(id) AS quiz_count
          FROM leaderboard
          WHERE subject = ?
          GROUP BY username
          ORDER BY points DESC
          LIMIT ? OFFSET ?;
        `;
        params = [subject, pageSize, offset];
      } else {
        sql = `
          SELECT username, SUM(score) AS points, COUNT(id) AS quiz_count
          FROM leaderboard
          GROUP BY username
          ORDER BY points DESC
          LIMIT ? OFFSET ?;
        `;
        params = [pageSize, offset];
      }
    }

    const results = await db.executeSql(sql, params);
    const list = rowsToArray(results);

    const enhanced = list.map((r) => {
      const points = Number(r.points || 0);
      const quiz_count = Number(r.quiz_count || 0);
      const accuracy = quiz_count ? Math.min(100, Math.round((points / (quiz_count * 10)) * 100)) : 0;
      return {
        username: r.username,
        points,
        quiz_count,
        accuracy,
      };
    });

    return enhanced;
  } catch (err) {
    console.error('getLeaderboardAdvanced error:', err, sql, params);
    return [];
  }
};

export const getLeaderboard = async (filter = 'overall', subject = null) => {
  const args =
    filter === 'overall'
      ? { mode: 'overall', period: 'allTime', page: 1, pageSize: 100 }
      : { mode: 'subject', subject, period: 'allTime', page: 1, pageSize: 100 };
  return getLeaderboardAdvanced(args);
};

/* ---------------------------
 * Daily-login streaks & rewards
 * --------------------------- */
/**
 * recordDailyLogin
 * - call when user logs in (redirect to dashboard)
 * - awards 2 points for each distinct calendar day login
 * - if user continues streak to 30 consecutive days -> award 50 points (one-time)
 * - if user continues streak to 90 consecutive days -> create a free_unlcok record (one-time)
 *
 * Implementation note: date strings are YYYY-MM-DD
 */
export const recordDailyLoginPending = async (userId) => {
  console.log('STREAKDBG DB: recordDailyLoginPending start for', userId);
  if (!userId) {
    console.log('STREAKDBG DB: no userId provided');
    return { loggedIn: false };
  }

  await ensureInitialized();
  const db = await getDBConnection();
  const today = new Date().toISOString().split('T')[0];
  console.log('STREAKDBG DB: today', today);

  try {
    const res = await db.executeSql(`SELECT * FROM daily_logins WHERE user_id = ? LIMIT 1;`, [userId]);
    const rows = rowsToArray(res);
    console.log('STREAKDBG DB: daily_logins rows length', rows.length, rows);

    if (!rows.length) {
      console.log('STREAKDBG DB: creating initial daily_logins row (first login)');
      await db.executeSql(
        `INSERT INTO daily_logins (user_id, streak, last_login_date, logged_in_today, quiz_count_today, monthly_awarded)
         VALUES (?, 1, ?, 1, 0, 0);`,
        [userId, today]
      );
      await updateUserProgress(userId, 'Login', 2, { saveToLeaderboard: true });
      console.log('STREAKDBG DB: awardedPoints=2, streak=1 (first login)');
      return { loggedIn: true, awardedPoints: 2, counted: false, streak: 1, quiz_count_today: 0, monthlyAwarded: false };
    }

    const rec = rows[0];
    console.log('STREAKDBG DB: existing record', rec);

    if (rec.last_login_date === today) {
      console.log('STREAKDBG DB: already logged in today (no award)');
      return {
        loggedIn: true,
        awardedPoints: 0,
        counted: !!rec.counted,
        streak: rec.streak || 0,
        quiz_count_today: rec.quiz_count_today || 0,
        monthlyAwarded: !!rec.monthly_awarded,
      };
    }

    // calculate new streak: if last_login_date was yesterday then +1 else reset to 1
    const lastDate = new Date(rec.last_login_date);
    const todayDate = new Date(today);
    const diffMs = todayDate - lastDate;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const newStreak = diffMs <= oneDayMs + 1000 ? (rec.streak || 0) + 1 : 1; // small buffer

    console.log('STREAKDBG DB: last_login_date', rec.last_login_date, 'diffMs', diffMs, 'newStreak', newStreak);

    await db.executeSql(
      `UPDATE daily_logins SET streak = ?, last_login_date = ?, logged_in_today = 1, quiz_count_today = 0 WHERE user_id = ?;`,
      [newStreak, today, userId]
    );

    await updateUserProgress(userId, 'Login', 2, { saveToLeaderboard: true });
    const monthlyAwarded = newStreak % 30 === 0;

    console.log('STREAKDBG DB: awardedPoints=2, monthlyAwarded', monthlyAwarded);

    return {
      loggedIn: true,
      awardedPoints: 2,
      counted: false,
      streak: newStreak,
      quiz_count_today: 0,
      monthlyAwarded,
    };
  } catch (err) {
    console.error('STREAKDBG DB: recordDailyLoginPending error', err);
    throw err;
  }
};


export const recordQuizStreakCompletion = async (userId) => {
  await ensureInitialized();
  const db = await getDBConnection();
  const today = new Date().toISOString().split('T')[0];

  // SAVE QUIZ COMPLETION DATE (FOR CALENDAR)
  await db.executeSql(
    `INSERT OR IGNORE INTO quiz_records (user_id, date_string)
    VALUES (?, ?);`,
    [userId, today]
  );

  const res = await db.executeSql(`SELECT * FROM daily_activity WHERE user_id=?;`, [userId]);
  const rows = rowsToArray(res);
  if (!rows.length) return false;

  const rec = rows[0];

  // If streak already counted today, do nothing
  if (Number(rec.streak_counted) === 1) return false;

  // Mark streak counted
  await db.executeSql(
    `UPDATE daily_activity SET streak_counted=1 WHERE user_id=?;`,
    [userId]
  );

  // Update the main streak table
  const streakRes = await db.executeSql(`SELECT * FROM daily_logins WHERE user_id=?;`, [userId]);
  const srows = rowsToArray(streakRes);

  let newStreak = 1;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (!srows.length) {
    await db.executeSql(
      `INSERT INTO daily_logins (user_id, streak, last_login_date, monthly_awarded, ninety_awarded)
       VALUES (?, 1, ?, 0, 0);`,
      [userId, today]
    );
  } else {
    const r = srows[0];
    if (r.last_login_date === yesterday) newStreak = r.streak + 1;

    await db.executeSql(
      `UPDATE daily_logins SET streak=?, last_login_date=? WHERE user_id=?;`,
      [newStreak, today, userId]
    );
  }

  // award quiz streak +2
  await updateUserProgress(userId, 'Daily Quiz Streak', 2);

  // month & 90 day bonuses reused from your code:
  let monthlyAward = false;

  if (newStreak >= 30) {
    await updateUserProgress(userId, '30-Day Streak Bonus', 50);
    monthlyAward = true;
  }

  return { streak: newStreak, monthlyAward };
};


/**
 * getQuizCountForToday(userId)
 */
export const getQuizCountForToday = async (userId) => {
  await ensureInitialized();
  const db = await getDBConnection();
  const today = new Date().toISOString().split('T')[0];
  try {
    const res = await db.executeSql(`SELECT quiz_count FROM quiz_daily WHERE user_id = ? AND date = ? LIMIT 1;`, [userId, today]);
    const rows = rowsToArray(res);
    if (!rows.length) return 0;
    return rows[0].quiz_count || 0;
  } catch (err) {
    console.error('getQuizCountForToday error', err);
    return 0;
  }
};

/**
 * incrementQuizCountForToday(userId, increment=1)
 * returns new count
 */
export const incrementQuizCountForToday = async (userId, threshold = 10) => {
  if (!userId) return { ok: false };

  await ensureInitialized();
  const db = await getDBConnection();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  try {
    // Ensure a daily_logins row exists for the user
    const res = await db.executeSql(`SELECT * FROM daily_logins WHERE user_id = ? LIMIT 1;`, [userId]);
    const rows = rowsToArray(res);

    if (!rows.length) {
      // No daily row yet -> create row marking they have logged in today (but login path should have done this)
      await db.executeSql(`INSERT INTO daily_logins (user_id, streak, last_login_date, logged_in_today, counted, quiz_count_today, monthly_awarded) VALUES (?, 0, ?, 0, 0, 0, 0);`, [userId, today]);
    }

    // increment quiz_count_today
    await db.executeSql(`UPDATE daily_logins SET quiz_count_today = COALESCE(quiz_count_today, 0) + 1 WHERE user_id = ?;`, [userId]);

    // fetch updated row
    const updatedRes = await db.executeSql(`SELECT * FROM daily_logins WHERE user_id = ? LIMIT 1;`, [userId]);
    const updated = rowsToArray(updatedRes)[0];

    const quizCount = Number(updated.quiz_count_today || 0);
    const alreadyCounted = Number(updated.counted || 0) === 1;

    // If threshold reached and not yet counted -> finalize
    if (quizCount >= threshold && !alreadyCounted) {
      // Determine new streak:
      // If previous last_counted_date is yesterday => streak+1, else streak resets to 1
      let newStreak = 1;
      if (updated.last_counted_date === yesterday) {
        newStreak = (updated.streak || 0) + 1;
      } else {
        newStreak = 1;
      }

      // update daily_logins
      await db.executeSql(`UPDATE daily_logins SET streak = ?, counted = 1, last_counted_date = ?, logged_in_today = 1 WHERE user_id = ?;`, [newStreak, today, userId]);

      // insert into history (if not exists)
      await db.executeSql(`INSERT OR IGNORE INTO daily_login_history (user_id, date, pieces_awarded) VALUES (?, ?, ?);`, [userId, today, 2]);

      // add 2 pieces to user's pieces balance
      await addUserPieces(userId, 2);

      // award monthly bonus if streak hits 30 and not awarded before
      let monthlyAwardedNow = false;
      if ((newStreak >= 30) && Number(updated.monthly_awarded || 0) === 0) {
        // award 50 leaderboard points
        await updateUserProgress(userId, '30-day streak bonus', 50, { saveToLeaderboard: true });
        await db.executeSql(`UPDATE daily_logins SET monthly_awarded = 1 WHERE user_id = ?;`, [userId]);
        monthlyAwardedNow = true;
      }

      return {
        ok: true,
        finalized: true,
        newStreak,
        piecesAwarded: 2,
        monthlyAwarded: monthlyAwardedNow,
        quizCount,
      };
    }

    // else not yet threshold
    return { ok: true, finalized: false, quizCount };
  } catch (err) {
    console.error('incrementQuizCountForToday error', err);
    throw err;
  }
};





export const piecesToNaira = (pieces) => {
  return Number((pieces * PIECE_VALUE_NAIRA).toFixed(2));
};


/**
 * getUserPieces(userId) -> returns integer pieces
 */
export const addUserPieces = async (userId, piecesToAdd = 0) => {
  if (!userId) throw new Error('userId required');
  await ensureInitialized();
  const db = await getDBConnection();

  try {
    await db.executeSql(
      `INSERT OR REPLACE INTO user_pieces (user_id, pieces)
       VALUES (?, COALESCE((SELECT pieces FROM user_pieces WHERE user_id = ?), 0) + ?);`,
      [userId, userId, piecesToAdd]
    );

    // FIXED: DO NOT USE rowsToArray
    const res = await db.executeSql(
      `SELECT pieces FROM user_pieces WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    const row = res[0].rows.length > 0 ? res[0].rows.item(0) : null;

    return row ? row.pieces : 0;

  } catch (err) {
    console.error('addUserPieces error', err);
    throw err;
  }
};

export const getUserPieces = async (userId) => {
  if (!userId) return 0;
  await ensureInitialized();
  const db = await getDBConnection();

  try {
    const res = await db.executeSql(
      `SELECT pieces FROM user_pieces WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    const row = res[0].rows.length > 0 ? res[0].rows.item(0) : null;
    return row ? row.pieces : 0;

  } catch (err) {
    console.error('getUserPieces error', err);
    return 0;
  }
};



export const deductUserPieces = async (userId, amountPieces) => {
  await ensureInitialized();
  if (!userId) throw new Error('Missing userId');

  const db = await getDBConnection();

  try {
    // Get current pieces
    const res = await db.executeSql(
      `SELECT pieces FROM user_pieces WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    const currentPieces =
      res[0].rows.length ? Number(res[0].rows.item(0).pieces) : 0;

    if (currentPieces < amountPieces) {
      throw new Error('Not enough pieces');
    }

    const newBalance = currentPieces - amountPieces;

    // Update
    await db.executeSql(
      `UPDATE user_pieces SET pieces = ? WHERE user_id = ?`,
      [newBalance, userId]
    );

    return newBalance;
  } catch (err) {
    console.error('deductUserPieces error:', err);
    throw err;
  }
};

/**
 * resetUserStreakAndPieces(userId)
 * Called when user misses a day; resets daily streak and pieces to 0.
 */
export const resetUserStreakAndPieces = async (userId) => {
  await ensureInitialized();
  const db = await getDBConnection();
  const today = new Date().toISOString().split('T')[0];
  try {
    // Reset daily_logins.streak to 0 and last_login_date to today (to avoid double counting)
    await db.executeSql(`UPDATE daily_logins SET streak = 0, monthly_awarded = 0, ninety_awarded = 0 WHERE user_id = ?;`, [userId]);

    // Reset pieces
    await db.executeSql(`INSERT OR REPLACE INTO user_pieces (user_id, pieces, updated_at) VALUES (?, 0, datetime('now'));`, [userId]);

    // Optionally clear quiz_daily rows older than today
    await db.executeSql(`DELETE FROM quiz_daily WHERE user_id = ? AND date != ?;`, [userId, today]);

    return true;
  } catch (err) {
    console.error('resetUserStreakAndPieces error', err);
    throw err;
  }
};

/**
 * recordQuizThresholdIfEligible(userId)
 *
 * Called whenever you want to test "did the user reach 10 quizzes today?"
 * If the user has logged in today (recorded by recordDailyLogin), and quiz_count >= 10,
 * and today's streak hasn't already been counted -> then:
 *  - award 2 pieces (and save in user_pieces)
 *  - increment daily_logins.streak by 1 and set last_login_date appropriately
 *  - return { awardedPieces: 2, newPiecesTotal, newStreak, markedDay: true }
 *
 * This does the "streak day counting" that used to happen in recordDailyLogin.
 */
export const recordQuizThresholdIfEligible = async (userId) => {
  await ensureInitialized();
  const db = await getDBConnection();
  const today = new Date().toISOString().split('T')[0];
  try {
    // get today's quiz count
    const qRes = await db.executeSql(`SELECT quiz_count FROM quiz_daily WHERE user_id = ? AND date = ? LIMIT 1;`, [userId, today]);
    const qRows = rowsToArray(qRes);
    const quizCount = qRows.length ? (qRows[0].quiz_count || 0) : 0;

    if (quizCount < 10) {
      return { eligible: false, reason: 'not_enough_quizzes', quizCount };
    }

    // ensure user has logged in today (recordDailyLogin should have been called)
    const dRes = await db.executeSql(`SELECT streak, last_login_date FROM daily_logins WHERE user_id = ? LIMIT 1;`, [userId]);
    const dRows = rowsToArray(dRes);
    let currentStreak = 0;
    let lastLoginDate = null;

    if (!dRows.length) {
      // create a daily_logins row if missing, but set streak=0 (we will increment now)
      await db.executeSql(`INSERT INTO daily_logins (user_id, streak, last_login_date, monthly_awarded, ninety_awarded) VALUES (?, 0, ?, 0, 0);`, [userId, today]);
      currentStreak = 0;
      lastLoginDate = null;
    } else {
      currentStreak = dRows[0].streak || 0;
      lastLoginDate = dRows[0].last_login_date || null;
    }

    // If lastLoginDate is not yesterday or today, it means the user missed a day and streak should reset.
    // We decide "missed" if last_login_date !== yesterday (and !== today).
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (lastLoginDate && lastLoginDate !== yesterday && lastLoginDate !== today) {
      // reset streak and pieces before awarding
      await resetUserStreakAndPieces(userId);
      currentStreak = 0;
    }

    // Check if today's streak already counted (avoid double-award)
    // We'll use last_login_date === today to detect if we've already counted today's streak.
    if (lastLoginDate === today) {
      return { eligible: false, reason: 'already_counted', quizCount, streak: currentStreak };
    }

    // At this point: quizCount >= 10 and either user logged in today (there is a daily_logins record)
    // Award 2 pieces
    const awardedPieces = 2;
    const newPiecesTotal = await addUserPieces(userId, awardedPieces);

    // increment streak and mark last_login_date = today
    const newStreak = currentStreak + 1;
    await db.executeSql(`UPDATE daily_logins SET streak = ?, last_login_date = ? WHERE user_id = ?;`, [newStreak, today, userId]);

    // optionally record leaderboard points for the quiz streak? you said pieces are not leaderboard points, so do NOT award points to leaderboard here
    // If you want to award leaderboard points separately, call updateUserProgress(userId, 'Quiz Streak', 2, {...})

    return {
      eligible: true,
      awardedPieces,
      newPiecesTotal,
      newStreak,
      quizCount
    };
  } catch (err) {
    console.error('recordQuizThresholdIfEligible error', err);
    throw err;
  }
};



/**
 * Get last 30 days login history (finalized days) for rendering dashboard calendar
 * returns array of { date: 'YYYY-MM-DD', finalized: true/false, pieces: number } for last 30 days ending today
 */
export const getMonthlyLoginHistory = async (userId, days = 30) => {
  if (!userId) return [];
  await ensureInitialized();
  const db = await getDBConnection();
  const today = new Date();
  const dates = [];

  // build last `days` dates in ascending order (older -> newer)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const iso = d.toISOString().split('T')[0];
    dates.push(iso);
  }

  try {
    // fetch history rows for the range
    const oldest = dates[0];
    const res = await db.executeSql(`SELECT date, pieces_awarded FROM daily_login_history WHERE user_id = ? AND date >= ? ORDER BY date ASC;`, [userId, oldest]);
    const rows = rowsToArray(res);
    const map = {};
    rows.forEach((r) => { map[r.date] = r; });

    // build result
    return dates.map((date) => {
      if (map[date]) {
        return { date, finalized: true, pieces: map[date].pieces_awarded || 0 };
      }
      return { date, finalized: false, pieces: 0 };
    });
  } catch (err) {
    console.error('getMonthlyLoginHistory error', err);
    return dates.map((date) => ({ date, finalized: false, pieces: 0 }));
  }
};


/**
 * getFreeUnlocksForUser
 * - returns free unlock rows that are granted and not claimed yet
 */
export const getFreeUnlocksForUser = async (userId) => {
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    const res = await db.executeSql(`SELECT * FROM free_unlocks WHERE user_id = ? ORDER BY granted_at DESC;`, [userId]);
    return rowsToArray(res);
  } catch (err) {
    console.error('getFreeUnlocksForUser error:', err);
    return [];
  }
};

/**
 * claimFreeUnlock
 * - user selects a subject to redeem a free unlock
 * - marks the free_unlock record claimed, and creates an enrollment (paid=1, unlocked_via_reward=1)
 */
export const claimFreeUnlock = async (freeUnlockId, userId, subjectId) => {
  await ensureInitialized();
  const db = await getDBConnection();

  if (!freeUnlockId || !userId || !subjectId) throw new Error('Missing parameters');

  try {
    // get subject
    const sres = await db.executeSql(`SELECT * FROM subjects WHERE id = ? LIMIT 1;`, [subjectId]);
    const srows = rowsToArray(sres);
    if (!srows.length) throw new Error('Subject not found');

    const subject = srows[0];

    // create enrollment marked as paid and unlocked_via_reward
    await db.executeSql(
      `INSERT INTO enrollments (user_id, subject_name, subject_id, amount, paid, payment_method, payment_status, unlocked_via_reward)
       VALUES (?, ?, ?, 0, 1, 'free_unlock', 'paid', 1);`,
      [userId, subject.name, subject.id]
    );

    // mark free_unlock record as claimed
    await db.executeSql(`UPDATE free_unlocks SET claimed = 1 WHERE id = ? AND user_id = ?;`, [freeUnlockId, userId]);

    return true;
  } catch (err) {
    console.error('claimFreeUnlock error:', err);
    throw err;
  }
};

/* ---------------------------
 * Helper: resolve username
 * --------------------------- */
const _resolveUsername = async (userId) => {
  if (!userId) return null;
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    const res = await db.executeSql(`SELECT name FROM users WHERE id = ? LIMIT 1;`, [userId]);
    const rows = rowsToArray(res);
    return rows.length ? rows[0].name : null;
  } catch (err) {
    console.error('_resolveUsername error:', err);
    return null;
  }
};

/* ---------------------------
 * XP + level helper (unchanged)
 * --------------------------- */
const XP_PER_LEVEL = 500;

export const addXP = async (userId, xpEarned) => {
  await ensureInitialized();
  const db = await getDBConnection();

  try {
    await db.transaction(async (tx) => {
      await tx.executeSql(`UPDATE users SET xp = IFNULL(xp,0) + ? WHERE id = ?;`, [xpEarned, userId]);
      await tx.executeSql(`UPDATE users SET level = CAST((IFNULL(xp,0) / ?) AS INTEGER) WHERE id = ?;`, [XP_PER_LEVEL, userId]);
    });
    return true;
  } catch (err) {
    console.error('addXP error:', err);
    throw err;
  }
};

/* ---------------------------
 * Streak helpers (activity streak)
 * --------------------------- */
export const updateStreak = async (userId) => {
  await ensureInitialized();
  const db = await getDBConnection();
  const today = new Date().toISOString().split('T')[0];

  try {
    const res = await db.executeSql(`SELECT * FROM streaks WHERE user_id = ?;`, [userId]);
    const rows = rowsToArray(res);

    if (!rows.length) {
      await db.executeSql(`INSERT INTO streaks (user_id, streak, last_active_date) VALUES (?, 1, ?);`, [userId, today]);
      return 1;
    }

    const rec = rows[0];
    if (rec.last_active_date === today) return rec.streak;

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (rec.last_active_date === yesterday) {
      const newStreak = rec.streak + 1;
      await db.executeSql(`UPDATE streaks SET streak = ?, last_active_date = ? WHERE user_id = ?;`, [newStreak, today, userId]);
      return newStreak;
    } else {
      await db.executeSql(`UPDATE streaks SET streak = 1, last_active_date = ? WHERE user_id = ?;`, [today, userId]);
      return 1;
    }
  } catch (err) {
    console.error('updateStreak error:', err);
    throw err;
  }
};

/* ---------------------------
 * Badges
 * --------------------------- */
export const awardBadge = async (userId, badgeName) => {
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    const today = new Date().toISOString();
    await db.executeSql(`INSERT INTO achievements (user_id, badge, date) VALUES (?, ?, ?);`, [userId, badgeName, today]);
    return true;
  } catch (err) {
    console.error('awardBadge error:', err);
    throw err;
  }
};

/* ---------------------------
 * Utility: getUserRank
 * --------------------------- */
export const getUserRank = async (username) => {
  try {
    const board = await getLeaderboard('overall', null);
    const idx = board.findIndex((r) => r.username === username);
    return idx === -1 ? null : idx + 1;
  } catch (err) {
    console.error('getUserRank error:', err);
    return null;
  }
};

export const getQuizThresholdDates = async (userId) => {
  await ensureInitialized();
  const db = await getDBConnection();
  const today = new Date().toISOString().split('T')[0];

  try {
    // table ensure
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS quiz_threshold (
        user_id INTEGER,
        date TEXT,
        PRIMARY KEY (user_id, date)
      );
    `);

    const res = await db.executeSql(
      `SELECT date FROM quiz_threshold WHERE user_id = ?`,
      [userId]
    );

    let rows = [];
    for (let i = 0; i < res[0].rows.length; i++) {
      rows.push(res[0].rows.item(i).date);
    }
    return rows;
  } catch (err) {
    console.log("getQuizThresholdDates error", err);
    return [];
  }
};

export const recordQuizCompletion = async (userId) => {
  const db = await getDBConnection();

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  await db.executeSql(
    `INSERT OR IGNORE INTO quiz_records (user_id, date_string)
     VALUES (?, ?)`,
    [userId, today]
  );

  return true;
};

/* ---------------------------
 * Notifications & Analytics Helpers
 * --------------------------- */

// notifyUser: inserts notification row and optionally triggers local notification
export const notifyUser = async (userId, title, body, data = null) => {
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    await db.executeSql(
      `INSERT INTO notifications (user_id, title, body, data) VALUES (?, ?, ?, ?);`,
      [userId, title, body, data ? JSON.stringify(data) : null]
    );
    // Return ok; UI layer should trigger local push when screen is active / service is running.
    return { ok: true };
  } catch (err) {
    console.error('notifyUser error', err);
    throw err;
  }
};

// getNotificationsForUser
export const getNotificationsForUser = async (userId) => {
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    const res = await db.executeSql(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC;`, [userId]);
    const rows = rowsToArray(res);
    return rows;
  } catch (err) {
    console.error('getNotificationsForUser error', err);
    return [];
  }
};

/* ---------------------------
 * Analytics: revenue, sales by subject, code redemptions, payment stats
 * --------------------------- */

// Total revenue (sum of completed payments + value of redeemed offline codes)
export const getTotalRevenue = async () => {
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    // Sum payments with status = 'completed'
    const pres = await db.executeSql(`SELECT IFNULL(SUM(amount),0) as total FROM payments WHERE status = 'completed';`);
    const totalPay = (pres[0].rows.length ? pres[0].rows.item(0).total : 0) || 0;

    // Sum redeemed offline codes value (they create payments with method='code' and status='completed' so already counted)
    // So totalPay already covers them.

    return Number(totalPay);
  } catch (err) {
    console.error('getTotalRevenue error', err);
    return 0;
  }
};

// Sales grouped by subject (count + revenue)
export const getSalesBySubject = async () => {
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    const res = await db.executeSql(`
      SELECT subject, COUNT(*) AS count, IFNULL(SUM(amount),0) AS revenue
      FROM payments
      WHERE status = 'completed'
      GROUP BY subject
      ORDER BY revenue DESC;
    `);
    return rowsToArray(res);
  } catch (err) {
    console.error('getSalesBySubject error', err);
    return [];
  }
};

// Code redemptions: count by month or total
export const getCodeRedemptions = async ({ months = 6 } = {}) => {
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    // Total redeemed codes (payments method='code' and status='completed')
    const totalRes = await db.executeSql(`SELECT COUNT(*) as total FROM payments WHERE method = 'code' AND status = 'completed';`);
    const total = totalRes[0].rows.length ? totalRes[0].rows.item(0).total : 0;

    // simple monthly series for last `months`
    const now = new Date();
    const monthsArr = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsArr.push(monthKey);
    }

    const rows = [];
    for (const m of monthsArr) {
      const r = await db.executeSql(
        `SELECT COUNT(*) as cnt FROM payments WHERE method = 'code' AND status = 'completed' AND strftime('%Y-%m', created_at) = ?;`,
        [m]
      );
      rows.push({ month: m, count: r[0].rows.item(0).cnt || 0 });
    }

    return { total: Number(total), monthly: rows };
  } catch (err) {
    console.error('getCodeRedemptions error', err);
    return { total: 0, monthly: [] };
  }
};

// Payment success/failure stats (completed vs failed vs pending)
export const getPaymentStats = async () => {
  await ensureInitialized();
  const db = await getDBConnection();
  try {
    const res = await db.executeSql(`
      SELECT status, COUNT(*) as count, IFNULL(SUM(amount),0) as total
      FROM payments
      GROUP BY status;
    `);
    return rowsToArray(res);
  } catch (err) {
    console.error('getPaymentStats error', err);
    return [];
  }
};

// setAdminPin(adminUserId, pinPlain)
export const setAdminPin = async (adminUserId, pinPlain) => {
  await ensureInitialized();
  const db = await getDBConnection();
  const hash = CryptoJS.SHA256(pinPlain + 'edubox_pin_salt_v1').toString();
  await db.executeSql(`UPDATE users SET admin_pin_hash = ? WHERE id = ?;`, [hash, adminUserId]);
  return true;
};

export const verifyAdminPin = async (adminUserId, pinPlain) => {
  await ensureInitialized();
  const db = await getDBConnection();
  const hash = CryptoJS.SHA256(pinPlain + 'edubox_pin_salt_v1').toString();
  const res = await db.executeSql(`SELECT admin_pin_hash FROM users WHERE id = ? LIMIT 1`, [adminUserId]);
  const rows = rowsToArray(res);
  if (!rows.length) return false;
  return rows[0].admin_pin_hash === hash;
};


export const isAdminPinSet = async (adminId) => {
  const db = await getDBConnection();
  const result = await db.executeSql(
    "SELECT admin_pin_hash FROM users WHERE id = ?",
    [adminId]
  );

  if (!result[0].rows.length) return false;

  const pin = result[0].rows.item(0).admin_pin_hash;

  return pin && pin.trim() !== "";
};


/**
 * validatePaymentReference
 * - checks format, uniqueness, entropy, frequency, similarity to recent refs
 * Returns { ok: boolean, issues: [strings], score: 0..100 }
 */
export const validatePaymentReference = async (reference, { userId = null, subjectId = null, amount = null } = {}) => {
  await ensureInitialized();
  const issues = [];
  const ref = (reference || '').trim();

  if (!ref) {
    issues.push('empty');
    return { ok: false, issues, score: 0 };
  }

  // 1) format check (must start with EDU-)
  if (!ref.startsWith('EDU-')) {
    issues.push('missing_prefix');
  }

  // 2) length
  if (ref.length < 8 || ref.length > 64) {
    issues.push('bad_length');
  }

  // 3) uniqueness: ensure not used before (payments or pending)
  try {
    const pres = await db.executeSql(`SELECT COUNT(*) as cnt FROM payments WHERE reference = ?`, [ref]);
    const pendingRes = await db.executeSql(`SELECT COUNT(*) as cnt FROM pending_payments WHERE id IN (SELECT id FROM pending_payments) AND ?`, [ref]).catch(()=>null);

    const usedCount = pres[0].rows.length ? pres[0].rows.item(0).cnt : 0;
    if (usedCount > 0) issues.push('reference_already_used');
  } catch (e) {
    // ignore uniqueness DB errors
  }

  // 4) entropy heuristic — check if string has mixed chars (numbers/letters/hyphens)
  const hasLetters = /[A-Z]/i.test(ref);
  const hasDigits = /\d/.test(ref);
  const hasHyphen = /-/.test(ref);
  if (!(hasLetters && hasDigits)) issues.push('low_entropy');

  // 5) repetition / flood check (same ref submitted many times by same user)
  try {
    const db = await getDBConnection();
    const r = await db.executeSql(`SELECT COUNT(*) as cnt FROM payments WHERE reference = ? AND user_id = ?`, [ref, userId]);
    if (r[0].rows.length && r[0].rows.item(0).cnt > 1) issues.push('repeated_by_user');
  } catch (e) {}

  // 6) amount mismatch check (if provided)
  if (amount != null && subjectId != null) {
    try {
      const sres = await db.executeSql(`SELECT price FROM subjects WHERE id = ? LIMIT 1`, [subjectId]);
      const srows = rowsToArray(sres);
      if (srows.length) {
        const expected = Number(srows[0].price || 0);
        if (Number(amount) !== expected) issues.push('amount_mismatch');
      }
    } catch (e) {}
  }

  // compute simple score
  let score = 100;
  score -= issues.length * 25;
  if (score < 0) score = 0;

  return { ok: issues.length === 0, issues, score };
};

  const seedShopIfNeeded = async () => {
    try {
      const db = await getDBConnection();
      for (const it of seedShopItems) {
        await db.executeSql(`INSERT OR IGNORE INTO shop_items (key, title, price) VALUES (?, ?, ?);`, [it.key, it.title, it.price]);
      }
    } catch (err) {
      console.warn('seedShopIfNeeded err', err);
    }
  };

  // equipSkin: look in equipped_skins table; map to files under assets/lottie/ (matching your screenshot)
  const equipSkin = async () => {
  try {
    const user = userRef.current;
    if (!user) return;

    const db = await getDBConnection();
    const res = await db.executeSql(
      `SELECT asset_key FROM equipped_skins WHERE user_id = ? LIMIT 1`,
      [user.id]
    );

    if (res[0].rows.length === 0) {
      setRunnerSkin(DEFAULT_SKIN);
      return;
    }

    const skinKey = res[0].rows.item(0).asset_key;
    setRunnerSkin(RUNNER_SKINS[skinKey] || DEFAULT_SKIN);
  } catch (err) {
    console.warn('equipSkin error', err);
    setRunnerSkin(DEFAULT_SKIN);
  }
};


  const loadGameProgress = async (userId, subject) => {
    try {
      const db = await getDBConnection();
      const res = await db.executeSql(`SELECT * FROM user_game_progress WHERE user_id = ? AND subject = ? LIMIT 1;`, [userId, subject]);
      if (res[0].rows.length > 0) return res[0].rows.item(0);
      return null;
    } catch (err) {
      console.warn('loadGameProgress err', err);
      return null;
    }
  };

  const loadHighestLevelForUser = async (userId) => {
    try {
      const db = await getDBConnection();
      const res = await db.executeSql(`SELECT MAX(level) as maxLevel FROM user_game_progress WHERE user_id = ?;`, [userId]);
      if (res[0].rows.length > 0) return res[0].rows.item(0).maxLevel || null;
      return null;
    } catch (err) {
      console.warn('loadHighestLevelForUser err', err);
      return null;
    }
  };

  const saveGameProgress = async (userId, subject, { level: lvl, coins: cns, fails = 0 }) => {
    try {
      const db = await getDBConnection();
      const existing = await db.executeSql(`SELECT id FROM user_game_progress WHERE user_id = ? AND subject = ? LIMIT 1;`, [userId, subject]);
      const now = new Date().toISOString();
      if (existing[0].rows.length > 0) {
        await db.executeSql(`UPDATE user_game_progress SET level = ?, coins = ?, fails = ?, updated_at = ? WHERE user_id = ? AND subject = ?;`, [lvl, cns, fails, now, userId, subject]);
      } else {
        await db.executeSql(`INSERT INTO user_game_progress (user_id, subject, level, coins, fails, updated_at) VALUES (?, ?, ?, ?, ?, ?);`, [userId, subject, lvl, cns, fails, now]);
      }
    } catch (err) {
      console.warn('saveGameProgress err', err);
    }
  };

  export const updateUserPassword = async (userId, newPassword) => {
  const db = await getDBConnection();
  const hashed = hashPassword(newPassword);

  await db.executeSql(
    `UPDATE users SET password = ? WHERE id = ?`,
    [hashed, userId]
  );

  return true;
};

  export const updateUserProfile = async (id, name) => {
    const db = await getDBConnection();
    await db.executeSql(
      `UPDATE users SET name = ? WHERE id = ?`,
      [name, id]
    );
  };



  export const verifyUserPasswordByEmail = async (email, plainPassword) => {
    const db = await getDBConnection();
    const res = await db.executeSql(
      `SELECT password FROM users WHERE email = ?`,
      [email]
    );

    if (res[0].rows.length === 0) return false;

    const storedHash = res[0].rows.item(0).password;
    return hashPassword(plainPassword) === storedHash;
  };


  export const getQuizRecordsForMonth = async (userId, yearMonth) => {
    await ensureInitialized();
    const db = await getDBConnection();

    const res = await db.executeSql(
      `SELECT date_string FROM quiz_records
      WHERE user_id=? AND date_string LIKE ?;`,
      [userId, `${yearMonth}-%`]
    );

    return rowsToArray(res).map(r => r.date_string);
  };


  export const markLessonCompleted = async (
    userId,
    subjectId,
    lessonKey
  ) => {
    const db = await getDBConnection();

    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS lesson_progress (
        user_id INTEGER,
        subject_id TEXT,
        lesson_key TEXT,
        PRIMARY KEY (user_id, subject_id, lesson_key)
      );
    `);

    await db.executeSql(
      `
      INSERT OR IGNORE INTO lesson_progress
      (user_id, subject_id, lesson_key)
      VALUES (?, ?, ?)
      `,
      [userId, subjectId, lessonKey]
    );
  };

  export const getSubjectProgress = async (userId, subjectName) => {
    const db = await getDBConnection();

    const SUBJECT_TOTAL_TOPICS = {
      Agriculture: 10,
      Biology: 12,
      Chemistry: 8,
      English: 15,
      Maths: 14,
      Physics: 9,
    };

    const [res] = await db.executeSql(
      `
      SELECT COUNT(DISTINCT topic) AS completed
      FROM topic_attempts
      WHERE user_id = ? AND subject = ?
      `,
      [userId, subjectName]
    );

    const completed = res.rows.item(0)?.completed || 0;
    const total = SUBJECT_TOTAL_TOPICS[subjectName] || 0;

    if (total === 0) return 0;

    return Math.round((completed / total) * 100);
  };



    export async function safeInitDB() {
    try {
      await ensureInitialized();
      return true;
    } catch (e) {
      console.error('DB init failed safely:', e);
      return false;
    }
  };


/* ---------------------------
 * Exports
 * --------------------------- */
export default {
  ensureInitialized,
  createUser,
  getUserByEmail,
  loginUser,
  logoutUser,
  getCurrentUser,
  getAllSubjects,
  getSubjectByName,
  setSubjectPrice,
  enrollInSubject,
  payEnrollmentLocally,
  markPendingPaymentAsPaid,
  getUserEnrollments,
  updateUserProgress,
  saveToLeaderboard,
  recordScores,
  getLeaderboard,
  getLeaderboardAdvanced,
  addXP,
  updateStreak,
  awardBadge,
  getUserRank,
  recordDailyLoginPending,
  recordQuizStreakCompletion,
  getFreeUnlocksForUser,
  claimFreeUnlock,
  generateOfflineCodes,
  redeemOfflineCode,
  saveManualPayment,
  createOnlinePaymentRecord,
  incrementQuizCountForToday,
  getQuizCountForToday,
  getUserPieces,
  addUserPieces,
  resetUserStreakAndPieces,
  recordQuizThresholdIfEligible,
  getMonthlyLoginHistory,
  piecesToNaira,
  deductUserPieces,
  getUserLastSubject,
  setUserLastSubject,
  getQuizThresholdDates,
  recordQuizCompletion,
  submitManualPaymentPending,
  submitOnlinePaymentPending,
  rejectPendingPayment,
  notifyUser,
  getNotificationsForUser,
  getTotalRevenue,
  getSalesBySubject,
  getCodeRedemptions,
  getPaymentStats,
  validatePaymentReference,
  setAdminPin,
  verifyAdminPin,
  isAdminPinSet,
  seedShopIfNeeded,
  equipSkin,
  loadGameProgress,
  loadHighestLevelForUser,
  saveGameProgress,
  getQuizRecordsForMonth,
  getSubjectProgress,
  safeInitDB
};
