// database.js
import SQLite from "react-native-sqlite-storage";

SQLite.enablePromise(true);

const DB_NAME = "edubox.db";
const DB_LOCATION = "default";

/** -------------------------------------------------
 * OPEN DATABASE CONNECTION
 * ------------------------------------------------- */
export const getDBConnection = async () => {
  try {
    const db = await SQLite.openDatabase({
      name: DB_NAME,
      location: DB_LOCATION,
    });
    console.log("✅ Database connected:", DB_NAME);
    return db;
  } catch (error) {
    console.error("❌ Failed to open DB:", error);
    throw error;
  }
};

/** -------------------------------------------------
 * INITIALIZE DATABASE
 * ------------------------------------------------- */
export const initDB = async () => {
  const db = await getDBConnection();

  try {
    await db.transaction(async (tx) => {
      console.log("⚙️ Initializing database...");

      /** USERS */
      tx.executeSql(`
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

      tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);

      /** SUBJECTS */
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS subjects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          price INTEGER DEFAULT 0,
          is_free INTEGER DEFAULT 0 -- 0=false, 1=true
          track TEXT  ,
          category TEXT ,
        );
      `);

      /** LESSONS */
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS lessons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subject_id INTEGER,
          title TEXT NOT NULL,
          content TEXT,
          conclusion TEXT,
          FOREIGN KEY (subject_id) REFERENCES subjects(id)
        );
      `);

      /** QUIZZES */
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS quizzes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lesson_id INTEGER,
          question TEXT NOT NULL,
          options TEXT NOT NULL,
          answer TEXT NOT NULL,
          FOREIGN KEY (lesson_id) REFERENCES lessons(id)
        );
      `);

      /** USER PROGRESS */
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS user_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          lesson_id INTEGER,
          score INTEGER DEFAULT 0,
          progress REAL DEFAULT 0,
          completed INTEGER DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (lesson_id) REFERENCES lessons(id)
        );
      `);

      tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id);`);

    

      /** LEADERBOARD (GLOBAL) */
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS leaderboard (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          username TEXT,
          subject TEXT,
          score INTEGER DEFAULT 0,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      /** USER SCORES (per activity) */
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS user_scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          subject TEXT,
          points INTEGER,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      /** DAILY */
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS daily_scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          username TEXT,
          points INTEGER,
          date TEXT
        );
      `);

      /** WEEKLY */
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS weekly_scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          username TEXT,
          points INTEGER,
          week TEXT
        );
      `);

      /** MONTHLY */
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS monthly_scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          username TEXT,
          points INTEGER,
          month TEXT
        );
      `);

      /** STREAKS */
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS streaks (
          user_id INTEGER PRIMARY KEY,
          streak INTEGER DEFAULT 0,
          last_active_date TEXT
        );
      `);

      /** ACHIEVEMENTS */
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          badge TEXT,
          date TEXT
        );
      `);

      /** LEADERBOARD HISTORY */
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS leaderboard_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          period TEXT,
          username TEXT,
          points INTEGER,
          date TEXT
        );
      `);

      /** SUBJECT TOPICS */
      const subjects = ["agric", "biology", "chemistry", "english", "maths", "physics"];
      subjects.forEach((sub) => {
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS ${sub}_topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL
          );
        `);
      });

      /** SUBJECT SEEDS */
      tx.executeSql(`
        INSERT OR IGNORE INTO subjects (id, name, description, price, is_free, track, category) VALUES
          (1, 'Agriculture', 'Agricultural Science', 0, 1, 'OLevel', 'JAMB'),
          (2, 'Biology', 'Biology', 0, 1, 'OLevel', 'JAMB'),
          (3, 'Chemistry', 'Chemistry', 1000, 0, 'OLevel', 'JAMB'),
          (4, 'English', 'English', 0, 1, 'OLevel', 'JAMB'),
          (5, 'Maths', 'Maths', 3000, 0, 'OLevel', 'JAMB'),
          (6, 'Physics', 'Physics', 3000, 0, 'OLevel', 'JAMB');
      `);
    });

    console.log("✅ DB initialized successfully.");
  } catch (error) {
    console.log("❌ DB Initialization Error:", error);
  }

  return db;
};
