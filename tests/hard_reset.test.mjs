import assert from 'node:assert/strict';
import fs from 'node:fs';
import { i18n } from '../js/core/I18n.js';
import { Save, performHardReset } from '../js/core/Save.js';
import { SettingsManager } from '../js/core/SettingsManager.js';
import { StatsManager } from '../js/core/StatsManager.js';
import { Achievements } from '../js/systems/Achievements.js';
import { CosmeticsManager } from '../js/systems/CosmeticsManager.js';
import { BiomeManager } from '../js/world/BiomeManager.js';
import { SettingsModal } from '../js/ui/SettingsModal.js';

console.log('--- TEST UNITARIO: HARD RESET & CACHE WIPE ---');

// 1. Verifica Localizzazione I18n
console.log('1. Verifica I18n Hard Reset...');
i18n.setLanguage('it');
assert.equal(i18n.t('cheats.hard_reset_title'), 'Reset Totale & Svuota Cache');
assert.equal(i18n.t('cheats.hard_reset_btn'), '☢ Cancella Tutto e Riavvia');
assert.equal(i18n.t('cheats.hard_reset_confirm'), '⚠ Conferma Formattazione Totale');
assert.equal(i18n.t('cheats.hard_reset_progress'), 'Pulizia in corso…');
assert.ok(i18n.t('cheats.hard_reset_desc').includes('Tavolette'));

i18n.setLanguage('en');
assert.equal(i18n.t('cheats.hard_reset_title'), 'Full Wipe & Clear Cache');
assert.equal(i18n.t('cheats.hard_reset_btn'), '☢ Wipe All & Restart');
assert.equal(i18n.t('cheats.hard_reset_confirm'), '⚠ Confirm Full Format');
assert.equal(i18n.t('cheats.hard_reset_progress'), 'Wiping in progress…');
assert.ok(i18n.t('cheats.hard_reset_desc').includes('Tablets'));
i18n.setLanguage('it');
console.log('✓ Stringhe I18n verificate in IT ed EN.');

// 2. Verifica performHardReset con mock del browser
console.log('2. Verifica performHardReset()...');

let localCleared = false;
let sessionCleared = false;
const deletedCaches = [];
const unregisteredSw = [];
let replacedUrl = null;

const mockStorage = {
  data: {
    dds_save_v1: '{"sand": 1000}',
    dds_settings_v1: '{"values": {}}',
    dds_stats_v1: '{"totalClicks": 50}',
  },
  getItem(k) { return this.data[k] || null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; },
  clear() {
    this.data = {};
    localCleared = true;
  },
};

const mockSession = {
  data: {},
  clear() {
    this.data = {};
    sessionCleared = true;
  },
};

globalThis.window = {
  __DDS_WIPING_DATA: false,
  localStorage: mockStorage,
  sessionStorage: mockSession,
  location: {
    href: 'http://localhost:8080/?biome=desert',
    origin: 'http://localhost:8080',
    pathname: '/',
    search: '?biome=desert',
    hash: '',
    replace(url) {
      replacedUrl = url;
    },
    reload() {},
  },
  caches: {
    async keys() {
      return ['dds_cache_v1.0.0', 'dds_cache_pre_v1'];
    },
    async delete(key) {
      deletedCaches.push(key);
      return true;
    },
  },
  navigator: {
    serviceWorker: {
      async getRegistrations() {
        return [
          {
            unregister: async () => {
              unregisteredSw.push('sw1');
              return true;
            },
          },
        ];
      },
    },
  },
  indexedDB: {
    databases: async () => [{ name: 'test_db' }],
    deleteDatabase: () => ({ onsuccess: null, onerror: null, onblocked: null }),
  },
};

globalThis.localStorage = mockStorage;
globalThis.sessionStorage = mockSession;
globalThis.caches = window.caches;
try {
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    value: window.navigator.serviceWorker,
    configurable: true,
  });
} catch {}
globalThis.indexedDB = window.indexedDB;

const result = await Save.performHardReset({ reload: false });
assert.equal(result.ok, true, 'performHardReset deve ritornare ok: true');
assert.equal(window.__DDS_WIPING_DATA, true, '__DDS_WIPING_DATA deve essere true');
assert.equal(localCleared, true, 'localStorage deve essere stato svuotato');
assert.equal(sessionCleared, true, 'sessionStorage deve essere stato svuotato');
assert.deepEqual(deletedCaches, ['dds_cache_v1.0.0', 'dds_cache_pre_v1'], 'Tutte le cache devono essere eliminate');
assert.equal(unregisteredSw.length, 1, 'Tutti i Service Worker devono essere deregistrati');
console.log('✓ performHardReset ha ripulito storage, cache e service workers.');

