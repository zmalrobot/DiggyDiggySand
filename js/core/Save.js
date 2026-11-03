// Salvataggio di gioco (separato dalle impostazioni). Versione 1: solo metadati di sessione;
// il terreno e l'economia arrivano nelle milestone successive.
export const SAVE_KEY = 'dds_save_v1';
export const SAVE_VERSION = 1;

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
      return data;
    } catch {
      return null;
    }
  }

  hasValidSave() { return this.load() !== null; }

  /** Nuova spedizione: genera il seed (da cui sarà scelto il finale) e scrive il salvataggio. */
  createNew() {
    const seed = (crypto.getRandomValues(new Uint32Array(1))[0]) | 0;
    const data = { version: SAVE_VERSION, seed, createdAt: Date.now(), sand: 0, upgrades: {}, endingsSeen: this.load()?.endingsSeen ?? [] };
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

