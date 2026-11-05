// Sistema Obiettivi & Trofei di Carriera (12 Trofei Ufficiali, Art Bible §2, §6).
// Verifica continua delle condizioni di sblocco con notifica toast ed audio.
// Lockout totale dei trofei se cheatsEnabled === true.
import { events } from '../core/Events.js';
import { showAchievementToast } from '../ui/AchievementToast.js';

export const ACHIEVEMENTS_KEY = 'dds_achievements_v1';

export const ACHIEVEMENT_DEFS = [
  {
    id: 'first_strike',
    icon: '⛏️',
    check: (ctx) => (ctx.stats?.totalClicks ?? 0) >= 1 || (ctx.state?.clicks ?? 0) >= 1,
  },
  {
    id: 'sand_millionaire',
    icon: '💰',
    check: (ctx) => (ctx.state?.sand ?? 0) >= 1000000 || (ctx.state?.totalSand ?? 0) >= 1000000 || (ctx.stats?.totalSandLifetime ?? 0) >= 1000000,
  },
  {
    id: 'explosive_temper',
    icon: '🧨',
    check: (ctx) => (ctx.stats?.dynamiteUsed ?? 0) >= 10 || (ctx.state?.dynamiteUsed ?? 0) >= 10,
  },
  {
    id: 'automation_age',
    icon: '⚙️',
    check: (ctx) => {
      const u = ctx.state?.upgrades ?? {};
      return ((u.scarab ?? 0) + (u.excavator ?? 0) + (u.dredge ?? 0)) >= 25;
    },
  },
  {
    id: 'relic_resonance',
    icon: '🏛️',
    check: (ctx) => {
      const u = ctx.state?.upgrades ?? {};
      return (u.relic_resonance ?? 0) >= 1 || (u.relic_leyline ?? 0) >= 1 || (u.relic_abyss ?? 0) >= 1;
    },
  },
  {
    id: 'first_epilogue',
    icon: '🏺',
    check: (ctx) => (ctx.save?.getEndingsSeen?.() ?? []).length >= 1 || (ctx.stats?.runsCompleted ?? 0) >= 1,
  },
  {
    id: 'pantheon_master',
    icon: '👑',
    check: (ctx) => {
      const seen = ctx.save?.getEndingsSeen?.() ?? [];
      return ['curse', 'treasure', 'business', 'secret'].every((id) => seen.includes(id));
    },
  },
  {
    id: 'deep_diver',
    icon: '🌊',
    check: (ctx) => (ctx.save?.getCompletedBiomes?.() ?? []).includes('ocean') || (ctx.stats?.completedBiomes ?? []).includes('ocean'),
  },
  {
    id: 'frost_breaker',
    icon: '❄️',
    check: (ctx) => (ctx.save?.getCompletedBiomes?.() ?? []).includes('glacier') || (ctx.stats?.completedBiomes ?? []).includes('glacier'),
  },
  {
    id: 'jungle_pioneer',
    icon: '🌿',
    check: (ctx) => (ctx.save?.getCompletedBiomes?.() ?? []).includes('jungle') || (ctx.stats?.completedBiomes ?? []).includes('jungle'),
  },
  {
    id: 'speed_demon',
    icon: '⏱️',
    check: (ctx) => {
      const best = ctx.stats?.bestRunTime;
      return best !== null && best !== undefined && best <= 1500;
    },
  },
  {
    id: 'sanctuary_ascendant',
    icon: '🔱',
    check: (ctx) => (ctx.stats?.tabletsSpent ?? 0) >= 50 || (ctx.save?.getTabletsSpent?.() ?? 0) >= 50,
  },
];

const ALIASES = {
  FIRST_DIG: 'first_strike',
  DUNE_BREAKER: 'sand_millionaire',
  MACHINE_LORD: 'automation_age',
  ECHOES_PAST: 'relic_resonance',
  TRINITY: 'pantheon_master',
  AWAKENING: 'pantheon_master',
  SPEEDRUNNER: 'speed_demon',
  SAND_HOARDER: 'sand_millionaire',
  ANCIENT_WISDOM: 'sanctuary_ascendant',
  COMPLETIONIST: 'first_epilogue',
};

export class Achievements {
  constructor({ state = null, statsManager = null, save = null, audio = null } = {}) {
    this.state = state;
    this.stats = statsManager;
    this.save = save;
    this.audio = audio;

    try {
      this.storage = window.localStorage;
    } catch {
      this.storage = null;
    }

    this.unlocked = new Map(); // id -> timestamp
    this._flags = {
      eventDiggingInStorm: false,
      eventNomadTraded: false,
    };

    this.load();
    this._bindEvents();
  }

  load() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(ACHIEVEMENTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (const [id, ts] of Object.entries(parsed)) {
            const realId = ALIASES[id] || id;
            if (ts) this.unlocked.set(realId, ts);
          }
        }
      }
    } catch (e) {
      console.warn('[Achievements] Errore lettura trofei:', e);
    }
  }

  saveData() {
    if (typeof window !== 'undefined' && window.__DDS_WIPING_DATA) return false;
    if (!this.storage) return false;
    try {
      const obj = Object.fromEntries(this.unlocked.entries());
      this.storage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(obj));
      return true;
    } catch {
      return false;
    }
  }

  _bindEvents() {
    events.on('dig:hit', () => this.check());
    events.on('upgrade:bought', () => this.check());
    events.on('stats:changed', () => this.check());
    events.on('ending:complete', () => this.check());
    events.on('ability:used', () => this.check());
    events.on('meta:bought', () => this.check());
  }

  isUnlocked(id) {
    const realId = ALIASES[id] || id;
    return this.unlocked.has(realId);
  }

  getUnlockedCount() {
    return this.unlocked.size;
  }

  getTotalCount() {
    return ACHIEVEMENT_DEFS.length;
  }

  unlock(id) {
    if (this.state?.cheatsEnabled) return false;
    const realId = ALIASES[id] || id;
    if (this.unlocked.has(realId)) return false;
    const def = ACHIEVEMENT_DEFS.find((d) => d.id === realId);
    if (!def) return false;

    const ts = Date.now();
    this.unlocked.set(realId, ts);
    this.saveData();

    // Feedback sonoro cerimoniale
    if (this.audio) {
      if (typeof this.audio.playSfx === 'function') {
        this.audio.playSfx('achievement');
      } else if (typeof this.audio.playAchievementChime === 'function') {
        this.audio.playAchievementChime();
      }
    }

    // Notifica visiva toast con particelle
    showAchievementToast(def, null);

    events.emit('achievement:unlocked', { id: realId, timestamp: ts });
    return true;
  }

  check() {
    if (this.state?.cheatsEnabled) return;

    const ctx = {
      state: this.state,
      stats: this.stats?.stats ?? this.stats,
      save: this.save,
      eventDiggingInStorm: this._flags.eventDiggingInStorm,
      eventNomadTraded: this._flags.eventNomadTraded,
    };

    for (const def of ACHIEVEMENT_DEFS) {
      if (!this.unlocked.has(def.id)) {
        try {
          if (def.check(ctx)) {
            this.unlock(def.id);
          }
        } catch (e) {
          console.warn(`[Achievements] Errore verifica ${def.id}:`, e);
        }
      }
    }
  }

  getAll() {
    return ACHIEVEMENT_DEFS.map((def) => ({
      id: def.id,
      icon: def.icon,
      unlocked: this.unlocked.has(def.id),
      unlockedAt: this.unlocked.get(def.id) ?? null,
    }));
  }
}
