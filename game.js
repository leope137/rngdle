// All game rules live here and run on the server, so nobody can fake a roll.
const crypto = require("crypto");
const makeBadges = require("./badges.js");
const PROBS = require("./probs.json");

const B = makeBadges();
// multiplier = (1 / chance) ^ 0.75
const DEFS = B.defs.map((d, i) => { const p = PROBS[i]; const mult = Math.pow(1 / p, 0.75); return { ...d, p, mult, lg: Math.log10(mult) }; });
const byId = Object.fromEntries(DEFS.map(d => [d.id, d]));

function evaluate(s) {
  const ids = B.evaluate(s).filter(id => byId[id]).sort((a, b) => byId[b].p - byId[a].p);
  return { s, n: Number(s), badges: ids, lg: ids.reduce((a, id) => a + byId[id].lg, 0) };
}

const rand = k => crypto.randomInt(k);
const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;

/* ---------- shop ---------- */
const UPG = [
  { id: "clock",  name: "Fast Clock",   vals: [30, 20, 15, 10, 5],     prices: [3000, 30000, 300000, 3000000],
    desc: v => `A new roll every ${v} minutes` },
  { id: "bank",   name: "Roll Bank",    vals: [1, 2, 3, 5, 8],         prices: [2000, 25000, 250000, 2500000],
    desc: v => `Saves up to ${v} roll${v > 1 ? "s" : ""} while you're away` },
  { id: "free",   name: "Free Roll",    vals: [0, 0.1, 0.2, 0.3],      prices: [10000, 200000, 4000000],
    desc: v => v ? `${Math.round(v * 100)}% chance a roll doesn't use one up` : "Every roll uses one up" },
  { id: "boost",  name: "Point Boost",  vals: [1, 1.5, 2, 3, 5],       prices: [2000, 100000, 10000000, 1000000000],
    desc: v => v > 1 ? `Every roll scores ×${v}` : "No boost yet" },
  { id: "vanish", name: "Vanish Luck",  vals: [11, 10, 9, 8],          prices: [20000, 2000000, 200000000],
    desc: v => `Leading digits vanish 1 in ${v} times` },
  { id: "echo",   name: "Echo",         vals: [0, 0.05, 0.1, 0.15],    prices: [10000, 1000000, 100000000],
    desc: v => v ? `Each digit has a ${Math.round(v * 100)}% chance to copy the one before it` : "Digits don't copy each other yet" },
  { id: "dice",   name: "Lucky Dice",   vals: [1, 2, 3, 4],            prices: [30000, 3000000, 300000000],
    desc: v => v > 1 ? `Each roll secretly tries ${v} times and keeps the best` : "One try per roll" },
];
const CHARMS = [
  { id: "ring",    sym: "◎", kind: "Points", name: "Even Ring",        desc: "×2 on even rolls",                              price: 1000,     m: r => r.n % 2 === 0 ? 2 : 1 },
  { id: "seven",   sym: "7", kind: "Points", name: "Lucky Seven Pin",  desc: "×3 if your roll has a 7 in it",                 price: 3000,     m: r => r.s.includes("7") ? 3 : 1 },
  { id: "eight",   sym: "8", kind: "Luck",   name: "Magic Eight",      desc: "8s land twice as often",                        price: 15000 },
  { id: "crown",   sym: "♛", kind: "Points", name: "Doubles Crown",    desc: "×4 if two same digits sit side by side",        price: 25000,    m: r => r.badges.includes("shape:dbl") ? 4 : 1 },
  { id: "pendant", sym: "◆", kind: "Points", name: "Prime Pendant",    desc: "×6 on prime rolls",                             price: 50000,    m: r => r.badges.includes("math:prime") ? 6 : 1 },
  { id: "shoe",    sym: "∩", kind: "Luck",   name: "Horseshoe",        desc: "A roll under 1,000 points gets one free reroll", price: 75000 },
  { id: "hourglass", sym: "⧗", kind: "Time", name: "Hourglass",        desc: "Your wait goes 2× faster",                      price: 150000 },
  { id: "clover",  sym: "♣", kind: "Luck",   name: "Four-Leaf Clover", desc: "Leading digits vanish twice as often",          price: 200000 },
  { id: "shades",  sym: "◐", kind: "Points", name: "Mirror Shades",    desc: "×25 on palindromes",                            price: 1000000,  m: r => r.badges.includes("shape:pal") ? 25 : 1 },
  { id: "mirror",  sym: "⇆", kind: "Luck",   name: "Mirror Charm",     desc: "1 in 5 rolls flip into a palindrome",           price: 5000000 },
  { id: "cloak",   sym: "☾", kind: "Points", name: "Ghost Cloak",      desc: "×5 for every digit that vanishes",              price: 10000000, m: r => Math.pow(5, 6 - r.s.length) },
];
const charmOf = id => CHARMS.find(c => c.id === id);
const lvl = (u, id) => u.owned[id] || 0;
const val = (u, id) => UPG.find(x => x.id === id).vals[lvl(u, id)];
const wearing = (u, id) => u.wear === id;
const waitMs = u => val(u, "clock") * MIN / (wearing(u, "hourglass") ? 2 : 1);

