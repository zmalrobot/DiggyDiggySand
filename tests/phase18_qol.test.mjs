// Test Unitari per la Fase 18: Quality of Life (Multi-Buy, Notazione Numerica, Save Import/Export)
// e Game Juice (Floating Text, Camera Shake, Haptic Feedback) per Diggy Diggy Sand.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { State } from '../js/core/State.js';
import {
  UPGRADE_CATALOG,
  getUpgradeCost,
  getMultiUpgradeCost,
  getMaxAffordableLevels,
  buyMultiUpgrade,
} from '../js/systems/Upgrades.js';
import { CameraController } from '../js/world/Camera.js';
import { FloatingTextManager } from '../js/ui/FloatingText.js';
import { Haptics } from '../js/core/Haptics.js';
import { SaveSerializer } from '../js/core/SaveSerializer.js';
import { formatNumber, setGlobalNotation } from '../js/ui/Hud.js';
import { SettingsManager } from '../js/core/SettingsManager.js';
import { i18n } from '../js/core/I18n.js';

console.log('--- TEST FASE 18: QoL & GAME JUICE ---');

// Mock localStorage per i test
const storage = new Map();
const mockLocalStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

// 1. Test Multi-Buy: Calcolo Costi Serie Geometrica e Modalità MAX
{
  console.log('Test 1: Multi-Buy (Serie Geometrica e Modalità MAX)');

  const shovelDef = UPGRADE_CATALOG.shovel;
  assert.ok(shovelDef, 'Definizione pala presente');

  // Livello 0: costo singolo
  const cost1 = getUpgradeCost(shovelDef, 0);
  assert.equal(cost1, 10, 'Costo pala Lv 0 è 10');

  // Costo cumulativo 10 livelli: somma dei costi da Lv 0 a Lv 9
  let expected10 = 0;
  for (let i = 0; i < 10; i++) expected10 += getUpgradeCost(shovelDef, i);

  const multiCost10 = getMultiUpgradeCost(shovelDef, 0, 10);
  assert.equal(multiCost10, expected10, 'getMultiUpgradeCost calcola esattamente la somma geometrica di 10 livelli');

  // Modalità MAX: saldo limitato
  const sandBudget = 50; // Con 10 (lv0) + 11 (lv1) + 13 (lv2) + 15 (lv3) = 49 sabbia => 4 livelli
  const maxAffordable = getMaxAffordableLevels(shovelDef, 0, sandBudget);
  assert.equal(maxAffordable.count, 4, 'Con 50 sabbia si possono acquistare esattamente 4 livelli');
  assert.ok(maxAffordable.cost <= sandBudget, 'Il costo non supera il budget disponibile');
  assert.equal(maxAffordable.cost, 49, 'Costo totale dei 4 livelli è 49');

  // Modalità MAX con budget insufficiente
  const zeroAffordable = getMaxAffordableLevels(shovelDef, 0, 5);
  assert.equal(zeroAffordable.count, 0, 'Sotto il costo base, MAX ritorna 0');
  assert.equal(zeroAffordable.cost, 0);

  // Esecuzione acquisto in blocco
  const state = new State();
  state.reset({ sand: 200, upgrades: {} });
  const buyRes = buyMultiUpgrade('shovel', 5, state);
  assert.equal(buyRes.ok, true, 'Acquisto 5 livelli riuscito');
  assert.equal(buyRes.boughtLevels, 5);
  assert.equal(state.upgrades.shovel, 5, 'Livello pala aggiornato a 5');
  assert.ok(state.sand < 200, 'Saldo sabbia decurtato correttamente');

  // Acquisto in modalità MAX
  const sandBefore = state.sand;
  const maxBuyRes = buyMultiUpgrade('shovel', 'MAX', state);
  assert.equal(maxBuyRes.ok, true, 'Acquisto MAX riuscito');
  assert.ok(maxBuyRes.boughtLevels > 0, 'Livelli aggiunti in modalità MAX');
  assert.ok(state.sand >= 0 && state.sand < sandBefore);

  console.log('  ✓ Calcolo geometrico, stima analitica MAX e acquisti multipli verificati');
}

