// ========== CANVAS RENDERING ==========
// Pure drawing: the perspective highway, notes, hit zone, cowbell, crowd and
// particles. No game logic lives here — game.js drives it from render().

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Viewers who ask for less motion get no screen shake and no particles.
const REDUCED_MOTION = window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let particles = [];
let screenShake = 0;

// Full-screen gradients depend only on canvas size, so build them once per
// resize instead of allocating three or four per frame.
let gradients = null;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  buildGradients();
}
window.addEventListener('resize', resizeCanvas);

function buildGradients() {
  if (!ctx) return;
  const m = getHighwayMetrics();

  const fill = ctx.createLinearGradient(0, m.horizonY, 0, m.h);
  fill.addColorStop(0, 'rgba(30,15,8,0.4)');
  fill.addColorStop(0.7, 'rgba(50,25,12,0.7)');
  fill.addColorStop(1, 'rgba(70,35,18,0.85)');

  const edge = (rgb) => {
    const g = ctx.createLinearGradient(0, m.horizonY, 0, m.h);
    g.addColorStop(0, `rgba(${rgb},0.2)`);
    g.addColorStop(1, `rgba(${rgb},0.95)`);
    return g;
  };
  const hitZone = (alpha) => {
    const g = ctx.createRadialGradient(m.centerX, m.hitY, 10, m.centerX, m.hitY, m.hitWidth * 1.2);
    g.addColorStop(0, `rgba(255,215,0,${alpha})`);
    g.addColorStop(1, 'rgba(255,215,0,0)');
    return g;
  };
  const feverOverlay = ctx.createLinearGradient(0, 0, 0, m.h);
  feverOverlay.addColorStop(0, 'rgba(255,215,0,0.05)');
  feverOverlay.addColorStop(1, 'rgba(255,153,51,0.12)');

  gradients = {
    highwayFill: fill,
    highwayEdge: { normal: edge('244,180,26'), fever: edge('255,215,0') },
    hitZoneRadial: { normal: hitZone(0.35), fever: hitZone(0.5) },
    feverOverlay,
  };
}

function getHighwayMetrics() {
  const w = canvas.width, h = canvas.height;
  const horizonY = h * 0.22;
  const roadTopWidth = Math.max(60, w * 0.05);
  const roadBottomWidth = Math.min(w * 0.55, 540);
  const hitY = h - 110;
  const centerX = w / 2;
  const hitWidth = roadBottomWidth * 0.78;
  return { w, h, horizonY, roadTopWidth, roadBottomWidth, hitY, centerX, hitWidth };
}

function getNotePosition(noteTime, currentTime) {
  const m = getHighwayMetrics();
  const lookahead = TUNING.lookahead;
  const td = noteTime - currentTime;
  if (td > lookahead || td < -0.5) return null;
  const progress = 1 - (td / lookahead);
  if (progress < 0 || progress > 1.15) return null;
  const t = progress;
  const y = m.horizonY + (m.hitY - m.horizonY) * t * t;
  const size = 10 + 32 * t;
  const alpha = Math.min(1, t * 1.8);
  return { x: m.centerX, y, size, alpha, progress: t };
}

function drawHighway(ctx, m) {
  ctx.fillStyle = gradients.highwayFill;
  ctx.beginPath();
  ctx.moveTo(m.centerX - m.roadTopWidth/2, m.horizonY);
  ctx.lineTo(m.centerX + m.roadTopWidth/2, m.horizonY);
  ctx.lineTo(m.centerX + m.roadBottomWidth/2, m.h);
  ctx.lineTo(m.centerX - m.roadBottomWidth/2, m.h);
  ctx.closePath(); ctx.fill();

  ctx.strokeStyle = game.feverActive ? gradients.highwayEdge.fever : gradients.highwayEdge.normal;
  ctx.lineWidth = 3;
  ctx.shadowColor = game.feverActive ? '#ffd700' : '#f4b41a';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(m.centerX - m.roadTopWidth/2, m.horizonY);
  ctx.lineTo(m.centerX - m.roadBottomWidth/2, m.h);
  ctx.moveTo(m.centerX + m.roadTopWidth/2, m.horizonY);
  ctx.lineTo(m.centerX + m.roadBottomWidth/2, m.h);
  ctx.stroke(); ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(244,180,26,0.15)'; ctx.lineWidth = 1;
  ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.moveTo(m.centerX, m.horizonY); ctx.lineTo(m.centerX, m.h); ctx.stroke();
  ctx.setLineDash([]);
}

function drawBeatLines(ctx, m) {
  if (game.state !== 'playing') return;
  if (!game.currentSong) return;
  const ct = getSongTime();
  const beat = 60 / game.currentSong.bpm;
  const lookahead = TUNING.lookahead;
  const cb = Math.floor(ct / beat);
  for (let i = -1; i < 20; i++) {
    const bt = (cb + i) * beat;
    const td = bt - ct;
    if (td > lookahead || td < -0.5) continue;
    const p = 1 - (td / lookahead);
    if (p < 0 || p > 1.1) continue;
    const t = p;
    const y = m.horizonY + (m.hitY - m.horizonY) * t * t;
    const width = m.roadTopWidth + (m.roadBottomWidth - m.roadTopWidth) * t * t;
    ctx.strokeStyle = `rgba(244,180,26,${t * 0.45})`;
    ctx.lineWidth = 1 + t * 1.5;
    ctx.beginPath();
    ctx.moveTo(m.centerX - width/2, y);
    ctx.lineTo(m.centerX + width/2, y);
    ctx.stroke();
  }
}

