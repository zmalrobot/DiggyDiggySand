// Caricamento asset con THREE.LoadingManager e THREE.GLTFLoader.
// Fallback procedurale garantito in ogni condizione (ProceduralFactory.js).
import * as THREE from 'three';
import { createFallback, createMesh, FALLBACK_IDS } from '../world/ProceduralFactory.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const ASSET_TIMEOUT_MS = 10000;
export const GLOBAL_TIMEOUT_MS = 30000;

const FONT_SPECS = ['700 1em "Cinzel Decorative"', '700 1em "Cinzel"', '500 1em "Syne"'];

export const DEFAULT_TARGET_HEIGHTS = {
  worker: 1.4,
  excavator: 2.5,
  chest: 0.85,
  pillar: 5.0,
  shovel: 0.9,
  obelisk: 6.0,
};

export const MODEL_REGISTRY = {
  // Tools
  'tools/shovel.glb': { id: 'MODEL_SHOVEL', file: './assets/models/tools/shovel.glb', fallback: 'createShovel', height: 0.9 },
  'tools/shovel_basic.glb': { id: 'TOOL_SHOVEL', file: './assets/models/tools/shovel_basic.glb', fallback: 'createShovel', height: 0.9 },
  'tools/shovel_atlantean.glb': { id: 'TOOL_SHOVEL_ATLANTEAN', file: './assets/models/tools/shovel_atlantean.glb', fallback: 'createShovel', height: 0.9 },
  // Machinery & Fleet
  'fleet/worker.glb': { id: 'MODEL_WORKER', file: './assets/models/fleet/worker_animated.glb', fallback: 'createWorker', height: 1.4 },
  'fleet/worker_animated.glb': { id: 'MODEL_WORKER_ANIMATED', file: './assets/models/fleet/worker_animated.glb', fallback: 'createWorker', height: 1.4 },
  'fleet/excavator.glb': { id: 'MODEL_EXCAVATOR', file: './assets/models/fleet/excavator_rigged.glb', fallback: 'createExcavator', height: 2.5 },
  'fleet/excavator_rigged.glb': { id: 'MODEL_EXCAVATOR_RIGGED', file: './assets/models/fleet/excavator_rigged.glb', fallback: 'createExcavator', height: 2.5 },
  'machinery/worker_scarab.glb': { id: 'UNIT_SCARAB', file: './assets/models/fleet/worker_animated.glb', fallback: 'createWorker', height: 1.4 },
  'machinery/excavator_steam.glb': { id: 'UNIT_EXCAVATOR', file: './assets/models/fleet/excavator_rigged.glb', fallback: 'createExcavator', height: 2.5 },
  'machinery/dredge.glb': { id: 'UNIT_DREDGE', file: './assets/models/machinery/dredge.glb', fallback: 'createMonolith', height: 3.5 },
  // Props
  'props/chest_animated.glb': { id: 'MODEL_CHEST_ANIMATED', file: './assets/models/props/chest_animated.glb', fallback: 'createChest', height: 0.85 },
  // Ruins & City
  'city/obelisk.glb': { id: 'MODEL_OBELISK', file: './assets/models/city/obelisk.glb', fallback: 'createObelisk', height: 6.0 },
  'city/chest.glb': { id: 'MODEL_CHEST', file: './assets/models/props/chest_animated.glb', fallback: 'createChest', height: 0.85 },
  'city/pillar_ruin.glb': { id: 'MODEL_PILLAR_RUIN', file: './assets/models/city/pillar_ruin.glb', fallback: 'createPillar', height: 5.0 },
  'ruins/column.glb': { id: 'RUIN_COLUMN', file: './assets/models/city/pillar_ruin.glb', fallback: 'createPillar', height: 5.0 },
  'ruins/temple_center.glb': { id: 'RUIN_TEMPLE', file: './assets/models/ruins/temple_center.glb', fallback: 'createObelisk', height: 6.0 },
  'ruins/chest.glb': { id: 'RUIN_CHEST', file: './assets/models/props/chest_animated.glb', fallback: 'createChest', height: 0.85 },
};