/* ---------- wheel and minigame settings ---------- */
const WHEEL = [
  { label: "1,000 pts",     w: 28, pts: 1000 },
  { label: "+1 roll",       w: 16, rolls: 1 },
  { label: "5,000 pts",     w: 22, pts: 5000 },
  { label: "Refill rolls",  w: 7,  refill: true },
  { label: "25,000 pts",    w: 12, pts: 25000 },
  { label: "+3 rolls",      w: 6,  rolls: 3 },
  { label: "250,000 pts",   w: 3,  pts: 250000 },
  { label: "+1 ticket",     w: 6,  tickets: 1 },
];
const TICKET_CAP = 5, TICKET_EVERY = 20 * MIN, HILO_START = 300, HILO_MAX_ROUNDS = 10;

/* ---------- users ---------- */
function newUser(name, pass) {
  const now = Date.now();
  return {
    name, pass, created: now,
    wallet: 0, earned: 0, totalRolls: 0, best: null,
    owned: {}, charms: [], wear: null,
    charges: 1, lastCharge: now,
    tickets: TICKET_CAP, lastTicket: now,
    wheelAt: 0, hilo: null,
    history: [], badgeCounts: {}, days: {},
  };
}
function resetProgress(u) {
  const fresh = newUser(u.name, u.pass);
  fresh.created = u.created;
  return fresh;
}

// refill rolls and minigame tickets based on time passed
function sync(u, now = Date.now()) {
  const cap = val(u, "bank"), iv = waitMs(u);
  if (u.charges >= cap) u.lastCharge = now;
  else {
    const g = Math.floor((now - u.lastCharge) / iv);
    if (g > 0) { u.charges = Math.min(cap, u.charges + g); u.lastCharge = u.charges >= cap ? now : u.lastCharge + g * iv; }
  }
  if (u.tickets >= TICKET_CAP) u.lastTicket = now;
  else {
    const g = Math.floor((now - u.lastTicket) / TICKET_EVERY);
    if (g > 0) { u.tickets = Math.min(TICKET_CAP, u.tickets + g); u.lastTicket = u.tickets >= TICKET_CAP ? now : u.lastTicket + g * TICKET_EVERY; }
  }
}

/* ---------- rolling ---------- */
function digit(u) { if (!wearing(u, "eight")) return rand(10); const x = rand(11); return x === 10 ? 8 : x; }
// six slots; a leading slot can vanish, the last slot always lands a digit
function rollString(u) {
  const V = val(u, "vanish"), vp = wearing(u, "clover") ? 2 : 1, echo = val(u, "echo");
  let s = "", lead = true;
  for (let i = 0; i < 6; i++) {
    if (lead && i < 5) { if (rand(V) < vp) continue; s += digit(u); lead = false; }
    else s += (s.length && echo > 0 && rand(1000) < echo * 1000) ? s[s.length - 1] : digit(u);
  }
  if (wearing(u, "mirror") && s.length >= 2 && rand(5) === 0) {
    const h = Math.ceil(s.length / 2);
    s = s.slice(0, h) + [...s.slice(0, Math.floor(s.length / 2))].reverse().join("");
  }
  return s;
}
function bonusesFor(u, r) {
  const out = [];
  if (val(u, "boost") > 1) out.push(["Point Boost", val(u, "boost")]);
  const c = u.wear && charmOf(u.wear);
  if (c && c.m) { const m = c.m(r); if (m > 1) out.push([c.name, m]); }
  return out;
}
function luckyRoll(u) {
  const one = () => { const r = evaluate(rollString(u)), bonus = bonusesFor(u, r); return { r, bonus, lg: r.lg + bonus.reduce((a, b) => a + Math.log10(b[1]), 0) }; };
  const tries = val(u, "dice"); let best = null;
  for (let t = 0; t < tries; t++) { const c = one(); if (!best || c.lg > best.lg) best = c; }
  const notes = [];
  if (tries > 1) notes.push(`Lucky Dice kept the best of ${tries} tries`);
  if (wearing(u, "shoe") && best.lg < 3) {
    const c = one();
    notes.push(c.lg > best.lg ? "Horseshoe rerolled it and helped" : "Horseshoe rerolled it, but the first was better");
    if (c.lg > best.lg) best = c;
  }
  return { ...best, notes };
}

