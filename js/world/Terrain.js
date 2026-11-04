// Terreno deformabile a heightmap. Quota iniziale sabbia Y=12, bedrock Y=0.
// - `heights` (Float32Array) è la fonte di verità e resta sincronizzato con gli attributi `position`.
// - Griglia a chunk da 8x8 vertici con dirty flags: ricolore e upload GPU solo per le zone scavate.
// - flatShading: true => le normali arrivano dalle derivate dello shader (dFdx/dFdy). Non serve
//   `computeVertexNormals()` sull'intera mesh (AGENTS §6), quindi niente costo O(n) per colpo.
//   `flush()` viene chiamato al massimo una volta per frame: è il throttling dell'aggiornamento.
import * as THREE from 'three';
import { PALETTE_3D } from './ProceduralFactory.js';
import { BIOME_CATALOG } from './BiomeManager.js';
import { generateSandPbrSet } from './TextureGenerator.js';

export const CHUNK = 8;                 // vertici per lato del chunk
export const TERRAIN_SIZE = 200;       // dimensione del piano di gioco
export const BOUNDARY_LIMIT = (TERRAIN_SIZE / 2) - 2.5;

export const BIOME_PALETTES = {
  sand_classic: {
    layer1: new THREE.Color(0xE0C27A),
    layer2: new THREE.Color(0xB88A44),
    layer3: new THREE.Color(0x6E563B),
    vein: new THREE.Color(PALETTE_3D.atlantisCoreTeal),
    hex1: 0xE0C27A,
    hex2: 0xB88A44,
    hex3: 0x6E563B,
  },
  sand_mars: {
    layer1: new THREE.Color(0xC84B31),
    layer2: new THREE.Color(0x8C2C1D),
    layer3: new THREE.Color(0x2D1B1B),
    vein: new THREE.Color(0xF5BA23),
    hex1: 0xC84B31,
    hex2: 0x8C2C1D,
    hex3: 0x2D1B1B,
  },
  sand_caribbean: {
    layer1: new THREE.Color(0xF4F6F0),
    layer2: new THREE.Color(0xD8E8E4),
    layer3: new THREE.Color(0x2A6F7B),
    vein: new THREE.Color(0x00F2FF),
    hex1: 0xF4F6F0,
    hex2: 0xD8E8E4,
    hex3: 0x2A6F7B,
  },
  sand_volcanic: {
    layer1: new THREE.Color(0x484B52),
    layer2: new THREE.Color(0x2C2F36),
    layer3: new THREE.Color(0x17181C),
    vein: new THREE.Color(0xFF4500),
    hex1: 0x484B52,
    hex2: 0x2C2F36,
    hex3: 0x17181C,
  },
  // Biomi di spedizione (Fase 12)
  desert: {
    layer1: new THREE.Color(0xE0C27A),
    layer2: new THREE.Color(0xB88A44),
    layer3: new THREE.Color(0x6E563B),
    vein: new THREE.Color(PALETTE_3D.atlantisCoreTeal),
    hex1: 0xE0C27A,
    hex2: 0xB88A44,
    hex3: 0x6E563B,
  },
  ocean: {
    layer1: new THREE.Color(0xF5E6CA),
    layer2: new THREE.Color(0x4A7C82),
    layer3: new THREE.Color(0x1B3240),
    vein: new THREE.Color(0xF5BA23),
    hex1: 0xF5E6CA,
    hex2: 0x4A7C82,
    hex3: 0x1B3240,
  },
  glacier: {
    layer1: new THREE.Color(0xE8F4F8),
    layer2: new THREE.Color(0x7BAEC2),
    layer3: new THREE.Color(0x2A3B45),
    vein: new THREE.Color(0x00F2FF),
    hex1: 0xE8F4F8,
    hex2: 0x7BAEC2,
    hex3: 0x2A3B45,
  },
  jungle: {
    layer1: new THREE.Color(0x3D5C38),
    layer2: new THREE.Color(0x5C4028),
    layer3: new THREE.Color(0x2E241C),
    vein: new THREE.Color(0x2ECC71),
    hex1: 0x3D5C38,
    hex2: 0x5C4028,
    hex3: 0x2E241C,
  },
};
BIOME_PALETTES.classic = BIOME_PALETTES.sand_classic;
BIOME_PALETTES.mars = BIOME_PALETTES.sand_mars;
BIOME_PALETTES.caribbean = BIOME_PALETTES.sand_caribbean;
BIOME_PALETTES.volcanic = BIOME_PALETTES.sand_volcanic;

