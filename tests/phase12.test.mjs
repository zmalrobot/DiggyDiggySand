// Suite di test Fase 12: Spedizioni nei Biomi Alternativi (Oceano, Ghiacciaio, Giungla),
// resistenze fisiche degli strati, radici sepolte, rovine 3D differenziate, atmosfera e persistenza.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BiomeManager, BIOME_CATALOG } from '../js/world/BiomeManager.js';
import { Terrain, getLayerColor } from '../js/world/Terrain.js';
import { City } from '../js/world/City.js';
import { Particles } from '../js/world/Particles.js';
import { DayNightCycle } from '../js/world/DayNightCycle.js';
import { AudioEngine } from '../js/core/AudioEngine.js';
import { State } from '../js/core/State.js';
import { Save } from '../js/core/Save.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

console.log('--- TEST FASE 12: Biomi Alternativi, Fisica Scavo & Rovine Differenziate ---');

// 1. Test Catalogo Biomi e Colori Specifica Fase 12
{
  assert.ok(BIOME_CATALOG.desert, 'Bioma desert presente');
  assert.ok(BIOME_CATALOG.ocean, 'Bioma ocean presente');
  assert.ok(BIOME_CATALOG.glacier, 'Bioma glacier presente');
  assert.ok(BIOME_CATALOG.jungle, 'Bioma jungle presente');

  // Oceano Prosciugato
  assert.equal(BIOME_CATALOG.ocean.colors.layer1, '#f5e6ca');
  assert.equal(BIOME_CATALOG.ocean.colors.layer2, '#4a7c82');
  assert.equal(BIOME_CATALOG.ocean.colors.layer3, '#1b3240');
  assert.equal(BIOME_CATALOG.ocean.mechanics.resistance, 0.8);
  assert.equal(BIOME_CATALOG.ocean.mechanics.volumeMultiplier, 1.15);

  // Ghiacciaio Arcaico
  assert.equal(BIOME_CATALOG.glacier.colors.layer1, '#e8f4f8');
  assert.equal(BIOME_CATALOG.glacier.colors.layer2, '#7baec2');
  assert.equal(BIOME_CATALOG.glacier.colors.layer3, '#2a3b45');
  assert.equal(BIOME_CATALOG.glacier.mechanics.midLayerResistance, 1.35);

  // Giungla Sepolta
  assert.equal(BIOME_CATALOG.jungle.colors.layer1, '#3d5c38');
  assert.equal(BIOME_CATALOG.jungle.colors.layer2, '#5c4028');
  assert.equal(BIOME_CATALOG.jungle.colors.layer3, '#2e241c');
  assert.ok(BIOME_CATALOG.jungle.mechanics.rootBlockFactor > 0);
  assert.equal(BIOME_CATALOG.jungle.mechanics.rootHitsRequired, 3);
  console.log('✓ 1. BIOME_CATALOG: colori strati e modificatori fisici conformi alle specifiche');
}

// 2. Test BiomeManager: sblocco con vittorie o Tavolette Antiche τ e persistenza
{
  const storage = new MemoryStorage();
  const save = new Save(storage);
  save.addTablets(30);

  const bm = new BiomeManager(save, { stats: { runsCompleted: 0 } }, storage);
  assert.equal(bm.isUnlocked('desert'), true, 'Deserto sbloccato di default');
  assert.equal(bm.isUnlocked('ocean'), false, 'Oceano bloccato inizialmente con 0 vittorie');

  // Sblocco Oceano con Tavolette (costo 15 τ)
  const unlockedOcean = bm.unlockWithTablets('ocean', save);
  assert.equal(unlockedOcean, true, 'Oceano sbloccato spendendo 15 τ');
  assert.equal(save.getTablets(), 15, 'Tavolette scalate correttamente (30 - 15 = 15)');
  assert.equal(bm.isUnlocked('ocean'), true);

  // Sblocco automatico Ghiacciaio tramite vittorie (minWins = 1)
  const bmWins = new BiomeManager(save, { stats: { runsCompleted: 1 } }, storage);
  assert.equal(bmWins.isUnlocked('glacier'), true, 'Ghiacciaio sbloccato automaticamente con 1 vittoria');
  assert.equal(bmWins.isUnlocked('jungle'), false, 'Giungla richiede 2 vittorie');

  bmWins.selectBiome('glacier');
  assert.equal(bmWins.currentBiome, 'glacier');

  // Ricarica da storage
  const bmReloaded = new BiomeManager(save, { stats: { runsCompleted: 0 } }, storage);
  assert.equal(bmReloaded.currentBiome, 'glacier', 'Bioma selezionato persistito su storage');
  assert.equal(bmReloaded.isUnlocked('ocean'), true, 'Bioma sbloccato persistito su storage');
  console.log('✓ 2. BiomeManager: sblocco con τ o vittorie e persistenza localStorage verificati');
}

