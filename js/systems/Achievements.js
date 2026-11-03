// Sistema Obiettivi & Trofei di Carriera.
// Verifica continua e su eventi delle condizioni di sblocco con notifica toast ed audio.
import { events } from '../core/Events.js';
import { showAchievementToast } from '../ui/Toast.js';

export const ACHIEVEMENTS_KEY = 'dds_achievements_v1';

export const ACHIEVEMENT_DEFS = [
  {
    id: 'FIRST_DIG',
    icon: '⛏️',
    check: (ctx) => (ctx.stats?.totalClicks ?? 0) >= 1 || (ctx.state?.clicks ?? 0) >= 1,
  },
  {
    id: 'DUNE_BREAKER',
    icon: '🏜️',
    check: (ctx) => (ctx.state?.totalSand ?? 0) >= 100000,
  },
  {
    id: 'MACHINE_LORD',
    icon: '⚙️',
    check: (ctx) => {
      const u = ctx.state?.upgrades ?? {};
      return ((u.scarab ?? 0) + (u.excavator ?? 0) + (u.dredge ?? 0)) >= 5;
    },
  },
  {
    id: 'ECHOES_PAST',
    icon: '🏛️',
    check: (ctx) => (ctx.state?.completion ?? 0) >= 0.5,
  },
  {
    id: 'TRINITY',
    icon: '🏺',
    check: (ctx) => {
      const seen = ctx.save?.getEndingsSeen?.() ?? [];
      return ['curse', 'treasure', 'business'].every((id) => seen.includes(id));
    },
  },
  {
    id: 'AWAKENING',
    icon: '🔱',
    check: (ctx) => {
      const seen = ctx.save?.getEndingsSeen?.() ?? [];
      return seen.includes('secret');
    },
  },
  {
    id: 'SPEEDRUNNER',
    icon: '⏱️',
    check: (ctx) => {
      const best = ctx.stats?.bestRunTime;
      return best !== null && best !== undefined && best <= 1200;
    },
  },
  {
    id: 'SAND_HOARDER',
    icon: '👑',
    check: (ctx) => (ctx.stats?.totalSandLifetime ?? 0) >= 1000000,
  },
  {
    id: 'ANCIENT_WISDOM',
    icon: '📜',
    check: (ctx) => (ctx.save?.getTablets?.() ?? 0) >= 5 || (ctx.state?.tablets ?? 0) >= 5,
  },
  {
    id: 'STORM_SURVIVOR',
    icon: '🌪️',
    check: (ctx) => !!ctx.eventDiggingInStorm,
  },
  {
    id: 'NOMAD_PARTNER',
    icon: '🐪',
    check: (ctx) => !!ctx.eventNomadTraded,
  },
  {
    id: 'COMPLETIONIST',
    icon: '✨',
    check: (ctx) => (ctx.state?.completion ?? 0) >= 0.999,
  },
];

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
            if (ts) this.unlocked.set(id, ts);
          }
        }
      }
    } catch (e) {
      console.warn('[Achievements] Errore lettura trofei:', e);
    }
  }

  saveData() {
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
    events.on('dig:hit', () => {
      this.check();
    });

    events.on('upgrade:bought', () => {
      this.check();
    });

    events.on('stats:changed', () => {
      this.check();
    });

    events.on('ending:complete', () => {
      this.check();
    });

    events.on('storm:dig', () => {
      this._flags.eventDiggingInStorm = true;
      this.check();
    });

    events.on('merchant:traded', () => {
      this._flags.eventNomadTraded = true;
      this.check();
    });
  }

  isUnlocked(id) {
    return this.unlocked.has(id);
  }

  getUnlockedCount() {
    return this.unlocked.size;
  }

  getTotalCount() {
    return ACHIEVEMENT_DEFS.length;
  }

  unlock(id) {
    if (this.unlocked.has(id)) return false;
    const def = ACHIEVEMENT_DEFS.find((d) => d.id === id);
    if (!def) return false;

    const ts = Date.now();
    this.unlocked.set(id, ts);
    this.saveData();

    // Notifica visiva toast
    showAchievementToast(def);

    // Effetto sonoro trionfale
    if (this.audio?.playAchievementChime) {
      this.audio.playAchievementChime();
    }

    events.emit('achievement:unlocked', { id, timestamp: ts });
    return true;
  }

  check() {
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