let currentBiome = 'sand_classic';

const fract = (n) => n - Math.floor(n);
const hash = (i) => fract(Math.sin(i * 12.9898) * 43758.5453);

// Funzione di rumore 2D procedurale pseudo-casuale multi-frequenza per granelli e venature
function noise2D(ix, iz) {
  const s1 = Math.sin(ix * 0.23 + iz * 0.17) * Math.cos(iz * 0.19 - ix * 0.13);
  const s2 = Math.sin(ix * 1.35 + iz * 1.85) * 0.5 + Math.cos(ix * 2.1 - iz * 1.4) * 0.5;
  return s1 * 0.65 + s2 * 0.35;
}

/** Calcola la deformazione d'altitudine procedurale per bioma (dune, bacini, creste, collinette). */
export function getInitialBiomeHeightOffset(vx, vz, biome = 'desert') {
  switch (biome) {
    case 'ocean':
    case 'sand_caribbean': {
      // Oceano prosciugato: avvallamento/depressione a bacino centrale con increspature del fondale
      const distSq = vx * vx + vz * vz;
      const basin = -2.8 * Math.exp(-distSq / 3000);
      const ripples = Math.sin(vx * 0.12) * 0.4 + Math.cos(vz * 0.12) * 0.4;
      return basin + ripples;
    }
    case 'glacier': {
      // Ghiacciaio: creste angolari e sfaccettate / formazioni di permafrost
      const ridge1 = Math.abs(Math.sin(vx * 0.05)) * 1.8;
      const ridge2 = -Math.abs(Math.cos(vz * 0.05)) * 1.4;
      const step = (Math.sin(vx * 0.14 + vz * 0.11) > 0 ? 0.5 : -0.5);
      return ridge1 + ridge2 + step;
    }
    case 'jungle': {
      // Giungla: dislivelli organici e collinette di radici/humus
      const mound1 = Math.sin(vx * 0.04) * 1.6 + Math.cos(vz * 0.045) * 1.3;
      const roots = Math.sin(vx * 0.09 + vz * 0.08) * 0.7;
      return mound1 + roots;
    }
    case 'mars':
    case 'sand_mars': {
      return Math.sin(vx * 0.05) * 1.8 + Math.cos(vz * 0.035) * 1.4;
    }
    case 'volcanic':
    case 'sand_volcanic': {
      return Math.sin(vx * 0.06) * 1.3 + Math.cos(vz * 0.06) * 1.3;
    }
    case 'desert':
    case 'sand_classic':
    default: {
      // Deserto (Default): creste di duna morbide e ondulate a bassa frequenza
      const duna1 = Math.sin(vx * 0.05) * 1.5;
      const duna2 = Math.cos(vz * 0.03) * 1.2;
      const duna3 = Math.sin((vx + vz) * 0.04) * 0.6;
      return duna1 + duna2 + duna3;
    }
  }
}

/** Ritorna il codice colore esadecimale dello strato per la quota Y (usato per le particelle). */
export function getLayerColor(y, biome = currentBiome) {
  const p = BIOME_PALETTES[biome] || BIOME_PALETTES.sand_classic;
  if (y > 8) return p.hex1;
  if (y > 3) return p.hex2;
  return p.hex3;
}

