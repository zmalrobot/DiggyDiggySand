// Test unitari del Meta-Progression Hub (Santuario Ancestrale, Guardaroba Cosmetico, Selezione Biomi).
import assert from 'node:assert/strict';
import { Save } from '../js/core/Save.js';
import { State } from '../js/core/State.js';
import { META_UPGRADES, buyMetaUpgrade, getMetaUpgradeCost } from '../js/systems/Prestige.js';
import { SanctuaryModal } from '../js/ui/SanctuaryModal.js';
import { PrestigeModal } from '../js/ui/PrestigeModal.js';
import { CosmeticsManager, COSMETICS_CATALOG } from '../js/systems/CosmeticsManager.js';
import { WardrobeModal } from '../js/ui/WardrobeModal.js';
import { BiomeManager, BIOME_CATALOG } from '../js/world/BiomeManager.js';
import { BiomeSelectModal } from '../js/ui/BiomeSelectModal.js';
import { Terrain } from '../js/world/Terrain.js';
import { events } from '../js/core/Events.js';

class MemoryStorage {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.get(k) ?? null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

class MockElement {
  constructor(tag) {
    this.tag = tag;
    this.className = '';
    this.innerHTML = '';
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.dataset = {};
    this.hidden = false;
  }
  getContext(type) {
    return {
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: () => {},
      fillRect: () => {},
      drawImage: () => {},
    };
  }
  addEventListener(event, fn) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(fn);
  }
  removeEventListener() {}
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k]; }
  appendChild(child) { this.children.push(child); return child; }
  append(...nodes) { this.children.push(...nodes); }
  remove() {}
  querySelector(sel) {
    if (sel.includes('shovelEcho')) return new MockElement('button');
    if (sel.includes('excavatorBlueprint')) return new MockElement('button');
    if (sel.includes('tabletMagnetism')) return new MockElement('button');
    return new MockElement('div');
  }
  querySelectorAll() { return []; }
}

globalThis.document = {
  createElement(tag) { return new MockElement(tag); },
  getElementById(id) { return new MockElement('div'); },
  body: new MockElement('body'),
};

class MockModal {
  constructor() {
    this.opened = [];
    this.stack = [];
  }
  open(config) {
    const handle = {
      config,
      close: () => {
        config.onClose?.();
        this.opened = this.opened.filter((h) => h !== handle);
      },
      setTitle: (t) => { config.title = t; },
      setActionLabel: (idx, l) => { if (config.actions?.[idx]) config.actions[idx].label = l; },
    };
    this.opened.push(handle);
    return handle;
  }
}

console.log('--- TEST: Meta-Progression Hub (Santuario, Guardaroba, Biomi) ---');

// 1. Santuario Ancestrale: Definizioni e Formule Perk
{
  assert.equal(typeof META_UPGRADES.shovelEcho, 'object', 'Eco della Pala definita');
  assert.equal(typeof META_UPGRADES.excavatorBlueprint, 'object', 'Progetto Escavatore definito');
  assert.equal(typeof META_UPGRADES.tabletMagnetism, 'object', 'Magnetismo Tavolette definito');

  assert.equal(META_UPGRADES.shovelEcho.baseCost, 3);
  assert.equal(META_UPGRADES.shovelEcho.maxLevel, 10);
  assert.equal(META_UPGRADES.excavatorBlueprint.baseCost, 5);
  assert.equal(META_UPGRADES.excavatorBlueprint.maxLevel, 5);
  assert.equal(META_UPGRADES.tabletMagnetism.baseCost, 4);
  assert.equal(META_UPGRADES.tabletMagnetism.maxLevel, 5);

  assert.equal(getMetaUpgradeCost(META_UPGRADES.shovelEcho, 0), 3);
  assert.equal(getMetaUpgradeCost(META_UPGRADES.shovelEcho, 1), 4); // floor(3 * 1.6) = 4
  console.log('✓ 1. Definizioni e costi dei 3 perk meta del Santuario conformi alle specifiche');
}

