// Caricamento asset con THREE.LoadingManager e THREE.GLTFLoader.
// Fallback procedurale garantito in ogni condizione (ProceduralFactory.js).
import * as THREE from 'three';
import { createFallback, FALLBACK_IDS } from '../world/ProceduralFactory.js';

export const ASSET_TIMEOUT_MS = 10000;
export const GLOBAL_TIMEOUT_MS = 30000;

const FONT_SPECS = ['700 1em "Cinzel Decorative"', '700 1em "Cinzel"', '500 1em "Syne"'];

export const MODEL_REGISTRY = {
  // Tools
  'tools/shovel_basic.glb': { id: 'TOOL_SHOVEL', file: 'assets/models/tools/shovel_basic.glb', fallback: 'createShovel' },
  'tools/shovel_atlantean.glb': { id: 'TOOL_SHOVEL_ATLANTEAN', file: 'assets/models/tools/shovel_atlantean.glb', fallback: 'createShovel' },
  // Machinery
  'machinery/worker_scarab.glb': { id: 'UNIT_SCARAB', file: 'assets/models/machinery/worker_scarab.glb', fallback: 'createWorker' },
  'machinery/excavator_steam.glb': { id: 'UNIT_EXCAVATOR', file: 'assets/models/machinery/excavator_steam.glb', fallback: 'createExcavator' },
  'machinery/dredge.glb': { id: 'UNIT_DREDGE', file: 'assets/models/machinery/dredge.glb', fallback: 'createMonolith' },
  // Ruins
  'ruins/column.glb': { id: 'RUIN_COLUMN', file: 'assets/models/ruins/column.glb', fallback: 'createPillar' },
  'ruins/temple_center.glb': { id: 'RUIN_TEMPLE', file: 'assets/models/ruins/temple_center.glb', fallback: 'createObelisk' },
  'ruins/chest.glb': { id: 'RUIN_CHEST', file: 'assets/models/ruins/chest.glb', fallback: 'createChest' },
};

const withTimeout = (promise, ms, label) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`timeout ${label}`)), ms);
  promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

export class AssetLoader {
  constructor() {
    this.manager = new THREE.LoadingManager();
    this.models = new Map();   // id -> THREE.Object3D caricato
    this.pending = new Set();  // item ancora in corso (per il timeout globale)
    this.report = { loaded: [], fallback: [] };
    this.manifest = null;
  }

  /** Avvolge un'operazione come item del LoadingManager; non rifiuta mai. */
  async _track(name, fn, timeoutMs = ASSET_TIMEOUT_MS) {
    this.manager.itemStart(name);
    this.pending.add(name);
    let result = null;
    try {
      result = await withTimeout(Promise.resolve().then(fn), timeoutMs, name);
    } catch (e) {
      console.warn(`[Assets] ${name}: ${e.message}. Uso il fallback.`);
      this.report.fallback.push(name);
    } finally {
      if (this.pending.delete(name)) this.manager.itemEnd(name);
    }
    return result;
  }

  /** Carica font, manifest e modelli disponibili. Risolve sempre. */
  async loadAll() {
    const work = this._loadEverything();
    const global = new Promise((resolve) => setTimeout(() => {
      if (this.pending.size) {
        console.warn('[Assets] timeout globale, fallback per:', [...this.pending]);
        for (const name of [...this.pending]) {
          this.report.fallback.push(name);
          this.pending.delete(name);
          this.manager.itemEnd(name);
        }
      }
      resolve();
    }, GLOBAL_TIMEOUT_MS));
    await Promise.race([work, global]);
    return this.report;
  }

  async _loadEverything() {
    // Font Google (se offline il browser usa il fallback generico del font-stack)
    const fonts = FONT_SPECS.map((spec) => this._track(`font:${spec}`, () => document.fonts.load(spec)));

    // Warm-up dei fallback procedurali
    const factory = this._track('procedural-factory', () => {
      FALLBACK_IDS.forEach((id) => createFallback(id));
    });

    const manifest = await this._track('manifest', async () => {
      const res = await fetch('assets/manifest.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
    this.manifest = manifest;

    const entries = (manifest?.models ?? []).filter((m) => m.available === true);
    let loader = null;
    if (entries.length) {
      try {
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        loader = new GLTFLoader(this.manager);
      } catch (e) {
        console.warn('[Assets] GLTFLoader non disponibile', e);
      }
    }

    const models = entries.map((m) => this._track(`model:${m.id}`, async () => {
      if (!loader) throw new Error('GLTFLoader assente');
      const gltf = await loader.loadAsync(m.file);
      this._prepareMesh(gltf.scene);
      this.models.set(m.id, gltf.scene);
      this.models.set(m.file, gltf.scene);
      this.report.loaded.push(m.id);
    }));

    await Promise.all([...fonts, factory, ...models]);
  }

  _prepareMesh(root) {
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        [].concat(o.material).forEach((mt) => {
          if (mt) {
            mt.flatShading = true;
            mt.roughness = Math.max(0.2, mt.roughness ?? 0.5);
            mt.needsUpdate = true;
          }
        });
      }
    });
  }

  /**
   * Pattern Fallback Robusto per caricare un modello on-demand:
   * se presente lo carica e clona, se assente invoca il fallbackGenerator o createFallback.
   */
  async loadModel(id, fallbackGenerator = null) {
    if (this.models.has(id)) {
      return this.models.get(id).clone(true);
    }

    const reg = MODEL_REGISTRY[id] || Object.values(MODEL_REGISTRY).find((r) => r.id === id);
    const file = reg?.file || (id.endsWith('.glb') ? `assets/models/${id}` : null);

    if (file && typeof window !== 'undefined' && window.fetch) {
      try {
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        const loader = new GLTFLoader(this.manager);
        const gltf = await loader.loadAsync(file);
        this._prepareMesh(gltf.scene);
        this.models.set(id, gltf.scene);
        if (reg?.id) this.models.set(reg.id, gltf.scene);
        this.report.loaded.push(id);
        return gltf.scene.clone(true);
      } catch {
        this.report.fallback.push(id);
      }
    }

    return this.getModel(id, fallbackGenerator);
  }

  /** Restituisce un clone del modello caricato oppure il fallback procedurale. */
  getModel(id, fallbackGenerator = null) {
    let src = this.models.get(id);
    if (!src) {
      const reg = MODEL_REGISTRY[id] || Object.values(MODEL_REGISTRY).find((r) => r.id === id);
      if (reg) src = this.models.get(reg.id) || this.models.get(reg.file);
    }
    if (src) return src.clone(true);
    if (fallbackGenerator) return fallbackGenerator();
    return createFallback(id);
  }
}
