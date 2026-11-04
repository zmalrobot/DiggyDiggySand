// Modulo Accessibilità e Comfort Visivo:
// - Modalità "Riduzione Movimento" (Reduced Motion) sincronizzata con OS e impostazioni.
// - Smart Pause su `visibilitychange` (sospensione AudioContext e ciclo di rendering Three.js senza salti fisici).
import { events } from './Events.js';

export class Accessibility {
  /**
   * @param {Object} options
   * @param {import('./SettingsManager.js').SettingsManager} options.settings
   * @param {import('./AudioEngine.js').AudioEngine} [options.audioEngine]
   * @param {import('../world/SceneManager.js').SceneManager} [options.sceneMgr]
   * @param {import('./Game.js').Game} [options.game]
   */
  constructor({ settings, audioEngine = null, sceneMgr = null, game = null }) {
    this.settings = settings;
    this.audio = audioEngine;
    this.sceneMgr = sceneMgr;
    this.game = game;

    this.reducedMotion = false;
    this._wasAudioRunning = false;
    this._wasRendering = false;
    this._unsubs = [];

    this._bindReducedMotion();
    this._bindSmartPause();
  }

  setGame(game) {
    this.game = game;
  }

  setSceneManager(sceneMgr) {
    this.sceneMgr = sceneMgr;
    if (this.sceneMgr) {
      this.sceneMgr.reducedMotion = this.reducedMotion;
      if (this.sceneMgr.cameraController) {
        this.sceneMgr.cameraController.reducedMotion = this.reducedMotion;
      }
    }
  }

  _bindReducedMotion() {
    const applyReducedMotion = (enabled) => {
      this.reducedMotion = !!enabled;
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('reduced-motion', this.reducedMotion);
        document.body?.classList.toggle('reduced-motion', this.reducedMotion);
      }
      if (this.sceneMgr) {
        this.sceneMgr.reducedMotion = this.reducedMotion;
        if (this.sceneMgr.cameraController) {
          this.sceneMgr.cameraController.reducedMotion = this.reducedMotion;
        }
        if (this.reducedMotion && this.sceneMgr.dust) {
          // Neutralizza o riduci la scia delle particelle atmosferiche rapide
          this.sceneMgr.dust.geometry.setDrawRange(0, 0);
        } else if (!this.reducedMotion && this.sceneMgr.dust) {
          const q = this.settings?.get?.('graphics.particles') || 'med';
          this.sceneMgr.applyParticles?.(q);
        }
      }
      events.emit('accessibility:reducedMotion', { reducedMotion: this.reducedMotion });
    };

    if (this.settings) {
      this._unsubs.push(
        this.settings.subscribe('accessibility.reducedMotion', applyReducedMotion, { immediate: true })
      );
    }

    // Ascolto dinamico delle preferenze di sistema operativo
    if (typeof window !== 'undefined' && window.matchMedia) {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      this._onMediaChange = (e) => {
        // Se non specificato diversamente dall'utente in localStorage, segui il sistema
        if (this.settings && !this.settings.storage?.getItem('dds_settings_v1')) {
          this.settings.set('accessibility.reducedMotion', e.matches);
        }
      };
      media.addEventListener?.('change', this._onMediaChange);
    }
  }

  _bindSmartPause() {
    if (typeof document === 'undefined') return;

    this._onVisibilityChange = () => {
      const isHidden = document.visibilityState === 'hidden';

      if (isHidden) {
        // Scheda in background: sospendi audio e metti in pausa il ciclo di rendering Three.js
        if (this.audio?.ctx && this.audio.ctx.state === 'running') {
          this._wasAudioRunning = true;
          this.audio.ctx.suspend?.().catch(() => {});
        }
        if (this.sceneMgr && this.sceneMgr.running) {
          this._wasRendering = true;
          this.sceneMgr.pauseRendering?.();
        }
        events.emit('visibility:hidden');
      } else {
        // Rientro in primo piano: ripristina AudioContext e riprendi rendering
        if (this._wasAudioRunning && this.audio?.ctx) {
          this.audio.ctx.resume?.().catch(() => {});
          this._wasAudioRunning = false;
        }
        if (this._wasRendering && this.sceneMgr) {
          this.sceneMgr.resumeRendering?.();
          this._wasRendering = false;
        }

        // Clamp massimo protettivo (max 0.1s): azzera lastFrame per prevenire salti repentini di simulazione
        const now = performance.now();
        if (this.sceneMgr) this.sceneMgr.lastFrame = now;
        if (this.game) this.game.lastFrame = now;

        events.emit('visibility:visible');
      }
    };

    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  dispose() {
    this._unsubs.forEach((u) => u());
    this._unsubs = [];
    if (typeof document !== 'undefined' && this._onVisibilityChange) {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
    if (typeof window !== 'undefined' && window.matchMedia && this._onMediaChange) {
      window.matchMedia('(prefers-reduced-motion: reduce)').removeEventListener?.('change', this._onMediaChange);
    }
  }
}