// 2. Test Numeri Fluttuanti (FloatingTextManager a Pool)
{
  console.log('Test 2: FloatingTextManager (Pool e Proiezione 3D/2D)');

  const mockCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  mockCamera.position.set(0, 5, 10);
  mockCamera.lookAt(0, 0, 0);
  mockCamera.updateMatrixWorld();
  mockCamera.updateProjectionMatrix();

  const mockCanvas = {
    clientWidth: 800,
    clientHeight: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };

  // Mock DOM per Node.js
  const mockContainer = {
    children: [],
    appendChild: function(child) { this.children.push(child); },
    removeChild: function(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) this.children.splice(idx, 1);
    },
  };

  globalThis.document = {
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      className: '',
      style: {},
      textContent: '',
      offsetWidth: 50,
    }),
  };

  const ftManager = new FloatingTextManager({
    container: mockContainer,
    camera: mockCamera,
    canvas: mockCanvas,
    poolSize: 15,
  });

  assert.equal(ftManager.pool.length, 15, 'Pool pre-allocato di 15 elementi');

  // Spawn 3D visibile davanti alla camera
  const spawned = ftManager.spawn3D({ x: 0, y: 0, z: 0, text: '+15', isCrit: false });
  assert.ok(spawned, 'Elemento fluttuante generato');
  assert.equal(spawned.textContent, '+15');
  assert.ok(spawned.className.includes('normal'), 'Classe normal assegnata');
  assert.ok(spawned.style.left.includes('px'), 'Posizione orizzontale in pixel calcolata');
  assert.ok(spawned.style.top.includes('px'), 'Posizione verticale in pixel calcolata');

  // Spawn Colpo Critico
  const critSpawned = ftManager.spawn3D({ x: 0, y: 0, z: 0, text: '+150 CRIT!', isCrit: true });
  assert.ok(critSpawned);
  assert.ok(critSpawned.className.includes('crit'), 'Classe crit applicata al colpo critico');

  // Punto dietro la camera (z = 20) -> deve essere ignorato senza errori
  const behindSpawned = ftManager.spawn3D({ x: 0, y: 0, z: 20, text: 'dietro' });
  assert.equal(behindSpawned, null, 'Nessun testo generato per punti posti dietro la visuale');

  ftManager.dispose();
  console.log('  ✓ Pool circolare, proiezione 3D e colpi critici verificati');
}

// 3. Test Camera Shake Procedurale con Modello a Trauma Non Lineare
{
  console.log('Test 3: Camera Shake Procedurale (Trauma & Decadimento)');

  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 200);
  const target = new THREE.Vector3(0, 0, 0);
  const mockControls = {
    target,
    update: () => {},
  };
  const mockDom = { addEventListener: () => {}, removeEventListener: () => {} };

  const camController = new CameraController(camera, mockControls, mockDom);

  // Inizialmente nessun trauma
  assert.equal(camController.trauma, 0, 'Trauma iniziale pari a 0');

  // Aggiunta trauma (es. colpo critico 0.15)
  camController.addTrauma(0.15);
  assert.equal(camController.trauma, 0.15, 'Trauma registrato correttamente');

  // Shake marcato (dinamite 0.5)
  camController.addTrauma(0.5);
  assert.equal(camController.trauma, 0.65, 'Trauma accumulato fino a 0.65');

  // Clamping a 1.0 massimo
  camController.addTrauma(0.8);
  assert.equal(camController.trauma, 1.0, 'Trauma rigorosamente limitato a 1.0 max');

  // Aggiornamento per-frame: decadimento esponenziale e offset calcolato
  const initialTrauma = camController.trauma;
  camController.update(0.2); // dt = 0.2s con decadimento 1.5/s => decadimento di 0.3

  assert.ok(camController.trauma < initialTrauma, 'Trauma decaduto dopo update');
  assert.ok(camController.trauma >= 0.65 && camController.trauma <= 0.75, 'Decadimento lineare conforme (dt * 1.5)');

  // Decadimento completo a zero
  camController.update(2.0);
  assert.equal(camController.trauma, 0, 'Trauma ritorna esattamente a 0');

  camController.dispose();
  console.log('  ✓ Sistema trauma esponenziale, clamping e decadimento verificati');
}

