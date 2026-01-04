// Daily Walk (MVP)
// - One-tap flappy-style control
// - "Sin" obstacles as matte-black pillars
// - No instant death on contact: light dims, controls get harder
// - Light restores with calm, clean flying
// - Endless mode

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

// ---------- helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function resize() {
  // Match CSS-scaled size
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);

// ---------- game state ----------
const state = {
  // player
  x: 0,
  y: 0,
  vy: 0,
  r: 12,

  // physics
  gravity: 1350,      // px/s^2
  thrust: -420,       // px/s impulse
  maxFall: 900,

  // scrolling
  baseScroll: 240,    // px/s
  scroll: 240,

  // light system
  light: 1.0,             // 0..1
  drainOnHit: 0.28,        // per hit
  regenPerSec: 0.14,       // base regen
  coastBonusPerSec: 0.10,  // regen bonus when calm

  // obstacles
  pipes: [],
  pipeW: 78,
  gapBase: 190,
  spawnEvery: 1.25,
  spawnTimer: 0,
  pipeId: 0,

  // score
  score: 0,
  best: 0,
  passed: new Set(),

  // messaging
  msg: "",
  msgT: 0,
  lastHitT: -999,

  // input
  running: true,
};

function loadBest() {
  const v = parseInt(localStorage.getItem("dailywalk_best_v1") || "0", 10);
  state.best = Number.isFinite(v) ? v : 0;
}
function saveBest() {
  localStorage.setItem("dailywalk_best_v1", String(state.best));
}

// ---------- init ----------
function reset() {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;

  state.x = Math.round(w * 0.28);
  state.y = Math.round(h * 0.45);
  state.vy = 0;

  state.light = 1.0;
  state.scroll = state.baseScroll;

  state.pipes = [];
  state.passed.clear();
  state.spawnTimer = 0;
  state.score = 0;

  state.msg = "Tap to rise. Stay steady.";
  state.msgT = 2.0;
  state.lastHitT = -999;

  // seed a few pipes so it starts immediately
  for (let i = 0; i < 3; i++) spawnPipe(w + i * 260);
}

function spawnPipe(x) {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;

  // slightly tighten with score (subtle)
  const gap = clamp(state.gapBase - state.score * 0.8, 132, state.gapBase);
  const margin = 70;

  const minY = margin + gap * 0.35;
  const maxY = h - margin - gap * 0.35;
  const gapY = minY + (maxY - minY) * Math.random();

  state.pipes.push({
    id: state.pipeId++,
    x,
    w: state.pipeW,
    gapY,
    gapH: gap,
  });
}

// ---------- collision ----------
function circleRectCollide(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

function hit() {
  const t = performance.now() / 1000;
  if (t - state.lastHitT < 0.2) return; // prevent multi-hit spam
  state.lastHitT = t;

  state.light = clamp(state.light - state.drainOnHit, 0, 1);
  state.vy *= 0.72;

  state.msg = "You slipped. Try again steady.";
  state.msgT = 1.1;

  if (state.light <= 0.001) {
    endRun("Your light faded.");
  }
}

function endRun(reason) {
  state.running = false;
  if (state.score > state.best) {
    state.best = state.score;
    saveBest();
  }

  // simple overlay text
  state.msg = `${reason}  Score: ${state.score}  Best: ${state.best}  (Tap to restart)`;
  state.msgT = 999;
}

// ---------- input ----------
function flap() {
  if (!state.running) {
    state.running = true;
    reset();
    return;
  }

  // thrust is weaker when light is low
  const strength = 0.88 + 0.28 * state.light;
  state.vy = state.thrust * strength;
}

window.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  flap();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    flap();
  }
  if (e.key.toLowerCase() === "r") {
    e.preventDefault();
    state.running = true;
    reset();
  }
});

