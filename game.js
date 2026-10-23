// All game rules live here and run on the server, so nobody can fake a roll.
const crypto = require("crypto");
const makeBadges = require("./badges.js");
const PROBS = require("./probs.json");

const B = makeBadges();
// multiplier = (1 / chance) ^ 0.75
const DEFS = B.defs.map((d, i) => { const p = PROBS[i]; const mult = Math.pow(1 / p, 0.75); return { ...d, p, mult, lg: Math.log10(mult) }; });
const byId = Object.fromEntries(DEFS.map(d => [d.id, d]));
// gold for rare badges: Rare 2, Epic 8, Legendary 30
const goldFor = id => { const p = byId[id].p; return p <= 1e-4 ? 30 : p <= 1e-3 ? 8 : p <= 1e-2 ? 2 : 0; };

function evaluate(s) {
  const ids = B.evaluate(s).filter(id => byId[id]).sort((a, b) => byId[b].p - byId[a].p);
  return { s, n: Number(s), badges: ids, lg: ids.reduce((a, id) => a + byId[id].lg, 0) };
}

const rand = k => crypto.randomInt(k);
const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
class GameError extends Error {}

/* ---------- shop ---------- */
const UPG = [
  { id: "clock",  name: "Fast Clock",   vals: [30, 20, 15, 10, 5],     prices: [3000, 30000, 300000, 3000000],
    desc: v => `A new roll and a new ticket every ${v} minutes` },
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
// charms level up from 1 to 5. v holds each level's strength, d describes it.
const CHARMS = [
  { id: "ring",    sym: "◎", kind: "Points", name: "Even Ring",        price: 1000,     v: [2, 3, 4, 5, 6],            d: x => `×${x} on even rolls`,                          m: (r, x) => r.n % 2 === 0 ? x : 1 },
  { id: "seven",   sym: "7", kind: "Points", name: "Lucky Seven Pin",  price: 3000,     v: [3, 4, 5, 7, 10],           d: x => `×${x} if your roll has a 7 in it`,             m: (r, x) => r.s.includes("7") ? x : 1 },
  { id: "eight",   sym: "8", kind: "Luck",   name: "Magic Eight",      price: 15000,    v: [2, 3, 4, 5, 6],            d: x => `8s land ${x}× as often` },
  { id: "crown",   sym: "♛", kind: "Points", name: "Doubles Crown",    price: 25000,    v: [4, 6, 8, 11, 15],          d: x => `×${x} if two same digits sit side by side`,    m: (r, x) => r.badges.includes("shape:dbl") ? x : 1 },
  { id: "pendant", sym: "◆", kind: "Points", name: "Prime Pendant",    price: 50000,    v: [6, 9, 13, 18, 25],         d: x => `×${x} on prime rolls`,                         m: (r, x) => r.badges.includes("math:prime") ? x : 1 },
  { id: "shoe",    sym: "∩", kind: "Luck",   name: "Horseshoe",        price: 75000,    v: [3, 4, 5, 6, 7],            d: x => `A roll under ${Math.pow(10, x).toLocaleString("en-US")} points gets one free reroll` },
  { id: "hourglass", sym: "⧗", kind: "Time", name: "Hourglass",        price: 150000,   v: [2, 2.25, 2.5, 2.75, 3],    d: x => `Your wait goes ${x}× faster` },
  { id: "clover",  sym: "♣", kind: "Luck",   name: "Four-Leaf Clover", price: 200000,   v: [2, 2.5, 3, 3.5, 4],        d: x => `Leading digits vanish ${x}× as often` },
  { id: "shades",  sym: "◐", kind: "Points", name: "Mirror Shades",    price: 1000000,  v: [25, 40, 60, 90, 150],      d: x => `×${x} on palindromes`,                         m: (r, x) => r.badges.includes("shape:pal") ? x : 1 },
  { id: "mirror",  sym: "⇆", kind: "Luck",   name: "Mirror Charm",     price: 5000000,  v: [5, 4, 3.5, 3, 2.5],        d: x => `1 in ${x} rolls flip into a palindrome` },
  { id: "cloak",   sym: "☾", kind: "Points", name: "Ghost Cloak",      price: 10000000, v: [5, 7, 10, 14, 20],         d: x => `×${x} for every digit that vanishes`,          m: (r, x) => Math.pow(x, 6 - r.s.length) },
];
const CHARM_MAX = 5;
const charmUpCost = (c, L) => c.price * Math.pow(10, L); // level L to L+1


/* ---------- the Vault: opens once every upgrade above is maxed. Paid in gold. Built to take years. ---------- */
const VAULT = [
  { id: "golden", name: "Golden Touch", max: 100, base: 25,  grow: 1.09, desc: L => `Every roll scores ×${(1 + 0.2 * L).toFixed(1)}` },
  { id: "quick",  name: "Quick Hands",  max: 100, base: 30,  grow: 1.10, desc: L => `Rolls and tickets come ${+((1 - Math.pow(0.985, L)) * 100).toFixed(1)}% faster` },
  { id: "deep",   name: "Deep Bank",    max: 92,  base: 15,  grow: 1.10, desc: L => `Save up to ${L} extra rolls` },
  { id: "press",  name: "Ticket Press", max: 45,  base: 15,  grow: 1.12, desc: L => `Hold up to ${L} extra tickets` },
  { id: "stake",  name: "Free Stake",   max: 100, base: 10,  grow: 1.08, desc: L => `Free arcade stakes are ${1 + L}× bigger` },
  { id: "scholar",name: "Scholar",      max: 100, base: 20,  grow: 1.09, desc: L => `Earn ${10 * L}% more XP` },
  { id: "midas",  name: "Midas",        max: 100, base: 50,  grow: 1.10, desc: L => `Earn ${5 * L}% more gold` },
  { id: "star",   name: "Star Dice",    max: 10,  base: 100, grow: 1.50, desc: L => `Lucky Dice tries ${L} extra times` },
];
const vlv = (u, id) => (u.vault && u.vault[id]) || 0;
const vaultCost = (v, L) => Math.ceil(v.base * Math.pow(v.grow, L));
const vaultOpen = u => UPG.every(x => lvl(u, x.id) >= x.prices.length);

const charmOf = id => CHARMS.find(c => c.id === id);
const lvl = (u, id) => u.owned[id] || 0;
const val = (u, id) => UPG.find(x => x.id === id).vals[lvl(u, id)];
const wearing = (u, id) => u.wear === id;
const charmLv = (u, id) => (u.charmLv && u.charmLv[id]) || 1;
const cv = (u, id) => charmOf(id).v[charmLv(u, id) - 1]; // strength of a charm at its level
const waitMs = u => Math.max(MIN, val(u, "clock") * MIN / (wearing(u, "hourglass") ? cv(u, "hourglass") : 1) * Math.pow(0.985, vlv(u, "quick")));
const bankCap = u => val(u, "bank") + vlv(u, "deep");
const ticketCap = u => TICKET_CAP + vlv(u, "press");
// higher levels grow free arcade stakes and wheel prizes by 5% per level
const levelMult = u => Math.pow(1.05, (u.level || 1) - 1);
const freeStake = u => Math.round(300 * levelMult(u) * (1 + vlv(u, "stake")));

/* ---------- levels ---------- */
const xpToNext = L => Math.round(100 * Math.pow(L, 1.4));
function addXp(u, n, ups) {
  u.xp = (u.xp || 0) + Math.round(n * (1 + 0.1 * vlv(u, "scholar")));
  u.level = u.level || 1;
  while (u.xp >= xpToNext(u.level)) {
    u.xp -= xpToNext(u.level); u.level += 1;
    const L = u.level, pts = 1000 * L, gold = 5 * L, tickets = L % 5 === 0 ? 3 : 1;
    u.wallet += pts; u.earned += pts; u.gold = (u.gold || 0) + gold; u.tickets += tickets;
    ups.push({ level: L, pts, gold, tickets });
  }
}
function addGold(u, n) { const g = Math.round(n * (1 + 0.05 * vlv(u, "midas"))); u.gold = (u.gold || 0) + g; return g; }

/* ---------- wheel and minigame settings ---------- */
const WHEEL = [
  { w: 28, pts: 1000 },
  { w: 16, rolls: 1 },
  { w: 22, pts: 5000 },
  { w: 7,  refill: true },
  { w: 12, pts: 25000 },
  { w: 6,  rolls: 3 },
  { w: 3,  pts: 250000 },
  { w: 6,  tickets: 1 },
];
// prizes for this player: points grow 5% per level, rolls and tickets grow every 10 levels
function wheelFor(u) {
  const L = u.level || 1, m = levelMult(u), extra = Math.floor(L / 10);
  return WHEEL.map(p => {
    if (p.pts) { const pts = Math.round(p.pts * m); return { w: p.w, pts, label: `${shortNum(pts)} pts` }; }
    if (p.rolls) { const n = p.rolls + extra; return { w: p.w, rolls: n, label: `+${n} rolls`.replace("+1 rolls", "+1 roll") }; }
    if (p.tickets) { const n = p.tickets + extra; return { w: p.w, tickets: n, label: `+${n} ticket${n > 1 ? "s" : ""}` }; }
    return { w: p.w, refill: true, label: "Refill rolls" };
  });
}
function shortNum(n) {
  const u = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]].find(([v]) => n >= v);
  return u ? `${+(n / u[0]).toPrecision(3)}${u[1]}` : String(n);
}
const TICKET_CAP = 5, HILO_MAX_ROUNDS = 10;
// stakes an experienced player can bet instead of playing free
const BETS = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e12, 1e15, 1e18, 1e21, 1e24, 1e27, 1e30];

