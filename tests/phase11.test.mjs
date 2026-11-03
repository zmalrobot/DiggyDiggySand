// Test unitari della Fase 11: Ciclo Giorno/Notte, Luci Dinamiche e Personalizzazione Cosmetica (Skins)
// Esecuzione: node --import ./tests/register.mjs tests/phase11.test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DayNightCycle } from '../js/world/DayNightCycle.js';
import { Sky } from '../js/world/Sky.js';
import { Torches } from '../js/world/Torches.js';
import { Terrain, BIOME_PALETTES } from '../js/world/Terrain.js';
import { CosmeticsManager, COSMETICS_CATALOG } from '../js/systems/CosmeticsManager.js';
import { SettingsManager } from '../js/core/SettingsManager.js';
import { DICTIONARY } from '../js/core/I18n.js';
import { events } from '../js/core/Events.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok -', name); };

// Storage mock in memoria
class MockStorage {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.get(k) ?? null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

// Mock Three.js scene & lights
function createMockSceneContext() {
  const scene = new THREE.Scene();
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  scene.add(dirLight);
  scene.add(hemiLight);
  scene.fog = new THREE.FogExp2(0x060b11, 0.005);
  return { scene, dirLight, hemiLight };
}

t('DayNightCycle: calcolo corretta rotazione solare e nightFactor', () => {
  const { scene, dirLight, hemiLight } = createMockSceneContext();
  const cycle = new DayNightCycle({
    scene,
    dirLight,
    hemiLight,
    cycleDuration: 10, // 10s per test rapido
  });

  // A mezzogiorno (time = 0.5): sole alto, fattore notte 0
  cycle.time = 0.5;
  cycle._applyTime(0.5);
  assert.equal(cycle.nightFactor, 0, 'A mezzogiorno il nightFactor deve essere 0');
  assert.ok(dirLight.position.y > 50, 'Il sole deve essere in alto sopra l\'orizzonte');
  assert.ok(dirLight.intensity > 1.2, 'Luce solare intensa a mezzogiorno');

  // A mezzanotte (time = 0.0): sole sotto orizzonte, fattore notte 1
  cycle.time = 0.0;
  cycle._applyTime(0.0);
  assert.equal(cycle.nightFactor, 1, 'A mezzanotte il nightFactor deve essere 1');
  assert.ok(dirLight.position.y < 0, 'Il sole deve essere sotto l\'orizzonte a mezzanotte');
  assert.ok(dirLight.intensity <= 0.4, 'Luce solare commutata in luce lunare tenue a mezzanotte');

  // Al tramonto (time = 0.75): transizione orizzonte
  cycle.time = 0.75;
  cycle._applyTime(0.75);
  assert.ok(cycle.nightFactor >= 0 && cycle.nightFactor <= 1, 'Transizione progressiva al tramonto');

  cycle.dispose();
});

t('DayNightCycle: modalità manuale (day, night) da Settings', () => {
  const { scene, dirLight, hemiLight } = createMockSceneContext();
  const mockStorage = new MockStorage();
  const settings = new SettingsManager(mockStorage);

  const cycle = new DayNightCycle({
    scene,
    dirLight,
    hemiLight,
    settings,
  });

  // Test toggle "day"
  settings.set('graphics.dayNightCycle', 'day');
  cycle.update(1.0);
  assert.equal(cycle.time, 0.5, 'Modalità day forza mezzogiorno (0.5)');
  assert.equal(cycle.nightFactor, 0);

  // Test toggle "night"
  settings.set('graphics.dayNightCycle', 'night');
  cycle.update(1.0);
  assert.equal(cycle.time, 0.0, 'Modalità night forza mezzanotte (0.0)');
  assert.equal(cycle.nightFactor, 1);

  cycle.dispose();
});

t('Sky: stelle e luna procedurali aggiornati dal ciclo', () => {
  const sky = new Sky();
  assert.ok(sky.group instanceof THREE.Group, 'Sky possiede un THREE.Group');
  assert.ok(sky.stars instanceof THREE.Points, 'Sky possiede un sistema particellare di stelle');
  assert.ok(sky.moon instanceof THREE.Mesh, 'Sky possiede una mesh per la luna');

  // Di giorno (nightFactor = 0): stelle invisibili
  sky.update(0.5, 0);
  assert.equal(sky.starsMat.opacity, 0, 'Stelle invisibili di giorno');

  // Di notte (nightFactor = 1): stelle visibili
  sky.update(0.0, 1);
  assert.ok(sky.starsMat.opacity > 0.8, 'Stelle visibili di notte');
  assert.ok(sky.moon.position.y > 30, 'La luna deve essere alta in cielo di notte');

  sky.dispose();
  assert.equal(sky.stars, null, 'Oggetto stelle rilasciato da dispose');
});

t('Torches: fiaccole sulle rovine con max 4 PointLights e flicker notturno', () => {
  const torches = new Torches();
  assert.equal(torches.lights.length, 4, 'Massimo 4 PointLights per limiti prestazioni mobile');

  // Di giorno: fiaccole spente (intensità 0)
  torches.update(0.016, 0);
  for (const item of torches.lights) {
    assert.equal(item.light.intensity, 0, 'Fiaccola spenta di giorno');
  }

  // Di notte: fiaccole accese e pulsanti
  torches.update(0.016, 1);
  for (const item of torches.lights) {
    assert.ok(item.light.intensity > 0.8, 'Fiaccola accesa con intensità calda di notte');
  }

  torches.dispose();
  assert.equal(torches.lights.length, 0, 'Torches ripulite con dispose()');
});

t('Terrain: personalizzazione cromatica dei Biomi Sabbia (BIOME_PALETTES)', () => {
  assert.ok(BIOME_PALETTES.classic, 'Bioma classico presente');
  assert.ok(BIOME_PALETTES.mars, 'Bioma Marte presente');
  assert.ok(BIOME_PALETTES.caribbean, 'Bioma Caraibi presente');
  assert.ok(BIOME_PALETTES.volcanic, 'Bioma Vulcanico presente');

  const terrain = new Terrain({ size: 20, res: 16, startHeight: 10, floor: 0 });
  const initialColors = Array.from(terrain.colors.array.slice(0, 9));

  // Cambia in bioma marziano (tonalità rosse)
  terrain.setBiomePalette('sand_mars');
  const marsColors = Array.from(terrain.colors.array.slice(0, 9));
  assert.notDeepEqual(initialColors, marsColors, 'I colori dei vertici del terreno devono aggiornarsi al cambio bioma');

  // Ritorna a classico
  terrain.setBiomePalette('sand_classic');
  const resetColors = Array.from(terrain.colors.array.slice(0, 9));
  assert.deepEqual(initialColors, resetColors, 'Ripristino corretto palette classica');

  terrain.dispose();
});

t('CosmeticsManager: catalogo skin, sblocco con tavolette e persistenza', () => {
  const mockStorage = new MockStorage();
  const mockSave = {
    storage: mockStorage,
    getTablets() { return Number(mockStorage.getItem('dds_tablets_v1') ?? 0); },
    spendTablets(amount) {
      const cur = this.getTablets();
      if (cur < amount) return false;
      mockStorage.setItem('dds_tablets_v1', cur - amount);
      return true;
    },
  };

  mockStorage.setItem('dds_tablets_v1', '10'); // Solo 10 τ disponibili

  const cosmetics = new CosmeticsManager(mockSave, mockStorage);

  // Verifiche predefinite
  assert.equal(cosmetics.getEquipped('shovel'), 'shovel_bronze');
  assert.equal(cosmetics.getEquipped('sand'), 'sand_classic');
  assert.equal(cosmetics.getEquipped('machinery'), 'machinery_standard');
  assert.ok(cosmetics.isUnlocked('shovel', 'shovel_bronze'), 'Skin base sbloccata di default');

  // Acquisto fallito per costo eccessivo (40 τ per shovel_obsidian con sole 10 τ in tasca)
  const failedBuy = cosmetics.unlock('shovel', 'shovel_obsidian');
  assert.equal(failedBuy, false, 'Acquisto deve fallire se le tavolette non bastano');

  // Accredita altre tavolette per permettere l'acquisto di sand_mars (20 τ)
  mockStorage.setItem('dds_tablets_v1', '50');

  // Acquisto riuscito per skin accessibile (sand_mars costa 20 τ)
  let equippedEvent = null;
  const unsub = events.on('cosmetics:equipped', (data) => { equippedEvent = data; });

  const okBuy = cosmetics.unlock('sand', 'sand_mars');
  assert.equal(okBuy, true, 'Acquisto di sand_mars deve riuscire');
  assert.equal(mockSave.getTablets(), 30, 'Tavolette detratte correttamente (50 - 20 = 30)');
  assert.ok(cosmetics.isUnlocked('sand', 'sand_mars'), 'sand_mars ora risulta sbloccata');

  // Equipaggiamento
  const okEquip = cosmetics.equip('sand', 'sand_mars');
  assert.equal(okEquip, true);
  assert.equal(cosmetics.getEquipped('sand'), 'sand_mars');
  assert.deepEqual(equippedEvent, { category: 'sand', id: 'sand_mars' });

  // Test ricaricamento da persistenza
  const cosmeticsReloaded = new CosmeticsManager(mockSave, mockStorage);
  assert.equal(cosmeticsReloaded.getEquipped('sand'), 'sand_mars', 'Skin equipaggiata mantenuta dopo reload');
  assert.ok(cosmeticsReloaded.isUnlocked('sand', 'sand_mars'), 'Stato sbloccato mantenuto dopo reload');

  unsub();
});

t('SettingsManager & I18n: integrazione giorno/notte e dizionario guardaroba', () => {
  const mockStorage = new MockStorage();
  const settings = new SettingsManager(mockStorage);
  assert.equal(settings.get('graphics.dayNightCycle'), 'auto', 'Default auto per ciclo giorno/notte');

  settings.set('graphics.dayNightCycle', 'night');
  assert.equal(settings.get('graphics.dayNightCycle'), 'night');

  assert.ok(DICTIONARY.it.wardrobe, 'Sezione wardrobe presente in IT');
  assert.ok(DICTIONARY.en.wardrobe, 'Sezione wardrobe presente in EN');
  assert.ok(DICTIONARY.it.settings.dayNight, 'Voce dayNight presente in IT');
  assert.ok(DICTIONARY.en.settings.dayNight, 'Voce dayNight presente in EN');
});

console.log(`\nFase 11 Test Completati: ${passed}/${passed} verifiche superate con successo!`);
