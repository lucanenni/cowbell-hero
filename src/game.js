// ========== GAME STATE ==========
const game = {
  state: 'menu', currentSong: null, notes: [], score: 0, combo: 0, maxCombo: 0,
  multiplier: 1, fever: 0, feverActive: false, feverTimeLeft: 0,
  notesHit: 0, notesTotal: 0, perfectHits: 0, goodHits: 0, okHits: 0, missedNotes: 0,
  songStartTime: 0, cowbellHitTime: 0, paused: false, useYouTube: false,
  audioMode: loadAudioMode(),
  menuIndex: 0,
};

const audioEngine = new AudioEngine();
const ytPlayer = new YouTubePlayer();
let musicScheduler = null;
let lastTime = 0;

// ========== SCREEN MANAGEMENT ==========
function showScreen(name) {
  document.getElementById('menu-screen').classList.toggle('hidden', name !== 'menu');
  document.getElementById('game-screen').classList.toggle('hidden', name !== 'game');
  document.getElementById('results-screen').classList.toggle('hidden', name !== 'results');
  // Show YouTube container only in game mode AND when using YouTube
  const ytContainer = document.getElementById('yt-container');
  const synthBanner = document.getElementById('synth-banner');
  if (name === 'game') {
    ytContainer.classList.toggle('hidden', !game.useYouTube);
    synthBanner.classList.toggle('hidden', game.useYouTube);
  } else {
    ytContainer.classList.add('hidden');
    synthBanner.classList.add('hidden');
  }
}

// ========== TOAST NOTIFICATION ==========
function showToast(message, duration = 3500) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ========== SONG TIME ==========
function getSongTime() {
  if (game.useYouTube && ytPlayer.ready) {
    const offset = game.currentSong ? (game.currentSong.youtubeOffset || 0) : 0;
    return ytPlayer.getCurrentTime() - offset;
  } else if (audioEngine.ctx) {
    return audioEngine.ctx.currentTime - game.songStartTime;
  }
  return 0;
}

// ========== START SONG ==========
function startSong(song) {
  game.currentSong = song;
  game.notes = generateGameNotes(song);
  game.notesTotal = game.notes.length;
  game.score = 0; game.combo = 0; game.maxCombo = 0; game.multiplier = 1;
  game.fever = 0; game.feverActive = false; game.feverTimeLeft = 0;
  game.notesHit = 0; game.perfectHits = 0; game.goodHits = 0; game.okHits = 0;
  game.missedNotes = 0; game.paused = false; game.cowbellHitTime = 0;
  particles = []; screenShake = 0;

  audioEngine.init();
  audioEngine.resume();

  game.useYouTube = false;
  if (game.audioMode === 'youtube' && song.youtubeId) {
    if (ytPlayer.ready) {
      if (ytPlayer.loadVideo(song.youtubeId)) {
        game.useYouTube = true;
        ytPlayer.videoEnded = false;
        ytPlayer.setVolume(0.8);
      } else {
        showToast('YouTube player not ready. Using synth mode.');
      }
    } else {
      showToast('YouTube still loading. Using synth mode for now.');
    }
  }

  showScreen('game');
  document.getElementById('song-title-mini').textContent = song.title;
  document.getElementById('song-artist-mini').textContent = song.artist;
  document.getElementById('mode-badge').textContent = game.useYouTube ? 'YOUTUBE' : 'SYNTH';
  document.getElementById('mode-badge').className = game.useYouTube ? 'mode-badge yt' : 'mode-badge synth';
  document.getElementById('fever-fill').classList.remove('active');
  document.getElementById('fever-label').classList.remove('active');
  updateHUD();

  // Highway is visible and animating during the count-in.
  game.state = 'countdown';
  startCountdown(() => {
    if (game.useYouTube) {
      ytPlayer.play();
      game.songStartTime = 0;
    } else {
      game.songStartTime = audioEngine.ctx.currentTime + 0.1;
      musicScheduler = new MusicScheduler(audioEngine, song);
      musicScheduler.start(game.songStartTime);
    }
    game.state = 'playing';
  });
}

function startCountdown(callback) {
  const cd = document.getElementById('countdown');
  const seq = ['3', '2', '1', 'GO!'];
  let i = 0;
  function next() {
    if (i >= seq.length) { cd.textContent = ''; callback(); return; }
    cd.textContent = seq[i];
    cd.classList.remove('show'); void cd.offsetWidth; cd.classList.add('show');
    if (audioEngine.ctx) audioEngine.playCowbell(0.7);
    i++; setTimeout(next, TUNING.countdownStepMs);
  }
  next();
}