/* ---------- users ---------- */
function newUser(name, pass) {
  const now = Date.now();
  return {
    name, pass, created: now,
    wallet: 0, earned: 0, totalRolls: 0, best: null,
    owned: {}, charms: [], wear: null,
    charges: 1, lastCharge: now,
    tickets: TICKET_CAP, lastTicket: now,
    wheelAt: 0, hilo: null, mines: null,
    xp: 0, level: 1, gold: 0, vault: {},
    history: [], badgeCounts: {}, days: {},
  };
}
function resetProgress(u) {
  const fresh = newUser(u.name, u.pass);
  fresh.created = u.created;
  return fresh;
}

// refill rolls and tickets based on time passed; tickets use the same timer as rolls
function sync(u, now = Date.now()) {
  const cap = bankCap(u), iv = waitMs(u), tcap = ticketCap(u);
  if (u.charges >= cap) u.lastCharge = now;
  else {
    const g = Math.floor((now - u.lastCharge) / iv);
    if (g > 0) { u.charges = Math.min(cap, u.charges + g); u.lastCharge = u.charges >= cap ? now : u.lastCharge + g * iv; }
  }
  if (u.tickets >= tcap) u.lastTicket = now;
  else {
    const g = Math.floor((now - u.lastTicket) / iv);
    if (g > 0) { u.tickets = Math.min(tcap, u.tickets + g); u.lastTicket = u.tickets >= tcap ? now : u.lastTicket + g * iv; }
  }
}