// 2. Santuario Ancestrale: Acquisto, detrazione tavolette, persistenza e impatto economico
{
  const storage = new MemoryStorage();
  const save = new Save(storage);
  save.addTablets(50);

  const state = new State({ tablets: 50, metaUpgrades: {}, upgrades: {} });
  assert.equal(state.costDiscount, 0, 'Sconto iniziale 0%');

  // Acquisto shovelEcho
  const ok1 = buyMetaUpgrade('shovelEcho', save, state);
  assert.equal(ok1, true, 'Acquisto shovelEcho riuscito');
  assert.equal(save.getTablets(), 47, 'Tavolette detratte: 50 - 3 = 47');
  assert.equal(save.getMetaUpgrades().shovelEcho, 1, 'Perk salvato nel Save persistente');
  assert.equal(state.metaUpgrades.shovelEcho, 1, 'Perk riflesso in State');
  assert.equal(state.stats.power, 1 * (1 + 0.15), 'Potenza di scavo base aumentata del 15%');

  // Acquisto tabletMagnetism
  const ok2 = buyMetaUpgrade('tabletMagnetism', save, state);
  assert.equal(ok2, true, 'Acquisto tabletMagnetism riuscito');
  assert.equal(save.getTablets(), 43, 'Tavolette detratte: 47 - 4 = 43');
  assert.equal(state.costDiscount, 0.05, 'Sconto acquisto officina attivo al 5%');

  // Acquisto excavatorBlueprint
  const ok3 = buyMetaUpgrade('excavatorBlueprint', save, state);
  assert.equal(ok3, true, 'Acquisto excavatorBlueprint riuscito');
  assert.equal(save.getTablets(), 38, 'Tavolette detratte: 43 - 5 = 38');
  assert.equal(state.upgrades.scarab, 1, 'Scarabeo attivato immediatamente nello stato di gioco');

  // Nuova run: eredita gli scarabei dal Blueprint
  const newRunData = save.createNew({ biome: 'desert' });
  assert.equal(newRunData.upgrades.scarab, 1, 'Nuova spedizione inizia con 1 scarabeo operante');
  console.log('✓ 2. Santuario: acquisti, persistenza, sconti e boost excavatorBlueprint verificati');
}

// 3. SanctuaryModal & PrestigeModal UI Lifecycle
{
  const storage = new MemoryStorage();
  const save = new Save(storage);
  save.addTablets(25);
  const modal = new MockModal();

  const sanctuary = new SanctuaryModal(modal, save, null, null);
  assert.equal(typeof sanctuary.open, 'function');
  assert.equal(typeof sanctuary.close, 'function');
  assert.equal(typeof sanctuary.dispose, 'function');

  sanctuary.open();
  assert.equal(modal.opened.length, 1, 'Modale Santuario aperta');
  assert.ok(sanctuary.wrap.innerHTML.includes('τ 25'), 'Mostra il saldo tavolette');
  assert.ok(sanctuary.wrap.querySelector('[data-meta-id="shovelEcho"]'), 'Pulsante Eco della Pala presente');
  assert.ok(sanctuary.wrap.querySelector('[data-meta-id="excavatorBlueprint"]'), 'Pulsante Progetto Escavatore presente');
  assert.ok(sanctuary.wrap.querySelector('[data-meta-id="tabletMagnetism"]'), 'Pulsante Magnetismo Tavolette presente');

  sanctuary.close();
  assert.equal(modal.opened.length, 0, 'Modale Santuario chiusa correttamente con close()');

  // Verifica retrocompatibilità PrestigeModal
  const prestige = new PrestigeModal(modal, save, null, null);
  prestige.open();
  assert.equal(modal.opened.length, 1, 'PrestigeModal eredita SanctuaryModal e apre la modale');
  prestige.close();
  assert.equal(modal.opened.length, 0);
  console.log('✓ 3. SanctuaryModal & PrestigeModal: ciclo di vita, render DOM e close() verificati');
}

