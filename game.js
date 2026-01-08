// game.js
// Liiiiiiight — earned day/night + BIG tap-to-start + daily verse + send-to-friends + soft sound + BIG emoji powerups
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

// ---------- Utilities ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Safe-area helpers (for iPhone notch) ----------
function cssPxVar(name) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v || "0");
  return Number.isFinite(n) ? n : 0;
}
function safeTop() { return cssPxVar("--sat"); }
function safeBottom() { return cssPxVar("--sab"); }

// ---------- Pacific Time daily date/seed ----------
const PT_TZ = "America/Los_Angeles";

function yyyymmddPT() {
  // Use Intl to derive PT calendar date (stable, DST-safe)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const y = parts.find(p => p.type === "year")?.value ?? "1970";
  const m = parts.find(p => p.type === "month")?.value ?? "01";
  const d = parts.find(p => p.type === "day")?.value ?? "01";
  return `${y}${m}${d}`;
}
function dailySeedFromPTDate() {
  return parseInt(yyyymmddPT(), 10);
}
function formatDatePTShort() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PT_TZ,
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date());
}

// ---------- Verse UI ----------
const verseOverlay = document.getElementById("verseOverlay");
const cardTitleEl = document.getElementById("cardTitle");
const dailyTagEl = document.getElementById("dailyTag");
const dateTextEl = document.getElementById("dateText");
const verseTextEl = document.getElementById("verseText");
const continueBtn = document.getElementById("continueBtn");
const unlockHint = document.getElementById("unlockHint");
const sendBtn = document.getElementById("sendBtn");
const shareStatus = document.getElementById("shareStatus");
const resultText = document.getElementById("resultText");

// WEB wording
const VERSES_WEB = [
  {
    ref: "Philippians 4:6–7",
    text:
`In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God.
And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus.`
  },
  {
    ref: "Isaiah 41:10",
    text:
`Don’t you be afraid, for I am with you.
Don’t be dismayed, for I am your God.
I will strengthen you.
Yes, I will help you.
Yes, I will uphold you with the right hand of my righteousness.`
  },
  {
    ref: "Psalms 46:1",
    text:
`God is our refuge and strength,
a very present help in trouble.`
  },
  {
    ref: "Matthew 11:28",
    text:
`“Come to me, all you who labor and are heavily burdened, and I will give you rest.”`
  },
  {
    ref: "Psalms 34:18",
    text:
`Yahweh is near to those who have a broken heart,
and saves those who have a crushed spirit.`
  },
  {
    ref: "Joshua 1:9",
    text:
`Haven’t I commanded you?
Be strong and courageous.
Don’t be afraid.
Don’t be dismayed, for Yahweh your God is with you wherever you go.`
  },
];

function pickDailyVerse() {
  const seed = dailySeedFromPTDate();
  const rng = mulberry32(seed);
  const idx = Math.floor(rng() * VERSES_WEB.length);
  return VERSES_WEB[idx];
}

// 5 second lock
let unlockAtMs = 0;
let unlockRAF = null;

function showVerseOverlay({ score, best }) {
  const v = pickDailyVerse();

  dailyTagEl.textContent = "Here’s your daily verse 👍🏼";
  dateTextEl.textContent = formatDatePTShort();

  verseTextEl.textContent = `${v.text}\n\n${v.ref}`;

  cardTitleEl.textContent = "It’s okay, try again.";
  resultText.textContent = `Score: ${score} • Best: ${best}`;
  shareStatus.textContent = "";

  continueBtn.disabled = true;
  continueBtn.classList.add("hiddenBtn");
  unlockHint.textContent = "Please wait 5s…";
  unlockHint.style.display = "block";

  unlockAtMs = performance.now() + 5000;
  tickUnlock();

  verseOverlay.classList.remove("hidden");
  verseOverlay.setAttribute("aria-hidden", "false");
}

function hideVerseOverlay() {
  verseOverlay.classList.add("hidden");
  verseOverlay.setAttribute("aria-hidden", "true");
  if (unlockRAF) cancelAnimationFrame(unlockRAF);
  unlockRAF = null;
}