/* ---------- rolling ---------- */
function digit(u) {
  if (!wearing(u, "eight")) return rand(10);
  const w = cv(u, "eight"), x = rand(9 + w); // 8 gets w shares, other digits 1 each
  return x < 8 ? x : x < 8 + w ? 8 : 9;
}
// six slots; a leading slot can vanish, the last slot always lands a digit
function rollString(u) {
  const V = val(u, "vanish"), vp = wearing(u, "clover") ? cv(u, "clover") : 1, echo = val(u, "echo");
  let s = "", lead = true;
  for (let i = 0; i < 6; i++) {
    if (lead && i < 5) { if (rand(V * 100) < vp * 100) continue; s += digit(u); lead = false; }
    else s += (s.length && echo > 0 && rand(1000) < echo * 1000) ? s[s.length - 1] : digit(u);
  }
  if (wearing(u, "mirror") && s.length >= 2 && rand(1000) < 1000 / cv(u, "mirror")) {
    const h = Math.ceil(s.length / 2);
    s = s.slice(0, h) + [...s.slice(0, Math.floor(s.length / 2))].reverse().join("");
  }
  return s;
}
function bonusesFor(u, r) {
  const out = [];
  if (val(u, "boost") > 1) out.push(["Point Boost", val(u, "boost")]);
  const c = u.wear && charmOf(u.wear);
  if (c && c.m) { const m = c.m(r, cv(u, c.id)); if (m > 1) out.push([c.name, m]); }
  if (vlv(u, "golden")) out.push(["Golden Touch", 1 + 0.2 * vlv(u, "golden")]);
  return out;
}
function luckyRoll(u) {
  const one = () => { const r = evaluate(rollString(u)), bonus = bonusesFor(u, r); return { r, bonus, lg: r.lg + bonus.reduce((a, b) => a + Math.log10(b[1]), 0) }; };
  const tries = val(u, "dice") + vlv(u, "star"); let best = null;
  for (let t = 0; t < tries; t++) { const c = one(); if (!best || c.lg > best.lg) best = c; }
  const notes = [];
  if (tries > 1) notes.push(`Lucky Dice kept the best of ${tries} tries`);
  if (wearing(u, "shoe") && best.lg < cv(u, "shoe")) {
    const c = one();
    notes.push(c.lg > best.lg ? "Horseshoe rerolled it and helped" : "Horseshoe rerolled it, but the first was better");
    if (c.lg > best.lg) best = c;
  }
  return { ...best, notes };
}

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
  const rawGold = res.r.badges.reduce((a, id) => a + goldFor(id), 0);
  const gold = rawGold ? addGold(u, rawGold) : 0;
  const ups = [];
  // rarer rolls give more XP: 5 XP for every ×10 the badges are worth
  const xp = Math.round(10 + 5 * res.r.lg);
  addXp(u, xp, ups);
  return { s: res.r.s, badges: res.r.badges, bonus: res.bonus, lg: res.lg, notes: res.notes, gold, xp, ups };
}

