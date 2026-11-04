// Gestione impostazioni utente: Observer + persistenza immediata su localStorage (dds_settings_v1).
import { events } from './Events.js';

export const SETTINGS_KEY = 'dds_settings_v1';
export const SETTINGS_VERSION = 1;

/** Schema: tipo, default e vincoli di ogni impostazione (chiavi piatte "gruppo.nome"). */
export const SCHEMA = {
  'audio.master':        { type: 'range', def: 80, min: 0, max: 100, step: 1 },
  'audio.music':         { type: 'range', def: 70, min: 0, max: 100, step: 1 },
  'audio.sfx':           { type: 'range', def: 80, min: 0, max: 100, step: 1 },
  'audio.mute':          { type: 'bool',  def: false },
  'graphics.renderScale':{ type: 'enum',  def: 1, values: [0.5, 0.75, 1] },
  'graphics.shadows':    { type: 'enum',  def: 'low', values: ['off', 'low', 'high'] },
  'graphics.particles':  { type: 'enum',  def: 'med', values: ['low', 'med', 'high'] },
  'graphics.postProcessing': { type: 'bool', def: true },
  'graphics.dustMotes':  { type: 'bool',  def: true },
  'graphics.dayNightCycle': { type: 'enum', def: 'auto', values: ['auto', 'day', 'night'] },
  'graphics.fpsCap':     { type: 'enum',  def: 60, values: [30, 60, 0] }, // 0 = senza limite
  'graphics.showProfiler': { type: 'bool', def: false },
  'graphics.raytracingSSR': { type: 'bool', def: false },
  'graphics.modelStyle': { type: 'enum', def: 'gltf', values: ['gltf', 'procedural'] },
  'controls.cameraSens': { type: 'range', def: 1, min: 0.25, max: 2, step: 0.05 },
  'controls.invertY':    { type: 'bool',  def: false },
  'controls.screenShake':{ type: 'bool',  def: true },
  'controls.haptics':    { type: 'bool',  def: true },
  'accessibility.reducedMotion': { type: 'bool', def: false },
  'game.language':       { type: 'enum',  def: 'it', values: ['it', 'en'] },
  'game.notation':       { type: 'enum',  def: 'standard', values: ['standard', 'scientific', 'engineering'] },
};

/** Normalizza un valore secondo lo schema. Ritorna undefined se non valido. */
function coerce(def, val) {
  switch (def.type) {
    case 'range': {
      const n = Number(val);
      if (!Number.isFinite(n)) return undefined;
      return Math.min(def.max, Math.max(def.min, n));
    }
    case 'bool':
      if (typeof val === 'boolean') return val;
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    case 'enum':
      return def.values.find((v) => String(v) === String(val));
    default:
      return undefined;
  }
}

function isMobile() {
  try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; }
}

export class SettingsManager {
  constructor(storage = null) {
    this.storage = storage ?? SettingsManager._defaultStorage();
    this.listeners = new Map(); // key | '*' -> Set<fn>
    this.values = SettingsManager.defaults();
    this._load();
  }

  static _defaultStorage() {
    try { return window.localStorage; } catch { return null; }
  }

