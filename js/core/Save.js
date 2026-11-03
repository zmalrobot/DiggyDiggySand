// Salvataggio di gioco (separato dalle impostazioni). Versione 1: metadati di sessione,
// economia e tracciamento finale basato su seed mulberry32.
export const SAVE_KEY = 'dds_save_v1';
export const SAVE_VERSION = 1;

export const ENDINGS = [
  { id: 'curse', name: 'La Maledizione di Atlantide', weight: 40 },
  { id: 'treasure', name: 'Il Tesoro d\'Oro Puro', weight: 40 },
  { id: 'business', name: 'L\'Impresa di Scavo SRL', weight: 20 },
];

export function mulberry32(seed) {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickEnding(seed) {
  try {
    const params = new URLSearchParams(window.location.search);
    const override = params.get('ending');
    if (override && ['curse', 'treasure', 'business'].includes(override)) {
      return override;
    }
  } catch {}

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

  /** Nuova spedizione: genera il seed (da cui sarà scelto il finale) e scrive il salvataggio. */
  createNew() {
    const seed = (crypto.getRandomValues(new Uint32Array(1))[0]) | 0;
    const endingId = pickEnding(seed);
    const data = {
      version: SAVE_VERSION,
      seed,
      endingId,
      createdAt: Date.now(),
      lastSaved: Date.now(),
      sand: 0,
      totalSand: 0,
      upgrades: {},
      endingsSeen: this.load()?.endingsSeen ?? [],
    };
    this.write(data);
    return data;
  }



  write(data) {
    try { this.storage?.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
  }

  clear() {
    try { this.storage?.removeItem(SAVE_KEY); } catch { /* ignora */ }
  }
}

