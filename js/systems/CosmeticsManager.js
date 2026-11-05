// Manager Cosmetico & Guardaroba: gestione skin per pala, biomi sabbia e macchinari.
// Persistenza sincrona su localStorage (dds_cosmetics_v1).
import { events } from '../core/Events.js';

export const COSMETICS_KEY = 'dds_cosmetics_v1';

export const COSMETICS_CATALOG = {
  shovel: [
    {
      id: 'shovel_bronze',
      cost: 0,
      icon: '⛏️',
      color: '#B88A44',
      unlockedByDefault: true,
    },
    {
      id: 'shovel_gold',
      cost: 15,
      icon: '✨',
      color: '#FFDF00',
      req: { tablets: 15 },
    },
    {
      id: 'shovel_crystal',
      cost: 25,
      icon: '💎',
      color: '#0FE3C1',
      req: { tablets: 25 },
    },
    {
      id: 'shovel_obsidian',
      cost: 40,
      icon: '🖤',
      color: '#2A1F2D',
      req: { tablets: 40 },
    },
  ],
  sand: [
    {
      id: 'sand_classic',
      cost: 0,
      icon: '🏜️',
      color: '#E0C27A',
      unlockedByDefault: true,
    },
    {
      id: 'sand_mars',
      cost: 20,
      icon: '🔴',
      color: '#C84B31',
      req: { tablets: 20 },
    },
    {
      id: 'sand_caribbean',
      cost: 25,
      icon: '🏝️',
      color: '#F4F6F0',
      req: { tablets: 25 },
    },
    {
      id: 'sand_volcanic',
      cost: 35,
      icon: '🌋',
      color: '#484B52',
      req: { tablets: 35 },
    },
  ],
  machinery: [
    {
      id: 'machinery_standard',
      cost: 0,
      icon: '⚙️',
      color: '#8C5828',
      unlockedByDefault: true,
    },
    {
      id: 'machinery_royal_gold',
      cost: 30,
      icon: '👑',
      color: '#F5BA23',
      req: { tablets: 30 },
    },
    {
      id: 'machinery_atlantis_teal',
      cost: 50,
      icon: '🔱',
      color: '#00F2FF',
      req: { tablets: 50 },
    },
  ],
};

export class CosmeticsManager {
  constructor(save = null, storage = null) {
    this.save = save;
    if (storage) {
      this.storage = storage;
    } else {
      try {
        this.storage = window.localStorage;
      } catch {
        this.storage = null;
      }
    }

    this.equipped = {
      shovel: 'shovel_bronze',
      sand: 'sand_classic',
      machinery: 'machinery_standard',
    };

    this.unlocked = {
      shovel: new Set(['shovel_bronze']),
      sand: new Set(['sand_classic']),
      machinery: new Set(['machinery_standard']),
    };

    this.load();
  }

  load() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(COSMETICS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.equipped) {
          if (parsed.equipped.shovel) this.equipped.shovel = parsed.equipped.shovel;
          if (parsed.equipped.sand) this.equipped.sand = parsed.equipped.sand;
          if (parsed.equipped.machinery) this.equipped.machinery = parsed.equipped.machinery;
        }
        if (parsed.unlocked) {
          ['shovel', 'sand', 'machinery'].forEach((cat) => {
            if (Array.isArray(parsed.unlocked[cat])) {
              parsed.unlocked[cat].forEach((id) => this.unlocked[cat].add(id));
            }
          });
        }
      }
    } catch (e) {
      console.warn('[Cosmetics] Errore lettura cosmetici:', e);
    }
  }

  saveData() {
    if (typeof window !== 'undefined' && window.__DDS_WIPING_DATA) return false;
    if (!this.storage) return false;
    try {
      const data = {
        equipped: this.equipped,
        unlocked: {
          shovel: Array.from(this.unlocked.shovel),
          sand: Array.from(this.unlocked.sand),
          machinery: Array.from(this.unlocked.machinery),
        },
      };
      this.storage.setItem(COSMETICS_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  isUnlocked(category, id) {
    return this.unlocked[category]?.has(id) ?? false;
  }

  getEquipped(category) {
    return this.equipped[category];
  }

  equip(category, id) {
    if (!this.unlocked[category]?.has(id)) return false;
    if (this.equipped[category] === id) return true;

    this.equipped[category] = id;
    this.saveData();

    events.emit('cosmetics:equipped', { category, id });
    events.emit('cosmetics:changed', { equipped: this.equipped });
    return true;
  }

  unlock(category, id, saveRef = null) {
    return this.unlockWithTablets(category, id, saveRef);
  }

  unlockAll() {
    for (const [cat, items] of Object.entries(COSMETICS_CATALOG)) {
      for (const item of items) {
        this.unlocked[cat]?.add(item.id);
      }
    }
    this.saveData();
    events.emit('cosmetics:changed', { equipped: this.equipped });
  }

  unlockWithTablets(category, id, saveRef = null) {
    if (this.isUnlocked(category, id)) return true;
    const catList = COSMETICS_CATALOG[category];
    const item = catList?.find((c) => c.id === id);
    if (!item) return false;

    const s = saveRef || this.save;
    const cost = item.cost || 0;
    const currentTablets = s?.getTablets?.() ?? 0;

    if (currentTablets < cost) return false;

    if (cost > 0 && s?.spendTablets) {
      const ok = s.spendTablets(cost);
      if (!ok) return false;
    }

    this.unlocked[category].add(id);
    this.saveData();

    events.emit('cosmetics:unlocked', { category, id, cost });
    events.emit('cosmetics:changed', { equipped: this.equipped });
    return true;
  }

  getAll(category) {
    const list = COSMETICS_CATALOG[category] || [];
    return list.map((item) => ({
      ...item,
      isUnlocked: this.isUnlocked(category, item.id),
      isEquipped: this.equipped[category] === item.id,
    }));
  }
}