// 4. Test Feedback Aptico (Haptics)
{
  console.log('Test 4: Feedback Aptico (Haptics)');

  let lastVibratePattern = null;
  Object.defineProperty(globalThis.navigator, 'vibrate', {
    value: (pattern) => {
      lastVibratePattern = pattern;
      return true;
    },
    configurable: true,
    writable: true,
  });

  const settings = new SettingsManager(mockLocalStorage);
  settings.set('controls.haptics', true);

  const h = new Haptics(settings);
  assert.equal(h.enabled, true, 'Haptics abilitato');

  // Scavo manuale (12ms)
  h.dig();
  assert.equal(lastVibratePattern, 12, 'Impulso scavo manuale 12ms');

  // Colpo critico (28ms)
  h.crit();
  assert.equal(lastVibratePattern, 28, 'Impulso critico 28ms');

  // Acquisto upgrade ([15, 30, 15]ms)
  h.purchase();
  assert.deepEqual(lastVibratePattern, [15, 30, 15], 'Pattern acquisto [15, 30, 15]ms');

  // Esplosione Dinamite ([40, 25, 60]ms)
  h.dynamite();
  assert.deepEqual(lastVibratePattern, [40, 25, 60], 'Pattern dinamite [40, 25, 60]ms');

  // Disattivazione tramite impostazioni
  settings.set('controls.haptics', false);
  assert.equal(h.enabled, false, 'Haptics recepisce disattivazione dalle impostazioni');
  lastVibratePattern = null;
  const res = h.dig();
  assert.equal(res, false, 'Vibrazione bloccata quando disabilitato');
  assert.equal(lastVibratePattern, null);

  h.dispose();
  console.log('  ✓ Integrazione navigator.vibrate e rispetto impostazioni verificati');
}

// 5. Test Serializzazione Salvataggio Portabile (SaveSerializer Base64)
{
  console.log('Test 5: SaveSerializer (Export / Import Base64 & Integrità)');

  const validSaveData = {
    version: 1,
    seed: 1234567,
    sand: 8520,
    totalSand: 15400,
    clicks: 142,
    upgrades: { shovel: 4, frequency: 2 },
    endingsSeen: ['treasure'],
  };

  // Serializzazione
  const code = SaveSerializer.serialize(validSaveData);
  assert.ok(typeof code === 'string', 'Codice esportato è stringa');
  assert.ok(code.startsWith('DDS1_'), 'Prefisso versione DDS1_ presente');

  // Deserializzazione
  const restored = SaveSerializer.deserialize(code);
  assert.equal(restored.version, validSaveData.version);
  assert.equal(restored.seed, validSaveData.seed);
  assert.equal(restored.sand, validSaveData.sand);
  assert.equal(restored.totalSand, validSaveData.totalSand);
  assert.deepEqual(restored.upgrades, validSaveData.upgrades);

  // Rifiuto dati corrotti o manomessi
  assert.throws(() => SaveSerializer.deserialize('stringa_invalida_non_base64!@#'), /corrotto|non valido/);
  assert.throws(() => SaveSerializer.deserialize('DDS1_e30='), /vincoli di integrità|schema/); // JSON vuoto {}

  // Test importazione con backup automatico
  mockLocalStorage.setItem('dds_save_v1', JSON.stringify(validSaveData));
  const newSaveData = { ...validSaveData, sand: 99999, clicks: 500 };
  const newCode = SaveSerializer.serialize(newSaveData);

  const importRes = SaveSerializer.importFromCode(newCode, mockLocalStorage);
  assert.equal(importRes.ok, true, 'Importazione riuscita');
  assert.equal(importRes.data.sand, 99999);

  // Verifica che il salvataggio precedente sia stato salvato nel backup
  const backupRaw = mockLocalStorage.getItem('dds_save_backup');
  assert.ok(backupRaw, 'Backup automatico creato prima di sovrascrivere');
  const backup = JSON.parse(backupRaw);
  assert.equal(backup.sand, 8520, 'Backup contiene il vecchio valore di sabbia');

  console.log('  ✓ Serializzazione Base64, deserializzazione con schema check e backup automatico verificati');
}

// 6. Test Notazione Numerica Configurabile (Standard, Scientifica, Ingegneristica)
{
  console.log('Test 6: Notazione Numerica Configurabile');

  const val = 1200000; // 1.2M o 1.20e+6

  // 1. Standard
  setGlobalNotation('standard');
  assert.equal(formatNumber(val), '1.2M', 'Standard compatta restituisce 1.2M');
  assert.equal(formatNumber(850), '850', 'Sotto 1000 rimane intero');

  // 2. Scientifica
  setGlobalNotation('scientific');
  const sci = formatNumber(val);
  assert.ok(sci.includes('e+6') || sci.includes('e6'), 'Scientifica include esponente e6');

  // 3. Ingegneristica (multipli di 3)
  setGlobalNotation('engineering');
  const eng = formatNumber(val);
  assert.ok(eng.includes('e6'), 'Ingegneristica mantiene multiplo di 3 per 1M');

  // 4. Override puntuale
  assert.equal(formatNumber(1500, 'standard'), '1.5k');
  assert.ok(formatNumber(1500, 'scientific').includes('e'));

  setGlobalNotation('standard'); // Ripristina
  console.log('  ✓ Notazioni Standard, Scientifica e Ingegneristica verificate');
}

console.log('--- TUTTI I TEST FASE 18 SUPERATI CON SUCCESSO! ---');
