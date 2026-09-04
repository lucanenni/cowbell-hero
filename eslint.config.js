// Flat ESLint config (ESLint 9+). Lint-only tooling for CI — the game itself
// ships with zero runtime dependencies.
const globals = require('globals');

// index.html loads these as plain <script> tags (config -> audio -> render ->
// game), so they share one global scope. List each file's top-level names so
// no-undef understands the cross-file references instead of flagging them.
const appGlobals = {
  // config.js
  CONFIG: 'readonly', TUNING: 'readonly', loadAudioMode: 'readonly', saveAudioMode: 'readonly',
  NOTES: 'readonly', COWBELL_PATTERNS: 'readonly', SONGS: 'readonly',
  barPatternFor: 'readonly', generateGameNotes: 'readonly',
  // audio.js
  AudioEngine: 'readonly', YouTubePlayer: 'readonly', MusicScheduler: 'readonly',
  YT: 'readonly', // injected by the YouTube iframe API script
  // render.js
  canvas: 'readonly', ctx: 'readonly', REDUCED_MOTION: 'readonly',
  particles: 'writable', screenShake: 'writable', gradients: 'writable',
  resizeCanvas: 'readonly', buildGradients: 'readonly', getHighwayMetrics: 'readonly', getNotePosition: 'readonly',
  drawHighway: 'readonly', drawBeatLines: 'readonly', drawHitZone: 'readonly', drawCowbell: 'readonly',
  drawNote: 'readonly', drawCrowd: 'readonly', spawnHitParticles: 'readonly', updateParticles: 'readonly', drawParticles: 'readonly',
  // game.js
  game: 'readonly', audioEngine: 'readonly', ytPlayer: 'readonly',
  musicScheduler: 'writable', lastTime: 'writable', menuCards: 'writable',
  showScreen: 'readonly', showToast: 'readonly', getSongTime: 'readonly', startSong: 'readonly', startCountdown: 'readonly',
  tryHit: 'readonly', checkMisses: 'readonly', updateFever: 'readonly', checkSongEnd: 'readonly', endGame: 'readonly',
  pauseGame: 'readonly', resumeGame: 'readonly', quitGame: 'readonly', render: 'readonly',
  showHitFeedback: 'readonly', showTimingHint: 'readonly', showFeverBanner: 'readonly', triggerGlowFlash: 'readonly',
  updateHUD: 'readonly', gameLoop: 'readonly', initModeSelector: 'readonly',
  updateMenuSelection: 'readonly', moveMenuSelection: 'readonly', initMenu: 'readonly', nextSong: 'readonly',
};

module.exports = [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...appGlobals },
    },
    rules: {
      'no-undef': 'error',
      // ESLint lints one file at a time, but these four share one global
      // scope via plain <script> tags: a name this file exports looks
      // "unused" here (its callers are in another file) and a name another
      // file owns looks like a "redeclare" here (that's how it's shared).
      // Both are false positives of the multi-file-classic-script pattern —
      // no-undef is what actually catches typos/missing globals.
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'no-var': 'error',
      eqeqeq: ['warn', 'smart'],
    },
  },
];