function buy(u, kind, id) {
  if (kind === "upgrade") {
    const up = UPG.find(x => x.id === id); if (!up) throw new GameError("That upgrade doesn't exist.");
    const L = lvl(u, id), price = up.prices[L];
    if (price == null) throw new GameError("Already maxed.");
    if (u.wallet < price) throw new GameError("Not enough points.");
    sync(u);
    u.wallet -= price; u.owned[id] = L + 1;
    return `Bought ${up.name} level ${L + 1}.${vaultOpen(u) && L + 1 === up.prices.length ? " Every upgrade is maxed. The Vault is open!" : ""}`;
  }
  if (kind === "charm") {
    const c = charmOf(id); if (!c) throw new GameError("That charm doesn't exist.");
    if (u.charms.includes(id)) throw new GameError("You already own it.");
    if (u.wallet < c.price) throw new GameError("Not enough points.");
    sync(u);
    u.wallet -= c.price; u.charms.push(id); u.wear = id;
    return `Bought ${c.name} and put it on.`;
  }
  if (kind === "charmup") {
    const c = charmOf(id); if (!c) throw new GameError("That charm doesn't exist.");
    if (!u.charms.includes(id)) throw new GameError("Buy the charm first.");
    const L = charmLv(u, id);
    if (L >= CHARM_MAX) throw new GameError("Already maxed.");
    const cost = charmUpCost(c, L);
    if (u.wallet < cost) throw new GameError("Not enough points.");
    sync(u); // count time at the old speed before changing it
    u.wallet -= cost; u.charmLv = u.charmLv || {}; u.charmLv[id] = L + 1;
    return `${c.name} is now level ${L + 1}.`;
  }
  if (kind === "vault") {
    if (!vaultOpen(u)) throw new GameError("Max every upgrade to open the Vault.");
    const v = VAULT.find(x => x.id === id); if (!v) throw new GameError("That Vault upgrade doesn't exist.");
    const L = vlv(u, id);
    if (L >= v.max) throw new GameError("Already maxed.");
    const cost = vaultCost(v, L);
    if ((u.gold || 0) < cost) throw new GameError("Not enough gold.");
    sync(u); // count time at the old speed before changing it
    u.gold -= cost; u.vault = u.vault || {}; u.vault[id] = L + 1;
    return `${v.name} is now level ${L + 1}.`;
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
  const prizes = wheelFor(u), total = prizes.reduce((a, s) => a + s.w, 0);
  let x = rand(total), idx = 0;
  while (x >= prizes[idx].w) { x -= prizes[idx].w; idx++; }
  const p = prizes[idx];
  if (p.pts) { u.wallet += p.pts; u.earned += p.pts; }
  if (p.rolls) u.charges += p.rolls;
  if (p.refill) u.charges = Math.max(u.charges, bankCap(u));
  if (p.tickets) u.tickets += p.tickets;
  u.wheelAt = now;
  return { index: idx, label: p.label };
}

/* ---------- arcade: every game uses 1 ticket. Play free, or bet your own points. ---------- */
function takeTicket(u, bet) {
  sync(u);
  if (u.tickets < 1) throw new GameError("No tickets left. Wait for the next one.");
  let stake = freeStake(u), wager = false;
  if (bet != null && bet !== 0) {
    if (!BETS.includes(bet)) throw new GameError("Pick a stake from the list.");
    if (u.wallet < bet) throw new GameError("You don't have that many points.");
    u.wallet -= bet; stake = bet; wager = true;
  }
  if (u.tickets >= ticketCap(u)) u.lastTicket = Date.now();
  u.tickets -= 1;
  return { stake, wager };
}
function payout(u, won, ups) {
  if (won > 0) { u.wallet += won; u.earned += won; }
  addXp(u, won > 0 ? 10 : 5, ups);
}

/* ---------- Higher or Lower: cards A (1) to K (13). A tie keeps going. ---------- */
function hiloStart(u, bet) {
  if (u.hilo) throw new GameError("You already have a game going.");
  const t = takeTicket(u, bet);
  u.hilo = { card: 1 + rand(13), pot: t.stake, stake: t.stake, round: 0, last: null };
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
  if (!win) { u.hilo = null; const ups = []; addXp(u, 5, ups); return { result: "lose", card: next, lost: Math.floor(g.pot), ups }; }
  g.pot = Math.floor(g.pot * mult); g.round += 1; g.card = next; g.last = { card: next, result: "win" };
  if (g.round >= HILO_MAX_ROUNDS) { const c = hiloCashOut(u); return { result: "win", card: next, autoCash: c.won, ups: c.ups }; }
  return { result: "win", card: next, game: g };
}
function hiloCashOut(u) {
  const g = u.hilo; if (!g) throw new GameError("No game to cash out.");
  if (g.round === 0) throw new GameError("Win at least one guess first.");
  u.hilo = null; const ups = []; payout(u, g.pot, ups);
  return { won: g.pot, ups };
}

/* ---------- Mines: 16 tiles, 1 to 10 hidden mines. More mines, bigger multipliers. ---------- */
const MINES_TILES = 16;
function minesNext(g) { const left = MINES_TILES - g.revealed.length, safe = left - g.count; return safe > 0 ? 0.97 * left / safe : 0; }
function minesStart(u, bet, count) {
  if (u.mines) throw new GameError("You already have a Mines game going.");
  count = count == null ? 3 : count;
  if (!Number.isInteger(count) || count < 1 || count > 10) throw new GameError("Pick 1 to 10 mines.");
  const t = takeTicket(u, bet);
  const spots = new Set(); while (spots.size < count) spots.add(rand(MINES_TILES));
  u.mines = { bombs: [...spots], revealed: [], pot: t.stake, stake: t.stake, count };
  return {};
}
function minesPick(u, tile) {
  const g = u.mines; if (!g) throw new GameError("Start a Mines game first.");
  g.count = g.count || g.bombs.length;
  if (!Number.isInteger(tile) || tile < 0 || tile >= MINES_TILES) throw new GameError("Pick a tile on the board.");
  if (g.revealed.includes(tile)) throw new GameError("You already flipped that one.");
  if (g.bombs.includes(tile)) { u.mines = null; const ups = []; addXp(u, 5, ups); return { result: "boom", tile, bombs: g.bombs, lost: Math.floor(g.pot), ups }; }
  g.pot = Math.floor(g.pot * minesNext(g)); g.revealed.push(tile);
  if (g.revealed.length >= MINES_TILES - g.count) { const c = minesCashOut(u); return { result: "clear", tile, bombs: g.bombs, won: c.won, ups: c.ups }; }
  return { result: "safe", tile };
}
function minesCashOut(u) {
  const g = u.mines; if (!g) throw new GameError("No Mines game to cash out.");
  if (!g.revealed.length) throw new GameError("Flip at least one tile first.");
  u.mines = null; const ups = []; payout(u, g.pot, ups);
  return { won: g.pot, ups };
}

/* ---------- Slots: three digit reels. Pays are multiples of your stake. ---------- */
const SLOTS_PAYS = [["777", 100], ["Three of a kind", 25], ["Straight, like 345", 10], ["Pair", 2]];
function slotsSpin(u, bet) {
  const t = takeTicket(u, bet);
  const reels = [rand(10), rand(10), rand(10)];
  const [a, b, c] = reels;
  let mult = 0, label = "No match";
  if (a === 7 && b === 7 && c === 7) { mult = 100; label = "Jackpot 777!"; }
  else if (a === b && b === c) { mult = 25; label = "Three of a kind"; }
  else if (b === a + 1 && c === b + 1) { mult = 10; label = "Straight"; }
  else if (a === b || b === c || a === c) { mult = 2; label = "Pair"; }
  const won = t.stake * mult, ups = [];
  payout(u, won, ups);
  return { reels, mult, label, won, stake: t.stake, ups };
}

/* ---------- Pick a Digit. Classic: exact ×8, one away ×0.75. Sniper: exact only, ×9.5. ---------- */
const PICK_MODES = { classic: { exact: 8, close: 0.75 }, sniper: { exact: 9.5, close: 0 } };
function pickPlay(u, digit, bet, mode) {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) throw new GameError("Pick a digit from 0 to 9.");
  const m = PICK_MODES[mode || "classic"]; if (!m) throw new GameError("Pick a mode.");
  const t = takeTicket(u, bet);
  const roll = rand(10), off = Math.min((roll - digit + 10) % 10, (digit - roll + 10) % 10);
  const mult = off === 0 ? m.exact : off === 1 ? m.close : 0;
  const won = Math.floor(t.stake * mult), ups = [];
  payout(u, won, ups);
  return { roll, digit, mult, won, stake: t.stake, result: off === 0 ? "exact" : off === 1 && m.close ? "close" : "miss", ups };
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
  const now = Date.now(), cap = bankCap(u), iv = waitMs(u), tcap = ticketCap(u);
  return {
    now, name: u.name,
    wallet: u.wallet, earned: u.earned, totalRolls: u.totalRolls, best: u.best,
    charges: u.charges, cap, waitMs: iv, nextChargeAt: u.charges < cap ? u.lastCharge + iv : null,
    tickets: u.tickets, ticketCap: tcap, nextTicketAt: u.tickets < tcap ? u.lastTicket + iv : null,
    freeStake: freeStake(u),
    mines: u.mines ? { revealed: u.mines.revealed, pot: u.mines.pot, count: u.mines.count || u.mines.bombs.length, next: minesNext({ ...u.mines, count: u.mines.count || u.mines.bombs.length }) } : null,
    wheelReadyAt: u.wheelAt + DAY, hilo: u.hilo ? { ...u.hilo, odds: { hi: hiloPayout(u.hilo.card, "hi"), lo: hiloPayout(u.hilo.card, "lo") } } : null,
    owned: u.owned, charms: u.charms, wear: u.wear,
    charmLv: u.charmLv || {}, wheel: wheelFor(u).map(p => p.label), levelBonus: levelMult(u),
    level: u.level || 1, xp: u.xp || 0, xpNext: xpToNext(u.level || 1), gold: u.gold || 0, vault: u.vault || {}, vaultOpen: vaultOpen(u),
    history: u.history.slice(0, 30), badgeCounts: u.badgeCounts,
    streak: todayKey ? streak(u, todayKey) : 0, daysPlayed: Object.keys(u.days).length,
  };
}
const catalog = {
  upgrades: UPG.map(u => ({ id: u.id, name: u.name, prices: u.prices, levels: u.vals.map(v => u.desc(v)) })),
  charms: CHARMS.map(c => ({ id: c.id, sym: c.sym, kind: c.kind, name: c.name, price: c.price, max: CHARM_MAX, levels: c.v.map(c.d), upCosts: Array.from({ length: CHARM_MAX - 1 }, (_, i) => charmUpCost(c, i + 1)) })),
  vault: VAULT.map(v => ({ id: v.id, name: v.name, max: v.max, costs: Array.from({ length: v.max }, (_, L) => vaultCost(v, L)), levels: Array.from({ length: v.max + 1 }, (_, L) => v.desc(L)) })),
  bets: BETS,
  hilo: { maxRounds: HILO_MAX_ROUNDS },
  mines: { tiles: MINES_TILES },
  slots: { pays: SLOTS_PAYS },
  pick: PICK_MODES,
};

module.exports = { GameError, newUser, resetProgress, doRoll, buy, wear, spinWheel, hiloStart, hiloGuess, hiloCashOut, minesStart, minesPick, minesCashOut, slotsSpin, pickPlay, publicState, catalog, sync };
