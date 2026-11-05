// Gestore dei Biomi di Spedizione (Fase 12): Deserto d'Oro, Oceano Prosciugato, Ghiacciaio Arcaico, Giungla Sepolta.
// Definisce palette strati, modificatori fisici di scavo, atmosfera, particelle, requisiti di sblocco e persistenza.
import { events } from '../core/Events.js';

export const BIOMES_STORAGE_KEY = 'dds_biomes_v1';

export const BIOME_CATALOG = {
  desert: {
    id: 'desert',
    nameIt: "Deserto d'Oro",
    nameEn: 'Golden Desert',
    subtitleIt: 'Le Dune Ancestrali di Kemet',
    subtitleEn: 'The Ancestral Dunes of Kemet',
    colors: {
      layer1: '#e0c27a',
      layer2: '#b88a44',
      layer3: '#6e563b',
      vein: '#0fe3c1',
      hex1: 0xe0c27a,
      hex2: 0xb88a44,
      hex3: 0x6e563b,
      veinHex: 0x0fe3c1,
    },
    mechanics: {
      resistance: 1.0,
      midLayerResistance: 1.0,
      volumeMultiplier: 1.0,
      sandValueMultiplier: 1.0,
      rootBlockFactor: 0,
      rootHitsRequired: 0,
    },
    particles: {
      type: 'sand',
      bubbleParticles: false,
      iceShards: false,
      sparkColor: 0x0fe3c1,
    },
    atmosphere: {
      sunColor: '#fff0d0',
      fogColor: '#8c6239',
      hemiSky: '#ffe8b8',
      hemiGround: '#4a3219',
      skyTop: '#1d3b52',
      skyMid: '#7d8f8c',
      skyHorizon: '#e0b979',
      skyBottom: '#ecd599',
    },
    unlock: {
      unlockedByDefault: true,
      minWins: 0,
      tabletCost: 0,
    },
    audioProfile: 'desert',
  },

  ocean: {
    id: 'ocean',
    nameIt: 'Oceano Prosciugato',
    nameEn: 'Drained Ocean',
    subtitleIt: 'Abisso Corallino Sommerso',
    subtitleEn: 'Submerged Coral Abyss',
    colors: {
      layer1: '#f5e6ca', // sabbia corallina chiara
      layer2: '#4a7c82', // sedimenti marini celesti
      layer3: '#1b3240', // basamento abissale
      vein: '#f5ba23',   // frammenti di conchiglie dorate
      hex1: 0xf5e6ca,
      hex2: 0x4a7c82,
      hex3: 0x1b3240,
      veinHex: 0xf5ba23,
    },
    mechanics: {
      resistance: 0.8,           // -20% resistenza (terreno più morbido)
      midLayerResistance: 0.8,
      volumeMultiplier: 1.15,    // +15% volume iniziale
      sandValueMultiplier: 1.25, // +25% valore sabbia
      rootBlockFactor: 0,
      rootHitsRequired: 0,
    },
    particles: {
      type: 'bubbles',
      bubbleParticles: true,     // bolle d'aria effimere e conchiglie dorate
      iceShards: false,
      sparkColor: 0xf5ba23,
    },
    atmosphere: {
      sunColor: '#d4f8ff',
      fogColor: '#1f4e5f',
      hemiSky: '#a8f0ff',
      hemiGround: '#13303d',
      skyTop: '#072233',
      skyMid: '#1f5c6e',
      skyHorizon: '#4ea8b8',
      skyBottom: '#9be0e8',
    },
    unlock: {
      unlockedByDefault: false,
      minWins: 1,
      tabletCost: 10,
    },
    audioProfile: 'ocean',
  },

  glacier: {
    id: 'glacier',
    nameIt: 'Ghiacciaio Arcaico',
    nameEn: 'Glacial Frost',
    subtitleIt: 'Cripta del Permafrost Eterno',
    subtitleEn: 'Crypt of Eternal Permafrost',
    colors: {
      layer1: '#e8f4f8', // neve compatta
      layer2: '#7baec2', // ghiaccio permafrost traslucido
      layer3: '#2a3b45', // roccia scistosa fredda
      vein: '#00f2ff',   // vene di zaffiro glaciale
      hex1: 0xe8f4f8,
      hex2: 0x7baec2,
      hex3: 0x2a3b45,
      veinHex: 0x00f2ff,
    },
    mechanics: {
      resistance: 1.15,
      midLayerResistance: 1.35,  // +35% resistenza nello strato intermedio di permafrost
      volumeMultiplier: 1.0,
      sandValueMultiplier: 1.35, // +35% valore sabbia
      rootBlockFactor: 0,
      rootHitsRequired: 0,
    },
    particles: {
      type: 'ice',
      bubbleParticles: false,
      iceShards: true,           // schegge di ghiaccio cristalline
      sparkColor: 0xb8f2ff,
    },
    atmosphere: {
      sunColor: '#e6f7ff',
      fogColor: '#4a6b82',
      hemiSky: '#d8f2ff',
      hemiGround: '#243746',
      skyTop: '#0f2537',
      skyMid: '#3f6a87',
      skyHorizon: '#8fc1db',
      skyBottom: '#d5eef7',
    },
    unlock: {
      unlockedByDefault: false,
      minWins: 2,
      tabletCost: 20,
    },
    audioProfile: 'glacier',
  },

  jungle: {
    id: 'jungle',
    nameIt: 'Giungla Sepolta',
    nameEn: 'Overgrown Oasis',
    subtitleIt: 'Ziggurat di Smeraldo e Radici',
    subtitleEn: 'Emerald Ziggurat & Roots',
    colors: {
      layer1: '#3d5c38', // humus scuro con muschio
      layer2: '#5c4028', // argilla densa
      layer3: '#2e241c', // arenaria umida
      vein: '#2ecc71',   // venature smeraldo
      hex1: 0x3d5c38,
      hex2: 0x5c4028,
      hex3: 0x2e241c,
      veinHex: 0x2ecc71,
    },
    mechanics: {
      resistance: 1.1,
      midLayerResistance: 1.1,
      volumeMultiplier: 1.0,
      sandValueMultiplier: 1.4,  // +40% valore sabbia
      rootBlockFactor: 0.35,     // radici sepolte bloccano il 35% del raggio finché non spezzate
      rootHitsRequired: 3,       // colpi multipli per rimuovere le radici nel settore
    },
    particles: {
      type: 'jungle',
      bubbleParticles: false,
      iceShards: false,
      sparkColor: 0x2ecc71,
    },
    atmosphere: {
      sunColor: '#ffe8a3',
      fogColor: '#243b24',
      hemiSky: '#b8e09e',
      hemiGround: '#261d14',
      skyTop: '#0d2618',
      skyMid: '#2e5936',
      skyHorizon: '#7a9a55',
      skyBottom: '#c2cfa0',
    },
    unlock: {
      unlockedByDefault: false,
      minWins: 3,
      tabletCost: 35,
    },
    audioProfile: 'jungle',
  },
};

