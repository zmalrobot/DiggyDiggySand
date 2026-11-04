// Catalogo e logica degli upgrade: formule di costo esponenziale, statistiche di scavo e produzione passiva (SPS).
import { events } from '../core/Events.js';
import { i18n } from '../core/I18n.js';

export const BRANCHES = {
  manual: {
    id: 'manual',
    get name() { return i18n.t('shop.tabs.manual') || 'Scavo Manuale'; },
    get desc() { return i18n.t('shop.subtitle') || 'Migliora la pala, la rapidità e l\'area di impatto.'; },
  },
  fleet: {
    id: 'fleet',
    get name() { return i18n.t('shop.tabs.fleet') || 'Flotta Autonoma'; },
    get desc() { return i18n.t('shop.subtitle') || 'Costrutti e macchine che scavano automaticamente il deserto.'; },
  },
  relics: {
    id: 'relics',
    get name() { return i18n.t('shop.tabs.relics') || 'Reliquie'; },
    get desc() { return i18n.t('shop.subtitleRelics') || 'Potenti sinergie e moltiplicatori delle rovine atlantidee.'; },
  },
};

export function getUpgradeName(def) {
  return i18n.t(`upgrades.${def.id}.name`) || def.name;
}

export function getUpgradeDesc(def) {
  return i18n.t(`upgrades.${def.id}.desc`) || def.desc;
}

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
      return i18n.t('upgrades.shovel.benefit', { amount: 1 + lvl }) || `+1 Sabbia per colpo (Attuale: ${1 + lvl})`;
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
      return i18n.t('upgrades.frequency.benefit', { rate }) || `Frequenza hold: ${rate} colpi/s`;
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
      const rad = (1.5 + lvl * 0.45).toFixed(2);
      return i18n.t('upgrades.radius.benefit', { radius: rad }) || `Raggio: ${rad}m (+0.45m)`;
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
      if (lvl > 0) {
        return i18n.t('upgrades.georadar.benefitActive') || 'Radar attivo nell\'HUD con letture live';
      }
      return i18n.t('upgrades.georadar.benefitInactive') || 'Sblocca bussola e letture criptiche del sottosuolo';
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
      const total = (lvl * 1.0).toFixed(1);
      return i18n.t('upgrades.scarab.benefit', { total }) || `+1.0 Sabbia/s per livello (Totale: ${total}/s)`;
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
      const total = (lvl * 25.0).toFixed(1);
      return i18n.t('upgrades.excavator.benefit', { total }) || `+25.0 Sabbia/s per livello (Totale: ${total}/s)`;
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
      const total = (lvl * 200.0).toFixed(1);
      return i18n.t('upgrades.dredge.benefit', { total }) || `+200.0 Sabbia/s per livello (Totale: ${total}/s)`;
    },
  },

  // Ramo C: Atlantean Relics (Reliquie di Risonanza)
  relic_cartel: {
    id: 'relic_cartel',
    branch: 'relics',
    name: 'Cartello del Papiro',
    baseCost: 8000,
    multiplier: 1.0,
    maxLevel: 1,
    minCompletion: 0.15,
    desc: 'Accordi mercantili che incrementano del 25% la produzione di tutta la flotta autonoma.',
    getBenefit(lvl) {
      return lvl > 0
        ? (i18n.t('upgrades.relic_cartel.benefitActive') || '+25% Produzione Flotta (Attivo)')
        : (i18n.t('upgrades.relic_cartel.benefitInactive') || '+25% Produzione Flotta (Richiede 15% Scavato)');
    },
  },
  relic_leyline: {
    id: 'relic_leyline',
    branch: 'relics',
    name: 'Sintonia Tellurica',
    baseCost: 15000,
    multiplier: 1.0,
    maxLevel: 1,
    minCompletion: 0.25,
    desc: 'Canalizza l\'energia del terreno: ogni click manuale infligge un bonus pari al 4% del DPS totale della flotta.',
    getBenefit(lvl) {
      return lvl > 0
        ? (i18n.t('upgrades.relic_leyline.benefitActive') || '+4% DPS Flotta su ogni click (Attivo)')
        : (i18n.t('upgrades.relic_leyline.benefitInactive') || '+4% DPS Flotta su ogni click (Richiede 25% Scavato)');
    },
  },
  relic_gears: {
    id: 'relic_gears',
    branch: 'relics',
    name: 'Ingranaggi d\'Oricalco',
    baseCost: 75000,
    multiplier: 1.0,
    maxLevel: 1,
    minCompletion: 0.50,
    desc: 'Raddoppia (+100%) la potenza e la velocità di scavo di Escavatori a Vapore e Draghe.',
    getBenefit(lvl) {
      return lvl > 0
        ? (i18n.t('upgrades.relic_gears.benefitActive') || '2x Potenza Escavatori e Draghe (Attivo)')
        : (i18n.t('upgrades.relic_gears.benefitInactive') || '2x Potenza Escavatori e Draghe (Richiede 50% Scavato)');
    },
  },
  relic_anomaly: {
    id: 'relic_anomaly',
    branch: 'relics',
    name: 'Armonizzatore di Anomalie',
    baseCost: 250000,
    multiplier: 1.0,
    maxLevel: 1,
    minCompletion: 0.65,
    desc: 'Stabilizzatore quantico che aumenta del 50% il valore economico di tutta la sabbia estratta.',
    getBenefit(lvl) {
      return lvl > 0
        ? (i18n.t('upgrades.relic_anomaly.benefitActive') || '+50% Valore della Sabbia (Attivo)')
        : (i18n.t('upgrades.relic_anomaly.benefitInactive') || '+50% Valore della Sabbia (Richiede 65% Scavato)');
    },
  },
  relic_abyss: {
    id: 'relic_abyss',
    branch: 'relics',
    name: 'Occhio dell\'Abisso',
    baseCost: 1200000,
    multiplier: 1.0,
    maxLevel: 1,
    minCompletion: 0.80,
    desc: 'Manufatto supremo delle profondità: triplica (3.0x) l\'intera produzione di sabbia sia manuale che passiva.',
    getBenefit(lvl) {
      return lvl > 0
        ? (i18n.t('upgrades.relic_abyss.benefitActive') || 'Moltiplicatore Globale 3.0x (Attivo)')
        : (i18n.t('upgrades.relic_abyss.benefitInactive') || 'Moltiplicatore Globale 3.0x (Richiede 80% Scavato)');
    },
  },
};