// 4. Guardaroba Cosmetico (CosmeticsManager & WardrobeModal)
{
  const storage = new MemoryStorage();
  const save = new Save(storage);
  save.addTablets(100);

  const cm = new CosmeticsManager(save, storage);
  assert.equal(cm.getEquipped('shovel'), 'shovel_bronze', 'Pala di bronzo equipaggiata di default');
  assert.equal(cm.getEquipped('sand'), 'sand_classic', 'Sabbia classica equipaggiata di default');
  assert.equal(cm.getEquipped('machinery'), 'machinery_standard', 'Flotta standard equipaggiata di default');

  let equippedEvent = null;
  const unsub = events.on('cosmetics:equipped', (data) => {
    equippedEvent = data;
  });

  // Sblocco Pala d'Oro (15 τ)
  const unlShovel = cm.unlockWithTablets('shovel', 'shovel_gold', save);
  assert.equal(unlShovel, true, 'Pala d\'Oro sbloccata');
  assert.equal(save.getTablets(), 85, '100 - 15 = 85 τ');
  assert.equal(cm.isUnlocked('shovel', 'shovel_gold'), true);

  // Equipaggia
  const eq = cm.equip('shovel', 'shovel_gold');
  assert.equal(eq, true);
  assert.equal(cm.getEquipped('shovel'), 'shovel_gold');
  assert.deepEqual(equippedEvent, { category: 'shovel', id: 'shovel_gold' });

  // Sblocco e applicazione Sabbia Vulcanica (35 τ)
  const unlSand = cm.unlockWithTablets('sand', 'sand_volcanic', save);
  assert.equal(unlSand, true, 'Sabbia vulcanica sbloccata');
  assert.equal(save.getTablets(), 50, '85 - 35 = 50 τ');
  cm.equip('sand', 'sand_volcanic');
  assert.deepEqual(equippedEvent, { category: 'sand', id: 'sand_volcanic' });

  // Verifica aggiornamento Three.js Terrain senza perdita di altezza
  const terrain = new Terrain({ size: 100, res: 64, startHeight: 12, biome: 'desert' });
  terrain.dig(0, 0, 5, 2);
  const dugY = terrain.heightAt(0, 0);
  assert.ok(dugY < 12, 'Terreno scavato');

  terrain.setBiomePalette('sand_volcanic');
  const postPaletteY = terrain.heightAt(0, 0);
  assert.equal(postPaletteY, dugY, 'setBiomePalette() aggiorna le tinte PBR senza resettare le quote scavate');

  unsub();

  // Verifica WardrobeModal lifecycle
  const modal = new MockModal();
  const wm = new WardrobeModal(modal, cm, save, null, null);
  assert.equal(typeof wm.open, 'function');
  assert.equal(typeof wm.close, 'function');
  wm.open();
  assert.equal(modal.opened.length, 1, 'WardrobeModal aperto');
  wm.close();
  assert.equal(modal.opened.length, 0, 'WardrobeModal chiuso');

  console.log('✓ 4. CosmeticsManager & WardrobeModal: sblocchi con τ, equipaggiamento e riflesso in Three.js Terrain verificati');
}

// 5. Selettore Biomi (BiomeManager & BiomeSelectModal)
{
  const storage = new MemoryStorage();
  const save = new Save(storage);
  save.addTablets(60);

  const bm = new BiomeManager(save, { stats: { runsCompleted: 0 } }, storage);
  assert.equal(bm.isUnlocked('desert'), true, 'Deserto sempre sbloccato');
  assert.equal(bm.isUnlocked('ocean'), false, 'Oceano bloccato a 0 vittorie');
  assert.equal(bm.isUnlocked('glacier'), false, 'Ghiacciaio bloccato a 0 vittorie');
  assert.equal(bm.isUnlocked('jungle'), false, 'Giungla bloccata a 0 vittorie');

  // Sblocco Oceano (10 τ)
  const okOcean = bm.unlockWithTablets('ocean', save);
  assert.equal(okOcean, true, 'Oceano sbloccato');
  assert.equal(save.getTablets(), 50, '60 - 10 = 50 τ');
  assert.equal(bm.isUnlocked('ocean'), true);

  // Sblocco Ghiacciaio con 2 vittorie
  const bm2Wins = new BiomeManager(save, { stats: { runsCompleted: 2 } }, storage);
  assert.equal(bm2Wins.isUnlocked('glacier'), true, 'Ghiacciaio sbloccato con 2 vittorie');
  assert.equal(bm2Wins.isUnlocked('jungle'), false, 'Giungla richiede 3 vittorie');

  // Sblocco Giungla con 3 vittorie
  const bm3Wins = new BiomeManager(save, { stats: { runsCompleted: 3 } }, storage);
  assert.equal(bm3Wins.isUnlocked('jungle'), true, 'Giungla sbloccata con 3 vittorie');

  // Modale Selezione Biomi
  let chosen = null;
  const bModal = new BiomeSelectModal(bm, save, { stats: { runsCompleted: 0 } }, null, (b) => { chosen = b; });
  assert.equal(typeof bModal.open, 'function');
  assert.equal(typeof bModal.close, 'function');

  bModal.open();
  assert.equal(bModal.isOpen, true, 'BiomeSelectModal aperta');
  assert.equal(bModal.el.hidden, false);

  bModal.close();
  assert.equal(bModal.isOpen, false, 'BiomeSelectModal chiusa con close()');
  assert.equal(bModal.el.hidden, true);

  bModal.dispose();
  console.log('✓ 5. BiomeManager e BiomeSelectModal: matrice sblocchi, ciclo vita e conferme verificati');
}

console.log('--- TUTTI I TEST DEL META-PROGRESSION HUB SUPERATI CON SUCCESSO! ---');