// ========== INPUT / SCORING ==========
function tryHit() {
  if (game.state !== 'playing' || game.paused) return;
  const ct = getSongTime();
  let closest = null, closestDiff = Infinity;
  for (const n of game.notes) {
    if (n.hit || n.missed) continue;
    const d = Math.abs(n.time - ct);
    if (d < closestDiff) { closestDiff = d; closest = n; }
  }
  if (closest && closestDiff < TUNING.hitWindow.max) {
    closest.hit = true; closest.hitTime = ct;
    let pts, qual, col;
    if (closestDiff < TUNING.hitWindow.perfect) { qual = 'PERFECT'; pts = TUNING.points.perfect; col = '#ffd700'; game.perfectHits++; }
    else if (closestDiff < TUNING.hitWindow.good) { qual = 'GOOD'; pts = TUNING.points.good; col = '#ff9933'; game.goodHits++; }
    else { qual = 'OK'; pts = TUNING.points.ok; col = '#e74c3c'; game.okHits++; }

    game.combo++; game.maxCombo = Math.max(game.maxCombo, game.combo);
    game.multiplier = 1;
    for (const tier of TUNING.comboTiers) { if (game.combo >= tier.at) { game.multiplier = tier.mult; break; } }

    if (!game.feverActive) {
      game.fever = Math.min(100, game.fever + (qual === 'PERFECT' ? TUNING.fever.gainPerfect : TUNING.fever.gain));
      if (game.fever >= 100) { game.feverActive = true; game.feverTimeLeft = TUNING.fever.duration; showFeverBanner(); }
    }
    const fMult = game.feverActive ? TUNING.fever.scoreMultiplier : 1;
    game.score += pts * game.multiplier * fMult;
    game.notesHit++;

    audioEngine.playCowbell(1);
    spawnHitParticles(col);
    showHitFeedback(qual, col);
    if (qual !== 'PERFECT') showTimingHint(ct - closest.time); // >0 late, <0 early
    triggerGlowFlash();
    game.cowbellHitTime = performance.now() / 1000;
    screenShake = REDUCED_MOTION ? 0 : (qual === 'PERFECT' ? 5 : 3);

    const ce = document.getElementById('combo-value');
    ce.classList.remove('high'); void ce.offsetWidth;
    if (game.combo >= 10) ce.classList.add('high');
  } else {
    audioEngine.playCowbell(0.35);
  }
}

function checkMisses() {
  if (game.state !== 'playing' || game.paused) return;
  const ct = getSongTime();
  for (const n of game.notes) {
    if (!n.hit && !n.missed && n.time < ct - TUNING.missAfter) {
      n.missed = true; game.combo = 0; game.multiplier = 1; game.missedNotes++;
      showHitFeedback('MISS', '#ff3050');
      audioEngine.playMiss();
      document.getElementById('combo-value').classList.remove('high');
      // A miss during fever burns a chunk of the remaining time.
      if (game.feverActive) game.feverTimeLeft = Math.max(0, game.feverTimeLeft - TUNING.fever.missPenalty);
    }
  }
}

function updateFever(dt) {
  if (!game.feverActive) return;
  game.feverTimeLeft -= dt;
  game.fever = Math.max(0, (game.feverTimeLeft / TUNING.fever.duration) * 100);
  if (game.feverTimeLeft <= 0) {
    game.feverActive = false; game.fever = 0;
    document.getElementById('fever-fill').classList.remove('active');
    document.getElementById('fever-label').classList.remove('active');
  }
}

function checkSongEnd() {
  if (game.state !== 'playing') return;
  const ct = getSongTime();
  if (ct > game.currentSong.duration + 0.5) { endGame(); return; }
  if (game.useYouTube && ytPlayer.videoEnded) { endGame(); return; }
}

