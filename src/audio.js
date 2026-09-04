// ========== AUDIO ENGINE ==========
// Everything you hear in synth mode: a cowbell, a miss buzz, and a tiny drum
// kit + bass + distorted guitar, all built from oscillators and noise buffers.
class AudioEngine {
  constructor() { this.ctx = null; this.masterGain = null; this.compressor = null; }
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return; }
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -12; this.compressor.knee.value = 14;
    this.compressor.ratio.value = 5; this.compressor.attack.value = 0.003; this.compressor.release.value = 0.12;
    this.masterGain = this.ctx.createGain(); this.masterGain.gain.value = 0.55;
    this.compressor.connect(this.masterGain); this.masterGain.connect(this.ctx.destination);
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  playCowbell(velocity = 1) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator(), osc2 = this.ctx.createOscillator(), osc3 = this.ctx.createOscillator();
    const gain = this.ctx.createGain(), filter = this.ctx.createBiquadFilter();
    osc1.type = 'square'; osc1.frequency.value = 540;
    osc2.type = 'square'; osc2.frequency.value = 800;
    osc3.type = 'triangle'; osc3.frequency.value = 360;
    filter.type = 'bandpass'; filter.frequency.value = 720; filter.Q.value = 1.8;
    const dt = 0.35;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.45 * velocity, now + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dt);
    osc1.connect(filter); osc2.connect(filter); osc3.connect(filter); filter.connect(gain); gain.connect(this.compressor);
    osc1.start(now); osc2.start(now); osc3.start(now);
    osc1.stop(now + dt); osc2.stop(now + dt); osc3.stop(now + dt);
  }
  playMiss() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(), filter = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(180, now); osc.frequency.exponentialRampToValueAtTime(60, now + 0.25);
    filter.type = 'lowpass'; filter.frequency.value = 800;
    gain.gain.setValueAtTime(0.18, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(filter); filter.connect(gain); gain.connect(this.compressor);
    osc.start(now); osc.stop(now + 0.3);
  }
  playKick(time) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(150, time); osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
    gain.gain.setValueAtTime(0.7, time); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    osc.connect(gain); gain.connect(this.compressor); osc.start(time); osc.stop(time + 0.2);
  }
  playSnare(time) {
    if (!this.ctx) return;
    const bs = Math.floor(this.ctx.sampleRate * 0.15);
    const buf = this.ctx.createBuffer(1, bs, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bs; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/bs, 2);
    const n = this.ctx.createBufferSource(); n.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.35, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    n.connect(f); f.connect(g); g.connect(this.compressor); n.start(time);
  }
  playHiHat(time) {
    if (!this.ctx) return;
    const bs = Math.floor(this.ctx.sampleRate * 0.05);
    const buf = this.ctx.createBuffer(1, bs, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bs; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/bs, 4);
    const n = this.ctx.createBufferSource(); n.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.08, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    n.connect(f); f.connect(g); g.connect(this.compressor); n.start(time);
  }
  playBassNote(freq, time, duration) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(), filter = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth'; osc.frequency.value = freq;
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(900, time); filter.frequency.exponentialRampToValueAtTime(200, time + duration); filter.Q.value = 6;
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.28, time + 0.01); gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(filter); filter.connect(gain); gain.connect(this.compressor);
    osc.start(time); osc.stop(time + duration + 0.05);
  }
  playGuitarNote(freq, time, duration) {
    if (!this.ctx) return;
    const o1 = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), gain = this.ctx.createGain(), filter = this.ctx.createBiquadFilter(), dist = this.ctx.createWaveShaper();
    const curve = new Float32Array(512);
    for (let i = 0; i < 512; i++) { const x = (i/256)-1; curve[i] = Math.tanh(x*4)*0.7; }
    dist.curve = curve; dist.oversample = '4x';
    o1.type = 'sawtooth'; o1.frequency.value = freq;
    o2.type = 'sawtooth'; o2.frequency.value = freq * 1.008;
    filter.type = 'lowpass'; filter.frequency.value = 2800; filter.Q.value = 1.2;
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.13, time + 0.005); gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    o1.connect(filter); o2.connect(filter); filter.connect(dist); dist.connect(gain); gain.connect(this.compressor);
    o1.start(time); o2.start(time); o1.stop(time + duration + 0.05); o2.stop(time + duration + 0.05);
  }
}