// 3. Test Meccaniche Terreno per Bioma (Oceano, Ghiacciaio, Giungla)
{
  const tDesert = new Terrain({ size: 100, res: 64, startHeight: 12, biome: 'desert' });
  const tOcean = new Terrain({ size: 100, res: 64, startHeight: 12, biome: 'ocean' });
  const tGlacier = new Terrain({ size: 100, res: 64, startHeight: 12, biome: 'glacier' });
  const tJungle = new Terrain({ size: 100, res: 64, startHeight: 12, biome: 'jungle' });

  // Oceano: +15% volume iniziale e -20% resistenza (scava più a fondo a parità di power)
  assert.ok(
    Math.abs(tOcean.initialVolume / tDesert.initialVolume - 1.15) < 1e-5,
    'Oceano ha volume iniziale aumentato del 15%'
  );
  const remDesert = tDesert.dig(0, 0, 6, 1.5);
  const remOcean = tOcean.dig(0, 0, 6, 1.5);
  assert.ok(remOcean > remDesert * 1.2, 'Oceano (-20% resistenza) rimuove più volume per colpo');

  // Ghiacciaio: strato intermedio (3 < Y <= 8) con resistenza +35%
  // Portiamo un punto a quota Y=6 (strato intermedio permafrost)
  const centerIdx = tGlacier.idx(32, 32);
  tGlacier.heights.fill(6.0);
  tDesert.heights.fill(6.0);
  const remMidDesert = tDesert.dig(0, 0, 6, 1.5);
  const remMidGlacier = tGlacier.dig(0, 0, 6, 1.5);
  assert.ok(remMidGlacier < remMidDesert * 0.8, 'Ghiacciaio oppone +35% resistenza nello strato permafrost');
  assert.equal(getLayerColor(10, 'glacier'), 0xe8f4f8);
  assert.equal(getLayerColor(6, 'glacier'), 0x7baec2);
  assert.equal(getLayerColor(1, 'glacier'), 0x2a3b45);

  // Giungla: radici sepolte bloccano parzialmente il raggio per i primi 3 colpi, poi si spezzano
  assert.equal(tJungle.getRootDurabilityAt(0, 0), 3, 'Giungla inizia con 3 punti durabilità radici per chunk');
  const hit1 = tJungle.dig(0, 0, 8, 0.5);
  assert.equal(tJungle.lastRootBlocked, true, 'Colpo 1 bloccato parzialmente dalle radici');
  assert.equal(tJungle.getRootDurabilityAt(0, 0), 2);
  tJungle.dig(0, 0, 8, 0.5);
  assert.equal(tJungle.getRootDurabilityAt(0, 0), 1);
  tJungle.dig(0, 0, 8, 0.5);
  assert.equal(tJungle.getRootDurabilityAt(0, 0), 0, 'Radici spezzate dopo 3 colpi');

  // Il 4° colpo non è più bloccato dalle radici e ha raggio pieno
  tJungle.heights.fill(12.0);
  const hit4Unblocked = tJungle.dig(0, 0, 8, 0.5);
  assert.equal(tJungle.lastRootBlocked, false, 'Colpo 4 ha raggio pieno dopo la rimozione delle radici');
  assert.ok(hit4Unblocked > hit1 * 1.8, 'Raggio sbloccato rimuove molto più volume rispetto al raggio ridotto dalle radici');
  console.log('✓ 3. Terrain: fisica Oceano (+15% vol, -20% res), Ghiacciaio (+35% permafrost) e Giungla (radici sepolte) verificata');
}

