// Gestione statistiche cumulative di carriera attraverso tutte le spedizioni.
// Persistenza sincrona su localStorage (dds_stats_v1).
import { events } from './Events.js';

export const STATS_KEY = 'dds_stats_v1';

export class StatsManager {
  constructor(storage = null) {
    try {
      this.storage = storage ?? window.localStorage;
    } catch {
      this.storage = null;
    }

    this.stats = {
      totalClicks: 0,
      totalSandLifetime: 0,
      totalPlaytime: 0,
      ruinsUncovered: 0,
      runsCompleted: 0,
      bestRunTime: null,
      dynamiteUsed: 0,
      tabletsEarned: 0,
      tabletsSpent: 0,
      completedBiomes: [],
    };

    this.load();
  }

  load() {
    if (!this.storage) return this.stats;
    try {
      const raw = this.storage.getItem(STATS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.stats = {
            totalClicks: Number.isFinite(parsed.totalClicks) ? parsed.totalClicks : 0,
            totalSandLifetime: Number.isFinite(parsed.totalSandLifetime) ? parsed.totalSandLifetime : 0,
            totalPlaytime: Number.isFinite(parsed.totalPlaytime) ? parsed.totalPlaytime : 0,
            ruinsUncovered: Number.isFinite(parsed.ruinsUncovered) ? parsed.ruinsUncovered : 0,
            runsCompleted: Number.isFinite(parsed.runsCompleted) ? parsed.runsCompleted : 0,
            bestRunTime: Number.isFinite(parsed.bestRunTime) ? parsed.bestRunTime : null,
            dynamiteUsed: Number.isFinite(parsed.dynamiteUsed) ? parsed.dynamiteUsed : 0,
            tabletsEarned: Number.isFinite(parsed.tabletsEarned) ? parsed.tabletsEarned : 0,
            tabletsSpent: Number.isFinite(parsed.tabletsSpent) ? parsed.tabletsSpent : 0,
            completedBiomes: Array.isArray(parsed.completedBiomes) ? parsed.completedBiomes : [],
          };
        }
      }
    } catch (e) {
      console.warn('[Stats] Errore lettura statistiche:', e);
    }
    return this.stats;
  }

  save() {
    if (typeof window !== 'undefined' && window.__DDS_WIPING_DATA) return false;
    if (!this.storage) return false;
    try {
      this.storage.setItem(STATS_KEY, JSON.stringify(this.stats));
      return true;
    } catch {
      return false;
    }
  }

  get(statName) {
    return this.stats[statName];
  }

  increment(statName, value = 1) {
    if (this.stats[statName] === undefined) return;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      this.stats[statName] += value;
      this.save();
      events.emit('stats:changed', { statName, value: this.stats[statName], stats: this.stats });
    }
  }

  recordRunCompletion(timeSeconds, biome = null) {
    this.stats.runsCompleted++;
    if (Number.isFinite(timeSeconds) && timeSeconds > 0) {
      if (this.stats.bestRunTime === null || timeSeconds < this.stats.bestRunTime) {
        this.stats.bestRunTime = Math.floor(timeSeconds);
      }
    }
    if (biome && !this.stats.completedBiomes.includes(biome)) {
      this.stats.completedBiomes.push(biome);
    }
    this.save();
    events.emit('stats:changed', { statName: 'runsCompleted', value: this.stats.runsCompleted, stats: this.stats });
  }

  reset() {
    this.stats = {
      totalClicks: 0,
      totalSandLifetime: 0,
      totalPlaytime: 0,
      ruinsUncovered: 0,
      runsCompleted: 0,
      bestRunTime: null,
      dynamiteUsed: 0,
      tabletsEarned: 0,
      tabletsSpent: 0,
      completedBiomes: [],
    };
    this.save();
    events.emit('stats:changed', { stats: this.stats });
  }
}