// ========== YOUTUBE PLAYER ==========
class YouTubePlayer {
  constructor() {
    this.player = null; this.ready = false; this.apiLoaded = false;
    this.currentVideoId = null; this.videoEnded = false;
    this.onEndCallback = null; this.onErrorCallback = null;
  }
  initAPI() {
    if (this.apiLoaded) return;
    this.apiLoaded = true;
    if (window.YT && window.YT.Player) { this.createPlayer(); return; }
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => { this.createPlayer(); };
  }
  createPlayer() {
    if (!window.YT || !window.YT.Player) return;
    try {
      this.player = new YT.Player('yt-player', {
        height: '113', width: '200',
        playerVars: { 'autoplay': 0, 'controls': 1, 'modestbranding': 1, 'playsinline': 1, 'rel': 0 },
        events: {
          'onReady': (e) => this.onReady(e),
          'onStateChange': (e) => this.onStateChange(e),
          'onError': (e) => this.onError(e),
        }
      });
    } catch(e) { console.warn('YouTube player creation failed', e); }
  }
  onReady() { this.ready = true; }
  onStateChange(e) {
    if (e.data === YT.PlayerState.ENDED) {
      this.videoEnded = true;
      if (this.onEndCallback) this.onEndCallback();
    } else if (e.data === YT.PlayerState.PLAYING) {
      this.videoEnded = false;
    }
  }
  onError(e) {
    console.warn('YouTube error code:', e.data);
    if (this.onErrorCallback) this.onErrorCallback(e.data);
  }
  loadVideo(videoId) {
    if (!this.ready || !this.player) return false;
    this.currentVideoId = videoId; this.videoEnded = false;
    try { this.player.loadVideoById(videoId); return true; } catch(e) { return false; }
  }
  play() { if (this.ready && this.player) try { this.player.playVideo(); } catch(e){} }
  pause() { if (this.ready && this.player) try { this.player.pauseVideo(); } catch(e){} }
  stop() { if (this.ready && this.player) try { this.player.stopVideo(); } catch(e){} }
  getCurrentTime() { if (this.ready && this.player) { try { return this.player.getCurrentTime() || 0; } catch(e) {} } return 0; }
  getDuration() { if (this.ready && this.player) { try { return this.player.getDuration() || 0; } catch(e) {} } return 0; }
  setVolume(v) { if (this.ready && this.player) try { this.player.setVolume(v * 100); } catch(e){} }
}

// ========== MUSIC SCHEDULER ==========
// Web Audio clock-driven step sequencer for the synth backing track.
class MusicScheduler {
  constructor(audio, song) {
    this.audio = audio; this.song = song;
    this.startTime = 0; this.lookahead = 0.025; this.scheduleAheadTime = 0.15;
    this.nextStepTime = 0; this.currentStep = 0; this.timerID = null; this.running = false;
  }
  start(startTime) { this.startTime = startTime; this.nextStepTime = startTime; this.currentStep = 0; this.running = true; this.scheduler(); }
  stop() { this.running = false; if (this.timerID) { clearTimeout(this.timerID); this.timerID = null; } }
  scheduler() {
    if (!this.running) return;
    while (this.nextStepTime < this.audio.ctx.currentTime + this.scheduleAheadTime) {
      if (this.nextStepTime >= this.startTime + this.song.duration) { this.running = false; return; }
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }
    this.timerID = setTimeout(() => this.scheduler(), this.lookahead * 1000);
  }
  advanceStep() { const s = (60/this.song.bpm)/4; this.nextStepTime += s; this.currentStep++; }
  scheduleStep(step, time) {
    const si = step % 16, bar = Math.floor(step / 16);
    const beat = 60/this.song.bpm, sixteenth = beat/4;
    if (si === 0 || si === 8) this.audio.playKick(time);
    if (si === 4 || si === 12) this.audio.playSnare(time);
    if (si % 2 === 0) this.audio.playHiHat(time);
    const chord = this.song.chords[bar % this.song.chords.length];
    if (si === 0) this.audio.playBassNote(NOTES[chord.bass], time, beat * 1.8);
    if (si === 8) this.audio.playBassNote(NOTES[chord.bassAlt], time, beat * 1.8);
    if (this.song.guitarRiff && this.song.guitarRiff[si]) this.audio.playGuitarNote(NOTES[this.song.guitarRiff[si]], time, sixteenth * 1.8);
  }
}
