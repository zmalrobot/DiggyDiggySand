// Gestore centralizzato dei tre finali dinamici (Curse, Treasure, Business).
// Interfaccia comune e ciclo vitale: prepare, onProgress, trigger, update, dispose.
import { CurseEnding } from './CurseEnding.js';
import { TreasureEnding } from './TreasureEnding.js';
import { BusinessEnding } from './BusinessEnding.js';
import { SecretEnding } from './SecretEnding.js';
import { calculateTabletsEarned } from '../systems/Prestige.js';
import { events } from '../core/Events.js';

export const ENDING_THRESHOLD = 0.98; // Trigger automatico a completamento quasi totale (98%-100%)

export class EndingManager {
  constructor({ scene, terrain, state, audio, particles, city, controls, overlay, save, game }) {
    this.scene = scene;
    this.terrain = terrain;
    this.state = state;
    this.audio = audio;
    this.particles = particles;
    this.city = city;
    this.controls = controls;
    this.overlay = overlay;
    this.save = save;
    this.game = game;

    this.activeEnding = null;
    this.hasTriggered = false;
    this.sandboxMode = false;

    this._initEnding();
  }

  _initEnding() {
    const id = this.state?.endingId || 'curse';
    switch (id) {
      case 'secret':
        this.activeEnding = new SecretEnding();
        break;
      case 'treasure':
        this.activeEnding = new TreasureEnding();
        break;
      case 'business':
        this.activeEnding = new BusinessEnding();
        break;
      case 'curse':
      default:
        this.activeEnding = new CurseEnding();
        break;
    }

    this.activeEnding.prepare({
      scene: this.scene,
      terrain: this.terrain,
      state: this.state,
      audio: this.audio,
      particles: this.particles,
      city: this.city,
      controls: this.controls,
    });
  }

  /**
   * Monitora l'avanzamento dello scavo (chiamato ad ogni aggiornamento o cambio completamento).
   */
  onProgress(completion) {
    if (this.hasTriggered || this.sandboxMode) return;
    this.activeEnding?.onProgress?.(completion);

    if (completion >= ENDING_THRESHOLD) {
      this.trigger();
    }
  }

  /**
   * Avvia la sequenza climax del finale attivo.
   */
  trigger() {
    if (this.hasTriggered) return;
    this.hasTriggered = true;

    // Disabilita comandi di scavo standard durante il climax
    if (this.game?.digging) {
      this.game.digging.setEnabled(false);
    }

    this.activeEnding?.trigger?.((result) => {
      // Registra l'ending scoperto tra i trofei
      this.save?.recordEnding?.(result.endingId);

      // Assegna Tavolette Antiche τ calcolate sulla sabbia totale estratta
      const tabletsEarned = calculateTabletsEarned(this.state?.totalSand ?? 0);
      this.save?.addTablets?.(tabletsEarned);
      if (this.state) {
        this.state.tablets = this.save?.getTablets?.() ?? 0;
      }

      // Presenta l'epilogo a tutto schermo con Tavolette Antiche
      this.overlay?.show({
        ...result,
        stats: {
          timeSeconds: this.state?.elapsedSeconds ?? 0,
          sandTotal: this.state?.totalSand ?? 0,
          clicks: this.state?.clicks ?? 0,
          completion: this.state?.completion ?? 1.0,
          tabletsEarned,
        },
        onRestart: () => this.game?.startNewRun?.(),
        onMenu: () => this.game?.returnToMenu?.(),
        onSandbox: result.sandboxAvailable ? () => this.enterSandbox() : null,
      });

      events.emit('ending:completed', { ...result, tabletsEarned });
    });
  }

  enterSandbox() {
    this.sandboxMode = true;
    this.overlay?.hide();
    if (this.game?.digging) {
      this.game.digging.setEnabled(true);
    }
  }

  forceEnding(id) {
    if (this.activeEnding) {
      this.activeEnding.dispose?.();
      this.activeEnding = null;
    }
    this.hasTriggered = false;
    this.sandboxMode = false;
    if (this.state) this.state.endingId = id;
    this._initEnding();
    this.trigger();
  }

  update(dt) {
    if (this.hasTriggered && !this.sandboxMode) {
      this.activeEnding?.update?.(dt);
    }
  }

  dispose() {
    this.activeEnding?.dispose?.();
    this.activeEnding = null;
    this.hasTriggered = false;
    this.sandboxMode = false;
  }
}

