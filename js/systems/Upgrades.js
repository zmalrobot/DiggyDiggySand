// Catalogo e logica degli upgrade: formule di costo esponenziale, statistiche di scavo e produzione passiva (SPS).
import { events } from '../core/Events.js';

export const BRANCHES = {
  manual: { id: 'manual', name: 'Scavo Manuale', desc: 'Migliora la pala, la rapidità e l\'area di impatto.' },
  fleet: { id: 'fleet', name: 'Flotta Autonoma', desc: 'Costrutti e macchine che scavano automaticamente il deserto.' },
};

export const UPGRADE_CATALOG = {
  // Ramo A: Manual Tooling
  shovel: {
    id: 'shovel',
    branch: 'manual',
    name: 'Pala in Oricalco',
    baseCost: 10,
    multiplier: 1.15,
    maxLevel: 50,
    desc: 'Affina la lama e incrementa la sabbia estratta per ogni singolo colpo.',
    getBenefit(lvl) {
      return `+1 Sabbia per colpo (Attuale: ${1 + lvl})`;
    },
  },
  frequency: {
    id: 'frequency',
    branch: 'manual',
    name: 'Ritmo Cinetico',
    baseCost: 45,
    multiplier: 1.17,
    maxLevel: 20,
    desc: 'Riduce l\'intervallo tra i colpi continuati quando tieni premuto il mouse.',
    getBenefit(lvl) {
      const rate = lvl === 0 ? '2.0' : (1 / Math.max(0.06, 0.35 * Math.pow(0.93, lvl))).toFixed(1);
      return `Frequenza hold: ${rate} colpi/s`;
    },
  },
  radius: {
    id: 'radius',
    branch: 'manual',
    name: 'Raggio di Scavo',
    baseCost: 90,
    multiplier: 1.16,
    maxLevel: 15,
    desc: 'Espande il raggio del cratere conico a ogni impatto sul terreno.',
    getBenefit(lvl) {
      return `Raggio: ${(1.5 + lvl * 0.45).toFixed(2)}m (+0.45m)`;
    },
  },
  georadar: {
    id: 'georadar',
    branch: 'manual',
    name: 'Georadar di Profondità',
    baseCost: 500,
    multiplier: 1.0,
    maxLevel: 1,
    desc: 'Bussola a risonanza che scansiona il sottosuolo e rileva anomalie prima di dissotterrarle.',
    getBenefit(lvl) {
      return lvl > 0 ? 'Radar attivo nell\'HUD con letture live' : 'Sblocca bussola e letture criptiche del sottosuolo';
    },
  },


  // Ramo B: Autonomous Fleet
  scarab: {
    id: 'scarab',
    branch: 'fleet',
    name: 'Scarafaggio Meccanico',
    baseCost: 120,
    multiplier: 1.15,
    maxLevel: 50,
    dpsPerLevel: 1.0,
    cycleTime: 2.0,    // ogni 2.0s scava
    digRadius: 1.2,
    desc: 'Automa dorato leggero che pattuglia le dune e scava la sabbia a intervalli regolari.',
    getBenefit(lvl) {
      return `+1.0 Sabbia/s per livello (Totale: ${(lvl * 1.0).toFixed(1)}/s)`;
    },
  },
  excavator: {
    id: 'excavator',
    branch: 'fleet',
    name: 'Escavatore a Vapore',
    baseCost: 1200,
    multiplier: 1.16,
    maxLevel: 30,
    dpsPerLevel: 25.0,
    cycleTime: 3.0,    // ogni 3.0s scava
    digRadius: 3.2,
    desc: 'Macchinario pesante con braccio a pistone che scava crateri ampi con grande potenza.',
    getBenefit(lvl) {
      return `+25.0 Sabbia/s per livello (Totale: ${(lvl * 25.0).toFixed(1)}/s)`;
    },
  },
  dredge: {
    id: 'dredge',
    branch: 'fleet',
    name: 'Draga Sabbiosa Atlantea',
    baseCost: 12000,
    multiplier: 1.17,
    maxLevel: 25,
    dpsPerLevel: 200.0,
    cycleTime: 4.0,    // ogni 4.0s scava
    digRadius: 5.5,
    desc: 'Imponente ruota a tazze rotante che macina e rimuove enormi volumi di duna.',
    getBenefit(lvl) {
      return `+200.0 Sabbia/s per livello (Totale: ${(lvl * 200.0).toFixed(1)}/s)`;
    },
  },
};

/** Formula costi: Math.floor(baseCost * Math.pow(multiplier, level)). */
export function getUpgradeCost(def, level = 0) {
  if (level >= def.maxLevel) return Infinity;
  return Math.floor(def.baseCost * Math.pow(def.multiplier, level));
}

/** Calcola la produzione passiva totale al secondo (Sand Per Second - SPS). */
export function calculateSPS(upgrades = {}) {
  let total = 0;
  for (const [id, def] of Object.entries(UPGRADE_CATALOG)) {
    if (def.dpsPerLevel) {
      total += (upgrades[id] ?? 0) * def.dpsPerLevel;
    }
  }
  return total;
}

/** Verifica se il giocatore può acquistare l'upgrade. */
export function canAffordUpgrade(id, state) {
  const def = UPGRADE_CATALOG[id];
  if (!def) return false;
  const currentLvl = state.upgrades[id] ?? 0;
  if (currentLvl >= def.maxLevel) return false;
  const cost = getUpgradeCost(def, currentLvl);
  return state.sand >= cost;
}

/** Acquista un livello dell'upgrade se possibile. Ritorna true se riuscito. */
export function buyUpgrade(id, state, audio = null) {
  const def = UPGRADE_CATALOG[id];
  if (!def) return false;
  const currentLvl = state.upgrades[id] ?? 0;
  if (currentLvl >= def.maxLevel) return false;
  const cost = getUpgradeCost(def, currentLvl);

  if (!state.spend(cost)) return false;

  const nextLvl = currentLvl + 1;
  state.upgrades[id] = nextLvl;

  audio?.playPurchaseSound?.();
  events.emit('upgrade:bought', { id, level: nextLvl, cost, def });
  return true;
}