export const BIOME_LIST = Object.values(BIOME_CATALOG);

export class BiomeManager {
  constructor(save = null, statsManager = null, storage = null) {
    this.save = save;
    this.statsManager = statsManager;
    if (storage) {
      this.storage = storage;
    } else {
      try {
        this.storage = window.localStorage;
      } catch {
        this.storage = null;
      }
    }

    this.currentBiome = 'desert';
    this.unlocked = new Set(['desert']);
    this.load();
  }

  load() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(BIOMES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.unlocked)) {
          parsed.unlocked.forEach((id) => {
            if (BIOME_CATALOG[id]) this.unlocked.add(id);
          });
        }
        if (parsed.currentBiome && BIOME_CATALOG[parsed.currentBiome]) {
          this.currentBiome = parsed.currentBiome;
        }
      }
    } catch (e) {
      console.warn('[BiomeManager] Errore lettura stato biomi:', e);
    }
  }

  saveData() {
    if (typeof window !== 'undefined' && window.__DDS_WIPING_DATA) return false;
    if (!this.storage) return false;
    try {
      const payload = {
        currentBiome: this.currentBiome,
        unlocked: Array.from(this.unlocked),
      };
      this.storage.setItem(BIOMES_STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  getBiome(id = this.currentBiome) {
    return BIOME_CATALOG[id] || BIOME_CATALOG.desert;
  }

  /** Conta il numero di vittorie/spedizioni completate dal giocatore. */
  getWinsCount(saveRef = null, statsRef = null) {
    const s = saveRef || this.save;
    const st = statsRef || this.statsManager;
    const runsCompleted = st?.stats?.runsCompleted ?? s?.getStats?.()?.runsCompleted ?? 0;
    const endingsSeen = s?.getEndingsSeen?.()?.length ?? 0;
    return Math.max(runsCompleted, endingsSeen);
  }

  /** Verifica se un bioma è sbloccato (di default, per vittorie raggiunte o sbloccato con Tavolette τ). */
  isUnlocked(id, saveRef = null, statsRef = null) {
    const b = BIOME_CATALOG[id];
    if (!b) return false;
    if (b.unlock.unlockedByDefault || this.unlocked.has(id)) return true;
    const wins = this.getWinsCount(saveRef, statsRef);
    if (b.unlock.minWins > 0 && wins >= b.unlock.minWins) {
      this.unlocked.add(id);
      this.saveData();
      return true;
    }
    return false;
  }

  /** Sblocca un bioma spendendo Tavolette Antiche τ. */
  unlockWithTablets(id, saveRef = null) {
    const b = BIOME_CATALOG[id];
    if (!b) return false;
    if (this.isUnlocked(id, saveRef)) return true;

    const s = saveRef || this.save;
    const cost = b.unlock.tabletCost || 0;
    const currentTablets = s?.getTablets?.() ?? 0;
    if (currentTablets < cost) return false;

    if (cost > 0 && s?.spendTablets) {
      const ok = s.spendTablets(cost);
      if (!ok) return false;
    }

    this.unlocked.add(id);
    this.saveData();
    events.emit('biome:unlocked', { id, cost });
    return true;
  }

  /** Sblocca tutti i biomi (cheat / debug). */
  unlockAll() {
    for (const id of Object.keys(BIOME_CATALOG)) {
      this.unlocked.add(id);
    }
    this.saveData();
    events.emit('biome:unlocked_all');
  }

  /** Seleziona il bioma attivo per la spedizione ed emette l'evento `biome:selected`. */
  selectBiome(id) {
    if (!BIOME_CATALOG[id]) return false;
    this.currentBiome = id;
    this.saveData();
    events.emit('biome:selected', { id, config: BIOME_CATALOG[id] });
    return true;
  }

  /** Restituisce l'elenco completo dei biomi con stato di sblocco ed equipaggiamento. */
  getAll(saveRef = null, statsRef = null) {
    const wins = this.getWinsCount(saveRef, statsRef);
    return BIOME_LIST.map((b) => ({
      ...b,
      isUnlocked: this.isUnlocked(b.id, saveRef, statsRef),
      isSelected: this.currentBiome === b.id,
      wins,
    }));
  }
}

