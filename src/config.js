// ========== CONFIGURATION ==========
const CONFIG = {
  // Default audio mode: 'synth' or 'youtube'
  // - 'synth': All music synthesized with Web Audio API (no external dependencies)
  // - 'youtube': Load real YouTube videos (requires valid video IDs and internet)
  defaultAudioMode: 'synth',
  // YouTube mode is functional but the fixed-tempo charts drift against real
  // recordings, so it's hidden for now. Flip to true to bring back the menu
  // toggle and honour a saved preference.
  youtubeEnabled: false,
};

// ========== TUNING ==========
// Every gameplay-feel number lives here so it can be balanced in one place.
const TUNING = {
  // Absolute timing error (seconds) for each hit grade, and when an
  // un-hit note is finally counted as missed.
  hitWindow: { perfect: 0.06, good: 0.12, max: 0.20 },
  missAfter: 0.18,
  points: { perfect: 100, good: 50, ok: 25 },
  // Combo count -> score multiplier, highest threshold first.
  comboTiers: [
    { at: 30, mult: 4 },
    { at: 20, mult: 3 },
    { at: 10, mult: 2 },
  ],
  fever: {
    gainPerfect: 10, // meter % added by a PERFECT hit (while not in fever)
    gain: 6,         // meter % added by any other hit
    duration: 8,     // seconds a fever lasts
    scoreMultiplier: 2,
    missPenalty: 3,  // seconds of fever burned by a miss during fever
  },
  lookahead: 2.5,      // seconds a note is visible before its hit time
  countdownStepMs: 750,
};

// Load / persist the audio-mode preference.
function loadAudioMode() {
  if (!CONFIG.youtubeEnabled) return 'synth';
  const saved = localStorage.getItem('cowbell_hero_audio_mode');
  if (saved === 'synth' || saved === 'youtube') return saved;
  return CONFIG.defaultAudioMode;
}
function saveAudioMode(mode) {
  localStorage.setItem('cowbell_hero_audio_mode', mode);
}

// ========== MUSICAL CONSTANTS ==========
const NOTES = {
  C2:65.41, Cs2:69.30, D2:73.42, Ds2:77.78, E2:82.41, F2:87.31, Fs2:92.50, G2:98.00, Gs2:103.83, A2:110.00, As2:116.54, B2:123.47,
  C3:130.81, Cs3:138.59, D3:146.83, Ds3:155.56, E3:164.81, F3:174.61, Fs3:185.00, G3:196.00, Gs3:207.65, A3:220.00, As3:233.08, B3:246.94,
  C4:261.63, Cs4:277.18, D4:293.66, Ds4:311.13, E4:329.63, F4:349.23, Fs4:369.99, G4:392.00, Gs4:415.30, A4:440.00, As4:466.16, B4:493.88,
  C5:523.25, D5:587.33, E5:659.25, G5:783.99, A5:880.00,
};