class GameError extends Error {}

function doRoll(u, dateKey) {
  sync(u);
  if (u.charges < 1) throw new GameError("No rolls ready yet.");
  const res = luckyRoll(u);
  const free = val(u, "free") > 0 && rand(1000) < val(u, "free") * 1000;
  if (free) res.notes.push("Free roll! It didn't use one up");
  else u.charges -= 1;
  const pts = Math.pow(10, res.lg);
  u.wallet += pts; u.earned += pts; u.totalRolls += 1;
  const entry = { s: res.r.s, lg: res.lg, bonus: res.bonus, at: Date.now() };
  if (!u.best || res.lg > u.best.lg) u.best = entry;
  u.history.unshift(entry); u.history = u.history.slice(0, 60);
  res.r.badges.forEach(id => { u.badgeCounts[id] = (u.badgeCounts[id] || 0) + 1; });
  if (typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const d = u.days[dateKey] || { n: 0, lg: 0 };
    d.n += 1; d.lg = Math.max(d.lg, res.lg); u.days[dateKey] = d;
  }
  return { s: res.r.s, badges: res.r.badges, bonus: res.bonus, lg: res.lg, notes: res.notes };
}

function buy(u, kind, id) {
  if (kind === "upgrade") {
    const up = UPG.find(x => x.id === id); if (!up) throw new GameError("That upgrade doesn't exist.");
    const L = lvl(u, id), price = up.prices[L];
    if (price == null) throw new GameError("Already maxed.");
    if (u.wallet < price) throw new GameError("Not enough points.");
    sync(u);
    u.wallet -= price; u.owned[id] = L + 1;
    return `Bought ${up.name} level ${L + 1}.`;
  }
  if (kind === "charm") {
    const c = charmOf(id); if (!c) throw new GameError("That charm doesn't exist.");
    if (u.charms.includes(id)) throw new GameError("You already own it.");
    if (u.wallet < c.price) throw new GameError("Not enough points.");
    sync(u);
    u.wallet -= c.price; u.charms.push(id); u.wear = id;
    return `Bought ${c.name} and put it on.`;
  }
  throw new GameError("Unknown item.");
}
function wear(u, id) {
  sync(u); // count time at the old speed before switching
  if (id == null || u.wear === id) { u.wear = null; return "Took off your charm."; }
  if (!u.charms.includes(id)) throw new GameError("You don't own that charm.");
  u.wear = id; return `Now wearing ${charmOf(id).name}.`;
}

function spinWheel(u) {
  sync(u);
  const now = Date.now();
  if (now < u.wheelAt + DAY) throw new GameError("The wheel isn't ready yet.");
  const total = WHEEL.reduce((a, s) => a + s.w, 0);
  let x = rand(total), idx = 0;
  while (x >= WHEEL[idx].w) { x -= WHEEL[idx].w; idx++; }
  const p = WHEEL[idx];
  if (p.pts) { u.wallet += p.pts; u.earned += p.pts; }
  if (p.rolls) u.charges += p.rolls;
  if (p.refill) u.charges = Math.max(u.charges, val(u, "bank"));
  if (p.tickets) u.tickets += p.tickets;
  u.wheelAt = now;
  return { index: idx, label: p.label };
}