// 3. Verifica blocco salvataggi con __DDS_WIPING_DATA = true
console.log('3. Verifica blocco auto-save durante la pulizia...');
const dummySave = new Save(mockStorage);
assert.equal(dummySave.write({ sand: 999 }), false, 'Save.write deve ritornare false');
assert.equal(dummySave.addTablets(10), 0, 'addTablets bloccato');

const dummySettings = new SettingsManager(mockStorage);
assert.equal(dummySettings._save(), false, 'SettingsManager._save deve ritornare false');

const dummyStats = new StatsManager(mockStorage);
assert.equal(dummyStats.save(), false, 'StatsManager.save deve ritornare false');

const dummyAch = new Achievements(dummyStats, dummySave);
dummyAch.storage = mockStorage;
assert.equal(dummyAch.saveData(), false, 'Achievements.saveData deve ritornare false');

const dummyCosm = new CosmeticsManager(dummySave, mockStorage);
assert.equal(dummyCosm.saveData(), false, 'CosmeticsManager.saveData deve ritornare false');

const dummyBiome = new BiomeManager(dummySave, dummyStats, mockStorage);
assert.equal(dummyBiome.saveData(), false, 'BiomeManager.saveData deve ritornare false');

console.log('✓ Tutti i moduli di persistenza rifiutano le scritture mentre __DDS_WIPING_DATA è true.');

// 4. Verifica UI SettingsModal Danger Zone e conferma a due stadi
console.log('4. Verifica UI SettingsModal Danger Zone...');
globalThis.document = {
  createElement: (tag) => {
    const el = {
      tagName: tag.toUpperCase(),
      id: '',
      _classes: new Set(),
      get className() { return Array.from(this._classes).join(' '); },
      set className(val) {
        this._classes.clear();
        if (val) val.trim().split(/\s+/).forEach(c => this._classes.add(c));
      },
      get classList() {
        const self = this;
        return {
          add(c) { self._classes.add(c); },
          remove(c) { self._classes.delete(c); },
          contains(c) { return self._classes.has(c); },
          toggle(c, force) {
            if (force !== undefined) {
              if (force) self._classes.add(c); else self._classes.delete(c);
            } else {
              if (self._classes.has(c)) self._classes.delete(c); else self._classes.add(c);
            }
          },
        };
      },
      children: [],
      append(...args) { this.children.push(...args); },
      listeners: {},
      addEventListener(evt, fn) {
        this.listeners[evt] = this.listeners[evt] || [];
        this.listeners[evt].push(fn);
      },
      dispatchEvent(evt) {
        (this.listeners[evt.type] || []).forEach(fn => fn(evt));
      },
    };
    return el;
  },
};

const settingsModal = new SettingsModal({
  settings: dummySettings,
  modal: null,
  save: dummySave,
  audio: null,
});

const dangerZone = settingsModal._createHardResetZone('btn-hard-reset-all');
assert.equal(dangerZone.className, 'cheat-danger-zone');
const wipeBtn = dangerZone.children.find(c => c.id === 'btn-hard-reset-all');
assert.ok(wipeBtn, 'Pulsante con ID #btn-hard-reset-all presente');
assert.ok(wipeBtn.classList.contains('btn-danger-wipe'), 'Classe .btn-danger-wipe presente');
assert.equal(wipeBtn.textContent, '☢ Cancella Tutto e Riavvia');

// Simula primo click: deve entrare in stato is-confirming
wipeBtn.dispatchEvent({ type: 'click', preventDefault: () => {}, stopPropagation: () => {} });
assert.ok(wipeBtn.classList.contains('is-confirming'), 'Dopo il primo click ha classe .is-confirming');
assert.equal(wipeBtn.textContent, '⚠ Conferma Formattazione Totale', 'Testo aggiornato alla conferma');

console.log('✓ Conferma a due stadi del Danger Zone verificata.');

// 5. Verifica Presenza CSS
console.log('5. Verifica Regole CSS...');
const css = fs.readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
assert.ok(css.includes('.cheat-danger-zone'), 'CSS include .cheat-danger-zone');
assert.ok(css.includes('.danger-zone-title'), 'CSS include .danger-zone-title');
assert.ok(css.includes('.danger-zone-info'), 'CSS include .danger-zone-info');
assert.ok(css.includes('.btn-danger-wipe'), 'CSS include .btn-danger-wipe');
assert.ok(css.includes('.btn-danger-wipe.is-confirming'), 'CSS include .btn-danger-wipe.is-confirming');
console.log('✓ Regole CSS per la Danger Zone presenti e convalidate.');

console.log('\n--- TUTTI I TEST UNITARI HARD RESET HANNO AVUTO SUCCESSO! ---');