const COWBELL_PATTERNS = {
  steady:     [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
  rock:       [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,1,0],
  funky:      [1,0,1,0, 0,1,1,0, 1,0,1,0, 0,1,1,1],
  driving:    [1,1,1,1, 1,0,1,1, 1,1,1,1, 1,0,1,1],
  syncopated: [1,0,1,1, 0,1,1,0, 1,1,0,1, 1,0,1,1],
};

// ========== SONGS ==========
const SONGS = [
  {
    id: 'reaper',
    title: "(Don't Fear) The Cowbell",
    artist: 'Blue Öyster Cowbell',
    bpm: 75, duration: 60, difficulty: 1,
    color: '#e74c3c', pattern: 'rock',
    // Riff after "(Don't Fear) The Reaper" - Blue Öyster Cult (Official Audio)
    youtubeId: 'Dy4HA3vUv2c',
    // Seconds into the video that line up with game time 0 (start of the
    // chart's 4-beat count-in). Tune live with [ and ] during YouTube playback.
    youtubeOffset: 0.4,
    chords: [
      { bass: 'A2', bassAlt: 'E2' },
      { bass: 'G2', bassAlt: 'D3' },
      { bass: 'F2', bassAlt: 'C3' },
      { bass: 'G2', bassAlt: 'D3' },
    ],
    guitarRiff: [null,'A3',null,null,'C4',null,null,null,'E4',null,null,null,'A4',null,'E4',null],
  },
  {
    id: 'lowrider',
    title: 'Low Ringer',
    artist: 'Moar',
    bpm: 100, duration: 52, difficulty: 2,
    color: '#f4b41a', pattern: 'funky',
    // Riff after "Low Rider" - WAR (Official Video, Remastered in 4K)
    youtubeId: 'BsrqKE1iqqo',
    youtubeOffset: 0.6,
    chords: [
      { bass: 'F2', bassAlt: 'F2' },
      { bass: 'F2', bassAlt: 'F2' },
      { bass: 'A2', bassAlt: 'A2' },
      { bass: 'C3', bassAlt: 'C3' },
    ],
    guitarRiff: ['F3',null,null,'F3',null,'A3',null,null,'C4',null,null,'A3',null,'F3',null,null],
  },
  {
    id: 'honkytonk',
    title: 'Clonky Tonk Women',
    artist: 'The Rolling Cowbells',
    bpm: 110, duration: 54, difficulty: 3,
    color: '#ff6b35', pattern: 'syncopated',
    // Riff after "Honky Tonk Women" - The Rolling Stones (Official Lyric Video)
    youtubeId: 'hqqkGxZ1_8I',
    youtubeOffset: 0.3,
    chords: [
      { bass: 'E2', bassAlt: 'B2' },
      { bass: 'E2', bassAlt: 'B2' },
      { bass: 'A2', bassAlt: 'E3' },
      { bass: 'E2', bassAlt: 'B2' },
    ],
    guitarRiff: ['E3',null,'G3',null,'B3',null,'G3',null,'E3',null,'G3',null,'B3',null,'G3',null],
  },
  {
    id: 'missqueen',
    title: 'Mississippi Cowbell',
    artist: 'Cowntain',
    bpm: 120, duration: 50, difficulty: 4,
    color: '#d4a017', pattern: 'driving',
    // Riff after "Mississippi Queen" - Mountain (Official Music Video)
    youtubeId: 'qEnF6EB-yMs',
    youtubeOffset: 0.5,
    chords: [
      { bass: 'E2', bassAlt: 'B2' },
      { bass: 'E2', bassAlt: 'B2' },
      { bass: 'A2', bassAlt: 'E3' },
      { bass: 'B2', bassAlt: 'Fs3' },
    ],
    guitarRiff: ['E3','E3',null,'E3','E3',null,'G3','E3','B3',null,'G3',null,'E3',null,'G3','B3'],
  },
];

// ========== NOTE GENERATION ==========
// Shape one 16-step bar: most bars play the song's base pattern, but the last
// bar of every 8-bar phrase gets a busier fill and bar 4 of later phrases drops
// to a two-hit break, so a chart breathes instead of looping flatly.
function barPatternFor(song, bar, base) {
  const pos = bar % 8;
  if (pos === 7 && song.difficulty >= 2) {
    return base.map((v, i) => (v || i % 2 === 0) ? 1 : 0); // fill: straight 8ths
  }
  if (pos === 3 && bar >= 8) {
    return base.map((_, i) => (i === 0 || i === 8) ? 1 : 0); // break: downbeats only
  }
  return base;
}

function generateGameNotes(song) {
  const notes = [];
  const beat = 60 / song.bpm;
  const sixteenth = beat / 4;
  const introBeats = 4;
  const base = COWBELL_PATTERNS[song.pattern];
  const totalBeats = song.duration / beat;
  const totalBars = Math.floor((totalBeats - introBeats) / 4);
  for (let bar = 0; bar < totalBars; bar++) {
    const pattern = barPatternFor(song, bar, base);
    for (let step = 0; step < 16; step++) {
      if (pattern[step]) {
        const time = introBeats * beat + bar * 4 * beat + step * sixteenth;
        notes.push({ time, hit: false, missed: false, hitTime: null });
      }
    }
  }
  return notes;
}
