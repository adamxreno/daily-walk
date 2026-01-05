// =========================
// Utilities
// =========================
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function yyyymmddLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function prettyDateLocal() {
  const d = new Date();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dailySeedFromDate() {
  return parseInt(yyyymmddLocal(), 10);
}

// =========================
// DOM
// =========================
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const cardTitle = document.getElementById("cardTitle");
const cardMeta = document.getElementById("cardMeta");
const cardSub = document.getElementById("cardSub");
const verseText = document.getElementById("verseText");
const verseRef = document.getElementById("verseRef");
const shareBtn = document.getElementById("shareBtn");
const countdownPill = document.getElementById("countdownPill");
const continueBtn = document.getElementById("continueBtn");

// =========================
// Canvas sizing
// =========================
const state = {
  width: 0,
  height: 0,
  dpr: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
};

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  state.width = w;
  state.height = h;

  canvas.width = Math.floor(w * state.dpr);
  canvas.height = Math.floor(h * state.dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// =========================
// Game tuning (NO difficulty changes unless requested)
// =========================
const TUNE = {
  gravity: 1300,          // px/s^2
  thrust: -420,           // px/s impulse
  maxFall: 900,           // terminal velocity
  baseScroll: 240,        // px/s
  pipeW: 78,
  gapBase: 190,
  gapTightenPerScore: 0.8,
  spawnEvery: 1.25,       // seconds

  // IMPORTANT: prevent impossible starts
  initialPipes: 3,
  initialSpacing: 340,    // wide enough that first seconds feel fair
  minSpacing: 280,        // ensures no “double pipes glued together”

  // Light system
  lightStart: 1.0,
  lightDrainPerSec: 0.14,
  lightRegenOnPass: 0.14,
  lightDrainOnHit: 0.28,
  lightRegenCoastBonus: 0.08,
  tapLockMs: 40,

  // Day/Night
  dayEvery: 40,           // ✅ as requested
};

// =========================
// Game state
// =========================
const STORAGE = { best: "liiiiight_best_v1", daily: "liiiiight_daily_v1" };

const game = {
  running: false,
  started: false,
  ended: false,

  mode: "endless", // we keep endless play; daily verse is the ritual
  rng: Math.random,

  x: 0,
  y: 0,
  vy: 0,
  r: 14,

  scroll: TUNE.baseScroll,
  pipes: [],
  passed: new Set(),
  pipeId: 0,

  spawnTimer: 0,
  score: 0,
  best: 0,

  // light + input pacing
  light: TUNE.lightStart,
  lastTapAt: -999,
  lastHitAt: -999,

  // background stars (stable positions)
  stars: [],
};

function loadBest() {
  const v = parseInt(localStorage.getItem(STORAGE.best) || "0", 10);
  game.best = Number.isFinite(v) ? v : 0;
}
function saveBest() {
  localStorage.setItem(STORAGE.best, String(game.best));
}

function initStars() {
  // Create stable starfield so it doesn't "sparkle" randomly every frame
  const seed = dailySeedFromDate() + 1337;
  const r = mulberry32(seed);
  game.stars = [];
  for (let i = 0; i < 110; i++) {
    game.stars.push({
      x: Math.floor(r() * state.width),
      y: Math.floor(r() * state.height),
      a: 0.15 + r() * 0.55,
      s: r() < 0.88 ? 1 : 2
    });
  }
}

function resetRun() {
  game.running = false;
  game.started = false;
  game.ended = false;

  game.pipes = [];
  game.passed.clear();
  game.pipeId = 0;

  game.spawnTimer = 0;
  game.score = 0;

  game.x = Math.round(state.width * 0.28);
  game.y = Math.round(state.height * 0.45);
  game.vy = 0;

  game.light = TUNE.lightStart;
  game.lastTapAt = -999;
  game.lastHitAt = -999;

  game.scroll = TUNE.baseScroll;

  // Seed RNG for "daily feel" consistency if you ever want to turn it on.
  // Right now obstacle layout is just normal random; daily ritual is the verse.
  game.rng = Math.random;

  // create initial pipes with safe spacing
  for (let i = 0; i < TUNE.initialPipes; i++) {
    spawnPipe(state.width + i * TUNE.initialSpacing);
  }
}

loadBest();
initStars();
resetRun();

// =========================
// Verses (WEB public domain)
// Built-in list for now; deterministic daily pick.
// =========================
const WEB_VERSES = [
  {
    ref: "Psalms 46:1",
    text: "God is our refuge and strength,\na very present help in trouble."
  },
  {
    ref: "Psalms 34:18",
    text: "Yahweh is near to those who have a broken heart,\nand saves those who have a crushed spirit."
  },
  {
    ref: "Matthew 11:28",
    text: "“Come to me, all you who labor and are heavily burdened,\nand I will give you rest.”"
  },
  {
    ref: "Isaiah 41:10",
    text: "Don’t you be afraid, for I am with you.\nDon’t be dismayed, for I am your God.\nI will strengthen you.\nYes, I will help you.\nYes, I will uphold you with the right hand of my righteousness."
  },
  {
    ref: "Philippians 4:6",
    text: "In nothing be anxious,\nbut in everything,\nby prayer and petition with thanksgiving,\nlet your requests be made known to God."
  },
  {
    ref: "John 16:33",
    text: "“In the world you have oppression;\nbut cheer up!\nI have overcome the world.”"
  },
];

function pickDailyVerse() {
  const seed = dailySeedFromDate();
  const r = mulberry32(seed);
  const idx = Math.floor(r() * WEB_VERSES.length);
  return WEB_VERSES[idx];
}

// =========================
// End card + sharing
// =========================
function openEndCard() {
  overlay.style.display = "flex";
  overlay.setAttribute("aria-hidden", "false");

  cardTitle.textContent = "It’s okay, try again.";
  cardMeta.textContent = "Here’s your daily verse 👍🏼";
  cardSub.textContent = prettyDateLocal();

  const v = pickDailyVerse();
  verseText.textContent = v.text;
  verseRef.textContent = v.ref;

  // Countdown -> Continue appears in the same right-side slot
  startCountdown(5);

  // Share behavior
  shareBtn.onclick = () => {
    const url = "https://adamxreno.github.io/daily-walk/";
    const msg = `I love this new game and think you will too!! 👀 ${url}`;

    // Use Web Share API if possible (mobile)
    if (navigator.share) {
      navigator.share({ text: msg, url }).catch(() => {});
      return;
    }

    // Otherwise open SMS-style fallback (iOS/Android may handle)
    const sms = `sms:&body=${encodeURIComponent(msg)}`;
    window.location.href = sms;
  };

  continueBtn.onclick = () => {
    overlay.style.display = "none";
    overlay.setAttribute("aria-hidden", "true");
    resetRun();
    // stay on "tap to start"
    requestAnimationFrame(frame);
  };
}

function startCountdown(seconds) {
  countdownPill.style.display = "inline-flex";
  continueBtn.style.display = "none";

  let t = seconds;
  countdownPill.textContent = `Continue in ${t}s`;

  const iv = setInterval(() => {
    t -= 1;
    if (t <= 0) {
      clearInterval(iv);
      countdownPill.style.display = "none";
      continueBtn.style.display = "inline-flex";
    } else {
      countdownPill.textContent = `Continue in ${t}s`;
    }
  }, 1000);
}

// =========================
// Obstacles
// =========================
function spawnPipe(x) {
  const gap = clamp(TUNE.gapBase - game.score * TUNE.gapTightenPerScore, 132, TUNE.gapBase);
  const margin = 70;

  // pick a center safely
  const minY = margin + gap * 0.35;
  const maxY = state.height - margin - gap * 0.35;
  const centerY = minY + (maxY - minY) * game.rng();

  const p = {
    id: game.pipeId++,
    x,
    w: TUNE.pipeW,
    gapY: centerY,
    gapH: gap,
  };

  // enforce spacing: never allow pipes to spawn glued together
  const last = game.pipes[game.pipes.length - 1];
  if (last) {
    const minX = last.x + Math.max(TUNE.minSpacing, last.w + 60);
    p.x = Math.max(p.x, minX);
  }

  game.pipes.push(p);
}

function updatePipes(dt) {
  const speed = game.scroll;
  for (const p of game.pipes) p.x -= speed * dt;

  // spawn timer
  game.spawnTimer += dt;
  if (game.spawnTimer >= TUNE.spawnEvery) {
    game.spawnTimer -= TUNE.spawnEvery;
    spawnPipe(state.width + 20);
  }

  // cleanup
  game.pipes = game.pipes.filter(p => p.x + p.w > -30);
}

// =========================
// Input
// =========================
function flap() {
  const now = performance.now();
  if (now - game.lastTapAt < TUNE.tapLockMs) return;
  game.lastTapAt = now;

  // Start gate: first tap starts the run (ball doesn't drop immediately)
  if (!game.started && !game.ended) {
    game.started = true;
    game.running = true;
    game.vy = 0;
    return;
  }

  if (!game.running) return;

  game.vy = TUNE.thrust;
  // tiny light regen for "steady calm taps"
  game.light = clamp(game.light + 0.01, 0, 1);
}

window.addEventListener("pointerdown", flap);
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    flap();
  }
});

