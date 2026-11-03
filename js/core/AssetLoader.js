// Caricamento asset con THREE.LoadingManager. Mai bloccante: timeout 10s per asset, 30s globale,
// poi fallback procedurale (ProceduralFactory.js).
import * as THREE from 'three';
import { createFallback, FALLBACK_IDS } from '../world/ProceduralFactory.js';

export const ASSET_TIMEOUT_MS = 10000;
export const GLOBAL_TIMEOUT_MS = 30000;

const FONT_SPECS = ['700 1em "Cinzel Decorative"', '700 1em "Cinzel"', '500 1em "Syne"'];

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
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = o.receiveShadow = true;
          [].concat(o.material).forEach((mt) => { if (mt && 'flatShading' in mt) { mt.flatShading = true; mt.needsUpdate = true; } });
        }
      });
      this.models.set(m.id, gltf.scene);
      this.report.loaded.push(m.id);
    }));

    await Promise.all([...fonts, factory, ...models]);
  }

  /** Restituisce un clone del modello caricato oppure il fallback procedurale. */
  getModel(id) {
    const src = this.models.get(id);
    if (src) return src.clone(true);
    return createFallback(id);
  }
}

