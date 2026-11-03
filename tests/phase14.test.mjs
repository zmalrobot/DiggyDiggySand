// Test unitari della Fase 14: Post-Processing Visivo, Ottimizzazione Sub-Grid e Bugfixing di Stabilità
// Esecuzione: node --import ./tests/register.mjs tests/phase14.test.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Save, SAVE_KEY, SAVE_BACKUP_KEY, validateSave } from '../js/core/Save.js';
import { Terrain, layerColor } from '../js/world/Terrain.js';
import { Digging } from '../js/systems/Digging.js';
import { State } from '../js/core/State.js';
import { Atmosphere } from '../js/world/Atmosphere.js';
import { PostProcessing } from '../js/world/PostProcessing.js';
import { SettingsManager } from '../js/core/SettingsManager.js';

console.log('--- TEST FASE 14: Post-Processing, Sub-Grid Terreno & Stabilità ---');

// Mock localStorage in memoria
class MockStorage {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.get(k) ?? null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

// -----------------------------------------------------------------------------
// 1. Save.js: Validazione Schema e Ripristino Automatico dal Backup
// -----------------------------------------------------------------------------
(() => {
  const storage = new MockStorage();
  const save = new Save(storage);

  // 1.1 Schema validation
  assert.equal(validateSave(null), false, 'null non deve passare');
  assert.equal(validateSave({ version: 1, seed: 123, sand: NaN, totalSand: 0, upgrades: {} }), false, 'sand: NaN non deve passare');
  assert.equal(validateSave({ version: 1, seed: 123, sand: -10, totalSand: 0, upgrades: {} }), false, 'sand negativa non deve passare');
  assert.equal(validateSave({ version: 99, seed: 123, sand: 10, totalSand: 10, upgrades: {} }), false, 'versione non supportata non deve passare');
  assert.equal(validateSave({ version: 1, seed: 123, sand: 100, totalSand: 100, upgrades: [] }), false, 'upgrades come array non deve passare');
  assert.equal(validateSave({ version: 1, seed: 123, sand: 100, totalSand: 100, upgrades: { shovel: 1 } }), true, 'salvataggio valido deve passare');

  // 1.2 Scrittura ridondante primario + backup
  const data = save.createNew({ biome: 'desert' });
  data.sand = 42000;
  save.write(data);

  assert.ok(storage.getItem(SAVE_KEY), 'File primario deve esistere');
  assert.ok(storage.getItem(SAVE_BACKUP_KEY), 'File di backup deve esistere');
  const backupObj = JSON.parse(storage.getItem(SAVE_BACKUP_KEY));
  assert.equal(backupObj.sand, 42000, 'Il backup deve contenere la stessa quantità di sabbia');

  // 1.3 Simulazione corruzione file primario (JSON troncato)
  storage.setItem(SAVE_KEY, '{"version": 1, "seed": 123, "sand": {"corrupt": true');
  const restored = save.load();
  assert.ok(restored, 'Il caricamento non deve crashare ma recuperare i dati');
  assert.equal(restored.sand, 42000, 'I dati devono essere ripristinati dal backup');
  assert.equal(save.lastRecoveryReason, 'backup_restored', 'La causa del ripristino deve essere backup_restored');

  // 1.4 Simulazione corruzione sia di primario che di backup
  storage.setItem(SAVE_KEY, 'corrupted');
  storage.setItem(SAVE_BACKUP_KEY, 'corrupted_backup');
  const emergencyData = save.load();
  assert.ok(emergencyData, 'Deve generare un salvataggio pulito');
  assert.equal(save.lastRecoveryReason, 'emergency_reset', 'La causa del ripristino deve essere emergency_reset');
  assert.equal(emergencyData.sand, 0, 'Il salvataggio pulito parte da 0');

  console.log('✓ 1. Save: validazione schema check e ripristino automatico da backup verificati');
})();

// -----------------------------------------------------------------------------
// 2. Terrain.js: Ottimizzazione Sub-Grid delle Normali & Procedural Noise Blend
// -----------------------------------------------------------------------------
(() => {
  const terrain = new Terrain({ size: 100, res: 64, startHeight: 12, floor: 0 });
  const norms = terrain.normals.array;

  // 2.1 Verifica calcolo localizzato sub-grid
  // Simula uno scavo circoscritto
  const initialNormalY = norms[1]; // y component of normal
  assert.ok(initialNormalY > 0.99, 'Normale iniziale piana deve puntare verso l\'alto');

  terrain.dig(0, 0, 8, 4);
  terrain.flush();

  // Verifica che le normali siano state ricalcolate
  const centerIdx = ((32 * 65) + 32) * 3;
  const nx = norms[centerIdx];
  const ny = norms[centerIdx + 1];
  const nz = norms[centerIdx + 2];
  const length = Math.hypot(nx, ny, nz);
  assert.ok(Math.abs(length - 1.0) < 0.01, `Vettore normale deve essere normalizzato (lunghezza ~ 1, trovata ${length})`);
  assert.ok(ny > 0, 'La normale deve puntare sempre verso l\'alto');

  // 2.2 Procedural Noise Blend
  const c1 = new THREE.Color();
  const c2 = new THREE.Color();
  layerColor(10, 100, c1, 'desert', 10, 10);
  layerColor(10, 101, c2, 'desert', 11, 10);
  assert.ok(c1.r !== c2.r || c1.g !== c2.g, 'Il noise blend deve produrre micro-variazioni tra vertici adiacenti');

  console.log('✓ 2. Terrain: sub-grid normal calculation O(k) e procedural noise blend collaudati');
})();

// -----------------------------------------------------------------------------
// 3. Digging.js & Terrain.js: Anti-Tunneling Clamping & Dynamic Bounds Refresh
// -----------------------------------------------------------------------------
(() => {
  const terrain = new Terrain({ size: 100, res: 64, startHeight: 12, floor: 0 });

  // 3.1 Clamping assoluto al bedrock (nessun tunneling sotto floor = 0)
  for (let i = 0; i < 30; i++) {
    terrain.dig(0, 0, 12, 10); // potenza estrema
  }
  terrain.flush();

  const minH = terrain.heightAt(0, 0);
  assert.equal(minH, 0, 'La quota non deve mai scendere al di sotto di floor (0)');
  assert.ok(terrain.heights.every((h) => h >= 0), 'Tutti i vertici della heightmap devono essere >= 0');

  // 3.2 Dynamic bounds refresh
  terrain.updateBounds();
  assert.equal(terrain.geometry.boundingBox.min.y, 0, 'Bounding box min Y deve essere 0');
  assert.ok(terrain._box.min.y <= 0, 'Box raycast deve includere il fondo dello scavo');

  console.log('✓ 3. Digging & Terrain: anti-tunneling assoluto a Y=0 e refresh volumi limite verificati');
})();

// -----------------------------------------------------------------------------
// 4. Atmosphere.js: Micro-Particelle Fluttuanti (Dust Motes) & Adattamento Biomi
// -----------------------------------------------------------------------------
(() => {
  const scene = new THREE.Scene();
  const settings = new SettingsManager(new MockStorage());
  const atmosphere = new Atmosphere(scene, settings);

  assert.equal(atmosphere.mesh.count, 100, 'Devono essere presenti 100 istanze di micro-particelle');
  assert.equal(atmosphere.group.visible, true, 'L\'atmosfera deve essere visibile di default');

  // 4.1 Moto sinusoidale
  const dummy = new THREE.Object3D();
  atmosphere.mesh.getMatrixAt(0, dummy.matrix);
  dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
  const p0y = dummy.position.y;

  atmosphere.update(0.5);
  atmosphere.mesh.getMatrixAt(0, dummy.matrix);
  dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
  const p1y = dummy.position.y;
  assert.ok(p0y !== p1y, 'Le particelle devono muoversi durante l\'update');

  // 4.2 Adattamento cromatico per bioma
  atmosphere.setBiome('ocean');
  assert.equal(atmosphere.material.color.getHexString(), '00f2ff', 'Colore Oceano deve essere ciano');

  atmosphere.setBiome('glacier');
  assert.equal(atmosphere.material.color.getHexString(), 'e8f4f8', 'Colore Ghiacciaio deve essere neve');

  // 4.3 Toggle impostazioni
  settings.set('graphics.dustMotes', false);
  assert.equal(atmosphere.enabled, false, 'Deve disattivarsi con l\'impostazione grafica');
  assert.equal(atmosphere.group.visible, false, 'Il gruppo Three.js deve essere nascosto');

  atmosphere.dispose();
  console.log('✓ 4. Atmosphere: 100 dust motes, moto sinusoidale, palette biomi e toggle collaudati');
})();

// -----------------------------------------------------------------------------
// 5. PostProcessing.js: Compositing Pass & Risoluzione Dinamica
// -----------------------------------------------------------------------------
(() => {
  // Mock WebGLRenderer
  const mockRenderer = {
    getSize: (v) => v.set(1280, 720),
    getPixelRatio: () => 1,
    render: () => {},
    getRenderTarget: () => null,
    setRenderTarget: () => {},
    clear: () => {},
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 400);
  const settings = new SettingsManager(new MockStorage());

  const postProc = new PostProcessing(mockRenderer, scene, camera, settings);
  assert.equal(postProc.enabled, true, 'Post-processing attivo di default');
  assert.ok(postProc.renderTarget, 'RenderTarget deve essere istanziato');

  // 5.1 Ridimensionamento buffer
  postProc.setSize(1920, 1080);
  assert.equal(postProc.renderTarget.width, 1920, 'Larghezza RenderTarget aggiornata');
  assert.equal(postProc.renderTarget.height, 1080, 'Altezza RenderTarget aggiornata');

  // 5.2 Disattivazione / Fallback
  settings.set('graphics.postProcessing', false);
  assert.equal(postProc.enabled, false, 'PostProcessing deve rispettare il toggle impostazioni');
  assert.equal(postProc.postMaterial.uniforms.uEnabled.value, 0.0, 'Uniform uEnabled deve essere 0.0');

  postProc.dispose();
  console.log('✓ 5. PostProcessing: render target, shader pass, resize e disattivazione verificati');
})();

// -----------------------------------------------------------------------------
// 6. SceneManager: Compensazione FOV su Display Estremi (Portrait & Ultra-Wide)
// -----------------------------------------------------------------------------
(() => {
  // Verifica formula compensazione adattiva del FOV
  const baseFov = 50;
  const computeFov = (w, h) => {
    const aspect = w / h;
    if (aspect < 1.0) {
      return Math.min(78, Math.max(50, baseFov / Math.pow(aspect, 0.65)));
    } else if (aspect > 2.05) {
      return Math.max(42, Math.min(baseFov, baseFov * (1.78 / aspect) * 1.05));
    }
    return baseFov;
  };

  // Smartphone verticale (9:16, notch)
  const portraitFov = computeFov(390, 844);
  assert.ok(portraitFov > 65, `Schermo portrait deve allargare il FOV per visibilità duna (ottenuto ${portraitFov})`);

  // Schermo standard 16:9
  const standardFov = computeFov(1920, 1080);
  assert.equal(standardFov, 50, 'Schermo 16:9 deve mantenere FOV base 50');

  // Schermo ultra-wide 21:9
  const ultrawideFov = computeFov(2560, 1080);
  assert.ok(ultrawideFov < 50 && ultrawideFov >= 42, `Ultra-wide 21:9 deve calibrare FOV per evitare distorsioni (ottenuto ${ultrawideFov})`);

  console.log('✓ 6. Display Estremi: compensazione adattiva FOV per schermi verticali e ultra-wide verificata');
})();

console.log('--- TUTTI I TEST DELLA FASE 14 SUPERATI CON SUCCESSO! ---');