/** Colore del terreno per altezza in base al bioma attivo con rifinitura noise blend. */
export function layerColor(y, i, out = new THREE.Color(), biome = currentBiome, ix = 0, iz = 0) {
  const p = BIOME_PALETTES[biome] || BIOME_PALETTES.sand_classic;
  const h = hash(i);
  const n = noise2D(ix || (i % 257), iz || Math.floor(i / 257));

  if (y > 8) {
    // Strato 1: Sabbia fine con micro-granelli e ondulazioni
    out.copy(p.layer1);
    const grain = (h - 0.5) * 0.08 + n * 0.05;
    out.r = Math.min(1, Math.max(0, out.r + grain));
    out.g = Math.min(1, Math.max(0, out.g + grain * 0.9));
    out.b = Math.min(1, Math.max(0, out.b + grain * 0.7));
  } else if (y > 3) {
    // Strato 2: Ocra / sedimenti / permafrost compatto
    out.copy(p.layer2);
    const strata = n * 0.07;
    out.r = Math.min(1, Math.max(0, out.r + strata));
    out.g = Math.min(1, Math.max(0, out.g + strata * 0.8));
    out.b = Math.min(1, Math.max(0, out.b + strata * 0.6));
  } else {
    // Strato 3: Basamento roccioso scuro con venature luminescenti d'oricalco
    out.copy(p.layer3);
    const rock = (h - 0.5) * 0.06 + n * 0.04;
    out.multiplyScalar(0.95 + rock);
    if (h < 0.18 || Math.abs(n) > 0.72) {
      out.lerp(p.vein, 0.6 + h * 0.3); // venature luminescenti d'oricalco
    }
  }
  return out.multiplyScalar(0.94 + h * 0.12);
}