// 4. Test Generazione Rovine Differenziata (City.js) e flatShading
{
  const cOcean = new City({ endingId: 'treasure', biome: 'ocean' });
  assert.ok(cOcean.sunkenShip, 'Oceano contiene la nave sommersa spezzata (sunkenShip)');
  assert.ok(cOcean.shellArches, 'Oceano contiene gli archi di conchiglie (shellArches)');
  assert.ok(cOcean.treasureChest, 'Oceano preserva il reperto del finale al centro');

  const cGlacier = new City({ endingId: 'curse', biome: 'glacier' });
  assert.ok(cGlacier.iceMonolith, 'Ghiacciaio contiene il monolite esagonale di ghiaccio (iceMonolith)');
  assert.ok(cGlacier.crystallineSpires, 'Ghiacciaio contiene le guglie cristalline (crystallineSpires)');
  assert.ok(cGlacier.curseSeal, 'Ghiacciaio preserva il sigillo della maledizione');

  const cJungle = new City({ endingId: 'business', biome: 'jungle' });
  assert.ok(cJungle.steppedZiggurat, 'Giungla contiene il tempio a ziggurat (steppedZiggurat)');
  assert.ok(cJungle.engravedMenhirs, 'Giungla contiene i menhir incisi (engravedMenhirs)');
  assert.ok(cJungle.businessBucket, 'Giungla preserva il reperto finale business');

  // Verifica AGENTS.md §2: flatShading: true su tutti i MeshStandardMaterial di tutti i biomi
  for (const cityInstance of [cOcean, cGlacier, cJungle]) {
    cityInstance.group.traverse((obj) => {
      if (obj.isMesh && obj.material?.isMeshStandardMaterial) {
        assert.equal(obj.material.flatShading, true, `flatShading deve essere true in ${cityInstance.biome}`);
      }
    });
    cityInstance.dispose();
  }
  console.log('✓ 4. City: architetture sepolte differenziate per i 4 biomi e flatShading: true verificati');
}

// 5. Test Particelle, Atmosfera DayNightCycle, Audio e Salvataggio Bioma
{
  const p = new Particles();
  p.setBiome('ocean');
  p.burst(0, 8, 0, { radius: 2.5, sparks: true });
  assert.ok(p.alive > 0, 'Particelle Oceano generate');
  p.update(0.1);

  p.setBiome('glacier');
  p.burst(0, 6, 0, { radius: 2.5, sparks: true });
  p.update(0.1);
  p.dispose();

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.006);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.8);
  const cycle = new DayNightCycle({ scene, sun, hemi, initialTime: 0.5 });

  cycle.setBiome('ocean');
  const oceanFogHex = scene.fog.color.getHexString();
  cycle.setBiome('jungle');
  const jungleFogHex = scene.fog.color.getHexString();
  assert.notEqual(oceanFogHex, jungleFogHex, 'La nebbia volumetrica si adatta dinamicamente al bioma attivo');
  cycle.dispose();

  const audio = new AudioEngine();
  audio.setBiome('glacier');
  assert.equal(audio.currentBiome, 'glacier');

  const storage = new MemoryStorage();
  const save = new Save(storage);
  const newRunData = save.createNew({ biome: 'jungle' });
  assert.equal(newRunData.currentBiome, 'jungle', 'Save.createNew salva currentBiome');

  const state = new State();
  state.reset(newRunData);
  assert.equal(state.currentBiome, 'jungle', 'State carica currentBiome dal salvataggio');
  const savedPayload = state.toSave();
  assert.equal(savedPayload.currentBiome, 'jungle', 'State.toSave preserva currentBiome');
  console.log('✓ 5. Particles, DayNightCycle, AudioEngine e Save/State per i biomi verificati');
}

console.log('--- TUTTI I TEST DELLA FASE 12 SUPERATI CON SUCCESSO! ---');

