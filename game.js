const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

let y = canvas.height / 2;
let velocity = 0;

const gravity = 0.6;
const lift = -10;

function loop() {
  velocity += gravity;
  y += velocity;

  if (y > canvas.height) {
    y = canvas.height;
    velocity = 0;
  }
  if (y < 0) {
    y = 0;
    velocity = 0;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(150, y, 12, 0, Math.PI * 2);
  ctx.fill();

  requestAnimationFrame(loop);
}
loop();

window.addEventListener("pointerdown", () => {
  velocity = lift;
});