function endGame() {
  game.state = 'results';
  if (musicScheduler) { musicScheduler.stop(); musicScheduler = null; }
  if (game.useYouTube) ytPlayer.stop();

  document.getElementById('final-score').textContent = game.score;
  document.getElementById('final-combo').textContent = game.maxCombo;
  const acc = game.notesTotal > 0 ? Math.round((game.notesHit / game.notesTotal) * 100) : 0;
  document.getElementById('final-accuracy').textContent = acc + '%';
  document.getElementById('final-notes').textContent = `${game.notesHit}/${game.notesTotal}`;

  let stars = 1;
  if (acc >= 95) stars = 5; else if (acc >= 85) stars = 4;
  else if (acc >= 70) stars = 3; else if (acc >= 50) stars = 2;
  if (game.notesHit === 0) stars = 0;

  const se = document.querySelectorAll('.star');
  se.forEach(s => s.classList.remove('lit'));
  se.forEach((s, i) => { if (i < stars) setTimeout(() => s.classList.add('lit'), 300 + i * 200); });

  const titles = ['OOPS!', 'KEEP TRYING', 'SET COMPLETE', 'NICE SET!', 'GREAT PERFORMANCE!', 'COWBELL LEGEND!'];
  document.getElementById('results-title').textContent = titles[stars];

  const hsKey = `cowbell_hero_hs_${game.currentSong.id}`;
  const prev = parseInt(localStorage.getItem(hsKey) || '0');
  const nr = document.getElementById('new-record');
  const prevEl = document.getElementById('prev-best');
  if (game.score > prev) {
    localStorage.setItem(hsKey, game.score);
    nr.classList.add('show');
    prevEl.textContent = prev > 0 ? `previous best ${prev}` : '';
  } else {
    nr.classList.remove('show');
    prevEl.textContent = prev > 0 ? `best ${prev}` : '';
  }

  setTimeout(() => showScreen('results'), 100);
}

// ========== PAUSE ==========
function pauseGame() {
  if (game.state !== 'playing' || game.paused) return;
  game.paused = true;
  if (game.useYouTube) {
    ytPlayer.pause();
  } else {
    if (audioEngine.ctx && audioEngine.ctx.state === 'running') audioEngine.ctx.suspend();
    if (musicScheduler) musicScheduler.stop();
  }
  document.getElementById('pause-overlay').classList.add('show');
}

function resumeGame() {
  if (!game.paused) return;
  if (game.useYouTube) {
    ytPlayer.play();
  } else {
    if (audioEngine.ctx && audioEngine.ctx.state === 'suspended') audioEngine.ctx.resume();
    if (musicScheduler) {
      const ct = audioEngine.ctx.currentTime - game.songStartTime;
      const s = (60 / game.currentSong.bpm) / 4;
      const ts = Math.max(0, Math.floor(ct / s));
      musicScheduler.currentStep = ts;
      musicScheduler.nextStepTime = game.songStartTime + ts * s;
      musicScheduler.running = true;
      musicScheduler.scheduler();
    }
  }
  game.paused = false;
  document.getElementById('pause-overlay').classList.remove('show');
}

function quitGame() {
  game.state = 'menu';
  if (musicScheduler) { musicScheduler.stop(); musicScheduler = null; }
  if (game.useYouTube) ytPlayer.stop();
  particles = [];
  document.getElementById('pause-overlay').classList.remove('show');
  showScreen('menu');
}

// ========== RENDER ORCHESTRATION ==========
function render(dt) {
  if (!gradients) buildGradients();
  const m = getHighwayMetrics();
  ctx.fillStyle = 'rgba(10, 5, 3, 0.35)';
  ctx.fillRect(0, 0, m.w, m.h);

  if (game.feverActive) {
    ctx.fillStyle = gradients.feverOverlay;
    ctx.fillRect(0, 0, m.w, m.h);
  }

  ctx.save();
  if (screenShake > 0) {
    ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake);
    screenShake *= Math.pow(0.85, dt * 60);
    if (screenShake < 0.3) screenShake = 0;
  }

  drawHighway(ctx, m);
  drawBeatLines(ctx, m);

  if (game.state === 'playing' && !game.paused) {
    const ct = getSongTime();
    for (const n of game.notes) {
      if (n.hit || n.missed) continue;
      const pos = getNotePosition(n.time, ct);
      if (pos) drawNote(ctx, pos.x, pos.y, pos.size, pos.alpha);
    }
  }

  drawHitZone(ctx, m);
  drawParticles(ctx);
  ctx.restore();
  drawCrowd(ctx, m);

  updateParticles(dt);

  if (game.state === 'playing' && !game.paused) {
    checkMisses();
    updateFever(dt);
    checkSongEnd();
    updateHUD();
  }
}

