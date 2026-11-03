// Stato di gioco (fonte unica di verità per economia e progresso). Il rendering lo legge soltanto.
import { events } from './Events.js';

export const STATE_VERSION = 1;

/** Statistiche iniziali (Upgrade Tree: Shovel T1). I livelli upgrade le modificano dalla M2. */
export const BASE_STATS = {
  power: 1,        // sabbia per colpo (U1.1: 1 + n)
  radius: 1.5,     // metri (raggio base richiesto dalla Fase 1; +0.45 per livello da U1.3)
  digRate: 2.0,    // colpi al secondo in hold (U1.2 la porterà fino a ~16.6/s)
};
export const MIN_TICK = 0.06; // secondi: tick minimo di scavo (AGENTS §4)

export class State {
  constructor() { this.reset(); }

  reset(data = {}) {
    this.version = STATE_VERSION;
    this.seed = data.seed ?? 0;
    this.endingId = data.endingId ?? 'curse';
    this.sand = Number.isFinite(data.sand) ? Math.max(0, data.sand) : 0;
    this.totalSand = Number.isFinite(data.totalSand) ? Math.max(0, data.totalSand) : this.sand;
    this.upgrades = { ...(data.upgrades ?? {}) };
    this.completion = 0; // 0..1, derivato dal terreno
    this.lastSaved = data.lastSaved ?? data.lastSeen ?? Date.now();
  }


  /** Statistiche correnti derivate dai livelli degli upgrade. */
  get stats() {
    const n = this.upgrades;
    const freqLvl = n.frequency ?? 0;
    // Formula U1.2: TickInterval = max(0.06s, 0.35s * 0.93^n)
    const interval = freqLvl === 0 ? 0.5 : Math.max(MIN_TICK, 0.35 * Math.pow(0.93, freqLvl));
    return {
      power: BASE_STATS.power + (n.shovel ?? 0),
      radius: BASE_STATS.radius + 0.45 * (n.radius ?? 0),
      digRate: freqLvl === 0 ? BASE_STATS.digRate : Math.min(1 / MIN_TICK, 1 / interval),
    };
  }

  addSand(amount) {
    if (!(amount > 0)) return;
    this.sand += amount;
    this.totalSand += amount;
    events.emit('sand:changed', { sand: this.sand, delta: amount });
  }

  /** Spende sabbia se disponibile. Ritorna true se l'acquisto è riuscito. */
  spend(amount) {
    if (amount > this.sand) return false;
    this.sand -= amount;
    events.emit('sand:changed', { sand: this.sand, delta: -amount });
    return true;
  }

  setCompletion(c) {
    const v = Math.min(1, Math.max(0, c));
    if (v === this.completion) return;
    this.completion = v;
    events.emit('completion:changed', { completion: v });
  }

  /** Dati da scrivere nel salvataggio. */
  toSave(base = {}) {
    return {
      ...base,
      version: base.version ?? 1,
      seed: this.seed,
      endingId: this.endingId,
      sand: this.sand,
      totalSand: this.totalSand,
      upgrades: this.upgrades,
      lastSaved: Date.now(),
      lastSeen: Date.now(),
    };
  }

}


