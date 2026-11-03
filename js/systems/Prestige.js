// Sistema di Meta-Progressione e Prestigio (Fase 6: Tavolette Antiche τ & New Game+).
// Perk permanenti che persistono attraverso le varie spedizioni.
import { events } from '../core/Events.js';

export const META_UPGRADES = {
  shovelEcho: {
    id: 'shovelEcho',
    name: 'Eco della Pala',
    badge: '⛏️',
    baseCost: 3,
    multiplier: 1.6,
    maxLevel: 10,
    desc: 'L\'esperienza dei cicli passati guida la lama: +15% potenza base di scavo per livello.',
    getBenefit: (lvl) => `+${lvl * 15}% Potenza di Scavo Permanente`,
  },
  excavatorBlueprint: {
    id: 'excavatorBlueprint',
    name: 'Progetto dell\'Escavatore',
    badge: '⚙️',
    baseCost: 5,
    multiplier: 2.0,
    maxLevel: 5,
    desc: 'Inizia ogni futura spedizione con Automi Scarabei già operativi nel cratere.',
    getBenefit: (lvl) => `${lvl} Scarabei operativi all'avvio`,
  },
  tabletMagnetism: {
    id: 'tabletMagnetism',
    name: 'Magnetismo delle Tavolette',
    badge: '🧲',
    baseCost: 4,
    multiplier: 1.8,
    maxLevel: 5,
    desc: 'Favore antico: sconto del 5% su tutti i costi in sabbia dell\'Officina per livello.',
    getBenefit: (lvl) => `-${lvl * 5}% Costi di Acquisto (Max -25%)`,
  },
};

/**
 * Calcola le Tavolette Antiche (τ) guadagnate alla conclusione di una run:
 * Math.floor(Math.sqrt(totalSand / 100000)) + 5.
 */
export function calculateTabletsEarned(totalSand = 0) {
  const safeSand = Math.max(0, totalSand);
  return Math.floor(Math.sqrt(safeSand / 100000)) + 5;
}

export function getMetaUpgradeCost(def, level = 0) {
  if (level >= def.maxLevel) return Infinity;
  return Math.floor(def.baseCost * Math.pow(def.multiplier, level));
}

export function canAffordMetaUpgrade(id, save) {
  const def = META_UPGRADES[id];
  if (!def) return false;
  const currentLvl = save.getMetaUpgrades()[id] ?? 0;
  if (currentLvl >= def.maxLevel) return false;
  const cost = getMetaUpgradeCost(def, currentLvl);
  return save.getTablets() >= cost;
}

export function buyMetaUpgrade(id, save, state = null, audio = null) {
  const def = META_UPGRADES[id];
  if (!def) return false;
  const currentLvl = save.getMetaUpgrades()[id] ?? 0;
  if (currentLvl >= def.maxLevel) return false;
  const cost = getMetaUpgradeCost(def, currentLvl);

  if (!save.spendTablets(cost)) return false;

  const nextLvl = currentLvl + 1;
  save.setMetaUpgrade(id, nextLvl);
  if (state) {
    state.metaUpgrades[id] = nextLvl;
    state.tablets = save.getTablets();
  }

  audio?.playPurchaseSound?.();
  events.emit('meta:bought', { id, level: nextLvl, cost, def });
  return true;
}

