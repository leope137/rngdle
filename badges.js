function makeBadges() {
  const MAX = 1000000;
  const FAMS = [
    ["vanish", "Vanishing digits"], ["math", "Number theory"], ["seq", "Famous sequences"], ["shape", "Digit patterns"],
    ["poker", "Poker hands"], ["div", "Divisibility"], ["sums", "Digit sums"], ["life", "Real life"], ["meme", "Memes and luck"],
    ["const", "Math and science constants"],
  ];

  const setOf = gen => { const s = new Set(); gen(x => { if (x >= 0 && x <= MAX) s.add(x); }); return s; };
  const pw = b => setOf(p => { for (let x = b; x <= MAX; x *= b) p(x); });
  const P2 = pw(2), P3 = pw(3), P5 = pw(5), P7 = pw(7), P10 = pw(10);
  const squares = setOf(p => { for (let i = 0; i * i <= MAX; i++) p(i * i); });
  const cubes = setOf(p => { for (let i = 0; i * i * i <= MAX; i++) p(i * i * i); });
  const perfPow = setOf(p => { for (let b = 2; b * b <= MAX; b++) for (let x = b * b; x <= MAX; x *= b) p(x); });
  const fib = setOf(p => { let a = 0, b = 1; while (a <= MAX) { p(a); [a, b] = [b, a + b]; } });
  const lucas = setOf(p => { let a = 2, b = 1; while (a <= MAX) { p(a); [a, b] = [b, a + b]; } });
  const tri = setOf(p => { for (let i = 1; i * (i + 1) / 2 <= MAX; i++) p(i * (i + 1) / 2); });
  const tetra = setOf(p => { for (let i = 1; i * (i + 1) * (i + 2) / 6 <= MAX; i++) p(i * (i + 1) * (i + 2) / 6); });
  const pent = setOf(p => { for (let i = 1; i * (3 * i - 1) / 2 <= MAX; i++) p(i * (3 * i - 1) / 2); });
  const hex = setOf(p => { for (let i = 1; i * (2 * i - 1) <= MAX; i++) p(i * (2 * i - 1)); });
  const fact = setOf(p => { let f = 1; for (let i = 1; f <= MAX; i++) { f *= i; p(f); } });
  const catalan = setOf(p => { let c = 1; for (let i = 0; c <= MAX; i++) { p(c); c = c * 2 * (2 * i + 1) / (i + 2); } });
  const mersenne = new Set([3, 7, 31, 127, 8191, 131071, 524287]);
  const perfect = new Set([6, 28, 496, 8128]);
  const armstrong = new Set([153, 370, 371, 407, 1634, 8208, 9474, 54748, 92727, 93084, 548834]);
  const isPrime = n => { if (n < 2) return false; if (n % 2 === 0) return n === 2; if (n % 3 === 0) return n === 3; for (let i = 5; i * i <= n; i += 6) if (n % i === 0 || n % (i + 2) === 0) return false; return true; };
  const happy = n => { if (n < 1) return false; const seen = new Set(); while (n !== 1 && !seen.has(n)) { seen.add(n); let s = 0; while (n) { const d = n % 10; s += d * d; n = (n - d) / 10; } n = s; } return n === 1; };
  const run = (dg, step) => { let best = 1, cur = 1; for (let i = 1; i < dg.length; i++) { cur = dg[i] - dg[i - 1] === step ? cur + 1 : 1; if (cur > best) best = cur; } return best; };
  const same = dg => { let best = 1, cur = 1; for (let i = 1; i < dg.length; i++) { cur = dg[i] === dg[i - 1] ? cur + 1 : 1; if (cur > best) best = cur; } return best; };
  const has = (c, t) => c.s.includes(t);
  const DIM = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  const L = [
    // vanishing
    ["vanish", "full", "Full Six", "No digits vanished", c => c.len === 6],
    ...[1, 2, 3, 4, 5].map(k => ["vanish", "v" + k, `Vanished ${k}`, `Exactly ${k} digit${k > 1 ? "s" : ""} disappeared`, c => 6 - c.len === k]),
    ...[1, 2, 3, 4, 5].map(k => ["vanish", "z" + k, `${["", "One", "Two", "Three", "Four", "Five"][k]} Leading Zero${k > 1 ? "s" : ""}`, `Starts with exactly ${k} zero${k > 1 ? "s" : ""} before a real digit`, c => c.lz === k && c.n > 0]),
    ["vanish", "allzero", "All Zeros", "Nothing but zeros", c => /^0+$/.test(c.s)],
    // number theory
    ["math", "even", "Even", "Divisible by 2", c => c.n % 2 === 0],
    ["math", "odd", "Odd", "Not divisible by 2", c => c.n % 2 === 1],
    ["math", "prime", "Prime", "Only divisible by 1 and itself", c => c.prime],
    ["math", "twinprime", "Twin Prime", "A prime with another prime 2 away", c => c.prime && (isPrime(c.n - 2) || isPrime(c.n + 2))],
    ["math", "emirp", "Emirp", "A prime that is a different prime backwards", c => c.prime && c.rev !== c.n && isPrime(c.rev)],
    ["math", "sophie", "Sophie Germain", "Prime p where 2p + 1 is also prime", c => c.prime && isPrime(2 * c.n + 1)],
    ["math", "mersenne", "Mersenne Prime", "A prime one less than a power of 2", c => mersenne.has(c.n)],
    ["math", "primepal", "Palindromic Prime", "Prime and reads the same backwards", c => c.prime && c.pal],
    ["math", "semiprime", "Semiprime", "Product of exactly two primes", c => c.omega === 2],
    ["math", "primesq", "Prime Squared", "A prime times itself", c => c.omega === 2 && c.distinctP === 1],
    ["math", "squarefree", "Square-Free", "No square factor besides 1", c => c.n > 1 && c.sqfree],
    ["math", "abundant", "Abundant", "Its divisors add up to more than it", c => c.n > 0 && c.sigma - c.n > c.n],
    ["math", "perfect", "Perfect Number", "Its divisors add up to exactly it", c => perfect.has(c.n)],
    ["math", "perfpow", "Perfect Power", "A whole number raised to a power of 2 or more", c => perfPow.has(c.n)],
    ["math", "square", "Perfect Square", "A whole number squared", c => squares.has(c.n)],
    ["math", "cube", "Perfect Cube", "A whole number cubed", c => cubes.has(c.n)],
    ["math", "pow2", "Power of 2", "2, 4, 8, 16, 32 ...", c => c.n > 1 && P2.has(c.n)],
    ["math", "pow3", "Power of 3", "3, 9, 27, 81 ...", c => P3.has(c.n)],
    ["math", "pow5", "Power of 5", "5, 25, 125 ...", c => P5.has(c.n)],
    ["math", "pow7", "Power of 7", "7, 49, 343 ...", c => P7.has(c.n)],
    ["math", "pow10", "Power of 10", "10, 100, 1,000 ...", c => P10.has(c.n)],
    ["math", "harshad", "Harshad", "Divisible by its own digit sum", c => c.ds > 0 && c.n % c.ds === 0],
    ["math", "selfdiv", "Self-Divisible", "Divisible by every one of its digits", c => c.n > 0 && !c.s.includes("0") && c.dg.every(d => c.n % d === 0)],
    ["math", "revmult", "Reversal Multiple", "A multiple of its own reverse, like 8712", c => c.n % 10 !== 0 && c.rev !== c.n && c.rev > 0 && c.n % c.rev === 0],
    ["math", "armstrong", "Armstrong Number", "Equals the sum of its digits to the power of its length", c => armstrong.has(c.n)],
    ["math", "happy", "Happy Number", "Square the digits and add, repeat, and you reach 1", c => happy(c.n)],
    // sequences
    ["seq", "fib", "Fibonacci", "0, 1, 1, 2, 3, 5, 8, 13 ...", c => fib.has(c.n)],
    ["seq", "lucas", "Lucas Number", "2, 1, 3, 4, 7, 11, 18 ...", c => lucas.has(c.n)],
    ["seq", "tri", "Triangular", "1 + 2 + 3 + ... up to something", c => tri.has(c.n)],
    ["seq", "tetra", "Tetrahedral", "Stacks into a triangular pyramid", c => tetra.has(c.n)],
    ["seq", "pent", "Pentagonal", "1, 5, 12, 22, 35 ...", c => pent.has(c.n)],
    ["seq", "hex", "Hexagonal", "1, 6, 15, 28, 45 ...", c => hex.has(c.n)],
    ["seq", "fact", "Factorial", "1, 2, 6, 24, 120, 720 ...", c => fact.has(c.n)],
    ["seq", "catalan", "Catalan Number", "1, 2, 5, 14, 42, 132 ...", c => catalan.has(c.n)],
    // digit patterns
    ["shape", "pal", "Palindrome", "Reads the same backwards", c => c.len >= 3 && c.pal],
    ["shape", "rep", "Repdigit", "Every digit the same", c => c.len > 1 && /^(\d)\1+$/.test(c.s)],
    ["shape", "copy", "Copy Paste", "Both halves match, like 123123", c => c.len >= 4 && c.len % 2 === 0 && c.s.slice(0, c.len / 2) === c.s.slice(c.len / 2)],
    ["shape", "abab", "Ping Pong", "Two digits taking turns, like 121212", c => c.len >= 4 && c.dg[0] !== c.dg[1] && c.dg.every((d, i) => d === c.dg[i % 2])],
    ["shape", "asc", "Staircase Up", "Every digit bigger than the last", c => c.len >= 3 && c.dg.every((d, i) => i === 0 || d > c.dg[i - 1])],
    ["shape", "desc", "Staircase Down", "Every digit smaller than the last", c => c.len >= 3 && c.dg.every((d, i) => i === 0 || d < c.dg[i - 1])],
    ["shape", "sorted", "Sorted", "Digits never go down", c => c.len >= 3 && c.dg.every((d, i) => i === 0 || d >= c.dg[i - 1])],
    ["shape", "str4", "Straight", "Four digits counting up in a row, like 3456", c => run(c.dg, 1) >= 4],
    ["shape", "str5", "Big Straight", "Five digits counting up in a row, like 34567", c => run(c.dg, 1) >= 5],
    ["shape", "cd4", "Countdown", "Four digits counting down in a row, like 6543", c => run(c.dg, -1) >= 4],
    ["shape", "dbl", "Doubles", "Two of the same digit side by side", c => same(c.dg) >= 2],
    ["shape", "trp", "Triples", "Three of the same digit side by side", c => same(c.dg) >= 3],
    ["shape", "quad", "Quads", "Four of the same digit side by side", c => same(c.dg) >= 4],
    ["shape", "zigzag", "Zigzag", "Digits go up, down, up, down", c => c.len >= 4 && c.dg.every((d, i) => i === 0 || d !== c.dg[i - 1]) && c.dg.every((d, i) => i < 2 || Math.sign(d - c.dg[i - 1]) === -Math.sign(c.dg[i - 1] - c.dg[i - 2]))],
    ["shape", "altpar", "Odd Even Odd", "Digits alternate odd and even", c => c.len >= 4 && c.dg.every((d, i) => i === 0 || d % 2 !== c.dg[i - 1] % 2)],
    ["shape", "alleven", "All Even Digits", "Every digit is 0, 2, 4, 6 or 8", c => c.dg.every(d => d % 2 === 0)],
    ["shape", "allodd", "All Odd Digits", "Every digit is 1, 3, 5, 7 or 9", c => c.dg.every(d => d % 2 === 1)],
    ["shape", "primedig", "Prime Digits Only", "Every digit is 2, 3, 5 or 7", c => c.dg.every(d => d === 2 || d === 3 || d === 5 || d === 7)],
    ["shape", "nozero", "No Zeros", "Not a single 0", c => !c.s.includes("0")],
    ["shape", "two", "Only Two Digits", "Uses exactly two different digits", c => c.len >= 3 && c.distinct === 2],
    // poker hands, the six digits as a hand
    ["poker", "nopair", "High Card", "Six digits, all different", c => c.len === 6 && c.hand === "111111"],
    ["poker", "pair", "One Pair", "Six digits with exactly one pair", c => c.len === 6 && c.hand === "21111"],
    ["poker", "2pair", "Two Pair", "Six digits with two pairs", c => c.len === 6 && c.hand === "2211"],
    ["poker", "3pair", "Three Pair", "Six digits making three pairs", c => c.len === 6 && c.hand === "222"],
    ["poker", "3kind", "Three of a Kind", "Six digits with a triple and nothing else", c => c.len === 6 && c.hand === "3111"],
    ["poker", "full", "Full House", "Six digits with a triple and a pair", c => c.len === 6 && c.hand === "321"],
    ["poker", "2trip", "Double Triple", "Six digits making two triples", c => c.len === 6 && c.hand === "33"],
    ["poker", "4kind", "Four of a Kind", "Six digits with four the same", c => c.len === 6 && c.hand[0] === "4"],
    ["poker", "5kind", "Five of a Kind", "Six digits with five the same", c => c.len === 6 && c.hand[0] === "5"],
    ["poker", "6kind", "Six of a Kind", "All six digits the same", c => c.len === 6 && c.hand === "6"],
    // divisibility
    ["div", "d3", "Divisible by 3", "A multiple of 3", c => c.n > 0 && c.n % 3 === 0],
    ["div", "d5", "Divisible by 5", "Ends in 0 or 5", c => c.n > 0 && c.n % 5 === 0],
    ["div", "d7", "Divisible by 7", "A multiple of 7", c => c.n > 0 && c.n % 7 === 0],
    ["div", "d9", "Divisible by 9", "A multiple of 9", c => c.n > 0 && c.n % 9 === 0],
    ["div", "d11", "Divisible by 11", "A multiple of 11", c => c.n > 0 && c.n % 11 === 0],
    ["div", "d12", "By the Dozen", "A multiple of 12", c => c.n > 0 && c.n % 12 === 0],
    ["div", "d13", "Baker's Dozen", "A multiple of 13", c => c.n > 0 && c.n % 13 === 0],
    ["div", "d25", "Quarter", "A multiple of 25", c => c.n > 0 && c.n % 25 === 0],
    ["div", "d100", "Round Hundred", "A multiple of 100", c => c.n > 0 && c.n % 100 === 0],
    ["div", "d1000", "Round Thousand", "A multiple of 1,000", c => c.n > 0 && c.n % 1000 === 0],
    ["div", "d10000", "Round Ten Thousand", "A multiple of 10,000", c => c.n > 0 && c.n % 10000 === 0],
    ["div", "d1024", "Kilobyte", "A multiple of 1,024", c => c.n > 0 && c.n % 1024 === 0],
    ["div", "nearround", "Almost Round", "Within 10 of a power of 10", c => [10, 100, 1e3, 1e4, 1e5, 1e6].some(p => Math.abs(c.n - p) <= 10)],
    // digit sums
    ["sums", "dsprime", "Prime Digit Sum", "Its digits add up to a prime", c => isPrime(c.ds)],
    ["sums", "ds7", "Lucky Sum", "Digits add up to 7", c => c.ds === 7],
    ["sums", "ds13", "Unlucky Sum", "Digits add up to 13", c => c.ds === 13],
    ["sums", "ds21", "Blackjack", "Digits add up to 21", c => c.ds === 21],
    ["sums", "dssq", "Square Sum", "Its digits add up to a perfect square", c => c.ds > 0 && squares.has(c.ds)],
    ["sums", "dslow", "Featherweight", "Digits add up to 5 or less", c => c.ds <= 5],
    ["sums", "dshigh", "Heavyweight", "Digits add up to 45 or more", c => c.ds >= 45],
    ["sums", "sumprod", "Balanced", "Digit sum equals digit product", c => c.len > 1 && c.ds === c.dp],
    // real life
    ["life", "year", "Could Be a Year", "Four digits from 1900 to 2026", c => c.len === 4 && c.n >= 1900 && c.n <= 2026],
    ["life", "future", "Future Year", "Four digits from 2027 to 2099", c => c.len === 4 && c.n >= 2027 && c.n <= 2099],
    ["life", "leap", "Leap Year", "Four digits that would be a leap year", c => c.len === 4 && c.n >= 1000 && ((c.n % 4 === 0 && c.n % 100 !== 0) || c.n % 400 === 0)],
    ["life", "clock", "Clock Time", "The last four digits read as a real time, like 12:45", c => { if (c.len < 3) return false; const t = c.s.slice(-4).padStart(4, "0"); return +t.slice(0, 2) < 24 && +t.slice(2) < 60; }],
    ["life", "date", "Calendar Date", "The last four digits read as a real month and day", c => { if (c.len < 3) return false; const t = c.s.slice(-4).padStart(4, "0"), m = +t.slice(0, 2), d = +t.slice(2); return m >= 1 && m <= 12 && d >= 1 && d <= DIM[m]; }],
    ["life", "halloween", "Halloween", "Contains 1031", c => has(c, "1031")],
    ["life", "xmas", "Christmas", "Contains 1225", c => has(c, "1225")],
    ["life", "july4", "Independence Day", "Contains 1776", c => has(c, "1776")],
    ["life", "piday", "Pi Day", "Contains 314", c => has(c, "314")],
    ["life", "911", "Emergency", "Contains 911", c => has(c, "911")],
    ["life", "247", "24/7", "Contains 247", c => has(c, "247")],
    ["life", "365", "Every Day", "Contains 365", c => has(c, "365")],
    ["life", "212", "Boiling Point", "Contains 212, water boils at 212°F", c => has(c, "212")],
    ["life", "555", "Movie Phone Number", "Contains 555", c => has(c, "555")],
    ["life", "404", "Not Found", "Contains 404", c => has(c, "404")],
    ["life", "007", "Secret Agent", "Contains 007", c => has(c, "007")],
    ["life", "1024", "Binary Brain", "Contains 1024", c => has(c, "1024")],
    // memes and luck
    ["meme", "67", "Six Seven", "Contains 67", c => has(c, "67")],
    ["meme", "21", "What's 9 + 10", "Contains 21", c => has(c, "21")],
    ["meme", "42", "The Answer", "Contains 42", c => has(c, "42")],
    ["meme", "1337", "Leet", "Contains 1337", c => has(c, "1337")],
    ["meme", "9001", "Over 9000", "Contains 9001", c => has(c, "9001")],
    ["meme", "360", "No Scope", "Contains 360", c => has(c, "360")],
    ["meme", "100", "Keep It 100", "Contains 100", c => has(c, "100")],
    ["meme", "777", "Jackpot", "Contains 777", c => has(c, "777")],
    ["meme", "888", "Triple Eight", "Contains 888, lucky in China", c => has(c, "888")],
    ["meme", "666", "Spooky", "Contains 666", c => has(c, "666")],
    ["meme", "13", "Unlucky 13", "Contains 13", c => has(c, "13")],
    ["meme", "7", "Lucky Seven", "Ends in 7", c => c.s.endsWith("7")],
    ["meme", "123", "Easy as 123", "Contains 123", c => has(c, "123")],
    // constants
    ["const", "pi", "Pi Digits", "Starts with 3141", c => c.s.startsWith("3141")],
    ["const", "e", "Euler Digits", "Starts with 2718", c => c.s.startsWith("2718")],
    ["const", "golden", "Golden Digits", "Starts with 1618", c => c.s.startsWith("1618")],
    ["const", "root2", "Root Two", "Starts with 1414", c => c.s.startsWith("1414")],
    ["const", "light", "Speed of Light", "Starts with 2997, like 299,792 km/s", c => c.s.startsWith("2997")],
  ];

  const defs = L.map(([fam, id, name, desc]) => ({ id: fam + ":" + id, name, desc, fam }));

  function ctxOf(s) {
    s = String(s); const n = Number(s), dg = [...s].map(Number), len = s.length;
    let ds = 0, dp = 1; dg.forEach(d => { ds += d; dp *= d; });
    const rev = Number([...s].reverse().join(""));
    let m = n, omega = 0, distinctP = 0, sqfree = true, sigma = 1;
    if (n > 1) {
      for (let p = 2; p * p <= m; p++) {
        if (m % p === 0) { let e = 0, pk = 1, sum = 1; while (m % p === 0) { m /= p; e++; pk *= p; sum += pk; } omega += e; distinctP++; if (e > 1) sqfree = false; sigma *= sum; }
      }
      if (m > 1) { omega++; distinctP++; sigma *= (m + 1); }
    }
    const cnt = Array(10).fill(0); dg.forEach(d => cnt[d]++);
    const hand = cnt.filter(Boolean).sort((a, b) => b - a).join("");
    let lz = 0; while (lz < len - 1 && s[lz] === "0") lz++;
    return { n, s, dg, len, ds, dp, rev, omega, distinctP, sqfree, sigma, hand, lz, distinct: cnt.filter(Boolean).length, prime: n > 1 && omega === 1, pal: s === [...s].reverse().join("") };
  }

  function evaluate(str) {
    const c = ctxOf(str), out = [];
    L.forEach(([fam, id, , , t]) => { if (t(c)) out.push(fam + ":" + id); });
    return out;
  }

  return { MAX, FAMS, defs, evaluate };
}
if (typeof module !== "undefined") module.exports = makeBadges;