// ---------- drawing ----------
function roundRectFill(x, y, w, h, r, fillStyle) {
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
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;

  // background
  ctx.clearRect(0, 0, w, h);

  // stars (subtle)
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "white";
  for (let i = 0; i < 24; i++) {
    const x = (i * 97 + Math.floor(performance.now() / 30)) % w;
    const y = (i * 53) % h;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  // pipes (sin / darkness)
  for (const p of state.pipes) {
    const gapTop = p.gapY - p.gapH / 2;
    const gapBot = p.gapY + p.gapH / 2;

    roundRectFill(p.x, 0, p.w, gapTop, 10, "rgba(0,0,0,0.78)");
    roundRectFill(p.x, gapBot, p.w, h - gapBot, 10, "rgba(0,0,0,0.78)");

    // subtle rim
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x + 1, 1, p.w - 2, gapTop - 2);
    ctx.strokeRect(p.x + 1, gapBot + 1, p.w - 2, (h - gapBot) - 2);
  }

  // player glow
  const glow = 18 + 34 * state.light;
  const alpha = 0.25 + 0.55 * state.light;

  ctx.beginPath();
  ctx.arc(state.x, state.y, glow, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.12})`;
  ctx.fill();

  // player body
  ctx.beginPath();
  ctx.arc(state.x, state.y, state.r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fill();

  // score + best
  ctx.font = "700 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`Score: ${state.score}`, 14, 26);
  ctx.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillStyle = "rgba(255,255,255,0.60)";
  ctx.fillText(`Best: ${state.best}`, 14, 44);

  // light bar
  const bx = 14, by = 56, bw = 160, bh = 10;
  roundRectFill(bx, by, bw, bh, 999, "rgba(255,255,255,0.10)");
  roundRectFill(bx, by, bw * state.light, bh, 999, `rgba(255,255,255,${0.20 + 0.65 * state.light})`);
  ctx.fillStyle = "rgba(255,255,255,0.60)";
  ctx.fillText(`Light`, bx + bw + 10, by + 10);

  // message
  if (state.msg) {
    ctx.font = "700 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText(state.msg, 14, 86);
  }

  // vignette
  ctx.globalAlpha = 0.22;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(0,0,0,0.20)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
}

// ---------- loop ----------
let last = performance.now();

function update(dt) {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;

  // dynamic scroll (slightly faster as score rises, softened by low light)
  const target = state.baseScroll + state.score * 5.5;
  state.scroll = target * (0.78 + 0.22 * state.light);

  // player physics
  state.vy += state.gravity * dt;
  state.vy = clamp(state.vy, -1200, state.maxFall);
  state.y += state.vy * dt;

  // bounds (no instant death; it counts as a slip)
  if (state.y < state.r) {
    state.y = state.r;
    state.vy *= -0.25;
    hit();
  }
  if (state.y > h - state.r) {
    state.y = h - state.r;
    hit();
  }

  // spawn pipes
  state.spawnTimer += dt;
  if (state.spawnTimer >= state.spawnEvery) {
    state.spawnTimer = 0;
    spawnPipe(w + 40);
  }

  // move pipes
  for (const p of state.pipes) p.x -= state.scroll * dt;
  state.pipes = state.pipes.filter(p => p.x + p.w > -60);

  // collisions + scoring
  for (const p of state.pipes) {
    const gapTop = p.gapY - p.gapH / 2;
    const gapBot = p.gapY + p.gapH / 2;

    const hitTop = circleRectCollide(state.x, state.y, state.r, p.x, 0, p.w, gapTop);
    const hitBot = circleRectCollide(state.x, state.y, state.r, p.x, gapBot, p.w, h - gapBot);

    if (hitTop || hitBot) hit();

    // score when passed
    if (!state.passed.has(p.id) && p.x + p.w < state.x - state.r) {
      state.passed.add(p.id);
      state.score += 1;
    }
  }

  // light regen (reward calm)
  const calm = Math.abs(state.vy) < 260;
  const regenRate = state.regenPerSec + (calm ? state.coastBonusPerSec : 0);
  state.light = clamp(state.light + regenRate * dt, 0, 1);

  // message decay
  if (state.msgT > 0) state.msgT -= dt;
  if (state.msgT <= 0 && state.running) state.msg = "";

  // fail-safe
  if (state.light <= 0.0001) endRun("Your light faded.");
}

function loop() {
  const now = performance.now();
  const dt = Math.min(0.033, (now - last) / 100