// =========================
// Rendering helpers
// =========================
function drawNightBackground() {
  // base
  ctx.fillStyle = "#0b0f14";
  ctx.fillRect(0, 0, state.width, state.height);

  // vignette
  const g = ctx.createRadialGradient(
    state.width * 0.65, state.height * 0.45, 40,
    state.width * 0.65, state.height * 0.45, Math.max(state.width, state.height)
  );
  g.addColorStop(0, "rgba(255,255,255,0.05)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, state.width, state.height);

  // stars
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  for (const s of game.stars) {
    ctx.globalAlpha = s.a;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;
}

function drawDayBackground() {
  // keep same style but clearly "day"
  ctx.fillStyle = "#cfd6dc";
  ctx.fillRect(0, 0, state.width, state.height);

  // warm glow from top-left (obvious)
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, state.width * 1.2);
  glow.addColorStop(0, "rgba(255,235,195,0.95)");
  glow.addColorStop(0.25, "rgba(255,235,195,0.40)");
  glow.addColorStop(1, "rgba(255,235,195,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, state.width, state.height);

  // subtle vignette to keep the vibe
  const v = ctx.createRadialGradient(
    state.width * 0.7, state.height * 0.45, 40,
    state.width * 0.7, state.height * 0.45, Math.max(state.width, state.height)
  );
  v.addColorStop(0, "rgba(255,255,255,0.10)");
  v.addColorStop(1, "rgba(0,0,0,0.08)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, state.width, state.height);
}

function isDay() {
  return Math.floor(game.score / TUNE.dayEvery) % 2 === 1;
}

function drawPipes() {
  // Clean, solid shapes—no outline artifacts
  ctx.fillStyle = "rgba(0,0,0,0.92)";
  for (const p of game.pipes) {
    const gapTop = p.gapY - p.gapH / 2;
    const gapBot = p.gapY + p.gapH / 2;

    // Top block
    roundRect(p.x, 0, p.w, gapTop, 14);
    // Bottom block
    roundRect(p.x, gapBot, p.w, state.height - gapBot, 14);
  }
}

function roundRect(x, y, w, h, r) {
  if (h <= 0 || w <= 0) return;
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  ctx.fill();
}

function drawPlayer() {
  // glow bubble
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.arc(game.x, game.y, 44, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.globalAlpha = 1;

  // ball
  ctx.beginPath();
  ctx.arc(game.x, game.y, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
}

function drawHUD() {
  // Score + Best
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "700 20px system-ui";
  ctx.fillText(`Score: ${game.score}`, 20, 36);

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "600 16px system-ui";
  ctx.fillText(`Best: ${game.best}`, 20, 62);

  // Light bar under logo area, left side
  const barX = 20, barY = 82, barW = 320, barH = 14;

  ctx.fillStyle = "rgba(255,255,255,0.20)";
  ctx.fillRect(barX, barY, barW, barH);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillRect(barX, barY, barW * clamp(game.light, 0, 1), barH);

  // Label under the bar (so it doesn't collide with logo)
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 16px system-ui";
  ctx.fillText("Light", barX, barY + 32);
}

function drawTapToStart() {
  // clean text, NO gradient panel
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "900 56px system-ui";
  ctx.fillText("Tap to start", state.width * 0.5, state.height * 0.70);

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "700 18px system-ui";
  ctx.fillText("Spacebar works too 🫣", state.width * 0.5, state.height * 0.76);
  ctx.textAlign = "left";
}

// =========================
// Collisions + scoring
// =========================
function hitPipe(p) {
  const gapTop = p.gapY - p.gapH / 2;
  const gapBot = p.gapY + p.gapH / 2;

  const px = game.x, py = game.y, pr = game.r;
  const withinX = px + pr > p.x && px - pr < p.x + p.w;

  if (!withinX) return false;
  // collide if outside gap
  return (py - pr < gapTop) || (py + pr > gapBot);
}

function passedPipe(p) {
  // passing occurs when right edge is behind player
  return (p.x + p.w) < (game.x - 2);
}

// =========================
// Main update loop
// =========================
let lastT = performance.now();

function frame(t) {
  const dt = clamp((t - lastT) / 1000, 0, 0.033);
  lastT = t;

  // background
  if (isDay()) drawDayBackground();
  else drawNightBackground();

  // HUD
  drawHUD();

  // Not started: hold ball in place, show "Tap to start"
  if (!game.started && !game.ended) {
    drawPlayer();
    drawTapToStart();
    requestAnimationFrame(frame);
    return;
  }

  // If ended, stop rendering game loop (overlay handles restart)
  if (game.ended) {
    requestAnimationFrame(frame);
    return;
  }

  // physics
  if (game.running) {
    game.vy += TUNE.gravity * dt;
    game.vy = Math.min(game.vy, TUNE.maxFall);
    game.y += game.vy * dt;

    // light drain (less drain if player is calm/not tapping constantly)
    const now = performance.now();
    const calm = (now - game.lastTapAt) > 500;
    const drain = TUNE.lightDrainPerSec - (calm ? TUNE.lightRegenCoastBonus : 0);
    game.light -= drain * dt;

    // update pipes
    updatePipes(dt);

    // collisions + scoring
    for (const p of game.pipes) {
      if (hitPipe(p)) {
        // hit: drain light a chunk, but don't end instantly unless light runs out
        game.light -= TUNE.lightDrainOnHit;
        game.lastHitAt = now;

        // small “bounce” feel
        game.vy *= -0.25;

        // If light out, end
        if (game.light <= 0) {
          endRun();
          break;
        }
      }

      if (!game.passed.has(p.id) && passedPipe(p)) {
        game.passed.add(p.id);
        game.score += 1;

        // regen a bit on pass
        game.light = clamp(game.light + TUNE.lightRegenOnPass, 0, 1);

        // best
        if (game.score > game.best) {
          game.best = game.score;
          saveBest();
        }
      }
    }

    // off-screen / light out ends
    if (game.y < -40 || game.y > state.height + 40 || game.light <= 0) {
      endRun();
    }
  }

  // draw obstacles + player
  drawPipes();
  drawPlayer();

  requestAnimationFrame(frame);
}

function endRun() {
  if (game.ended) return;
  game.running = false;
  game.ended = true;

  // open end card ritual
  openEndCard();
}

// Start loop
requestAnimationFrame(frame);
