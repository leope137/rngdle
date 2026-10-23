const express = require("express");
const crypto = require("crypto");
const path = require("path");
const store = require("./store");
const G = require("./game");

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "10kb" }));
// only these files are public; the server code stays private
const PUBLIC = { "/": "index.html", "/index.html": "index.html", "/badges.js": "badges.js", "/probs.json": "probs.json" };
app.get(Object.keys(PUBLIC), (req, res) => res.sendFile(path.join(__dirname, PUBLIC[req.path])));

/* ---------- helpers ---------- */
const COOKIE = "rngdle_sid";
const keyOf = name => name.toLowerCase();
const hashPass = (pw, salt) => new Promise((ok, bad) => crypto.scrypt(pw, salt, 64, (e, k) => e ? bad(e) : ok(k.toString("hex"))));
function readCookie(req) {
  const m = (req.headers.cookie || "").split(/;\s*/).find(c => c.startsWith(COOKIE + "="));
  return m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : null;
}
function setCookie(req, res, token, maxAge) {
  const secure = req.secure ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}
// one change at a time per player, so two quick taps can't double-spend a roll
const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(key, next.catch(() => {}));
  return next;
}
const send = (res, status, body) => res.status(status).json(body);
const today = req => (typeof req.body?.today === "string" ? req.body.today : typeof req.query.today === "string" ? req.query.today : null);

// simple brake on password guessing
const attempts = new Map();
function tooMany(ip) {
  const now = Date.now(), a = (attempts.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  attempts.set(ip, a);
  return a.length >= 20;
}

async function auth(req, res, next) {
  const token = readCookie(req);
  const key = token && await store.getSession(token);
  if (!key) return send(res, 401, { error: "Please log in." });
  req.userKey = key; req.token = token; next();
}
// load the player, run the change, save, reply with fresh state
function act(fn) {
  return (req, res) => withLock(req.userKey, async () => {
    const u = await store.getUser(req.userKey);
    if (!u) return send(res, 401, { error: "Account not found. Please log in again." });
    try {
      const out = await fn(u, req);
      const user = out && out.__replace ? out.__replace : u;
      await store.saveUser(req.userKey, user);
      send(res, 200, { ...(out && !out.__replace ? out : {}), state: G.publicState(user, today(req)) });
    } catch (e) {
      if (e instanceof G.GameError) { await store.saveUser(req.userKey, u); return send(res, 400, { error: e.message, state: G.publicState(u, today(req)) }); }
      console.error(e); send(res, 500, { error: "Something broke on the server. Try again." });
    }
  }).catch(e => { console.error(e); send(res, 500, { error: "Something broke on the server. Try again." }); });
}

/* ---------- accounts ---------- */
app.post("/api/signup", async (req, res) => {
  const { name, password } = req.body || {};
  if (typeof name !== "string" || !/^[A-Za-z0-9_]{3,16}$/.test(name)) return send(res, 400, { error: "Usernames are 3 to 16 letters, numbers or underscores." });
  if (typeof password !== "string" || password.length < 6 || password.length > 100) return send(res, 400, { error: "Passwords need at least 6 characters." });
  if (tooMany(req.ip)) return send(res, 429, { error: "Too many tries. Wait a few minutes." });
  attempts.get(req.ip).push(Date.now());
  const key = keyOf(name);
  await withLock("signup:" + key, async () => {
    if (await store.getUser(key)) return send(res, 400, { error: "That username is taken." });
    const salt = crypto.randomBytes(16).toString("hex");
    const user = G.newUser(name, { salt, hash: await hashPass(password, salt) });
    await store.saveUser(key, user);
    const token = crypto.randomBytes(32).toString("hex");
    await store.addSession(token, key);
    setCookie(req, res, token, 60 * 60 * 24 * 365);
    send(res, 200, { ok: true });
  });
});

app.post("/api/login", async (req, res) => {
  const { name, password } = req.body || {};
  if (typeof name !== "string" || typeof password !== "string") return send(res, 400, { error: "Enter your username and password." });
  if (tooMany(req.ip)) return send(res, 429, { error: "Too many tries. Wait a few minutes." });
  attempts.get(req.ip).push(Date.now());
  const u = await store.getUser(keyOf(name));
  const ok = u && crypto.timingSafeEqual(Buffer.from(await hashPass(password, u.pass.salt), "hex"), Buffer.from(u.pass.hash, "hex"));
  if (!ok) return send(res, 400, { error: "Wrong username or password." });
  const token = crypto.randomBytes(32).toString("hex");
  await store.addSession(token, keyOf(name));
  setCookie(req, res, token, 60 * 60 * 24 * 365);
  send(res, 200, { ok: true });
});

app.post("/api/logout", async (req, res) => {
  const token = readCookie(req);
  if (token) await store.dropSession(token);
  setCookie(req, res, "", 0);
  send(res, 200, { ok: true });
});

/* ---------- game ---------- */
app.get("/api/catalog", (req, res) => send(res, 200, G.catalog));
app.get("/api/me", auth, act(() => ({})));
app.post("/api/roll", auth, act((u, req) => ({ roll: G.doRoll(u, today(req)) })));
app.post("/api/buy", auth, act((u, req) => ({ message: G.buy(u, req.body.kind, req.body.id) })));
app.post("/api/wear", auth, act((u, req) => ({ message: G.wear(u, req.body.id ?? null) })));
app.post("/api/wheel", auth, act(u => ({ spin: G.spinWheel(u) })));
app.post("/api/hilo/start", auth, act(u => ({ game: G.hiloStart(u) })));
app.post("/api/hilo/guess", auth, act((u, req) => ({ guess: G.hiloGuess(u, req.body.dir) })));
app.post("/api/hilo/cashout", auth, act(u => ({ won: G.hiloCashOut(u) })));
app.post("/api/mines/start", auth, act(u => G.minesStart(u)));
app.post("/api/mines/pick", auth, act((u, req) => ({ pick: G.minesPick(u, req.body.tile) })));
app.post("/api/mines/cashout", auth, act(u => ({ won: G.minesCashOut(u) })));
app.post("/api/slots/spin", auth, act(u => ({ spin: G.slotsSpin(u) })));
app.post("/api/pick/play", auth, act((u, req) => ({ pick: G.pickPlay(u, req.body.digit) })));
app.post("/api/reset", auth, act(u => ({ __replace: G.resetProgress(u) })));

app.get("/api/leaderboard", auth, async (req, res) => {
  const users = await store.allUsers();
  const rows = users.map(u => ({ name: u.name, best: u.best ? { s: u.best.s, lg: u.best.lg } : null, earned: u.earned || 0, rolls: u.totalRolls || 0 }));
  send(res, 200, {
    best: rows.filter(r => r.best).sort((a, b) => b.best.lg - a.best.lg).slice(0, 25),
    earned: rows.filter(r => r.earned > 0).sort((a, b) => b.earned - a.earned).slice(0, 25),
  });
});

app.use("/api", (req, res) => send(res, 404, { error: "Not found." }));

const PORT = process.env.PORT || 3000;
store.init().then(() => {
  app.listen(PORT, () => console.log(`RNGdle running on port ${PORT} (${store.kind} storage)`));
}).catch(e => { console.error("Could not start the database:", e); process.exit(1); });