function drawHitZone(ctx, m) {
  ctx.fillStyle = game.feverActive ? gradients.hitZoneRadial.fever : gradients.hitZoneRadial.normal;
  ctx.beginPath(); ctx.ellipse(m.centerX, m.hitY, m.hitWidth * 1.2, 40, 0, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = game.feverActive ? '#ffd700' : '#f4b41a';
  ctx.lineWidth = 3;
  ctx.shadowColor = game.feverActive ? '#ffd700' : '#f4b41a';
  ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.ellipse(m.centerX, m.hitY, m.hitWidth/2, 14, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(255,244,224,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(m.centerX - m.hitWidth/2, m.hitY); ctx.lineTo(m.centerX + m.hitWidth/2, m.hitY); ctx.stroke();

  drawCowbell(ctx, m.centerX, m.hitY, 55);
}

function drawCowbell(ctx, x, y, size) {
  const ht = game.cowbellHitTime;
  const now = performance.now() / 1000;
  const sh = now - ht;
  const shake = !REDUCED_MOTION && sh < 0.15 ? Math.sin(sh * 100) * 4 : 0;
  const scale = sh < 0.15 ? 1 + (0.15 - sh) * 0.6 : 1;
  ctx.save();
  ctx.translate(x + shake, y); ctx.scale(scale, scale);
  ctx.shadowColor = '#f4b41a'; ctx.shadowBlur = sh < 0.3 ? 30 : 14;
  const g = ctx.createLinearGradient(0, -size, 0, size);
  g.addColorStop(0, '#ffe680'); g.addColorStop(0.4, '#f4b41a'); g.addColorStop(1, '#8b6914');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-size*0.65, -size*0.8); ctx.lineTo(size*0.65, -size*0.8);
  ctx.lineTo(size, size*0.55); ctx.lineTo(-size, size*0.55);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#5c4a1e'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(-size*0.4, -size*0.7); ctx.lineTo(-size*0.2, -size*0.7);
  ctx.lineTo(-size*0.5, size*0.4); ctx.lineTo(-size*0.7, size*0.4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5c4a1e';
  ctx.fillRect(-size*1.05, size*0.5, size*2.1, size*0.15);
  ctx.beginPath(); ctx.arc(0, size*0.72, size*0.12, 0, Math.PI*2); ctx.fill();
  ctx.fillRect(-size*0.15, -size*0.95, size*0.3, size*0.15);
  ctx.restore();
}

function drawNote(ctx, x, y, size, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
  ctx.shadowColor = '#f4b41a'; ctx.shadowBlur = 18;
  const g = ctx.createLinearGradient(0, -size, 0, size);
  g.addColorStop(0, '#ffe680'); g.addColorStop(0.5, '#f4b41a'); g.addColorStop(1, '#8b6914');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-size*0.65, -size*0.8); ctx.lineTo(size*0.65, -size*0.8);
  ctx.lineTo(size, size*0.55); ctx.lineTo(-size, size*0.55);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#5c4a1e'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(-size*0.4, -size*0.7); ctx.lineTo(-size*0.2, -size*0.7);
  ctx.lineTo(-size*0.5, size*0.4); ctx.lineTo(-size*0.7, size*0.4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5c4a1e';
  ctx.fillRect(-size*1.05, size*0.5, size*2.1, size*0.15);
  ctx.restore();
}

function drawCrowd(ctx, m) {
  const time = performance.now() / 1000;
  const intensity = game.state === 'playing' && game.combo > 5 ? 1 : 0.5;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.beginPath(); ctx.moveTo(0, m.h);
  const heads = Math.floor(m.w / 28);
  for (let i = 0; i <= heads; i++) {
    const x = (i / heads) * m.w;
    const b = REDUCED_MOTION ? 0 : Math.sin(time * 4 + i * 0.7) * 5 * intensity;
    const y = m.h - 30 + Math.sin(i * 1.3) * 10 - b;
    ctx.lineTo(x - 9, m.h - 5); ctx.lineTo(x - 9, y + 5);
    ctx.quadraticCurveTo(x, y - 14, x + 9, y + 5);
    ctx.lineTo(x + 9, m.h - 5);
  }
  ctx.lineTo(m.w, m.h); ctx.closePath(); ctx.fill();
}

// ========== PARTICLES ==========
function spawnHitParticles(color) {
  if (REDUCED_MOTION) return;
  const m = getHighwayMetrics();
  const count = game.feverActive ? 35 : 25;
  for (let i = 0; i < count; i++) {
    const a = -Math.PI/2 + (Math.random()-0.5) * Math.PI * 0.9;
    const s = 200 + Math.random() * 350;
    particles.push({ x: m.centerX, y: m.hitY, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
      life: 1, maxLife: 0.6 + Math.random()*0.5, size: 3+Math.random()*5, color });
  }
  for (let i = 0; i < 8; i++) {
    particles.push({ x: m.centerX, y: m.hitY, vx: (Math.random()-0.5)*250, vy: -Math.random()*250-80,
      life: 1, maxLife: 0.8+Math.random()*0.4, size: 2+Math.random()*3, color: '#fff4e0' });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 700 * dt; p.vx *= Math.pow(0.98, dt * 60);
    p.life -= dt / p.maxLife;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles(ctx) {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.life), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
