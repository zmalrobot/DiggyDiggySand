// Test unitari della Fase 3: node --import ./tests/register.mjs tests/phase3.test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Terrain, getLayerColor, layerColor } from '../js/world/Terrain.js';
import { City } from '../js/world/City.js';
import { Foreshadowing } from '../js/systems/Foreshadowing.js';
import { State } from '../js/core/State.js';
import { UPGRADE_CATALOG, canAffordUpgrade, buyUpgrade } from '../js/systems/Upgrades.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok -', name); };

t('Terrain: stratificazione cromatica per quota Y', () => {
  // Layer 1 (Superficie, Y da 12 a 8): 0xE0C27A
  assert.equal(getLayerColor(12), 0xE0C27A);
  assert.equal(getLayerColor(9), 0xE0C27A);

  // Layer 2 (Profondità, Y da 8 a 3): 0xB88A44
  assert.equal(getLayerColor(8), 0xB88A44);
  assert.equal(getLayerColor(5.5), 0xB88A44);

  // Layer 3 (Fondo roccioso, Y da 3 a 0): 0x6E563B
  assert.equal(getLayerColor(3), 0x6E563B);
  assert.equal(getLayerColor(0.5), 0x6E563B);

  // Verifica THREE.Color da layerColor
  const c = new THREE.Color();
  layerColor(10, 0, c);
  assert.ok(c.r > 0.5, 'Tonalità sabbia dorata chiara');

  layerColor(2, 0, c);
  assert.ok(c.r < 0.2, 'Tonalità roccia scura con venature');


});

t('City: generazione procedurale sotto la quota iniziale (Y <= 9.0)', () => {
  const city = new City({ endingId: 'curse', floor: 0 });
  assert.ok(city.group.isGroup);
  assert.equal(city.group.name, 'buried-city');

  // Calcola bounding box globale per verificare le quote verticali
  const box = new THREE.Box3().setFromObject(city.group);
  assert.ok(box.min.y >= -0.05, `Il fondo deve poggiare sul bedrock (min Y=${box.min.y})`);
  assert.ok(box.max.y <= 9.2, `Gli edifici devono stare tutti sotto Y=12 (max Y=${box.max.y})`);

  city.dispose();
});

t('City: varianti ending (curse, treasure, business)', () => {
  const cityCurse = new City({ endingId: 'curse', floor: 0 });
  const cityTreasure = new City({ endingId: 'treasure', floor: 0 });
  const cityBiz = new City({ endingId: 'business', floor: 0 });

  assert.ok(cityCurse.group.children.length > 0);
  assert.ok(cityTreasure.group.children.length > 0);
  assert.ok(cityBiz.group.children.length > 0);

  cityCurse.dispose();
  cityTreasure.dispose();
  cityBiz.dispose();
});

t('Foreshadowing: attivazione indizi alla soglia 60%', () => {
  const state = new State();
  state.endingId = 'curse';
  state.completion = 0.30;

  const mockScene = {
    sun: { color: new THREE.Color(0xFFF3D6), intensity: 2.4 },
    scene: { fog: { color: new THREE.Color(0xD9B97A), density: 0.0035 } },
    shake: () => {},
  };

  const fore = new Foreshadowing({ state, scene: mockScene, audio: null, particles: null, terrain: null });
  assert.equal(fore.triggered60, false);

  fore.update(0.1);
  assert.equal(fore.triggered60, false);

  // Raggiunge 60%
  state.completion = 0.62;
  fore.update(0.1);
  assert.equal(fore.triggered60, true);

  // Verifica viraggio atmosfera per Curse
  assert.equal(mockScene.sun.color.getHex(), 0xFF7A66);

  // Letture del radar
  const surfaceReading = fore.getRadarReading(10);
  assert.ok(surfaceReading.includes('sabbioso'));

  const deepReading = fore.getRadarReading(2);
  assert.ok(deepReading.includes('ATTENZIONE') || deepReading.includes('oscura'));

  fore.dispose();
});

t('Upgrades & Georadar: acquisto e sblocco', () => {
  const state = new State();
  state.sand = 600;

  assert.ok(UPGRADE_CATALOG.georadar);
  assert.equal(UPGRADE_CATALOG.georadar.maxLevel, 1);
  assert.equal(canAffordUpgrade('georadar', state), true);

  const bought = buyUpgrade('georadar', state);
  assert.equal(bought, true);
  assert.equal(state.upgrades.georadar, 1);
  assert.equal(state.sand, 100);
});

console.log(`\n${passed} test passati con successo!`);