const withTimeout = (promise, ms, label) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`timeout ${label}`)), ms);
  promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

export class AssetLoader {
  constructor(settings = null) {
    this.settings = settings;
    this.manager = new THREE.LoadingManager();
    this.models = new Map();       // id -> THREE.Object3D caricato e normalizzato
    this.animations = new Map();   // id -> THREE.AnimationClip[]
    this.pending = new Set();      // item ancora in corso (per il timeout globale)
    this.report = { loaded: [], fallback: [] };
    this.maxAnisotropy = 16;
    this.manifest = null;
  }

  setSettings(settings) {
    this.settings = settings;
  }

  /**
   * Normalizza qualsiasi modello sull'altezza target definita in metri di gioco
   * e ancora i piedi a Y = 0 (grounding pivot).
   */
  normalizeModel(gltfScene, targetHeight = 1.5) {
    if (!gltfScene) return gltfScene;
    const box = new THREE.Box3().setFromObject(gltfScene);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Evita divisioni per zero se il modello è vuoto
    if (size.y > 0) {
      const scaleFactor = targetHeight / size.y;
      gltfScene.scale.setScalar(scaleFactor);

      // Ricalcola il bounding box dopo lo scale per allineare i piedi sul terreno (Y = 0)
      box.setFromObject(gltfScene);
      gltfScene.position.y = -box.min.y;
    }

    // Applica flatShading sui materiali per esaltare le faccette low-poly
    gltfScene.traverse((child) => {
      if (child.isMesh && child.material) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => {
            if (m) {
              m.flatShading = true;
              m.needsUpdate = true;
            }
          });
        } else {
          child.material.flatShading = true;
          child.material.needsUpdate = true;
        }
      }
    });

    return gltfScene;
  }

  _resolveTargetHeight(id) {
    const reg = MODEL_REGISTRY[id] || Object.values(MODEL_REGISTRY).find((r) => r.id === id);
    if (reg?.height) return reg.height;
    const clean = String(id).toLowerCase();
    if (clean.includes('worker') || clean.includes('scarab') || clean.includes('character')) return DEFAULT_TARGET_HEIGHTS.worker;
    if (clean.includes('excavator') || clean.includes('tractor')) return DEFAULT_TARGET_HEIGHTS.excavator;
    if (clean.includes('chest')) return DEFAULT_TARGET_HEIGHTS.chest;
    if (clean.includes('pillar') || clean.includes('column')) return DEFAULT_TARGET_HEIGHTS.pillar;
    if (clean.includes('obelisk') || clean.includes('temple')) return DEFAULT_TARGET_HEIGHTS.obelisk;
    if (clean.includes('shovel')) return DEFAULT_TARGET_HEIGHTS.shovel;
    return 1.5;
  }

  /** Restituisce l'array di AnimationClip per un id modello o file. */
  getAnimations(id) {
    if (this.animations.has(id)) return this.animations.get(id);
    const reg = MODEL_REGISTRY[id] || Object.values(MODEL_REGISTRY).find((r) => r.id === id);
    if (reg) {
      return this.animations.get(reg.id) || this.animations.get(reg.file) || [];
    }
    return [];
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
      const res = await fetch('./assets/manifest.json', { cache: 'no-cache' });
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
      const filePath = m.file.startsWith('./') ? m.file : `./${m.file}`;
      const gltf = await loader.loadAsync(filePath);
      if (gltf.animations && gltf.animations.length) {
        this.animations.set(m.id, gltf.animations);
        this.animations.set(m.file, gltf.animations);
        this.animations.set(filePath, gltf.animations);
        gltf.scene.userData.animations = gltf.animations;
      }
      const targetH = this._resolveTargetHeight(m.id);
      this.normalizeModel(gltf.scene, targetH);
      this._prepareMesh(gltf.scene);
      this.models.set(m.id, gltf.scene);
      this.models.set(m.file, gltf.scene);
      this.models.set(filePath, gltf.scene);
      this.report.loaded.push(m.id);
    }));

    await Promise.all([...fonts, factory, ...models]);
  }

  setMaxAnisotropy(val) {
    this.maxAnisotropy = Math.max(1, val || 1);
  }

  _prepareMesh(root) {
    const texKeys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'bumpMap', 'aoMap', 'emissiveMap'];
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        [].concat(o.material).forEach((mt) => {
          if (mt) {
            mt.flatShading = true;
            mt.roughness = Math.max(0.2, mt.roughness ?? 0.5);
            for (const k of texKeys) {
              const tex = mt[k];
              if (tex && typeof tex === 'object' && tex.isTexture) {
                tex.anisotropy = this.maxAnisotropy;
                tex.minFilter = THREE.LinearMipmapLinearFilter;
                tex.magFilter = THREE.LinearFilter;
                tex.generateMipmaps = true;
                tex.needsUpdate = true;
              }
            }
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
      return this.getModel(id, fallbackGenerator);
    }

    const reg = MODEL_REGISTRY[id] || Object.values(MODEL_REGISTRY).find((r) => r.id === id);
    const rawFile = reg?.file || (id.endsWith('.glb') ? (id.startsWith('./') ? id : (id.startsWith('assets/') ? `./${id}` : `./assets/models/${id}`)) : null);
    const file = rawFile ? (rawFile.startsWith('./') ? rawFile : `./${rawFile}`) : null;

    if (file && typeof window !== 'undefined' && window.fetch) {
      try {
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        const loader = new GLTFLoader(this.manager);
        const gltf = await loader.loadAsync(file);
        if (gltf && gltf.scene) {
          if (gltf.animations && gltf.animations.length) {
            this.animations.set(id, gltf.animations);
            if (reg?.id) this.animations.set(reg.id, gltf.animations);
            this.animations.set(file, gltf.animations);
            gltf.scene.userData.animations = gltf.animations;
          }
          const targetH = this._resolveTargetHeight(id);
          this.normalizeModel(gltf.scene, targetH);
          this._prepareMesh(gltf.scene);
          this.models.set(id, gltf.scene);
          if (reg?.id) this.models.set(reg.id, gltf.scene);
          this.models.set(file, gltf.scene);
          this.report.loaded.push(id);
          return this.getModel(id, fallbackGenerator);
        }
      } catch (err) {
        console.warn(`[Assets] Caricamento GLTF per "${id}" (${file}) fallito, fallback procedurale:`, err?.message || err);
        this.report.fallback.push(id);
      }
    }

    return this.getModel(id, fallbackGenerator);
  }

  /**
   * Restituisce un modello clonabile in base all'impostazione corrente (GLTF vs Procedurale):
   * Se modelStyle === 'gltf' e il modello è disponibile, clona con flatShading e shadow mapping.
   * Se modelStyle === 'procedural' o il modello non è precaricato, usa il fallback procedurale.
   */
  getModel(id, fallbackGenerator = null) {
    const style = this.settings?.get?.('graphics.modelStyle') ?? this.settings?.modelStyle ?? 'gltf';
    if (style === 'gltf') {
      let src = this.models.get(id);
      if (!src) {
        const reg = MODEL_REGISTRY[id] || Object.values(MODEL_REGISTRY).find((r) => r.id === id);
        if (reg) {
          src = this.models.get(reg.id) || this.models.get(reg.file) || (reg.file ? this.models.get(reg.file.replace(/^\.\//, '')) : null);
        }
      }
      if (src) {
        let clone = null;
        try {
          clone = (SkeletonUtils && typeof SkeletonUtils.clone === 'function')
            ? SkeletonUtils.clone(src)
            : src.clone(true);
        } catch (e) {
          clone = src.clone(true);
        }
        const anims = this.getAnimations(id) || src.userData?.animations;
        if (anims && anims.length) {
          clone.userData = clone.userData || {};
          clone.userData.animations = anims;
        }
        this._prepareMesh(clone);
        return clone;
      }
    }

    if (fallbackGenerator) {
      try {
        return fallbackGenerator();
      } catch (e) {
        console.warn(`[Assets] fallbackGenerator fallito per "${id}":`, e);
      }
    }
    return createMesh(id);
  }
}