function tickUnlock() {
  const leftMs = Math.max(0, unlockAtMs - performance.now());
  const left = Math.ceil(leftMs / 1000);

  if (leftMs <= 0) {
    unlockHint.style.display = "none";
    continueBtn.classList.remove("hiddenBtn");
    continueBtn.disabled = false;
    unlockRAF = null;
    return;
  }

  unlockHint.textContent = `Please wait ${left}s…`;
  unlockRAF = requestAnimationFrame(tickUnlock);
}

continueBtn.addEventListener("click", () => {
  hideVerseOverlay();
  S.running = true;
  resetRun();
});

// ---------- “Send to your friends!” ----------
const GAME_URL = "https://liiiiiight.com/";
function buildInviteMessage() {
  return `I love this new game (Liiiiiiight) and think you will too!! 👀 ${GAME_URL}`;
}

async function sendToFriends() {
  const text = buildInviteMessage();

  if (navigator.share) {
    try {
      await navigator.share({ text, url: GAME_URL, title: "Liiiiiiight" });
      shareStatus.textContent = "";
      return;
    } catch {}
  }

  const smsUrl = `sms:&body=${encodeURIComponent(text)}`;
  const opened = window.open(smsUrl, "_self");

  if (!opened && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      shareStatus.textContent = "Copied message — paste it to a friend 🙂";
      return;
    } catch {
      shareStatus.textContent = "Couldn’t open messages. Copy this link: " + GAME_URL;
    }
  }
}
sendBtn.addEventListener("click", sendToFriends);

// ---------- Sound ----------
const audio = { ctx: null, master: null, ready: false };

function ensureAudio() {
  if (audio.ready) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audio.ctx = new Ctx();
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = 0.22;
  audio.master.connect(audio.ctx.destination);
  audio.ready = true;
}

function playTone({ type="sine", freq=440, dur=0.06, gain=0.08, attack=0.002, release=0.03 }) {
  ensureAudio();
  if (!audio.ready) return;

  const t0 = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const g = audio.ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);

  osc.connect(g);
  g.connect(audio.master);

  osc.start(t0);
  osc.stop(t0 + dur + release + 0.01);
}

function sfxFlap() {
  playTone({ type:"triangle", freq: 880, dur: 0.032, gain: 0.06, release: 0.02 });
  playTone({ type:"triangle", freq: 1320, dur: 0.028, gain: 0.05, release: 0.02 });
}
function sfxHit() { playTone({ type:"sine", freq: 150, dur: 0.045, gain: 0.08, release: 0.04 }); }
function sfxScore() { playTone({ type:"sine", freq: 660, dur: 0.03, gain: 0.045, release: 0.02 }); }
function sfxPower() { playTone({ type:"sine", freq: 980, dur: 0.04, gain: 0.06, release: 0.03 }); }

// ---------- Canvas sizing ----------
function resizeCanvas() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ---------- Game State ----------
const S = {
  started: false,
  running: false,

  x: 0, y: 0, vy: 0, r: 12,

  gravity: 1350,
  thrust: -420,
  maxFall: 900,

  baseScroll: 240,
  scroll: 240,

  dayAmount: 0,
  dayTarget: 0,
  dayEvery: 40,

  // Light can overfill to 150% with milk
  light: 1,
  lightMax: 1.5,

  drainOnHit: 0.28,
  regenBasePerSec: 0.10,
  regenCalmBonusPerSec: 0.08,
  regenCoastGateSec: 0.35,
  lastFlapT: -999,

  pipes: [],
  pipeW: 78,
  gapBase: 188,
  gapMin: 148,
  pipeId: 0,
  lastGapY: null,

  spacingBase: 380,
  spacingMin: 330,
  spawnLead: 1100,

  score: 0,
  best: 0,
  passed: new Set(),

  // Powerups
  powerups: [], // { id, x, y, kind:'bread'|'milk', r, alive }
  powerId: 0,

  msg: "Tap to start.",
  msgT: 999,
  lastHitT: -999,

  lastRunScore: 0,
};

function loadBest() {
  const v = parseInt(localStorage.getItem("dailywalk_best_v1") || "0", 10);
  S.best = Number.isFinite(v) ? v : 0;
}
function saveBest() { localStorage.setItem("dailywalk_best_v1", String(S.best)); }

