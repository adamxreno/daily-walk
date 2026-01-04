// Daily Walk (MVP) — Dark/Star vibe, slightly lifted background
// Tap/Space to rise. Avoid darkness. Light dims on contact. Light restores with calm flying.

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

// ---------- helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function resize() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// ---------- state ----------
const S = {
  running: true,

  // player
  x: Math.round(window.innerWidth * 0.28),
  y: Math.round(window.innerHeight * 0.45),
  vy: 0,
  r: 12,

  // physics
  gravity: 1350,
  thrust: -420,
  maxFall: 900,

  // scrolling
  baseScroll: 240,
  scroll: 240,

  // light
  light: 1,
  drainOnHit: 0.28,
  regenPerSec: 0.14,
  coastBonusPerSec: 0.10,

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

  // message
  msg: "Tap / Space to rise. Stay steady.",
  msgT: 2.5,
  lastHitT: -999,
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
  S.spawnTimer = 0;
  S.score = 0;

  S.msg = "Tap / Space to rise. Stay steady.";
  S.msgT = 2.0;
  S.lastHitT = -999;

  for (let i = 0; i < 3; i++) spawnPipe(window.innerWidth + i * 260);
}

function spawnPipe(x) {
  const h = window.innerHeight;

  const gap = clamp(S.gapBase - S.score * 0.8, 132, S.gapBase);
  const margin = 70;

  const minY = margin + gap * 0.35;
  const maxY = h - margin - gap * 0.35;
  const gapY = minY + (maxY - minY) * Math.random();

  S.pipes.push({
    id: S.pipeId++,
    x,
    w: S.pipeW,
    gapY,
    gapH: gap,
  });
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

  if (S.light <= 0.001) endRun("Your light faded.");
}

function endRun(reason) {
  S.running = false;

  if (S.score > S.best) {
    S.best = S.score;
    saveBest();
  }

  S.msg = `${reason}  Score: ${S.score}  Best: ${S.best}  (Tap to restart)`;
  S.msgT = 999;
}

function flap() {
  if (!S.running) {
    S.running = true;
    resetRun();
    return;
  }
  const strength = 0.88 + 0.28 * S.light;
  S.vy = S.thrust * strength;
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
    S.running = true;
    resetRun();
  }
});

// ---------- drawing ----------
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

  // background (slightly lifted, same vibe)
  ctx.fillStyle = "#14171d";
  ctx.fillRect(0, 0, w, h);

  // stars (same feel)
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "white";
  for (let i = 0; i < 24; i++) {
    const x = (i * 97 + Math.floor(performance.now() / 30)) % w;
    const y = (i * 53) % h;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  // pipes (darkness) — slightly lighter than pure black, with subtle rim
  for (const p of S.pipes) {
    const gapTop = p.gapY - p.gapH / 2;
    const gapBot = p.gapY + p.gapH / 2;

    roundRectFill(p.x, 0, p.w, gapTop, 12, "rgba(0,0,0,0.78)");
    roundRectFill(p.x, gapBot, p.w, h - gapBot, 12, "rgba(0,0,0,0.78)");

    // subtle rim (helps visibility)
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x + 1, 1, p.w - 2, gapTop - 2);
    ctx.strokeRect(p.x + 1, gapBot + 1, p.w - 2, (h - gapBot) - 2);
  }

  // player glow
  const glow = 16 + 30 * S.light;
  const alpha = 0.20 + 0.55 * S.light;

  ctx.beginPath();
  ctx.arc(S.x, S.y, glow, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.12})`;
  ctx.fill();

  // player body
  ctx.beginPath();
  ctx.arc(S.x, S.y, S.r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fill();

  // HUD
  ctx.font = "700 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(`Score: ${S.score}`, 14, 26);

  ctx.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillText(`Best: ${S.best}`, 14, 44);

  // light bar
  const bx = 14, by = 56, bw = 160, bh = 10;
  roundRectFill(bx, by, bw, bh, 999, "rgba(255,255,255,0.12)");
  roundRectFill(bx, by, bw * S.light, bh, 999, `rgba(255,255,255,${0.22 + 0.65 * S.light})`);
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.fillText("Light", bx + bw + 10, by + 10);

  // message
  if (S.msg) {
    ctx.font = "700 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.fillText(S.msg, 14, 86);
  }

  // vignette (kept subtle)
  ctx.globalAlpha = 0.18;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(0,0,0,0.16)");
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
}

// ---------- loop ----------
let last = performance.now();

function update(dt) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // scroll
  const target = S.baseScroll + S.score * 5.5;
  S.scroll = target * (0.78 + 0.22 * S.light);

  // player
  S.vy += S.gravity * dt;
  S.vy = clamp(S.vy, -1200, S.maxFall);
  S.y += S.vy * dt;

  // bounds = slip (not instant death)
  if (S.y < S.r) {
    S.y = S.r;
    S.vy *= -0.25;
    hit();
  }
  if (S.y > h - S.r) {
    S.y = h - S.r;
    hit();
  }

  // spawn
  S.spawnTimer += dt;
  if (S.spawnTimer >= S.spawnEvery) {
    S.spawnTimer = 0;
    spawnPipe(w + 40);
  }

  // move pipes
  for (const p of S.pipes) p.x -= S.scroll * dt;
  S.pipes = S.pipes.filter(p => p.x + p.w > -60);

  // collisions + scoring
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

  // light regen (reward calm)
  const calm = Math.abs(S.vy) < 260;
  const regenRate = S.regenPerSec + (calm ? S.coastBonusPerSec : 0);
  S.light = clamp(S.light + regenRate * dt, 0, 1);

  if (S.msgT > 0) S.msgT -= dt;
  if (S.msgT <= 0 && S.running) S.msg = "";

  if (S.light <= 0.0001) endRun("Your light faded.");
}

function loop() {
  const now = performance.now();
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (S.running) update(dt);
  draw();
  requestAnimationFrame(loop);
}

// boot
loadBest();
resetRun();
loop();
