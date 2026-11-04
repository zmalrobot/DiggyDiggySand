// Audio procedurale (Web Audio API) & Colonna Sonora Adattiva (BGM Kevin MacLeod CC-BY 4.0).
// Catena: music/sfx -> master -> destination. AudioContext creato e sbloccato dopo un gesto utente.
import { events } from './Events.js';

export const BGM_TRACKS = {
  menu: './assets/audio/music/bgm_menu.mp3',
  desert: './assets/audio/music/bgm_desert.mp3',
  ocean: './assets/audio/music/bgm_ocean.mp3',
  glacier: './assets/audio/music/bgm_glacier.mp3',
  jungle: './assets/audio/music/bgm_jungle.mp3',
};

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.nodes = null;
    this.ambient = null;
    this.ambientFilters = null;
    this.buffers = new Map();
    this.samplesLoading = false;
    this.currentBiome = 'desert';
    this.supported = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);

    // Canali BGM per crossfade fluido e gestione streaming
    this.currentBgm = null;
    this.prevBgm = null;
    this.pendingMusic = null;
    this.unlockedByUser = false;
    this.proceduralBgmActive = false;

    settings?.subscribe?.('*', (_v, key) => {
      if (key.startsWith('audio.')) this._applyGains();
    });

    if (typeof document !== 'undefined') {
      // Sblocco automatico trasparente al primo gesto utente (policy autoplay browser)
      const userInteractionHandler = async () => {
        this.unlockedByUser = true;
        document.removeEventListener('pointerdown', userInteractionHandler);
        document.removeEventListener('click', userInteractionHandler);
        document.removeEventListener('keydown', userInteractionHandler);
        document.removeEventListener('touchstart', userInteractionHandler);
        await this.unlock();
        if (this.pendingMusic) {
          const { trackKey, options } = this.pendingMusic;
          this.pendingMusic = null;
          this.playMusic(trackKey, options);
        }
      };
      document.addEventListener('pointerdown', userInteractionHandler, { once: true, passive: true });
      document.addEventListener('click', userInteractionHandler, { once: true, passive: true });
      document.addEventListener('keydown', userInteractionHandler, { once: true, passive: true });
      document.addEventListener('touchstart', userInteractionHandler, { once: true, passive: true });

      // Crossfade automatico al cambio bioma
      events.on('biome:selected', ({ id }) => {
        this.setBiome(id);
        this.playMusic(id);
      });

      // Risparmio risorse e sospensione AudioContext quando la scheda non è visibile
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.ctx && this.ctx.state === 'running') this.ctx.suspend?.().catch(() => {});
          this.currentBgm?.el?.pause?.();
          this.nextBgm?.el?.pause?.();
        } else {
          if (this.ctx && this.ctx.state === 'suspended' && !this.settings?.get?.('audio.mute')) {
            this.ctx.resume?.().catch(() => {});
          }
          if (this.currentBgm?.el && !this.settings?.get?.('audio.mute')) {
            this.currentBgm.el.play().catch(() => {});
          }
        }
      });
    }
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
      this.loadDefaultSamples().catch(() => {});
      this.startAmbient();
      return this.ctx.state === 'running';
    } catch (e) {
      console.warn('[Audio] sblocco non riuscito', e);
      return false;
    }
  }

  /**
   * Carica un campione audio campionato (OGG/MP3/WAV) nel pool di buffer.
   * Se fallisce o se non supportato, non lancia eccezioni e preserva i fallback procedurali.
   */
  async loadSample(id, url) {
    if (!this.ctx || typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.buffers.set(id, audioBuffer);
      return audioBuffer;
    } catch (e) {
      console.warn(`[Audio] Campione "${id}" (${url}) non caricato, uso fallback procedurale:`, e?.message || e);
      return null;
    }
  }

  /**
   * Pre-carica i campioni audio predefiniti per SFX e rumore ambientale.
   */
  async loadDefaultSamples() {
    if (this.samplesLoading || !this.ctx) return;
    this.samplesLoading = true;
    const samples = [
      { id: 'sfx_dig', url: './assets/audio/sfx_dig_sand.ogg' },
      { id: 'sfx_coin', url: './assets/audio/sfx_coin_pickup.ogg' },
      { id: 'sfx_earthquake', url: './assets/audio/sfx_earthquake.ogg' },
      { id: 'amb_wind', url: './assets/audio/ambient_desert_wind.ogg' },
    ];
    await Promise.allSettled(samples.map((s) => this.loadSample(s.id, s.url)));
  }

  _getMusicEffectiveGain() {
    const s = this.settings;
    if (!s) return 0.6;
    if (s.get('audio.mute')) return 0;
    const master = ((s.get('audio.master') ?? 80) / 100) ** 2;
    const music = ((s.get('audio.music') ?? 60) / 100) ** 2;
    return master * music;
  }

  _applyGains(instant = false) {
    if (this.nodes && this.ctx) {
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

    // Aggiorna istantaneamente il volume degli elementi BGM attivi
    const effectiveMusicGain = this._getMusicEffectiveGain();
    if (this.currentBgm?.el) {
      const alpha = this.currentBgm.fadeAlpha ?? 1;
      this.currentBgm.el.volume = Math.max(0, Math.min(1, alpha * effectiveMusicGain));
    }
    if (this.prevBgm?.el) {
      const alpha = this.prevBgm.fadeAlpha ?? 0;
      this.prevBgm.el.volume = Math.max(0, Math.min(1, alpha * effectiveMusicGain));
    }
  }

  /**
   * Riproduce una traccia musicale di sottofondo (menu, desert, ocean, glacier, jungle)
   * eseguendo una dissolvenza incrociata (crossfade) morbida con la traccia precedente.
   *
   * @param {string} trackKey - Chiave della traccia ('menu' | 'desert' | 'ocean' | 'glacier' | 'jungle')
   * @param {object} [options]
   * @param {number} [options.fadeDuration=1.8] - Durata della dissolvenza incrociata in secondi
   * @param {boolean} [options.loop=true] - Se mandare la traccia in loop continuo
   */
  playMusic(trackKey, { fadeDuration = 1.8, loop = true } = {}) {
    if (!trackKey) return;
    const src = BGM_TRACKS[trackKey];
    if (!src) {
      console.warn(`[Audio] Traccia BGM sconosciuta: "${trackKey}"`);
      return;
    }

    // Se la traccia richiesta è già quella corrente attiva, non riavviare
    if (this.currentBgm && this.currentBgm.trackKey === trackKey) {
      return;
    }

    // Se l'utente non ha ancora interagito con la pagina, memorizza per sblocco autoplay
    if (!this.unlockedByUser) {
      this.pendingMusic = { trackKey, options: { fadeDuration, loop } };
    }

    if (typeof Audio === 'undefined') {
      // Ambiente Node.js o test headless senza Audio API
      this._startProceduralBgmFallback(trackKey);
      return;
    }

    let newAudioEl = null;
    try {
      newAudioEl = new Audio(src);
      newAudioEl.loop = loop;
      newAudioEl.volume = 0;
      newAudioEl.preload = 'auto';
    } catch (e) {
      console.warn(`[Audio] Impossibile creare AudioElement per "${trackKey}":`, e);
      this._startProceduralBgmFallback(trackKey);
      return;
    }

    const nextChannel = {
      el: newAudioEl,
      trackKey,
      isPlaying: false,
      fadeAlpha: 0,
      fadeTimer: null,
    };

    // Fallback procedurale trasparente se la risorsa .mp3 fallisce il download o non è decodificabile
    newAudioEl.addEventListener('error', (err) => {
      console.warn(`[Audio] Errore caricamento file "${src}", attivo fallback procedurale:`, err);
      this._stopBgmChannel(nextChannel);
      if (this.currentBgm === nextChannel) this.currentBgm = null;
      this._startProceduralBgmFallback(trackKey);
    }, { once: true });

    // Avvio riproduzione
    try {
      const playPromise = newAudioEl.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          nextChannel.isPlaying = true;
        }).catch((err) => {
          if (err.name === 'NotAllowedError') {
            // Autoplay bloccato: sarà sbloccato al primo tocco
            this.pendingMusic = { trackKey, options: { fadeDuration, loop } };
          } else {
            console.warn(`[Audio] Errore play() per "${trackKey}":`, err.message);
            this._startProceduralBgmFallback(trackKey);
          }
        });
      } else {
        nextChannel.isPlaying = true;
      }
    } catch (e) {
      console.warn(`[Audio] Eccezione play() BGM "${trackKey}":`, e);
      this._startProceduralBgmFallback(trackKey);
    }

    // Se c'era già un canale in dissolvenza di uscita, fermalo definitivamente
    if (this.prevBgm) {
      this._stopBgmChannel(this.prevBgm);
      this.prevBgm = null;
    }

    const prevChannel = this.currentBgm;
    this.prevBgm = prevChannel;
    this.currentBgm = nextChannel;

    const startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const durationMs = Math.max(100, fadeDuration * 1000);
    const prevStartAlpha = prevChannel?.fadeAlpha ?? 1;

    const fadeStep = () => {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      const curEffectiveGain = this._getMusicEffectiveGain();

      // Dissolvenza in ingresso (fade-in) per la nuova traccia
      nextChannel.fadeAlpha = progress;
      if (nextChannel.el) {
        nextChannel.el.volume = Math.max(0, Math.min(1, progress * curEffectiveGain));
      }

      // Dissolvenza in uscita (fade-out) per la traccia precedente
      if (prevChannel && prevChannel.el) {
        prevChannel.fadeAlpha = Math.max(0, prevStartAlpha * (1 - progress));
        prevChannel.el.volume = Math.max(0, Math.min(1, prevChannel.fadeAlpha * curEffectiveGain));
      }

      if (progress < 1) {
        if (typeof requestAnimationFrame !== 'undefined') {
          nextChannel.fadeTimer = requestAnimationFrame(fadeStep);
        } else {
          nextChannel.fadeTimer = setTimeout(fadeStep, 25);
        }
      } else {
        nextChannel.fadeTimer = null;
        if (this.prevBgm === prevChannel) {
          this._stopBgmChannel(prevChannel);
          this.prevBgm = null;
        }
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      nextChannel.fadeTimer = requestAnimationFrame(fadeStep);
    } else {
      nextChannel.fadeTimer = setTimeout(fadeStep, 25);
    }
  }

  /** Interrompe e rilascia le risorse di un canale BGM. */
  _stopBgmChannel(channel) {
    if (!channel) return;
    if (channel.fadeTimer) {
      if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(channel.fadeTimer);
      clearTimeout(channel.fadeTimer);
      channel.fadeTimer = null;
    }
    channel.isPlaying = false;
    if (channel.el) {
      try {
        channel.el.pause();
        channel.el.currentTime = 0;
        channel.el.removeAttribute('src');
        channel.el.load();
      } catch {}
      channel.el = null;
    }
  }

  /** Sfuma e arresta la musica corrente. */
  stopMusic(fadeDuration = 1.0) {
    if (!this.currentBgm) return;
    const channel = this.currentBgm;
    this.currentBgm = null;
    this.pendingMusic = null;
    if (!channel.el) return;

    const startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const durationMs = Math.max(50, fadeDuration * 1000);
    const startAlpha = channel.fadeAlpha ?? 1;

    const fadeOutStep = () => {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const alpha = Math.max(0, startAlpha * (1 - progress));
      const curGain = this._getMusicEffectiveGain();
      if (channel.el) {
        channel.el.volume = Math.max(0, Math.min(1, alpha * curGain));
      }
      if (progress < 1) {
        if (typeof requestAnimationFrame !== 'undefined') {
          channel.fadeTimer = requestAnimationFrame(fadeOutStep);
        } else {
          channel.fadeTimer = setTimeout(fadeOutStep, 25);
        }
      } else {
        this._stopBgmChannel(channel);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      channel.fadeTimer = requestAnimationFrame(fadeOutStep);
    } else {
      channel.fadeTimer = setTimeout(fadeOutStep, 25);
    }
  }

  /** Attiva il loop procedurale armonico sintetico leggero se la musica esterna non è disponibile. */
  _startProceduralBgmFallback(biomeId = 'desert') {
    if (this.proceduralBgmActive) return;
    this.proceduralBgmActive = true;
    console.info(`[Audio] Fallback sonoro procedurale attivato per bioma "${biomeId}".`);
    this.setBiome(biomeId);
    this.startAmbient();
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
    const sample = this.buffers.get('sfx_coin');
    if (sample) {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = sample;
        src.playbackRate.value = 1 + (Math.random() * 0.15 - 0.075);
        const g = this.ctx.createGain();
        g.gain.value = 0.35;
        src.connect(g);
        g.connect(this.nodes.sfx);
        src.start();
        return;
      } catch (e) {
        console.warn('[Audio] Errore riproduzione sfx_coin, fallback:', e);
      }
    }
    const pitches = [587.33, 880.0, 1174.66]; // D5, A5, D6
    pitches.forEach((f, i) => {
      setTimeout(() => {
        if (!this._ok()) return;
        this._blip({ type: 'triangle', f0: f, f1: f * 1.02, dur: 0.16, vol: 0.2 });
        this._blip({ type: 'sine', f0: f * 2, f1: f * 2.01, dur: 0.1, vol: 0.1 });
      }, i * 50);
    });
  }


  /** Imposta il profilo sonoro del bioma attivo (desert, ocean, glacier, jungle). */
  setBiome(biomeId = 'desert') {
    this.currentBiome = biomeId || 'desert';
    if (this.ambientFilters && this._ok()) {
      const t = this.ctx.currentTime;
      if (this.currentBiome === 'ocean') {
        // Risacca marina in lontananza
        this.ambientFilters.bp.frequency.setTargetAtTime(240, t, 0.25);
        this.ambientFilters.bp.Q.setTargetAtTime(0.9, t, 0.25);
        this.ambientFilters.lp.frequency.setTargetAtTime(220, t, 0.25);
      } else if (this.currentBiome === 'glacier') {
        // Vento polare fischiante
        this.ambientFilters.bp.frequency.setTargetAtTime(680, t, 0.25);
        this.ambientFilters.bp.Q.setTargetAtTime(2.2, t, 0.25);
        this.ambientFilters.lp.frequency.setTargetAtTime(420, t, 0.25);
      } else if (this.currentBiome === 'jungle') {
        // Ronzio di cicale/insetti attutito e brezza umida
        this.ambientFilters.bp.frequency.setTargetAtTime(880, t, 0.25);
        this.ambientFilters.bp.Q.setTargetAtTime(1.6, t, 0.25);
        this.ambientFilters.lp.frequency.setTargetAtTime(260, t, 0.25);
      } else {
        // Deserto d'Oro
        this.ambientFilters.bp.frequency.setTargetAtTime(380, t, 0.25);
        this.ambientFilters.bp.Q.setTargetAtTime(0.6, t, 0.25);
        this.ambientFilters.lp.frequency.setTargetAtTime(320, t, 0.25);
      }
    }
  }

  setBiomeAudio(biomeId = 'desert') {
    this.setBiome(biomeId);
  }

  /**
   * Colpo di pala nel terreno: adatta timbrica ed inviluppo al bioma attivo (desert, ocean, glacier, jungle).
   * `intensity` (0..1.5) scala il volume.
   */
  playDigSound(intensity = 1) {
    if (!this._ok()) return;
    const p = 1 + (Math.random() * 0.3 - 0.15);
    const vol = 0.35 * Math.min(1.5, Math.max(0.2, intensity));

    const sample = this.buffers.get('sfx_dig');
    if (sample && this.currentBiome === 'desert') {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = sample;
        src.playbackRate.value = p;
        const g = this.ctx.createGain();
        g.gain.value = vol;
        src.connect(g);
        g.connect(this.nodes.sfx);
        src.start();
        return;
      } catch (e) {
        console.warn('[Audio] Errore riproduzione sfx_dig, fallback:', e);
      }
    }

    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.22);
    const bp = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    if (this.currentBiome === 'ocean') {
      // Oceano: suono ovattato acquatico + bolla d'aria risonante
      bp.type = 'lowpass';
      bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(950 * p, t);
      bp.frequency.exponentialRampToValueAtTime(340 * p, t + 0.19);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * 0.9, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.21);
      src.connect(bp); bp.connect(g); g.connect(this.nodes.sfx);
      src.start(t);

      this._blip({ type: 'sine', f0: 290 * p, f1: 620 * p, dur: 0.11, vol: vol * 0.55 });
      return;
    }

    if (this.currentBiome === 'glacier') {
      // Ghiacciaio: suono cristallino e scricchiolio di permafrost
      bp.type = 'bandpass';
      bp.Q.value = 2.0;
      bp.frequency.setValueAtTime(3600 * p, t);
      bp.frequency.exponentialRampToValueAtTime(1600 * p, t + 0.16);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * 0.85, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      src.connect(bp); bp.connect(g); g.connect(this.nodes.sfx);
      src.start(t);

      this._blip({ type: 'triangle', f0: 1420 * p, f1: 860 * p, dur: 0.12, vol: vol * 0.5 });
      return;
    }

    if (this.currentBiome === 'jungle') {
      // Giungla: colpo sordo su terra umida e radici legnose
      bp.type = 'lowpass';
      bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(720 * p, t);
      bp.frequency.exponentialRampToValueAtTime(260 * p, t + 0.17);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
      src.connect(bp); bp.connect(g); g.connect(this.nodes.sfx);
      src.start(t);

      this._blip({ type: 'triangle', f0: 165 * p, f1: 68 * p, dur: 0.14, vol: vol * 0.8 });
      return;
    }

    // Deserto d'Oro (default)
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(2400 * p, t);
    bp.frequency.exponentialRampToValueAtTime(700 * p, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    src.connect(bp); bp.connect(g); g.connect(this.nodes.sfx);
    src.start(t);

    this._blip({ type: 'sine', f0: 120 * p, f1: 55 * p, dur: 0.13, vol: vol * 0.7 });
  }

  /** Vento del deserto (campionato o sintetico filtrato con LFO) + drone atlantideo a bassa frequenza. */
  startAmbient() {
    if (!this.ctx || this.ambient) return;
    const ctx = this.ctx;
    const out = this.nodes.music;

    const windSample = this.buffers.get('amb_wind');
    const wind = ctx.createBufferSource();
    wind.buffer = windSample || this._noiseBuffer(3);
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
    this.ambientFilters = { bp, lp, droneGain, windGain };
    this.setBiome(this.currentBiome);
    this.ambient = {
      stop: () => {
        [wind, lfo, ...oscs].forEach((n) => { try { n.stop(); } catch { /* già fermo */ } });
        this.ambientFilters = null;
      },
    };
  }

  /** Modula la timbrica dell'ambiente in base alla quota media raggiunta dallo scavo (Y=12 superficie, Y=0 bedrock). */
  setDepth(depthY = 12) {
    if (!this.ambientFilters || !this._ok()) return;
    const t = this.ctx.currentTime;
    const ratio = Math.max(0, Math.min(1, (12 - depthY) / 12));
    // Suolo profondo: lpFreq scende a 130Hz, drone aumenta volume, vento diventa più cupo
    const lpFreq = 340 - ratio * 190;
    const droneVol = 0.04 + ratio * 0.08;
    const bpFreq = 380 - ratio * 140;

    this.ambientFilters.lp.frequency.setTargetAtTime(lpFreq, t, 0.2);
    this.ambientFilters.droneGain.gain.setTargetAtTime(droneVol, t, 0.2);
    this.ambientFilters.bp.frequency.setTargetAtTime(bpFreq, t, 0.2);
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

  /** Rombo tellurico profondo e boato cosmico per il climax della Maledizione. */
  playCurseRumble() {
    if (!this._ok()) return;
    const sample = this.buffers.get('sfx_earthquake');
    if (sample) {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = sample;
        const g = this.ctx.createGain();
        g.gain.value = 0.5;
        src.connect(g);
        g.connect(this.nodes.sfx);
        src.start();
        return;
      } catch (e) {
        console.warn('[Audio] Errore riproduzione sfx_earthquake, fallback:', e);
      }
    }
    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(55, t);
    osc1.frequency.exponentialRampToValueAtTime(28, t + 3.0);
    osc2.frequency.setValueAtTime(82, t);
    osc2.frequency.exponentialRampToValueAtTime(35, t + 3.0);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, t);
    filter.frequency.linearRampToValueAtTime(90, t + 3.0);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.45, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 3.2);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.nodes.sfx);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 3.3);
    osc2.stop(t + 3.3);
  }

  /** Cascata metallica e arpeggio trionfale per la pioggia del Tesoro. */
  playTreasureShower() {
    if (!this._ok()) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0];
    notes.forEach((f, i) => {
      setTimeout(() => {
        if (!this._ok()) return;
        this._blip({ type: 'triangle', f0: f, f1: f * 1.02, dur: 0.28, vol: 0.22 });
      }, i * 65);
    });
  }

  /** Tintinnio brillante quando si raccoglie una gemma sul fondo. */
  playCoinGlitter() {
    if (!this._ok()) return;
    this._blip({ type: 'sine', f0: 1760, f1: 2637, dur: 0.16, vol: 0.25 });
  }

  /** Vento forte e sferzante per la Tempesta di Sabbia. */
  playStormSound() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(2.5);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, t);
    filter.frequency.linearRampToValueAtTime(750, t + 1.2);
    filter.frequency.linearRampToValueAtTime(320, t + 2.4);
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.5);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.nodes.sfx);
    src.start(t);
  }

  /** Modula progressivamente il vento ambientale durante la tempesta di sabbia (0..1). */
  setStormWind(intensity = 0, rampTime = 0.3) {
    if (!this.ambientFilters || !this._ok()) return;
    const t = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, intensity));
    const targetGain = 0.08 + clamped * 0.36;
    const bpFreq = 380 + clamped * 380;
    const lpFreq = 320 + clamped * 420;
    this.ambientFilters.windGain?.gain?.setTargetAtTime(targetGain, t, rampTime);
    this.ambientFilters.bp?.frequency?.setTargetAtTime(bpFreq, t, rampTime);
    this.ambientFilters.lp?.frequency?.setTargetAtTime(lpFreq, t, rampTime);
  }

  /** Fanfara aurorale ed eco d'oricalco per l'Ascensione di Atlantide. */
  playAscensionChime() {
    if (!this._ok()) return;
    const notes = [440.0, 554.37, 659.25, 880.0, 1108.73, 1318.51, 1760.0];
    notes.forEach((f, i) => {
      setTimeout(() => {
        if (!this._ok()) return;
        this._blip({ type: 'sine', f0: f, f1: f * 1.005, dur: 0.45, vol: 0.22 });
      }, i * 90);
    });
  }

  /** Tintinnio trionfale di sblocco obiettivo / achievement (Fase 10). */
  playAchievementChime() {
    if (!this._ok()) return;
    const chords = [523.25, 659.25, 1046.5]; // C5, E5, C6
    chords.forEach((f, i) => {
      setTimeout(() => {
        if (!this._ok()) return;
        this._blip({ type: 'triangle', f0: f, f1: f * 1.01, dur: 0.35, vol: 0.22 });
        this._blip({ type: 'sine', f0: f * 2, f1: f * 2.01, dur: 0.2, vol: 0.12 });
      }, i * 75);
    });
  }

  /** Fischio comico e solitario del vento per l'anticlimax di Business. */
  playWindWhistle() {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, t); // D5
    osc.frequency.exponentialRampToValueAtTime(440.0, t + 0.7);
    osc.frequency.exponentialRampToValueAtTime(293.66, t + 1.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.9);

    osc.connect(gain);
    gain.connect(this.nodes.sfx);
    osc.start(t);
    osc.stop(t + 1.95);
  }

  stopAmbient() {
    if (this.ambient) {
      try { this.ambient.stop(); } catch {}
      this.ambient = null;
    }
  }

  dispose() {
    this.stopAmbient();
    if (this.currentBgm) {
      this._stopBgmChannel(this.currentBgm);
      this.currentBgm = null;
    }
    if (this.nextBgm) {
      this._stopBgmChannel(this.nextBgm);
      this.nextBgm = null;
    }
    this.pendingMusic = null;
    this.buffers.clear();
    if (this.ctx && this.ctx.state !== 'closed') {
      try { this.ctx.close(); } catch {}
    }
    this.ctx = null;
    this.nodes = null;
  }
}


