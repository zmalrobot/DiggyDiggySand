// Salvataggio di gioco (separato dalle impostazioni). Versione 1: metadati di sessione,
// economia e tracciamento finale basato su seed mulberry32.
export const SAVE_KEY = 'dds_save_v1';
export const SAVE_BACKUP_KEY = 'dds_save_backup';
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

/**
 * Valida la conformità strutturale del salvataggio.
 * Respinge JSON troncati, valori NaN o infiniti, e oggetti corrotti.
 */
export function validateSave(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Number.isInteger(data.version) || data.version < 1 || data.version > SAVE_VERSION) return false;
  if (!Number.isInteger(data.seed)) return false;
  if (typeof data.sand !== 'number' || Number.isNaN(data.sand) || !Number.isFinite(data.sand) || data.sand < 0) return false;
  if (typeof data.totalSand !== 'number' || Number.isNaN(data.totalSand) || !Number.isFinite(data.totalSand) || data.totalSand < 0) return false;
  if (!data.upgrades || typeof data.upgrades !== 'object' || Array.isArray(data.upgrades)) return false;
  return true;
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
    this.lastRecoveryReason = null;
  }

  /**
   * Legge e valida il salvataggio con schema check.
   * Se il dato primario è corrotto, tenta il ripristino automatico dal backup dds_save_backup.
   * Se anche il backup fallisce, genera un salvataggio pulito senza schermate bianche o crash.
   */
  load() {
    this.lastRecoveryReason = null;
    let primaryData = null;
    let primaryCorrupted = false;

    // 1. Lettura salvataggio principale
    try {
      const raw = this.storage?.getItem(SAVE_KEY);
      if (raw) {
        primaryData = JSON.parse(raw);
        if (!validateSave(primaryData)) {
          primaryCorrupted = true;
          primaryData = null;
        }
      }
    } catch {
      primaryCorrupted = true;
      primaryData = null;
    }

    if (primaryData) {
      if (!primaryData.endingId) primaryData.endingId = pickEnding(primaryData.seed);
      return primaryData;
    }

    // 2. Se primario corrotto o assente, tenta il recupero dal backup
    if (primaryCorrupted) {
      console.warn('[Save] Salvataggio primario corrotto o non conforme. Tentativo di ripristino dal backup...');
      try {
        const rawBackup = this.storage?.getItem(SAVE_BACKUP_KEY);
        if (rawBackup) {
          const backupData = JSON.parse(rawBackup);
          if (validateSave(backupData)) {
            console.info('[Save] Ripristino dal backup completato con successo.');
            if (!backupData.endingId) backupData.endingId = pickEnding(backupData.seed);
            this.lastRecoveryReason = 'backup_restored';
            // Sovrascrivi il file primario corrotto con il backup valido
            this.write(backupData);
            return backupData;
          }
        }
      } catch (err) {
        console.error('[Save] Errore lettura backup:', err);
      }

      // 3. Fallback salvataggio pulito di emergenza
      console.warn('[Save] Backup assente o corrotto: generazione nuovo salvataggio di emergenza pulito.');
      this.lastRecoveryReason = 'emergency_reset';
      return this.createNew();
    }

    return null;
  }

  hasValidSave() { return this.load() !== null; }

  getEndingsSeen() {
    try {
      const raw = this.storage?.getItem('dds_endings_seen');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch {}
    return [];
  }

  recordEnding(id, biome = null) {
    if (!id) return this.getEndingsSeen();
    const seen = new Set(this.getEndingsSeen());
    seen.add(id);
    const arr = Array.from(seen);
    try { this.storage?.setItem('dds_endings_seen', JSON.stringify(arr)); } catch {}

    try {
      const datesRaw = this.storage?.getItem('dds_endings_dates');
      const dates = datesRaw ? JSON.parse(datesRaw) : {};
      if (!dates[id]) {
        dates[id] = Date.now();
        this.storage?.setItem('dds_endings_dates', JSON.stringify(dates));
      }
    } catch {}

    if (biome) {
      this.recordCompletedBiome(biome);
    }

    const cur = this.load();
    if (cur) {
      cur.endingsSeen = arr;
      this.write(cur);
    }
    return arr;
  }

  getEndingUnlockDate(id) {
    try {
      const datesRaw = this.storage?.getItem('dds_endings_dates');
      if (datesRaw) {
        const dates = JSON.parse(datesRaw);
        return dates[id] ?? null;
      }
    } catch {}
    return null;
  }

  getCompletedBiomes() {
    try {
      const raw = this.storage?.getItem('dds_biomes_completed');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch {}
    return [];
  }

  recordCompletedBiome(biome) {
    if (typeof window !== 'undefined' && window.__DDS_WIPING_DATA) return [];
    if (!biome) return this.getCompletedBiomes();
    const completed = new Set(this.getCompletedBiomes());
    completed.add(biome);
    const arr = Array.from(completed);
    try { this.storage?.setItem('dds_biomes_completed', JSON.stringify(arr)); } catch {}
    return arr;
  }

  getTablets() {
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
    if (typeof window !== 'undefined' && window.__DDS_WIPING_DATA) return this.getTablets();
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
    if (typeof window !== 'undefined' && window.__DDS_WIPING_DATA) return false;
    const cur = this.getTablets();
    if (amount > cur) return false;
    const next = cur - amount;
    try {
      this.storage?.setItem('dds_tablets_v1', String(next));
      const spent = (Number(this.storage?.getItem('dds_tablets_spent')) || 0) + amount;
      this.storage?.setItem('dds_tablets_spent', String(spent));
    } catch {}
    const s = this.load();
    if (s) {
      s.tablets = next;
      this.write(s);
    }
    return true;
  }

  getTabletsSpent() {
    try {
      const raw = this.storage?.getItem('dds_tablets_spent');
      if (raw !== null && raw !== undefined) {
        const n = Number(raw);
        if (Number.isFinite(n)) return n;
      }
    } catch {}
    return 0;
  }

  getMetaUpgrades() {
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
    if (typeof window !== 'undefined' && window.__DDS_WIPING_DATA) return {};
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
    if (typeof window !== 'undefined' && window.__DDS_WIPING_DATA) {
      return false;
    }
    if (!validateSave(data)) {
      console.warn('[Save] Scrittura annullata: dati non conformi allo schema.');
      return false;
    }
    try {
      const json = JSON.stringify(data);
      this.storage?.setItem(SAVE_KEY, json);
      // Salva sempre una copia di backup ridondante ad ogni salvataggio valido
      this.storage?.setItem(SAVE_BACKUP_KEY, json);
      return true;
    } catch {
      return false;
    }
  }

  clear() {
    try {
      this.storage?.removeItem(SAVE_KEY);
      this.storage?.removeItem(SAVE_BACKUP_KEY);
    } catch { /* ignora */ }
  }

  /**
   * Procedura centralizzata di Hard Reset:
   * Svuota localStorage, sessionStorage, Cache Storage API, deregistra i Service Worker
   * ed elimina eventuali database IndexedDB, forzando poi il reload con cache-buster.
   *
   * @param {Object} [options]
   * @param {boolean} [options.reload=true] - Se false, non esegue window.location.replace (utile per test e headless QA)
   */
  static async performHardReset(options = {}) {
    const shouldReload = options.reload !== false;

    if (typeof window !== 'undefined') {
      window.__DDS_WIPING_DATA = true;
    }

    try {
      // 1. Svuota localStorage e sessionStorage
      if (typeof window !== 'undefined') {
        try { window.localStorage?.clear?.(); } catch {}
        try { window.sessionStorage?.clear?.(); } catch {}
      }

      // 2. Elimina tutte le Cache PWA (Service Worker Caches)
      const cacheStorage = (typeof window !== 'undefined' && window.caches) ? window.caches : (typeof caches !== 'undefined' ? caches : null);
      if (cacheStorage && typeof cacheStorage.keys === 'function') {
        const cacheNames = await cacheStorage.keys();
        await Promise.all(cacheNames.map((name) => cacheStorage.delete(name)));
      }

      // 3. Deregistra tutti i Service Worker attivi
      const nav = (typeof window !== 'undefined' && window.navigator) ? window.navigator : (typeof navigator !== 'undefined' ? navigator : null);
      if (nav && 'serviceWorker' in nav && nav.serviceWorker?.getRegistrations) {
        const registrations = await nav.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }

      // 4. Elimina eventuali database IndexedDB
      const idb = (typeof window !== 'undefined' && window.indexedDB) ? window.indexedDB : (typeof indexedDB !== 'undefined' ? indexedDB : null);
      if (idb && typeof idb.databases === 'function') {
        const dbs = await idb.databases();
        dbs.forEach((db) => {
          if (db.name) idb.deleteDatabase(db.name);
        });
      }
    } catch (err) {
      console.warn('[DDS] Errore parziale durante la pulizia cache:', err);
    } finally {
      // 5. Ricarica pulita con cache-buster nell'URL
      if (shouldReload && typeof window !== 'undefined' && window.location) {
        const cleanUrl = window.location.origin + window.location.pathname + '?reset=' + Date.now();
        window.location.replace(cleanUrl);
      }
    }

    return { ok: true };
  }

  async performHardReset(options = {}) {
    return Save.performHardReset(options);
  }
}

export async function performHardReset(options = {}) {
  return Save.performHardReset(options);
}

