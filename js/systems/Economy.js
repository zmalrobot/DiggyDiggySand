// Gestione dell'economia disaccoppiata dal rendering: timestamp reali (dt), SPS e guadagni offline.
import { events } from '../core/Events.js';
import { UPGRADE_CATALOG, calculateSPS, getUpgradeCost } from './Upgrades.js';

/**
 * Simulatore analitico di progressione economica per validare la curva di 30-35 minuti.
 * Esegue in pochi millisecondi una simulazione end-to-end con acquisto greedy ottimizzato.
 */
export function simulateProgression(options = {}) {
  const totalVolume = options.totalVolume ?? 487500;
  const clicksPerSec = options.clicksPerSec ?? 3.0;
  const dt = options.dt ?? 1.0;
  const maxSeconds = options.maxSeconds ?? 3600;

  let volume = 0;
  let sand = options.initialSand ?? 0;
  let time = 0;
  const upgrades = {
    shovel: 0,
    frequency: 0,
    radius: 0,
    worker: 0,
    scarab: 0,
    excavator: 0,
    dredge: 0,
    relic_cartel: 0,
    relic_leyline: 0,
    relic_gears: 0,
    relic_anomaly: 0,
    relic_abyss: 0,
    georadar: 0,
  };

  const milestones = [
    { target: 0.15, label: '15% (Reliquia Gilda Mercanti)' },
    { target: 0.25, label: '25% (Reliquia Condotti Tellurici)' },
    { target: 0.50, label: '50% (Reliquia Ingranaggi Arcaici)' },
    { target: 0.65, label: '65% (Reliquia Cuore dell’Anomalia)' },
    { target: 0.80, label: '80% (Reliquia Corona dell’Abisso)' },
    { target: 1.00, label: '100% (Fine Spedizione / Finale)' },
  ];
  let nextMilestoneIdx = 0;
  const milestoneLog = [];

  while (volume < totalVolume && time < maxSeconds) {
    time += dt;
    const completion = volume / totalVolume;

    // Calcolo potenza di scavo manuale
    let clickPower = 1 + (upgrades.shovel || 0);
    const sps = calculateSPS(upgrades);
    if (upgrades.relic_leyline) clickPower += 0.04 * sps;
    if (upgrades.relic_abyss) clickPower *= 3.0;

    const clickDPS = clicksPerSec * clickPower;
    const totalDPS = clickDPS + sps;
    const sandMult = upgrades.relic_anomaly ? 1.5 : 1.0;
    sand += totalDPS * sandMult * dt;

    // Volume scavato (calibrato sul modello voxel/heightmap)
    const volDug = (clickDPS * 0.098 + sps * 0.065) * dt;
    volume += volDug;

    // Registra milestone raggiunte in questo tick
    while (nextMilestoneIdx < milestones.length && (volume / totalVolume) >= milestones[nextMilestoneIdx].target) {
      milestoneLog.push({
        milestone: milestones[nextMilestoneIdx].label,
        timeMin: (time / 60).toFixed(2),
        completion: `${Math.min(100, ((volume / totalVolume) * 100)).toFixed(1)}%`,
      });
      nextMilestoneIdx++;
    }

    // Strategia di acquisto Greedy
    let boughtAny = true;
    while (boughtAny) {
      boughtAny = false;
      // Priorità alle Reliquie sbloccate per soglia
      for (const relicId of ['relic_cartel', 'relic_leyline', 'relic_gears', 'relic_anomaly', 'relic_abyss']) {
        const def = UPGRADE_CATALOG[relicId];
        if (def && completion >= def.minCompletion && (upgrades[relicId] || 0) < def.maxLevel) {
          const cost = getUpgradeCost(def, upgrades[relicId] || 0, 0);
          if (sand >= cost) {
            sand -= cost;
            upgrades[relicId] = 1;
            boughtAny = true;
          }
        }
      }

      // Upgrade standard: acquisto costo-efficace
      let bestId = null;
      let minCost = Infinity;
      for (const [id, def] of Object.entries(UPGRADE_CATALOG)) {
        if (def.branch === 'relics') continue;
        const curLvl = upgrades[id] || 0;
        if (curLvl < def.maxLevel) {
          const cost = getUpgradeCost(def, curLvl, 0);
          if (sand >= cost && cost < minCost) {
            minCost = cost;
            bestId = id;
          }
        }
      }

      if (bestId && sand >= minCost) {
        sand -= minCost;
        upgrades[bestId] = (upgrades[bestId] || 0) + 1;
        boughtAny = true;
      }
    }
  }

  const elapsedMinutes = +(time / 60).toFixed(2);
  const inTargetWindow = elapsedMinutes >= 30.0 && elapsedMinutes <= 35.0;

  return {
    targetWindow: '30.0 - 35.0 min',
    elapsedMinutes,
    elapsedSeconds: Math.round(time),
    inTargetWindow,
    completion: ((volume / totalVolume) * 100).toFixed(1) + '%',
    finalSPS: Math.round(calculateSPS(upgrades)),
    upgradesBought: upgrades,
    milestones: milestoneLog,
  };
}

export class Economy {
  constructor(state) {
    this.state = state;
    this.sps = calculateSPS(state.upgrades);
    this._accumulated = 0;
    this._unsubs = [
      events.on('upgrade:bought', () => this.refreshSPS()),
    ];
  }

  refreshSPS() {
    const next = calculateSPS(this.state.upgrades);
    if (next !== this.sps) {
      this.sps = next;
      events.emit('sps:changed', { sps: this.sps });
    }
    return this.sps;
  }

  /**
   * Calcolo guadagni offline (massimo 2 ore = 7200s, efficienza 50%).
   * Ritorna l'ammontare di sabbia prodotta mentre il giocatore era via.
   */
  calculateOfflineProgress(lastSaved, sps = this.sps, maxSeconds = 7200) {
    if (!lastSaved || sps <= 0) return 0;
    const elapsedSec = Math.max(0, (Date.now() - lastSaved) / 1000);
    if (elapsedSec < 5) return 0; // ignora chiusure istantanee
    const cappedSec = Math.min(maxSeconds, elapsedSec);
    return Math.floor(cappedSec * sps * 0.5);
  }

  /** Aggiornamento tempo reale (usato se serve accumulo passivo diretto). */
  update(dt) {
    // La produzione della flotta nel mondo 3D è eseguita fisicamente dai Workers.
    // L'Economy mantiene la sincronizzazione dell'SPS nominale.
  }

  dispose() {
    this._unsubs.forEach((u) => u());
  }
}