/** Genera una micro-texture procedurale 2048x2048 per grana della sabbia e glint di quarzo con anisotropia massima. */
export function createSandMicroTexture({ size = 2048, maxAnisotropy = 16 } = {}) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const img = ctx.createImageData(size, size);
  const buf = new Uint32Array(img.data.buffer);
  const total = size * size;
  let seed = 42831;

  for (let i = 0; i < total; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = (seed >>> 24);
    // Variazione di grana con micro-glint brillanti di quarzo e venature minerali
    const isGlitter = (n > 248);
    const lum = isGlitter ? 255 : Math.floor(175 + (n / 255) * 65);
    buf[i] = 0xFF000000 | (lum << 16) | (lum << 8) | lum;
  }

  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(64, 64);
  texture.anisotropy = Math.max(1, maxAnisotropy || 1);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export class Terrain {
  constructor({ size = 200, res = 256, startHeight = 12, floor = 0, biome = 'desert', flat = false, maxAnisotropy = 16 } = {}) {
    this.size = size;
    this.res = res;
    this.expeditionBiome = BIOME_CATALOG[biome] ? biome : 'desert';
    this.biomeConfig = BIOME_CATALOG[this.expeditionBiome];
    this.biomeMechanics = { ...this.biomeConfig.mechanics };
    this.activeBiome = this.expeditionBiome;
    currentBiome = this.activeBiome;

    const volMult = this.biomeMechanics.volumeMultiplier ?? 1.0;
    this.startHeight = startHeight * volMult;
    this.floor = floor;
    this.cell = size / res;
    this.stride = res + 1;
    this.half = size / 2;

    const count = this.stride * this.stride;
    this.heights = new Float32Array(count);

    if (flat) {
      this.heights.fill(this.startHeight);
    } else {
      // Deformazione procedurale naturale per bioma
      const rawOffsets = new Float32Array(count);
      let sumOffset = 0;
      for (let i = 0; i < count; i++) {
        const ix = i % this.stride;
        const iz = (i / this.stride) | 0;
        const vx = -this.half + ix * this.cell;
        const vz = -this.half + iz * this.cell;
        const off = getInitialBiomeHeightOffset(vx, vz, this.activeBiome);
        rawOffsets[i] = off;
        sumOffset += off;
      }
      const meanOffset = sumOffset / count;

      for (let i = 0; i < count; i++) {
        const adjustedOffset = rawOffsets[i] - meanOffset;
        this.heights[i] = Math.max(this.floor + 0.2, this.startHeight + adjustedOffset);
      }
    }

    const cellArea = this.cell * this.cell;
    let totalVolume = 0;
    for (let i = 0; i < count; i++) {
      totalVolume += (this.heights[i] - this.floor) * cellArea;
    }

    this.geometry = new THREE.PlaneGeometry(size, size, res, res);
    this.geometry.rotateX(-Math.PI / 2); // orizzontale; riga iz -> z = -size/2 + iz*cell
    const pos = this.geometry.attributes.position;
    for (let i = 0; i < count; i++) pos.setY(i, this.heights[i]);
    this.colors = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    this.colors.setUsage(THREE.DynamicDrawUsage);
    pos.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('color', this.colors);

    this.normals = this.geometry.attributes.normal;
    this.normals.setUsage(THREE.DynamicDrawUsage);

    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const ix = i % this.stride;
      const iz = (i / this.stride) | 0;
      layerColor(this.heights[i], i, c, this.activeBiome, ix, iz).toArray(this.colors.array, i * 3);
    }
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.geometry.computeBoundingBox();

    const pbr = generateSandPbrSet({ size: 2048, repeat: 32, maxAnisotropy });
    this.pbrTextures = pbr;
    this.sandGrainTexture = pbr.roughnessMap;
    this.sandNormalMap = pbr.normalMap;

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      normalMap: pbr.normalMap,
      normalScale: new THREE.Vector2(0.6, 0.6),
      bumpMap: pbr.roughnessMap,
      bumpScale: 0.04,
      roughnessMap: pbr.roughnessMap,
      roughness: 0.85,
      metalness: 0.05,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;

    this.group = new THREE.Group();
    this.group.add(this.mesh, this._buildWalls());

    // Volume in m^3 (somma delle altezze effettive sui vertici per cell^2)
    this.initialVolume = totalVolume;
    this.remainingVolume = totalVolume;

    this.chunksX = Math.ceil(this.stride / CHUNK);
    this.dirty = new Uint8Array(this.chunksX * this.chunksX);
    this.dirtyCount = 0;
    this.dirtyRowMin = Infinity;
    this.dirtyRowMax = -Infinity;

    // Sub-grid bounding box indici per il ricalcolo localizzato delle normali O(1)
    this.dirtyIxMin = Infinity;
    this.dirtyIxMax = -Infinity;
    this.dirtyIzMin = Infinity;
    this.dirtyIzMax = -Infinity;
    // Giungla Sepolta: durabilità delle radici sepolte per ciascun chunk
    const rootHits = this.biomeMechanics.rootHitsRequired || 0;
    this.rootDurability = new Uint8Array(this.chunksX * this.chunksX).fill(rootHits);
    this.lastRootBlocked = false;

    this._box = new THREE.Box3(new THREE.Vector3(-this.half, floor, -this.half), new THREE.Vector3(this.half, this.startHeight + 5, this.half));
    this._tmpColor = new THREE.Color();
  }

  /** Pareti perimetrali: niente "buco" visibile ai bordi del mondo. */
  _buildWalls() {
    const g = new THREE.Group();
    const h = this.startHeight + 0.5;
    const mat = new THREE.MeshStandardMaterial({ color: PALETTE_3D.sandMid, flatShading: true, roughness: 1, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(this.size, h);
    const defs = [[0, -this.half, 0], [0, this.half, Math.PI], [-this.half, 0, Math.PI / 2], [this.half, 0, -Math.PI / 2]];
    for (const [x, z, ry] of defs) {
      const w = new THREE.Mesh(geo, mat);
      w.position.set(x, this.floor - 0.5 + h / 2, z);
      w.rotation.y = ry;
      g.add(w);
    }
    return g;
  }

  idx(ix, iz) { return iz * this.stride + ix; }

  /** Altezza interpolata bilinearmente nel punto world (x, z). */
  heightAt(x, z) {
    const fx = (x + this.half) / this.cell;
    const fz = (z + this.half) / this.cell;
    if (fx < 0 || fz < 0 || fx > this.res || fz > this.res) return this.floor;
    const ix = Math.min(this.res - 1, Math.floor(fx));
    const iz = Math.min(this.res - 1, Math.floor(fz));
    const tx = fx - ix, tz = fz - iz;
    const h = this.heights, s = this.stride;
    const a = h[iz * s + ix], b = h[iz * s + ix + 1], c = h[(iz + 1) * s + ix], d = h[(iz + 1) * s + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  getHeightAt(x, z) { return this.heightAt(x, z); }


  /**
   * Raycast analitico sulla heightmap (nessun raycast sulla mesh da 130k triangoli):
   * clip sull'AABB del terreno, marcia a passo fisso, poi bisezione.
   * Ritorna THREE.Vector3 | null.
   */
  raycast(ray, maxDist = 1000) {
    const hit = ray.intersectBox(this._box, new THREE.Vector3());
    let t0 = 0;
    if (!hit) return null;
    // Se l'origine è dentro la box t0 = 0, altrimenti distanza di ingresso.
    if (!this._box.containsPoint(ray.origin)) t0 = ray.origin.distanceTo(hit);
    const exit = this._exitDistance(ray, t0);
    const t1 = Math.min(exit, maxDist);
    const step = this.cell * 1.5;
    const p = new THREE.Vector3();
    const at = (t) => { p.copy(ray.direction).multiplyScalar(t).add(ray.origin); return p.y - this.heightAt(p.x, p.z); };
    let prevT = t0;
    let prevD = at(prevT);
    if (prevD <= 0) return p.clone(); // origine già sotto la superficie
    for (let t = t0 + step; t <= t1 + step; t += step) {
      const tt = Math.min(t, t1);
      const d = at(tt);
      if (d <= 0) {
        let lo = prevT, hi = tt;
        for (let i = 0; i < 10; i++) {
          const mid = (lo + hi) / 2;
          if (at(mid) > 0) lo = mid; else hi = mid;
        }
        at((lo + hi) / 2);
        return p.clone();
      }
      prevT = tt; prevD = d;
      if (tt >= t1) break;
    }
    return null;
  }

  _exitDistance(ray, t0) {
    // Distanza d'uscita dalla box lungo il raggio (slab method sui tre assi).
    let tMax = Infinity;
    const o = ray.origin, d = ray.direction, b = this._box;
    for (const ax of ['x', 'y', 'z']) {
      if (Math.abs(d[ax]) < 1e-9) continue;
      const ta = (b.min[ax] - o[ax]) / d[ax];
      const tb = (b.max[ax] - o[ax]) / d[ax];
      tMax = Math.min(tMax, Math.max(ta, tb));
    }
    return Math.max(tMax, t0);
  }

  /** Indice del chunk corrispondente alle coordinate mondo (x, z). */
  getChunkIndexAt(x, z) {
    const ix = Math.max(0, Math.min(this.res, Math.floor((x + this.half) / this.cell)));
    const iz = Math.max(0, Math.min(this.res, Math.floor((z + this.half) / this.cell)));
    return (iz / CHUNK | 0) * this.chunksX + (ix / CHUNK | 0);
  }

  /** Restituisce la durabilità residua delle radici sepolte in (x, z) (Giungla Sepolta). */
  getRootDurabilityAt(x, z) {
    const k = this.getChunkIndexAt(x, z);
    return this.rootDurability ? (this.rootDurability[k] || 0) : 0;
  }

  /**
   * Scava in (x, z). Altezza abbassata di `power * falloff` con falloff = 1 - dist/radius, clamp al bedrock.
   * Ritorna il volume rimosso in m^3.
   */
  dig(x, z, radius, power) {
    const cell = this.cell, s = this.stride;
    let effectiveRadius = radius;
    this.lastRootBlocked = false;

    if (this.biomeMechanics?.rootBlockFactor > 0 && this.rootDurability) {
      const k = this.getChunkIndexAt(x, z);
      if (this.rootDurability[k] > 0) {
        effectiveRadius = radius * (1 - this.biomeMechanics.rootBlockFactor);
        this.rootDurability[k]--;
        this.lastRootBlocked = true;
      }
    }

    const baseRes = this.biomeMechanics?.resistance ?? 1.0;
    const midRes = this.biomeMechanics?.midLayerResistance ?? baseRes;

    const ixMin = Math.max(0, Math.floor((x - effectiveRadius + this.half) / cell));
    const ixMax = Math.min(this.res, Math.ceil((x + effectiveRadius + this.half) / cell));
    const izMin = Math.max(0, Math.floor((z - effectiveRadius + this.half) / cell));
    const izMax = Math.min(this.res, Math.ceil((z + effectiveRadius + this.half) / cell));
    const pos = this.geometry.attributes.position.array;
    const cellArea = cell * cell;
    let removed = 0;

    for (let iz = izMin; iz <= izMax; iz++) {
      const vz = -this.half + iz * cell;
      for (let ix = ixMin; ix <= ixMax; ix++) {
        const vx = -this.half + ix * cell;
        const dist = Math.hypot(vx - x, vz - z);
        if (dist >= effectiveRadius) continue;
        const i = iz * s + ix;
        const h = this.heights[i];
        const resFactor = (h > 3 && h <= 8) ? midRes : baseRes;
        const effectivePower = resFactor === 1.0 ? power : (power / resFactor);
        // Fix Anti-Tunneling: Clamping assoluto al bedrock (Y = 0) per prevenire fori o crollo nel vuoto
        const newH = Math.max(0, Math.max(this.floor, h - effectivePower * (1 - dist / effectiveRadius)));
        if (newH === h) continue;
        removed += (h - newH) * cellArea;
        this.heights[i] = newH;
        pos[i * 3 + 1] = newH;
        this._markDirty(ix, iz);

        // Espande il bounding box degli indici sub-grid per il ricalcolo localizzato delle normali
        if (ix < this.dirtyIxMin) this.dirtyIxMin = ix;
        if (ix > this.dirtyIxMax) this.dirtyIxMax = ix;
        if (iz < this.dirtyIzMin) this.dirtyIzMin = iz;
        if (iz > this.dirtyIzMax) this.dirtyIzMax = iz;
      }
    }
    this.remainingVolume -= removed;
    return removed;
  }

  _markDirty(ix, iz) {
    const k = (iz / CHUNK | 0) * this.chunksX + (ix / CHUNK | 0);
    if (!this.dirty[k]) { this.dirty[k] = 1; this.dirtyCount++; }
    if (iz < this.dirtyRowMin) this.dirtyRowMin = iz;
    if (iz > this.dirtyRowMax) this.dirtyRowMax = iz;
  }

  /**
   * Ricalcola i vettori normali esclusivamente per la sub-regione di indici compresa tra
   * [ix0 - 1, iz0 - 1] e [ix1 + 1, iz1 + 1]. O(k) con k << N, garantendo 60 FPS costanti.
   */
  computeSubGridNormals(ix0, ix1, iz0, iz1) {
    if (!this.normals) return;
    const s = this.stride, res = this.res, cell = this.cell;
    const h = this.heights;
    const norms = this.normals.array;

    const minX = Math.max(0, ix0 - 1);
    const maxX = Math.min(res, ix1 + 1);
    const minZ = Math.max(0, iz0 - 1);
    const maxZ = Math.min(res, iz1 + 1);

    for (let iz = minZ; iz <= maxZ; iz++) {
      const zPrev = iz > 0 ? iz - 1 : iz;
      const zNext = iz < res ? iz + 1 : iz;
      const dzScale = (zNext - zPrev) * cell;

      for (let ix = minX; ix <= maxX; ix++) {
        const xPrev = ix > 0 ? ix - 1 : ix;
        const xNext = ix < res ? ix + 1 : ix;
        const dxScale = (xNext - xPrev) * cell;

        // Gradiente parziale locale O(1)
        const dx = (h[iz * s + xNext] - h[iz * s + xPrev]) / dxScale;
        const dz = (h[zNext * s + ix] - h[zPrev * s + ix]) / dzScale;

        // Vettore normale della superficie Y = h(X, Z): N = normalize(-dx, 1, -dz)
        const nx = -dx;
        const ny = 1.0;
        const nz = -dz;
        const len = Math.hypot(nx, ny, nz);
        const invLen = len > 0 ? 1.0 / len : 1.0;

        const idx3 = (iz * s + ix) * 3;
        norms[idx3] = nx * invLen;
        norms[idx3 + 1] = ny * invLen;
        norms[idx3 + 2] = nz * invLen;
      }
    }

    const start = minZ * s * 3;
    const count = (maxZ - minZ + 1) * s * 3;
    this.normals.clearUpdateRanges();
    this.normals.addUpdateRange(start, count);
    this.normals.needsUpdate = true;
  }

  /**
   * Forza l'aggiornamento dei volumi limite (AABB e sfera) della geometria per prevenire
   * il fallimento dei raycast o il culling indesiderato quando la fossa diventa profonda.
   */
  updateBounds() {
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
    if (this.geometry.boundingBox) {
      this._box.copy(this.geometry.boundingBox);
      this._box.min.y = Math.min(this.floor, this._box.min.y);
      this._box.max.y = Math.max(this.startHeight, this._box.max.y);
    }
  }

  /** Ricolora i chunk sporchi e carica su GPU solo le righe e le normali coinvolte. */
  flush() {
    if (!this.dirtyCount) return false;
    const s = this.stride, c = this._tmpColor, col = this.colors.array;
    const activePalette = this.activeBiome || currentBiome;
    for (let k = 0; k < this.dirty.length; k++) {
      if (!this.dirty[k]) continue;
      this.dirty[k] = 0;
      const cx = k % this.chunksX, cz = (k / this.chunksX) | 0;
      const x1 = Math.min(s, (cx + 1) * CHUNK), z1 = Math.min(s, (cz + 1) * CHUNK);
      for (let iz = cz * CHUNK; iz < z1; iz++) {
        for (let ix = cx * CHUNK; ix < x1; ix++) {
          const i = iz * s + ix;
          layerColor(this.heights[i], i, c, activePalette, ix, iz).toArray(col, i * 3);
        }
      }
    }
    this.dirtyCount = 0;

    const start = this.dirtyRowMin * s * 3, count = (this.dirtyRowMax - this.dirtyRowMin + 1) * s * 3;
    const pos = this.geometry.attributes.position;
    pos.clearUpdateRanges(); pos.addUpdateRange(start, count); pos.needsUpdate = true;
    this.colors.clearUpdateRanges(); this.colors.addUpdateRange(start, count); this.colors.needsUpdate = true;

    // Ricalcolo localizzato delle normali solo per la sub-grid scavata
    if (this.dirtyIxMin <= this.dirtyIxMax && this.dirtyIzMin <= this.dirtyIzMax) {
      this.computeSubGridNormals(this.dirtyIxMin, this.dirtyIxMax, this.dirtyIzMin, this.dirtyIzMax);
      this.dirtyIxMin = Infinity;
      this.dirtyIxMax = -Infinity;
      this.dirtyIzMin = Infinity;
      this.dirtyIzMax = -Infinity;
    }

    this.dirtyRowMin = Infinity;
    this.dirtyRowMax = -Infinity;
    return true;
  }

  /** Percentuale di scavo: 1 - remainingVolume / initialVolume (0..1). */
  get completion() {
    return Math.min(1, Math.max(0, 1 - this.remainingVolume / this.initialVolume));
  }

  /** Imposta e applica la palette cosmetica del bioma all'intera griglia del terreno. */
  setBiomePalette(biomeId) {
    if (!BIOME_PALETTES[biomeId]) return;
    currentBiome = biomeId;
    this.activeBiome = biomeId;
    const s = this.stride, count = s * s, c = this._tmpColor, col = this.colors.array;
    for (let i = 0; i < count; i++) {
      layerColor(this.heights[i], i, c, biomeId, i % s, (i / s) | 0).toArray(col, i * 3);
    }
    this.colors.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.group.traverse((o) => { if (o !== this.mesh && o.isMesh) { o.geometry?.dispose(); o.material?.dispose?.(); } });
    this.sandGrainTexture = null;
    this.sandNormalMap = null;
    this.pbrTextures = null;
  }
}

