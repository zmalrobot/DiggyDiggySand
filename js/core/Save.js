// Salvataggio di gioco (separato dalle impostazioni). Versione 1: metadati di sessione,
// economia e tracciamento finale basato su seed mulberry32.
export const SAVE_KEY = 'dds_save_v1';
export const SAVE_VERSION = 1;

export const ENDINGS = [
  { id: 'curse', name: 'La Maledizione di Atlantide', weight: 40 },
  { id: 'treasure', name: 'Il Tesoro d\'Oro Puro', weight: 40 },
  { id: 'business', name: 'L\'Impresa di Scavo SRL', weight: 20 },
];

export const SECRET_ENDING = {
  id: 'secret',
  name: 'L\'Ascensione di Atlantide',
  weight: 0,
};

export function mulberry32(seed) {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickEnding(seed, seenEndings = [], overrideParam = null) {
  try {
    const override = overrideParam || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ending') : null);
    if (override && ['curse', 'treasure', 'business', 'secret'].includes(override)) {
      return override;
    }
  } catch {}

  // Se tutti i 3 finali base sono già stati scoperti, sblocca l'accesso al Finale Segreto
  const baseEndingsSeen = seenEndings.filter((id) => ['curse', 'treasure', 'business'].includes(id));
  if (baseEndingsSeen.length >= 3) {
    return 'secret';
  }

  const rng = mulberry32(seed);
  const total = ENDINGS.reduce((acc, e) => acc + e.weight, 0);
  let r = rng() * total;
  for (const e of ENDINGS) {
    if ((r -= e.weight) < 0) return e.id;
  }
  return ENDINGS[0].id;
}

export class Save {
  constructor(storage = null) {
    try { this.storage = storage ?? window.localStorage; } catch { this.storage = null; }
  }

  /** Legge e valida il salvataggio. Ritorna null se assente o non valido. */
  load() {
    try {
      const raw = this.storage?.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      if (!Number.isInteger(data.version) || data.version < 1 || data.version > SAVE_VERSION) return null;
      if (!Number.isInteger(data.seed)) return null;
      if (!data.endingId) data.endingId = pickEnding(data.seed);
      return data;
    } catch {
      return null;
    }
  }

  hasValidSave() { return this.load() !== null; }

  getEndingsSeen() {
    const fromSave = this.load()?.endingsSeen;
    if (Array.isArray(fromSave) && fromSave.length > 0) return fromSave;
    try {
      const raw = this.storage?.getItem('dds_endings_seen');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch {}
    return Array.isArray(fromSave) ? fromSave : [];
  }

  recordEnding(id) {
    if (!id) return this.getEndingsSeen();
    const seen = new Set(this.getEndingsSeen());
    seen.add(id);
    const arr = Array.from(seen);
    try { this.storage?.setItem('dds_endings_seen', JSON.stringify(arr)); } catch {}
    const cur = this.load();
    if (cur) {
      cur.endingsSeen = arr;
      this.write(cur);
    }
    return arr;
  }

  getTablets() {
    const fromSave = this.load()?.tablets;
    if (Number.isFinite(fromSave)) return fromSave;
    try {
      const raw = this.storage?.getItem('dds_tablets_v1');
      if (raw !== null && raw !== undefined) {
        const n = Number(raw);
        if (Number.isFinite(n)) return n;
      }
    } catch {}
    return 0;
  }

  addTablets(amount) {
    if (!(amount > 0)) return this.getTablets();
    const cur = this.getTablets() + amount;
    try { this.storage?.setItem('dds_tablets_v1', String(cur)); } catch {}
    const s = this.load();
    if (s) {
      s.tablets = cur;
      this.write(s);
    }
    return cur;
  }

  spendTablets(amount) {
    const cur = this.getTablets();
    if (amount > cur) return false;
    const next = cur - amount;
    try { this.storage?.setItem('dds_tablets_v1', String(next)); } catch {}
    const s = this.load();
    if (s) {
      s.tablets = next;
      this.write(s);
    }
    return true;
  }

  getMetaUpgrades() {
    const fromSave = this.load()?.metaUpgrades;
    if (fromSave && typeof fromSave === 'object') return fromSave;
    try {
      const raw = this.storage?.getItem('dds_meta_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return {};
  }

  setMetaUpgrade(id, level) {
    const cur = { ...this.getMetaUpgrades(), [id]: level };
    try { this.storage?.setItem('dds_meta_v1', JSON.stringify(cur)); } catch {}
    const s = this.load();
    if (s) {
      s.metaUpgrades = cur;
      this.write(s);
    }
    return cur;
  }

  /** Nuova spedizione: genera il seed (da cui sarà scelto il finale) e scrive il salvataggio. */
  createNew({ biome = 'desert' } = {}) {
    const seed = (crypto.getRandomValues(new Uint32Array(1))[0]) | 0;
    const seen = this.getEndingsSeen();
    const endingId = pickEnding(seed, seen);
    const metaUpgrades = this.getMetaUpgrades();
    const tablets = this.getTablets();

    // Applica blueprint scarabei iniziali dai meta-upgrade
    const initialUpgrades = {};
    if ((metaUpgrades.excavatorBlueprint ?? 0) > 0) {
      initialUpgrades.scarab = metaUpgrades.excavatorBlueprint;
    }

    const data = {
      version: SAVE_VERSION,
      seed,
      endingId,
      currentBiome: biome || 'desert',
      cheatsEnabled: false,
      godMode: false,
      createdAt: Date.now(),
      lastSaved: Date.now(),
      sand: 0,
      totalSand: 0,
      upgrades: initialUpgrades,
      tablets,
      metaUpgrades,
      tutorialDone: false,
      endingsSeen: seen,
    };
    this.write(data);
    return data;
  }



  getStats() {
    try {
      const raw = this.storage?.getItem('dds_stats_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  getAchievements() {
    try {
      const raw = this.storage?.getItem('dds_achievements_v1');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  write(data) {
    try { this.storage?.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
  }

  clear() {
    try { this.storage?.removeItem(SAVE_KEY); } catch { /* ignora */ }
  }
}

