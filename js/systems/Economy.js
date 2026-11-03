// Gestione dell'economia disaccoppiata dal rendering: timestamp reali (dt), SPS e guadagni offline.
import { events } from '../core/Events.js';
import { calculateSPS } from './Upgrades.js';

export class Economy {
  constructor(state) {
    this.state = state;
    this.sps = calculateSPS(state.upgrades);
    this._accumulated = 0;
    this._unsubs = [
      events.on('upgrade:bought', () => this.refreshSPS()),
    ];
  }

  refreshSPS() {
    const next = calculateSPS(this.state.upgrades);
    if (next !== this.sps) {
      this.sps = next;
      events.emit('sps:changed', { sps: this.sps });
    }
    return this.sps;
  }

  /**
   * Calcolo guadagni offline (massimo 2 ore = 7200s, efficienza 50%).
   * Ritorna l'ammontare di sabbia prodotta mentre il giocatore era via.
   */
  calculateOfflineProgress(lastSaved, sps = this.sps, maxSeconds = 7200) {
    if (!lastSaved || sps <= 0) return 0;
    const elapsedSec = Math.max(0, (Date.now() - lastSaved) / 1000);
    if (elapsedSec < 5) return 0; // ignora chiusure istantanee
    const cappedSec = Math.min(maxSeconds, elapsedSec);
    return Math.floor(cappedSec * sps * 0.5);
  }

  /** Aggiornamento tempo reale (usato se serve accumulo passivo diretto). */
  update(dt) {
    // La produzione della flotta nel mondo 3D è eseguita fisicamente dai Workers.
    // L'Economy mantiene la sincronizzazione dell'SPS nominale.
  }

  dispose() {
    this._unsubs.forEach((u) => u());
  }
}