/** Formula costi: Math.floor(baseCost * Math.pow(multiplier, level)) con sconto opzionale e protezione overflow. */
export function getUpgradeCost(def, level = 0, discount = 0) {
  if (level >= def.maxLevel) return Infinity;
  const multPow = Math.pow(def.multiplier, level);
  if (!Number.isFinite(multPow) || def.baseCost * multPow >= Number.MAX_SAFE_INTEGER) {
    return Number.MAX_SAFE_INTEGER;
  }
  const raw = Math.floor(def.baseCost * multPow);
  const safeRaw = Math.min(Number.MAX_SAFE_INTEGER, raw);
  return Math.max(1, Math.floor(safeRaw * (1 - Math.min(0.25, Math.max(0, discount)))));
}

/**
 * Calcola il costo cumulativo per acquistare `count` livelli consecutivi a partire da `currentLvl`.
 */
export function getMultiUpgradeCost(def, currentLvl = 0, count = 1, discount = 0) {
  if (currentLvl >= def.maxLevel || count <= 0) return 0;
  const actualCount = Math.min(count, def.maxLevel - currentLvl);
  if (actualCount <= 0) return 0;

  let total = 0;
  for (let i = 0; i < actualCount; i++) {
    total += getUpgradeCost(def, currentLvl + i, discount);
  }
  return total;
}

/**
 * Calcola analiticamente ed esattamente il massimo numero di livelli acquistabili
 * con il saldo sabbia disponibile, e il costo complessivo.
 * @returns {{ count: number, cost: number }}
 */
export function getMaxAffordableLevels(def, currentLvl = 0, availableSand = 0, discount = 0) {
  if (currentLvl >= def.maxLevel || availableSand <= 0) {
    return { count: 0, cost: 0 };
  }
  const remainingMax = def.maxLevel - currentLvl;
  const r = def.multiplier;
  const discountFactor = 1 - Math.min(0.25, Math.max(0, discount));
  const basePriceAtN = Math.max(1, Math.floor(Math.floor(def.baseCost * Math.pow(r, currentLvl)) * discountFactor));

  // Stima analitica iniziale usando la formula della serie geometrica
  let kEstimate = 0;
  if (Math.abs(r - 1.0) < 0.0001) {
    kEstimate = Math.floor(availableSand / basePriceAtN);
  } else {
    const rawRatio = (availableSand * (r - 1)) / (def.baseCost * Math.pow(r, currentLvl) * discountFactor);
    if (rawRatio > -1) {
      kEstimate = Math.floor(Math.log(1 + Math.max(0, rawRatio)) / Math.log(r));
    }
  }

  // Raffinamento esatto e robusto con clamping
  let k = Math.min(remainingMax, Math.max(0, kEstimate));
  let cost = getMultiUpgradeCost(def, currentLvl, k, discount);

  while (k > 0 && cost > availableSand) {
    k--;
    cost = getMultiUpgradeCost(def, currentLvl, k, discount);
  }

  while (k < remainingMax) {
    const nextCost = cost + getUpgradeCost(def, currentLvl + k, discount);
    if (nextCost <= availableSand) {
      k++;
      cost = nextCost;
    } else {
      break;
    }
  }

  return { count: k, cost };
}