/* ---------- Higher or Lower minigame: cards A (1) to K (13). A tie keeps going. ---------- */
function hiloStart(u) {
  sync(u);
  if (u.hilo) throw new GameError("You already have a game going.");
  if (u.tickets < 1) throw new GameError("No tickets left. Wait for the next one.");
  if (u.tickets >= TICKET_CAP) u.lastTicket = Date.now();
  u.tickets -= 1;
  u.hilo = { card: 1 + rand(13), pot: HILO_START, round: 0, last: null };
  return u.hilo;
}
function hiloOdds(card) { return { hi: (13 - card) / 12, lo: (card - 1) / 12 }; }
function hiloPayout(card, dir) { const p = hiloOdds(card)[dir]; return p > 0 ? 0.95 / p : 0; }
function hiloGuess(u, dir) {
  const g = u.hilo; if (!g) throw new GameError("Start a game first.");
  if (dir !== "hi" && dir !== "lo") throw new GameError("Pick higher or lower.");
  const mult = hiloPayout(g.card, dir); if (!mult) throw new GameError("That can't win.");
  const next = 1 + rand(13);
  if (next === g.card) { g.last = { card: next, result: "tie" }; return { result: "tie", card: next, game: g }; }
  const win = dir === "hi" ? next > g.card : next < g.card;
  if (!win) { u.hilo = null; return { result: "lose", card: next, lost: Math.floor(g.pot) }; }
  g.pot = Math.floor(g.pot * mult); g.round += 1; g.card = next; g.last = { card: next, result: "win" };
  if (g.round >= HILO_MAX_ROUNDS) { const won = hiloCashOut(u); return { result: "win", card: next, autoCash: won }; }
  return { result: "win", card: next, game: g };
}
function hiloCashOut(u) {
  const g = u.hilo; if (!g) throw new GameError("No game to cash out.");
  if (g.round === 0) throw new GameError("Win at least one guess first.");
  u.wallet += g.pot; u.earned += g.pot; u.hilo = null;
  return g.pot;
}

/* ---------- what the browser gets ---------- */
function streak(u, todayKey) {
  const keys = new Set(Object.keys(u.days));
  const d = new Date(todayKey + "T12:00:00Z"); let s = 0;
  const k = x => x.toISOString().slice(0, 10);
  if (!keys.has(k(d))) d.setUTCDate(d.getUTCDate() - 1);
  while (keys.has(k(d))) { s++; d.setUTCDate(d.getUTCDate() - 1); }
  return s;
}
function publicState(u, todayKey) {
  sync(u);
  const now = Date.now(), cap = val(u, "bank"), iv = waitMs(u);
  return {
    now, name: u.name,
    wallet: u.wallet, earned: u.earned, totalRolls: u.totalRolls, best: u.best,
    charges: u.charges, cap, waitMs: iv, nextChargeAt: u.charges < cap ? u.lastCharge + iv : null,
    tickets: u.tickets, ticketCap: TICKET_CAP, nextTicketAt: u.tickets < TICKET_CAP ? u.lastTicket + TICKET_EVERY : null,
    wheelReadyAt: u.wheelAt + DAY, hilo: u.hilo ? { ...u.hilo, odds: { hi: hiloPayout(u.hilo.card, "hi"), lo: hiloPayout(u.hilo.card, "lo") } } : null,
    owned: u.owned, charms: u.charms, wear: u.wear,
    history: u.history.slice(0, 30), badgeCounts: u.badgeCounts,
    streak: todayKey ? streak(u, todayKey) : 0, daysPlayed: Object.keys(u.days).length,
  };
}
const catalog = {
  upgrades: UPG.map(u => ({ id: u.id, name: u.name, prices: u.prices, levels: u.vals.map(v => u.desc(v)) })),
  charms: CHARMS.map(({ id, sym, kind, name, desc, price }) => ({ id, sym, kind, name, desc, price })),
  wheel: WHEEL.map(w => w.label),
  hilo: { start: HILO_START, maxRounds: HILO_MAX_ROUNDS },
};

module.exports = { GameError, newUser, resetProgress, doRoll, buy, wear, spinWheel, hiloStart, hiloGuess, hiloCashOut, publicState, catalog, sync };
