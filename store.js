// Saves accounts. Uses Postgres when DATABASE_URL is set (on Railway), otherwise a local data.json file for testing.
const fs = require("fs");
const path = require("path");

function postgresStore(url) {
  const { Pool } = require("pg");
  const ssl = process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined;
  const pool = new Pool({ connectionString: url, ssl });
  return {
    kind: "postgres",
    async init() {
      await pool.query(`CREATE TABLE IF NOT EXISTS users (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
      await pool.query(`CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, key TEXT NOT NULL, created BIGINT NOT NULL)`);
    },
    async getUser(key) { const r = await pool.query("SELECT data FROM users WHERE key = $1", [key]); return r.rows[0] ? r.rows[0].data : null; },
    async saveUser(key, data) { await pool.query("INSERT INTO users (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data", [key, data]); },
    async allUsers() { const r = await pool.query("SELECT data FROM users"); return r.rows.map(x => x.data); },
    async addSession(token, key) { await pool.query("INSERT INTO sessions (token, key, created) VALUES ($1, $2, $3)", [token, key, Date.now()]); },
    async getSession(token) { const r = await pool.query("SELECT key FROM sessions WHERE token = $1", [token]); return r.rows[0] ? r.rows[0].key : null; },
    async dropSession(token) { await pool.query("DELETE FROM sessions WHERE token = $1", [token]); },
  };
}

function fileStore(file) {
  let db = { users: {}, sessions: {} };
  try { db = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) {}
  let timer = null;
  const flush = () => { clearTimeout(timer); timer = setTimeout(() => fs.writeFileSync(file, JSON.stringify(db)), 100); };
  return {
    kind: "file",
    async init() {},
    async getUser(key) { return db.users[key] ? JSON.parse(JSON.stringify(db.users[key])) : null; },
    async saveUser(key, data) { db.users[key] = data; flush(); },
    async allUsers() { return Object.values(db.users); },
    async addSession(token, key) { db.sessions[token] = key; flush(); },
    async getSession(token) { return db.sessions[token] || null; },
    async dropSession(token) { delete db.sessions[token]; flush(); },
  };
}

module.exports = process.env.DATABASE_URL ? postgresStore(process.env.DATABASE_URL) : fileStore(path.join(__dirname, "data.json"));