function resetRun() {
  S.x = Math.round(window.innerWidth * 0.28);
  S.y = Math.round(window.innerHeight * 0.45);
  S.vy = 0;

  S.light = 1;
  S.scroll = S.baseScroll;

  S.pipes = [];
  S.powerups = [];
  S.passed.clear();
  S.score = 0;
  S.lastGapY = null;

  S.msg = "";
  S.msgT = 0;
  S.lastHitT = -999;
  S.lastFlapT = -999;

  const w = window.innerWidth;
  const startX = w + 520;
  const spacing = S.spacingBase;
  for (let i = 0; i < 3; i++) spawnPipe(startX + i * spacing);
  ensurePipesAhead();
}

function smoothGapY(targetGapY) {
  if (S.lastGapY == null) return targetGapY;
  const baseMaxDelta = 150;
  const extra = clamp(S.score * 6, 0, 120);
  const maxDelta = baseMaxDelta + extra;
  return clamp(targetGapY, S.lastGapY - maxDelta, S.lastGapY + maxDelta);
}

function maybeSpawnPowerupForPipe(p) {
  // Not too frequent, but regular enough to feel like a “thing”
  // Increase chance slightly after score 10
  const baseChance = 0.18;
  const chance = baseChance + clamp(S.score / 120, 0, 0.12); // up to +0.12

  if (Math.random() > chance) return;

  const kind = Math.random() < 0.62 ? "bread" : "milk"; // bread more common

  // Place inside the gap, but in slightly “dangerous” spots (near edges)
  const edgeBias = Math.random() < 0.55; // often near an edge
  const offset = edgeBias
    ? (Math.random() < 0.5 ? -1 : 1) * (p.gapH * (0.28 + Math.random() * 0.10))
    : (Math.random() - 0.5) * (p.gapH * 0.30);

  const y = p.gapY + offset;

  S.powerups.push({
    id: S.powerId++,
    x: p.x + p.w + 46,     // just after the pipe face
    y,
    kind,
    r: 18,                 // collision radius
    alive: true,
  });
}

function spawnPipe(x) {
  const h = window.innerHeight;

  const earlyBonus = S.score < 8 ? 18 : 0;
  const rawGap = (S.gapBase + earlyBonus) - S.score * 0.6;
  const gap = clamp(rawGap, S.gapMin, S.gapBase + earlyBonus);

  const margin = 70;
  const minY = margin + gap * 0.35;
  const maxY = h - margin - gap * 0.35;

  let gapY = minY + (maxY - minY) * Math.random();
  gapY = smoothGapY(gapY);
  S.lastGapY = gapY;

  const pipe = { id: S.pipeId++, x, w: S.pipeW, gapY, gapH: gap };
  S.pipes.push(pipe);

  // Power-up occasionally tied to a pipe spawn
  maybeSpawnPowerupForPipe(pipe);
}

function circleRectCollide(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

function circleCircleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by;
  return (dx*dx + dy*dy) <= (ar + br) * (ar + br);
}

function hit() {
  const t = performance.now() / 1000;
  if (t - S.lastHitT < 0.2) return;
  S.lastHitT = t;

  S.light = clamp(S.light - S.drainOnHit, 0, S.lightMax);
  S.vy *= 0.72;

  S.msg = "You slipped. Try again steady.";
  S.msgT = 1.0;

  sfxHit();

  if (S.light <= 0.001) endRun();
}

function endRun() {
  S.running = false;
  S.lastRunScore = S.score;

  if (S.score > S.best) { S.best = S.score; saveBest(); }

  showVerseOverlay({ score: S.score, best: S.best });
}

function startGameAndFlap() {
  if (!S.started) {
    S.started = true;
    S.running = true;
    resetRun();
    S.vy = S.thrust * 0.72;
    sfxFlap();
    return;
  }

  if (!S.running) return;

  const t = performance.now() / 1000;
  S.lastFlapT = t;

  const strength = 0.88 + 0.28 * (S.light / S.lightMax);
  S.vy = S.thrust * strength;

  sfxFlap();
}

window.addEventListener("pointerdown", () => {
  if (!verseOverlay.classList.contains("hidden")) return;
  startGameAndFlap();
});
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (!verseOverlay.classList.contains("hidden")) return;
    startGameAndFlap();
  }
});