// ========== UI HELPERS ==========
function showHitFeedback(text, color) {
  const el = document.getElementById('hit-feedback');
  el.textContent = text;
  el.style.color = color;
  el.style.textShadow = `0 0 30px ${color}`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

// signed seconds: positive = pressed after the note (late), negative = early.
function showTimingHint(signed) {
  const el = document.getElementById('timing-hint');
  const late = signed > 0;
  el.textContent = late ? 'LATE ▸' : '◂ EARLY';
  el.style.color = late ? '#8ab4ff' : '#ffb454';
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

function showFeverBanner() {
  const el = document.getElementById('fever-banner');
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  document.getElementById('fever-fill').classList.add('active');
  document.getElementById('fever-label').classList.add('active');
}

function triggerGlowFlash() {
  const el = document.getElementById('glow-flash');
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

function updateHUD() {
  document.getElementById('score-value').textContent = game.score;
  document.getElementById('combo-value').textContent = game.combo;
  document.getElementById('fever-fill').style.width = game.fever + '%';
  const me = document.getElementById('multiplier');
  if (game.multiplier > 1) {
    me.textContent = 'x' + game.multiplier;
    me.classList.add('active');
  } else {
    me.classList.remove('active');
  }
}

// ========== GAME LOOP ==========
function gameLoop(ts) {
  const dt = lastTime ? Math.min(0.1, (ts - lastTime) / 1000) : 1 / 60;
  lastTime = ts;
  if ((game.state === 'playing' || game.state === 'countdown' || game.state === 'results') &&
      !document.getElementById('game-screen').classList.contains('hidden')) {
    render(dt);
  }
  requestAnimationFrame(gameLoop);
}

// ========== KEYBOARD / POINTER ==========
document.addEventListener('keydown', (e) => {
  // Match on both `code` (layout-independent) and `key`, since not every
  // input source (assistive tech, synthetic events) sets `code`.
  const k = e.key;
  const isSpace = e.code === 'Space' || k === ' ';
  const isEnter = e.code === 'Enter' || k === 'Enter';
  const isUp = e.code === 'ArrowUp' || e.code === 'KeyW' || k === 'ArrowUp' || k === 'w' || k === 'W';
  const isDown = e.code === 'ArrowDown' || e.code === 'KeyS' || k === 'ArrowDown' || k === 's' || k === 'S';
  const isEscape = e.code === 'Escape' || e.code === 'KeyP' || k === 'Escape' || k === 'p' || k === 'P';
  const isBracketL = e.code === 'BracketLeft' || k === '[';
  const isBracketR = e.code === 'BracketRight' || k === ']';

  if (isSpace) {
    e.preventDefault();
    if (game.state === 'playing' && !game.paused) tryHit();
    else if (game.state === 'menu') startSong(SONGS[game.menuIndex]);
    else if (game.state === 'results') nextSong();
  } else if (isEnter) {
    if (game.state === 'menu') { e.preventDefault(); startSong(SONGS[game.menuIndex]); }
    else if (game.state === 'results') { e.preventDefault(); nextSong(); }
  } else if (isUp) {
    if (game.state === 'menu') { e.preventDefault(); moveMenuSelection(-1); }
  } else if (isDown) {
    if (game.state === 'menu') { e.preventDefault(); moveMenuSelection(1); }
  } else if (isEscape) {
    e.preventDefault();
    if (game.state === 'playing') { if (game.paused) resumeGame(); else pauseGame(); }
    else if (game.state === 'results') { showScreen('menu'); game.state = 'menu'; }
  } else if ((isBracketL || isBracketR) &&
             game.state === 'playing' && game.useYouTube && game.currentSong) {
    // Live-tune the YouTube sync offset by ear: [ pulls notes earlier, ] later.
    e.preventDefault();
    const step = e.shiftKey ? 0.02 : 0.1;
    game.currentSong.youtubeOffset = Math.round(
      ((game.currentSong.youtubeOffset || 0) + (isBracketR ? step : -step)) * 1000) / 1000;
    showToast(`YouTube offset: ${game.currentSong.youtubeOffset.toFixed(2)}s`, 1200);
  }
});

// Song keeps playing (and desyncing) if the tab is hidden — pause instead.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing' && !game.paused) pauseGame();
});

canvas.addEventListener('touchstart', (e) => {
  if (game.state === 'playing' && !game.paused) { e.preventDefault(); tryHit(); }
}, { passive: false });
canvas.addEventListener('click', () => { if (game.state === 'playing' && !game.paused) tryHit(); });

// ========== MODE SELECTOR ==========
function initModeSelector() {
  const selector = document.querySelector('.mode-selector');
  if (!CONFIG.youtubeEnabled) return;
  if (selector) selector.hidden = false;
  const buttons = document.querySelectorAll('.mode-btn');
  buttons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === game.audioMode);
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      game.audioMode = mode;
      saveAudioMode(mode);
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (mode === 'youtube' && !ytPlayer.apiLoaded) ytPlayer.initAPI();
      showToast(mode === 'youtube'
        ? 'YouTube mode selected. Videos will load when you play.'
        : 'Synth mode selected. All music is synthesized.', 2500);
    });
  });
}

