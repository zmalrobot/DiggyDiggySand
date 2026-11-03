// Audio procedurale (Web Audio API). Nessun file esterno richiesto.
// Catena: music/sfx -> master -> destination. AudioContext creato solo dopo un gesto utente.
export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.nodes = null;
    this.ambient = null;
    this.supported = !!(window.AudioContext || window.webkitAudioContext);
    settings.subscribe('*', (_v, key) => {
      if (key.startsWith('audio.')) this._applyGains();
    });
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  _init() {
    if (this.ctx || !this.supported) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    const master = this.ctx.createGain();
    const music = this.ctx.createGain();
    const sfx = this.ctx.createGain();
    music.connect(master);
    sfx.connect(master);
    master.connect(this.ctx.destination);
    this.nodes = { master, music, sfx };
    this._applyGains(true);
  }

  /** Da chiamare dentro un gesto utente (click). */
  async unlock() {
    if (!this.supported) return false;
    try {
      this._init();
      if (this.ctx.state !== 'running') await this.ctx.resume();
      this.startAmbient();
      return this.ctx.state === 'running';
    } catch (e) {
      console.warn('[Audio] sblocco non riuscito', e);
      return false;
    }
  }

  _applyGains(instant = false) {
    if (!this.nodes) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    const curve = (p) => (p / 100) ** 2; // risposta percettiva
    const target = {
      master: s.get('audio.mute') ? 0 : curve(s.get('audio.master')),
      music: curve(s.get('audio.music')),
      sfx: curve(s.get('audio.sfx')),
    };
    for (const [name, v] of Object.entries(target)) {
      const p = this.nodes[name].gain;
      p.cancelScheduledValues(t);
      if (instant) p.setValueAtTime(v, t);
      else p.setTargetAtTime(v, t, 0.02);
    }
  }

  _ok() { return this.ctx && this.ctx.state === 'running'; }

  _noiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _blip({ type = 'triangle', f0, f1, dur, vol }) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.nodes.sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  playClick() {
    if (!this._ok()) return;
    this._blip({ type: 'triangle', f0: 540, f1: 260, dur: 0.09, vol: 0.35 });
    // piccolo "tick" di rumore per il carattere di pietra
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.04);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(f); f.connect(g); g.connect(this.nodes.sfx);
    src.start(t);
  }

  playHover() {
    if (!this._ok()) return;
    this._blip({ type: 'sine', f0: 880, f1: 1180, dur: 0.05, vol: 0.12 });
  }

  /** Accordo cristallino per "Inizia Spedizione". */
  playConfirm() {
    if (!this._ok()) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      setTimeout(() => {
        if (this._ok()) this._blip({ type: 'sine', f0: f, f1: f * 1.004, dur: 0.6, vol: 0.18 });
      }, i * 90);
    });
  }

  playWarn() {
    if (!this._ok()) return;
    this._blip({ type: 'sawtooth', f0: 220, f1: 110, dur: 0.25, vol: 0.2 });
  }

  /** Chime metallico / cascata di monete per acquisto di upgrade. */
  playPurchaseSound() {
    if (!this._ok()) return;
    const pitches = [587.33, 880.0, 1174.66]; // D5, A5, D6
    pitches.forEach((f, i) => {
      setTimeout(() => {
        if (!this._ok()) return;
        this._blip({ type: 'triangle', f0: f, f1: f * 1.02, dur: 0.16, vol: 0.2 });
        this._blip({ type: 'sine', f0: f * 2, f1: f * 2.01, dur: 0.1, vol: 0.1 });
      }, i * 50);
    });
  }


  /**
   * Colpo di pala nella sabbia: raschio di rumore filtrato + tonfo sordo. Il pitch varia di ±15% a ogni
   * chiamata per evitare ripetitività. `intensity` (0..1.5) scala il volume.
   */
  playDigSound(intensity = 1) {
    if (!this._ok()) return;
    const p = 1 + (Math.random() * 0.3 - 0.15);
    const t = this.ctx.currentTime;
    const vol = 0.35 * Math.min(1.5, Math.max(0.2, intensity));

    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.22);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(2400 * p, t);
    bp.frequency.exponentialRampToValueAtTime(700 * p, t + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    src.connect(bp); bp.connect(g); g.connect(this.nodes.sfx);
    src.start(t);

    this._blip({ type: 'sine', f0: 120 * p, f1: 55 * p, dur: 0.13, vol: vol * 0.7 });
  }

  /** Vento del deserto (rumore filtrato con LFO) + drone atlantideo a bassa frequenza. */
  startAmbient() {
    if (!this.ctx || this.ambient) return;
    const ctx = this.ctx;
    const out = this.nodes.music;

    const wind = ctx.createBufferSource();
    wind.buffer = this._noiseBuffer(3);
    wind.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.14;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07; lfoGain.gain.value = 140;
    lfo.connect(lfoGain); lfoGain.connect(bp.frequency);
    wind.connect(bp); bp.connect(windGain); windGain.connect(out);

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.05;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 320;
    const oscs = [55, 82.5, 110.4].map((f) => {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      o.connect(lp);
      return o;
    });
    lp.connect(droneGain); droneGain.connect(out);

    [wind, lfo, ...oscs].forEach((n) => n.start());
    this.ambient = { stop: () => [wind, lfo, ...oscs].forEach((n) => { try { n.stop(); } catch { /* già fermo */ } }) };
  }

  /** Sussurri oscuri e rombo sismico a bassa frequenza (Indizio Maledizione). */
  playWhispers() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 1.2);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.nodes.sfx);

    osc.start(t);
    osc.stop(t + 1.25);
  }

  /** Tintinnio cristallino e scintillio metallico (Indizio Tesoro). */
  playGlintChime() {
    if (!this._ok()) return;
    [1046.5, 1318.5, 1567.98, 2093.0].forEach((f, i) => {
      setTimeout(() => {
        if (!this._ok()) return;
        this._blip({ type: 'sine', f0: f, f1: f * 1.01, dur: 0.35, vol: 0.14 });
      }, i * 70);
    });
  }

  /** Sonar ping criptico del Georadar. */
  playRadarPing() {
    if (!this._ok()) return;
    this._blip({ type: 'sine', f0: 1760, f1: 880, dur: 0.08, vol: 0.15 });
  }
}