/** Calcola la produzione passiva totale al secondo (Sand Per Second - SPS) considerando sinergie e reliquie. */
export function calculateSPS(upgrades = {}) {
  let fleetTotal = 0;
  const gearsMult = (upgrades.relic_gears ?? 0) > 0 ? 2.0 : 1.0;

  for (const [id, def] of Object.entries(UPGRADE_CATALOG)) {
    if (def.dpsPerLevel) {
      const lvl = upgrades[id] ?? 0;
      let unitDPS = def.dpsPerLevel;
      if (id === 'excavator' || id === 'dredge') {
        unitDPS *= gearsMult;
      }
      fleetTotal += lvl * unitDPS;
    }
  }

  const cartelMult = (upgrades.relic_cartel ?? 0) > 0 ? 1.25 : 1.0;
  const abyssMult = (upgrades.relic_abyss ?? 0) > 0 ? 3.0 : 1.0;

  return fleetTotal * cartelMult * abyssMult;
}

/** Verifica se il giocatore può acquistare l'upgrade rispettando requisiti di scavo e saldo. */
export function canAffordUpgrade(id, state) {
  const def = UPGRADE_CATALOG[id];
  if (!def) return false;
  if (def.minCompletion && (state?.completion ?? 0) < def.minCompletion) {
    return false;
  }
  const currentLvl = state.upgrades[id] ?? 0;
  if (currentLvl >= def.maxLevel) return false;
  const discount = state?.costDiscount ?? 0;
  const cost = getUpgradeCost(def, currentLvl, discount);
  return state.sand >= cost;
}

/** Acquista un livello dell'upgrade se possibile. Ritorna true se riuscito. */
export function buyUpgrade(id, state, audio = null) {
  return buyMultiUpgrade(id, 1, state, audio).ok;
}

/**
 * Acquista in blocco `countOrMax` livelli (1, 10, 100, oppure 'MAX').
 * Deduce la somma totale e notifica l'evento con count e costo effettivo.
 */
export function buyMultiUpgrade(id, countOrMax = 1, state, audio = null) {
  const def = UPGRADE_CATALOG[id];
  if (!def) return { ok: false, boughtLevels: 0, totalCost: 0 };
  if (def.minCompletion && (state?.completion ?? 0) < def.minCompletion) {
    return { ok: false, boughtLevels: 0, totalCost: 0 };
  }
  const currentLvl = state.upgrades[id] ?? 0;
  if (currentLvl >= def.maxLevel) return { ok: false, boughtLevels: 0, totalCost: 0 };

  const discount = state?.costDiscount ?? 0;
  let targetCount = 1;
  let totalCost = 0;

  if (countOrMax === 'MAX' || countOrMax === 'max') {
    const maxInfo = getMaxAffordableLevels(def, currentLvl, state.sand, discount);
    if (maxInfo.count <= 0) return { ok: false, boughtLevels: 0, totalCost: 0 };
    targetCount = maxInfo.count;
    totalCost = maxInfo.cost;
  } else {
    const requested = Number(countOrMax) || 1;
    targetCount = Math.min(requested, def.maxLevel - currentLvl);
    if (targetCount <= 0) return { ok: false, boughtLevels: 0, totalCost: 0 };
    totalCost = getMultiUpgradeCost(def, currentLvl, targetCount, discount);
  }

  if (state.sand < totalCost || !state.spend(totalCost)) {
    return { ok: false, boughtLevels: 0, totalCost };
  }

  const nextLvl = currentLvl + targetCount;
  state.upgrades[id] = nextLvl;

  audio?.playPurchaseSound?.();
  events.emit('upgrade:bought', { id, level: nextLvl, cost: totalCost, count: targetCount, def });
  return { ok: true, boughtLevels: targetCount, totalCost };
}