// ========== MENU ==========
let menuCards = [];

function updateMenuSelection() {
  menuCards.forEach((card, i) => card.classList.toggle('selected', i === game.menuIndex));
}

function moveMenuSelection(delta) {
  if (!menuCards.length) return;
  game.menuIndex = Math.max(0, Math.min(menuCards.length - 1, game.menuIndex + delta));
  updateMenuSelection();
  menuCards[game.menuIndex].scrollIntoView({ block: 'nearest' });
}

function initMenu() {
  const list = document.getElementById('song-list');
  list.innerHTML = '';
  menuCards = [];
  SONGS.forEach((song, index) => {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.style.setProperty('--song-color', song.color);
    const dots = Array.from({ length: 4 }, (_, i) =>
      `<span class="difficulty-dot ${i < song.difficulty ? 'active' : ''}"></span>`).join('');
    const hs = parseInt(localStorage.getItem(`cowbell_hero_hs_${song.id}`) || '0');
    card.innerHTML = `
      <div class="song-info">
        <div class="song-title">${song.title}</div>
        <div class="song-artist">${song.artist}</div>
      </div>
      <div class="song-meta">
        <div class="difficulty">${dots}</div>
        <div class="song-bpm">${song.bpm} BPM</div>
        ${hs > 0 ? `<div class="hs-badge">HS: ${hs}</div>` : ''}
      </div>`;
    card.addEventListener('mouseenter', () => { game.menuIndex = index; updateMenuSelection(); });
    card.addEventListener('click', () => { game.menuIndex = index; startSong(song); });
    list.appendChild(card);
    menuCards.push(card);
  });
  updateMenuSelection();

  document.getElementById('resume-btn').addEventListener('click', resumeGame);
  document.getElementById('quit-btn').addEventListener('click', quitGame);
  document.getElementById('back-btn').addEventListener('click', () => {
    game.state = 'menu'; particles = []; if (game.useYouTube) ytPlayer.stop(); showScreen('menu');
  });
  document.getElementById('retry-btn').addEventListener('click', () => { if (game.currentSong) startSong(game.currentSong); });
  document.getElementById('next-btn').addEventListener('click', nextSong);
}

function nextSong() {
  const idx = SONGS.findIndex(s => s.id === game.currentSong.id);
  const ni = (idx + 1) % SONGS.length;
  game.menuIndex = ni;
  startSong(SONGS[ni]);
}

// ========== YOUTUBE FALLBACK ==========
ytPlayer.onErrorCallback = (errorCode) => {
  let message = 'YouTube video unavailable. Switching to synth mode.';
  if (errorCode === 101 || errorCode === 150) message = 'Video owner disabled embedding. Using synth mode.';
  else if (errorCode === 153) message = 'Video not available for embedding (error 153). Using synth mode.';
  else if (errorCode === 100) message = 'Video not found. Using synth mode.';
  showToast(message, 4000);

  if (!game.useYouTube) return;
  game.useYouTube = false;
  ytPlayer.stop();
  if (game.state === 'playing' || game.state === 'countdown') {
    audioEngine.init();
    audioEngine.resume();
    game.songStartTime = audioEngine.ctx.currentTime - getSongTime() + 0.1;
    musicScheduler = new MusicScheduler(audioEngine, game.currentSong);
    musicScheduler.start(game.songStartTime);
    document.getElementById('mode-badge').textContent = 'SYNTH';
    document.getElementById('mode-badge').className = 'mode-badge synth';
    document.getElementById('yt-container').classList.add('hidden');
    document.getElementById('synth-banner').classList.remove('hidden');
  }
};

ytPlayer.onEndCallback = () => { if (game.state === 'playing') endGame(); };

// ========== INIT ==========
resizeCanvas();
initModeSelector();
initMenu();
showScreen('menu');
requestAnimationFrame(gameLoop);

if (game.audioMode === 'youtube') ytPlayer.initAPI();
