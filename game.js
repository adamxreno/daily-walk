// Daily Walk — WEB Daily Verse (no translation shown) + Send to Friends + 5s Lock + Guaranteed Pipe Spacing

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

// ---------- Utilities ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// UTC date so everyone shares the same daily verse
function yyyymmddUTC() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
function dailySeedFromUTCDate() {
  return parseInt(yyyymmddUTC(), 10);
}
function formatDateUTCShort() {
  const d = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const m = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const y = d.getUTCFullYear();
  return `${m} ${day}, ${y}`;
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

// WEB verses (public domain) — short + uplifting
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
  const seed = dailySeedFromUTCDate();
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
  dateTextEl.textContent = formatDateUTCShort();

  // Verse text + reference on its own line (no translation shown)
  verseTextEl.textContent = `${v.text}\n\n${v.ref}`;

  cardTitleEl.textContent = "It’s okay, try again.";
  resultText.textContent = `Score: ${score} • Best: ${best}`;
  shareStatus.textContent = "";

  // Lock Continue for 5 seconds
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
    // Countdown disappears, Continue appears in SAME spot (right side)
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
const GAME_URL = "https://adamxreno.github.io/daily-walk/";
function buildInviteMessage() {
  return `I love this new game and think you will too!! 👀 ${GAME_URL}`;
}

async function sendToFriends() {
  const text = buildInviteMessage();

  if (navigator.share) {
    try {
      await navigator.share({ text, url: GAME_URL, title: "Daily Walk" });
      shareStatus.textContent = "";
      return;
    } catch {
      // user cancelled or browser blocked — fall through
    }
  }

  // Fallback: open SMS composer
  const smsUrl = `sms:&body=${encodeURIComponent(text)}`;
  const opened = window.open(smsUrl, "_self");

  // Last fallback: copy
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
  running: true,
  x: 0, y: 0, vy: 0, r: 12,

  gravity: 1350,
  thrust: -420,
  maxFall: 900,

  baseScroll: 240,
  scroll: 240,

  light: 1,
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

  msg: "Tap / Space to rise. Stay steady.",
  msgT: 2.0,
  lastHitT: -999,

  lastRunScore: 0,
};

function loadBest() {
  const v = parseInt(localStorage.getItem("dailywalk_best_v1") || "0", 10);
  S.best = Number.isFinite(v) ? v : 0;
}
function saveBest() {
  localStorage.setItem("dailywalk_best_v1", String(S.best));
}

function resetRun() {
  S.x = Math.round(window.innerWidth * 0.28);
  S.y = Math.round(window.innerHeight * 0.45);
  S.vy = 0;

  S.light = 1;
  S.scroll = S.baseScroll;

  S.pipes = [];
  S.passed.clear();
  S.score = 0;
  S.lastGapY = null;

  S.msg = "Tap / Space to rise. Stay steady.";
  S.msgT = 2.0;
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

  S.pipes.push({ id: S.pipeId++, x, w: S.pipeW, gapY, gapH: gap });
}

function circleRectCollide(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

function hit() {
  const t = performance.now() / 1000;
  if (t - S.lastHitT < 0.2) return;
  S.lastHitT = t;

  S.light = clamp(S.light - S.drainOnHit, 0, 1);
  S.vy *= 0.72;

  S.msg = "You slipped. Try again steady.";
  S.msgT = 1.0;

  if (S.light <= 0.001) endRun();
}

function endRun() {
  S.running = false;
  S.lastRunScore = S.score;

  if (S.score > S.best) {
    S.best = S.score;
    saveBest();
  }

  showVerseOverlay({ score: S.score, best: S.best });
}

function flap() {
  if (!verseOverlay.classList.contains("hidden")) return;
  if (!S.running) return;

  const t = performance.now() / 1000;
  S.lastFlapT = t;

  const strength = 0.88 + 0.28 * S.light;
  S.vy = S.thrust * strength;
}

window.addEventListener("pointerdown", () => flap());
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    flap();
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

function draw() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.fillStyle = "#171b22";
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "white";
  for (let i = 0; i < 24; i++) {
    const x = (i * 97 + Math.floor(performance.now() / 30)) % w;
    const y = (i * 53) % h;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  for (const p of S.pipes) {
    const gapTop = p.gapY - p.gapH / 2;
    const gapBot = p.gapY + p.gapH / 2;
    roundRectFill(p.x, 0, p.w, gapTop, 12, "rgba(0,0,0,0.72)");
    roundRectFill(p.x, gapBot, p.w, h - gapBot, 12, "rgba(0,0,0,0.72)");
  }

  const glow = 16 + 30 * S.light;
  const alpha = 0.20 + 0.55 * S.light;

  ctx.beginPath();
  ctx.arc(S.x, S.y, glow, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.12})`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(S.x, S.y, S.r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fill();

  ctx.font = "700 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(`Score: ${S.score}`, 14, 26);

  ctx.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillText(`Best: ${S.best}`, 14, 44);

  const bx = 14, by = 56, bw = 160, bh = 10;
  roundRectFill(bx, by, bw, bh, 999, "rgba(255,255,255,0.12)");
  roundRectFill(bx, by, bw * S.light, bh, 999, `rgba(255,255,255,${0.22 + 0.65 * S.light})`);
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillText("Light", bx + bw + 10, by + 10);

  if (S.msg && verseOverlay.classList.contains("hidden")) {
    ctx.font = "700 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.fillText(S.msg, 14, 86);
  }

  ctx.globalAlpha = 0.18;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(0,0,0,0.16)");
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
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
  S.scroll = target * (0.82 + 0.18 * S.light);

  for (const p of S.pipes) p.x -= S.scroll * dt;
  S.pipes = S.pipes.filter(p => p.x + p.w > -140);

  ensurePipesAhead();

  S.vy += S.gravity * dt;
  S.vy = clamp(S.vy, -1200, S.maxFall);
  S.y += S.vy * dt;

  if (S.y < S.r) {
    S.y = S.r;
    S.vy *= -0.25;
    hit();
  }
  if (S.y > h - S.r) {
    S.y = h - S.r;
    hit();
  }

  for (const p of S.pipes) {
    const gapTop = p.gapY - p.gapH / 2;
    const gapBot = p.gapY + p.gapH / 2;

    const hitTop = circleRectCollide(S.x, S.y, S.r, p.x, 0, p.w, gapTop);
    const hitBot = circleRectCollide(S.x, S.y, S.r, p.x, gapBot, p.w, h - gapBot);
    if (hitTop || hitBot) hit();

    if (!S.passed.has(p.id) && p.x + p.w < S.x - S.r) {
      S.passed.add(p.id);
      S.score += 1;
    }
  }

  const t = performance.now() / 1000;
  const calm = Math.abs(S.vy) < 260;
  const coasting = (t - S.lastFlapT) >= S.regenCoastGateSec;

  let regen = S.regenBasePerSec;
  if (calm && coasting) regen += S.regenCalmBonusPerSec;

  S.light = clamp(S.light + regen * dt, 0, 1);

  if (S.msgT > 0) S.msgT -= dt;
  if (S.msgT <= 0 && S.running) S.msg = "";

  if (S.light <= 0.0001) endRun();
}

function loop() {
  const now = performance.now();
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (S.running) update(dt);
  draw();
  requestAnimationFrame(loop);
}

loadBest();
resetRun();
loop();