  static defaults() {
    const out = {};
    for (const [k, d] of Object.entries(SCHEMA)) out[k] = d.def;
    try {
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        out['accessibility.reducedMotion'] = true;
      }
    } catch {}
    return out;
  }

  /** Lettura da storage con try/catch. Dati corrotti o assenti: default. */
  _load() {
    let raw = null;
    try { raw = this.storage?.getItem(SETTINGS_KEY) ?? null; } catch { raw = null; }
    if (raw === null) {
      // Prima esecuzione: default più leggeri su dispositivi touch.
      if (isMobile()) {
        this.values['graphics.shadows'] = 'off';
        this.values['graphics.particles'] = 'low';
        this.values['graphics.renderScale'] = 0.75;
        this.values['graphics.postProcessing'] = false;
        this.values['graphics.dustMotes'] = false;
      }
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const src = parsed && typeof parsed === 'object' ? parsed.values : null;
      if (!src || typeof src !== 'object') throw new Error('formato non valido');
      for (const [k, def] of Object.entries(SCHEMA)) {
        const v = coerce(def, src[k]);
        if (v !== undefined) this.values[k] = v;
      }
    } catch (e) {
      console.warn('[Settings] dati corrotti, uso i default', e);
      this.values = SettingsManager.defaults();
    }
  }

  /** Scrittura immediata e sincrona (nessun debounce). */
  _save() {
    try {
      this.storage?.setItem(SETTINGS_KEY, JSON.stringify({ version: SETTINGS_VERSION, values: this.values }));
      return true;
    } catch (e) {
      console.warn('[Settings] salvataggio non riuscito', e);
      return false;
    }
  }

  get(key) {
    if (key === 'showProfiler') key = 'graphics.showProfiler';
    if (key === 'raytracingSSR') key = 'graphics.raytracingSSR';
    if (key === 'modelStyle') key = 'graphics.modelStyle';
    if (key === 'haptics') key = 'controls.haptics';
    if (key === 'notation') key = 'game.notation';
    if (key === 'reducedMotion') key = 'accessibility.reducedMotion';
    if (!(key in SCHEMA)) throw new Error(`Impostazione sconosciuta: ${key}`);
    return this.values[key];
  }

  get raytracingSSR() {
    return this.get('graphics.raytracingSSR');
  }

  set raytracingSSR(v) {
    this.set('graphics.raytracingSSR', v);
  }

  snapshot() { return { ...this.values }; }

  /** Imposta un valore, salva subito e notifica. Ritorna true se il valore è cambiato. */
  set(key, val) {
    if (key === 'showProfiler') key = 'graphics.showProfiler';
    if (key === 'raytracingSSR') key = 'graphics.raytracingSSR';
    if (key === 'modelStyle') key = 'graphics.modelStyle';
    if (key === 'haptics') key = 'controls.haptics';
    if (key === 'notation') key = 'game.notation';
    if (key === 'reducedMotion') key = 'accessibility.reducedMotion';
    const def = SCHEMA[key];
    if (!def) return false;
    const v = coerce(def, val);
    if (v === undefined || v === this.values[key]) return false;
    this.values[key] = v;
    this._save();
    this._notify(key, v);
    if (key === 'graphics.showProfiler') {
      this._notify('showProfiler', v);
    }
    if (key === 'graphics.raytracingSSR') {
      this._notify('raytracingSSR', v);
    }
    if (key === 'graphics.modelStyle') {
      this._notify('modelStyle', v);
      events.emit('settings:modelStyleChanged', v);
    }
    if (key === 'controls.haptics') {
      this._notify('haptics', v);
    }
    if (key === 'accessibility.reducedMotion') {
      this._notify('reducedMotion', v);
    }
    if (key === 'game.notation') {
      this._notify('notation', v);
    }
    return true;
  }

  /** Observer: fn(value, key). key = chiave esatta oppure '*' per tutte. Ritorna la funzione di unsubscribe. */
  subscribe(key, fn, { immediate = false } = {}) {
    if (key === 'showProfiler') key = 'graphics.showProfiler';
    if (key === 'raytracingSSR') key = 'graphics.raytracingSSR';
    if (key === 'modelStyle') key = 'graphics.modelStyle';
    if (key === 'haptics') key = 'controls.haptics';
    if (key === 'notation') key = 'game.notation';
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(fn);
    if (immediate) {
      if (key === '*') for (const [k, v] of Object.entries(this.values)) fn(v, k);
      else fn(this.values[key], key);
    }
    return () => this.listeners.get(key)?.delete(fn);
  }

  _notify(key, value) {
    for (const k of [key, '*']) {
      this.listeners.get(k)?.forEach((fn) => {
        try { fn(value, key); } catch (e) { console.error('[Settings] listener', e); }
      });
    }
    events.emit('settings:changed', { key, value });
  }

  resetDefaults() {
    for (const [k, d] of Object.entries(SCHEMA)) this.set(k, d.def);
  }

  exportJSON() {
    return JSON.stringify({ version: SETTINGS_VERSION, values: this.values }, null, 2);
  }

  /** Importa JSON. Applica solo le chiavi valide. Ritorna {ok, applied, error?}. */
  importJSON(text) {
    try {
      const parsed = JSON.parse(text);
      const src = parsed?.values ?? parsed;
      if (!src || typeof src !== 'object') throw new Error('JSON non valido');
      let applied = 0;
      for (const k of Object.keys(SCHEMA)) {
        if (k in src) {
          const before = this.values[k];
          this.set(k, src[k]);
          if (this.values[k] !== before) applied++;
        }
      }
      return { ok: true, applied };
    } catch (e) {
      return { ok: false, applied: 0, error: e.message };
    }
  }
}