// ---------- Visual helpers ----------
function roundRectFill(x, y, w, h, r, fillStyle) {
  if (h <= 0 || w <= 0) return;
  const rr = Math.min(r, w / 2, h / 2);
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  ctx.fill();
}

function updateDayNight() {
  const phase = Math.floor(S.score / S.dayEvery) % 2;
  S.dayTarget = phase === 1 ? 1 : 0;
  S.dayAmount = lerp(S.dayAmount, S.dayTarget, 0.02);
}

function drawBackground(w, h) {
  const d = S.dayAmount;

  ctx.fillStyle = "#171b22";
  ctx.fillRect(0, 0, w, h);

  if (d > 0.001) {
    ctx.globalAlpha = 0.28 * d;
    ctx.fillStyle = "#2a3242";
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 0.24 * d;
    ctx.fillStyle = "#3a4357";
    ctx.fillRect(0, 0, w, h);

    const g = ctx.createRadialGradient(-60, -60, 0, -60, -60, Math.max(w, h) * 0.95);
    g.addColorStop(0, "rgba(255, 214, 160, 0.95)");
    g.addColorStop(0.25, "rgba(255, 214, 160, 0.34)");
    g.addColorStop(0.6, "rgba(255, 214, 160, 0.10)");
    g.addColorStop(1, "rgba(255, 214, 160, 0)");
    ctx.globalAlpha = 0.62 * d;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 1;
  }

  const starAlpha = 0.30 * (1 - d) + 0.03;
  ctx.globalAlpha = starAlpha;
  ctx.fillStyle = "white";
  for (let i = 0; i < 24; i++) {
    const x = (i * 97 + Math.floor(performance.now() / 30)) % w;
    const y = (i * 53) % h;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  ctx.globalAlpha = 0.18;
  const vg = ctx.createLinearGradient(0, 0, 0, h);
  vg.addColorStop(0, "rgba(0,0,0,0.14)");
  vg.addColorStop(1, "rgba(0,0,0,0.44)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
}

function drawPowerups() {
  // BIG emojis (super readable)
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";

  for (const pu of S.powerups) {
    if (!pu.alive) continue;

    // subtle glow behind emoji
    ctx.beginPath();
    ctx.arc(pu.x, pu.y, 26, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();

    const emoji = pu.kind === "milk" ? "🥛" : "🍞";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(emoji, pu.x, pu.y);
  }
}

function draw() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  drawBackground(w, h);

  // pipes
  for (const p of S.pipes) {
    const gapTop = p.gapY - p.gapH / 2;
    const gapBot = p.gapY + p.gapH / 2;
    roundRectFill(p.x, 0, p.w, gapTop, 12, "rgba(0,0,0,0.72)");
    roundRectFill(p.x, gapBot, p.w, h - gapBot, 12, "rgba(0,0,0,0.72)");
  }

  drawPowerups();

  // player glow scales with (light / lightMax)
  const lNorm = clamp(S.light / S.lightMax, 0, 1);
  const glow = 16 + 30 * lNorm;
  const alpha = 0.20 + 0.55 * lNorm;

  ctx.beginPath();
  ctx.arc(S.x, S.y, glow, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.12})`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(S.x, S.y, S.r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fill();

  // HUD respects safe area
  const hudTopY = safeTop() + 86;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.font = "700 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(`Score: ${S.score}`, 14, hudTopY);

  ctx.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillText(`Best: ${S.best}`, 14, hudTopY + 18);

  // light bar
  const bx = 14, by = hudTopY + 30, bw = 160, bh = 10;
  roundRectFill(bx, by, bw, bh, 999, "rgba(255,255,255,0.12)");
  const fill = bw * clamp(S.light / S.lightMax, 0, 1);
  roundRectFill(bx, by, fill, bh, 999, `rgba(255,255,255,${0.22 + 0.65 * lNorm})`);

  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillText("Light", bx, by + bh + 16);

  // Tap to start: moved LOWER (~½ inch)
  if (!S.started && verseOverlay.classList.contains("hidden")) {
    const tx = Math.round(w * 0.22);
    const ty = Math.round(h * 0.66); // was ~0.60

    ctx.textAlign = "left";
    ctx.font = "900 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText("Tap to start", tx, ty);

    ctx.font = "800 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.fillText("Spacebar works too 🫣", tx, ty + 28);
  }

  if (S.msg && S.msgT > 0 && S.started && verseOverlay.classList.contains("hidden")) {
    ctx.textAlign = "left";
    ctx.font = "700 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.fillText(S.msg, 14, by + bh + 46);
  }
}

// ---------- Guaranteed spacing ----------
function spacingPx() {
  const tighten = clamp(S.score * 0.9, 0, 50);
  return clamp(S.spacingBase - tighten, S.spacingMin, S.spacingBase);
}

function ensurePipesAhead() {
  const w = window.innerWidth;
  let rightmostX = -Infinity;
  for (const p of S.pipes) rightmostX = Math.max(rightmostX, p.x);
  if (!Number.isFinite(rightmostX)) rightmostX = w;

  const needUntil = w + S.spawnLead;
  const sp = spacingPx();

  while (rightmostX < needUntil) {
    rightmostX += sp;
    spawnPipe(rightmostX);
  }
}

// ---------- Loop ----------
let last = performance.now();

function update(dt) {
  const h = window.innerHeight;

  const target = S.baseScroll + S.score * 4.2;
  S.scroll = target * (0.82 + 0.18 * clamp(S.light / S.lightMax, 0, 1));

  updateDayNight();

  for (const p of S.pipes) p.x -= S.scroll * dt;
  S.pipes = S.pipes.filter(p => p.x + p.w > -140);
  ensurePipesAhead();

  // move powerups with world
  for (const pu of S.powerups) pu.x -= S.scroll * dt;
  S.powerups = S.powerups.filter(pu => pu.x > -120 && pu.alive);

  S.vy += S.gravity * dt;
  S.vy = clamp(S.vy, -1200, S.maxFall);
  S.y += S.vy * dt;

  if (S.y < S.r) { S.y = S.r; S.vy *= -0.25; hit(); }
  if (S.y > h - S.r) { S.y = h - S.r; hit(); }

  // pipe collisions + score
  for (const p of S.pipes) {
    const gapTop = p.gapY - p.gapH / 2;
    const gapBot = p.gapY + p.gapH / 2;

    const hitTop = circleRectCollide(S.x, S.y, S.r, p.x, 0, p.w, gapTop);
    const hitBot = circleRectCollide(S.x, S.y, S.r, p.x, gapBot, p.w, h - gapBot);
    if (hitTop || hitBot) hit();

    if (!S.passed.has(p.id) && p.x + p.w < S.x - S.r) {
      S.passed.add(p.id);
      S.score += 1;
      sfxScore();
    }
  }

  // powerup pickup
  for (const pu of S.powerups) {
    if (!pu.alive) continue;
    if (circleCircleHit(S.x, S.y, S.r, pu.x, pu.y, pu.r)) {
      pu.alive = false;

      if (pu.kind === "bread") {
        // instant “refill to 100%”
        S.light = Math.max(S.light, 1.0);
        S.msg = "🍞  Steady. Light restored.";
        S.msgT = 0.9;
      } else {
        // “150% light”
        S.light = S.lightMax;
        S.msg = "🥛  OVERFILLED. Keep going.";
        S.msgT = 0.9;
      }
      sfxPower();
    }
  }

  // regen logic
  const t = performance.now() / 1000;
  const calm = Math.abs(S.vy) < 260;
  const coasting = (t - S.lastFlapT) >= S.regenCoastGateSec;

  let regen = S.regenBasePerSec;
  if (calm && coasting) regen += S.regenCalmBonusPerSec;

  S.light = clamp(S.light + regen * dt, 0, S.lightMax);

  if (S.msgT > 0) S.msgT -= dt;
  if (S.msgT <= 0 && S.running) S.msg = "";

  if (S.light <= 0.0001) endRun();
}

function loop() {
  const now = performance.now();
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (S.running) update(dt);
  else updateDayNight();

  draw();
  requestAnimationFrame(loop);
}

// boot
(function init() {
  resizeCanvas();
})();
window.addEventListener("resize", resizeCanvas);

loadBest();

// Tap-to-start: stable starting position (no falling)
S.x = Math.round(window.innerWidth * 0.28);
S.y = Math.round(window.innerHeight * 0.45);
S.vy = 0;

resetRun();
S.running = false;
S.started = false;
S.msg = "Tap to start.";

loop();
