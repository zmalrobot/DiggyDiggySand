// Terreno deformabile a heightmap. Quota iniziale sabbia Y=12, bedrock Y=0.
// - `heights` (Float32Array) è la fonte di verità e resta sincronizzato con gli attributi `position`.
// - Griglia a chunk da 8x8 vertici con dirty flags: ricolore e upload GPU solo per le zone scavate.
// - flatShading: true => le normali arrivano dalle derivate dello shader (dFdx/dFdy). Non serve
//   `computeVertexNormals()` sull'intera mesh (AGENTS §6), quindi niente costo O(n) per colpo.
//   `flush()` viene chiamato al massimo una volta per frame: è il throttling dell'aggiornamento.
import * as THREE from 'three';
import { PALETTE_3D } from './ProceduralFactory.js';

export const CHUNK = 8;                 // vertici per lato del chunk

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
};
BIOME_PALETTES.classic = BIOME_PALETTES.sand_classic;
BIOME_PALETTES.mars = BIOME_PALETTES.sand_mars;
BIOME_PALETTES.caribbean = BIOME_PALETTES.sand_caribbean;
BIOME_PALETTES.volcanic = BIOME_PALETTES.sand_volcanic;

let currentBiome = 'sand_classic';

const fract = (n) => n - Math.floor(n);
const hash = (i) => fract(Math.sin(i * 12.9898) * 43758.5453);

/** Ritorna il codice colore esadecimale dello strato per la quota Y (usato per le particelle). */
export function getLayerColor(y, biome = currentBiome) {
  const p = BIOME_PALETTES[biome] || BIOME_PALETTES.sand_classic;
  if (y > 8) return p.hex1;
  if (y > 3) return p.hex2;
  return p.hex3;
}

/** Colore del terreno per altezza in base al bioma attivo. */
export function layerColor(y, i, out = new THREE.Color(), biome = currentBiome) {
  const p = BIOME_PALETTES[biome] || BIOME_PALETTES.sand_classic;
  const h = hash(i);
  if (y > 8) out.copy(p.layer1);
  else if (y > 3) out.copy(p.layer2);
  else {
    out.copy(p.layer3);
    if (h < 0.16) out.lerp(p.vein, 0.65); // venature luminescenti
  }
  return out.multiplyScalar(0.92 + h * 0.16);
}


export class Terrain {
  constructor({ size = 200, res = 256, startHeight = 12, floor = 0 } = {}) {
    this.size = size;
    this.res = res;
    this.startHeight = startHeight;
    this.floor = floor;
    this.cell = size / res;
    this.stride = res + 1;
    this.half = size / 2;

    const count = this.stride * this.stride;
    this.heights = new Float32Array(count).fill(startHeight);

    this.geometry = new THREE.PlaneGeometry(size, size, res, res);
    this.geometry.rotateX(-Math.PI / 2); // orizzontale; riga iz -> z = -size/2 + iz*cell
    const pos = this.geometry.attributes.position;
    for (let i = 0; i < count; i++) pos.setY(i, startHeight);
    this.colors = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    this.colors.setUsage(THREE.DynamicDrawUsage);
    pos.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('color', this.colors);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) layerColor(startHeight, i, c).toArray(this.colors.array, i * 3);
    this.geometry.computeBoundingSphere();
    this.geometry.computeBoundingBox();

    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;

    this.group = new THREE.Group();
    this.group.add(this.mesh, this._buildWalls());

    // Volume in m^3 (somma delle altezze sui vertici per cell^2).
    this.initialVolume = count * (startHeight - floor) * this.cell * this.cell;
    this.remainingVolume = this.initialVolume;

    this.chunksX = Math.ceil(this.stride / CHUNK);
    this.dirty = new Uint8Array(this.chunksX * this.chunksX);
    this.dirtyCount = 0;
    this.dirtyRowMin = Infinity;
    this.dirtyRowMax = -Infinity;
    this._box = new THREE.Box3(new THREE.Vector3(-this.half, floor, -this.half), new THREE.Vector3(this.half, startHeight, this.half));
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

  /**
   * Scava in (x, z). Altezza abbassata di `power * falloff` con falloff = 1 - dist/radius, clamp al bedrock.
   * Ritorna il volume rimosso in m^3.
   */
  dig(x, z, radius, power) {
    const cell = this.cell, s = this.stride;
    const ixMin = Math.max(0, Math.floor((x - radius + this.half) / cell));
    const ixMax = Math.min(this.res, Math.ceil((x + radius + this.half) / cell));
    const izMin = Math.max(0, Math.floor((z - radius + this.half) / cell));
    const izMax = Math.min(this.res, Math.ceil((z + radius + this.half) / cell));
    const pos = this.geometry.attributes.position.array;
    const cellArea = cell * cell;
    let removed = 0;

    for (let iz = izMin; iz <= izMax; iz++) {
      const vz = -this.half + iz * cell;
      for (let ix = ixMin; ix <= ixMax; ix++) {
        const vx = -this.half + ix * cell;
        const dist = Math.hypot(vx - x, vz - z);
        if (dist >= radius) continue;
        const i = iz * s + ix;
        const h = this.heights[i];
        const newH = Math.max(this.floor, h - power * (1 - dist / radius));
        if (newH === h) continue;
        removed += (h - newH) * cellArea;
        this.heights[i] = newH;
        pos[i * 3 + 1] = newH;
        this._markDirty(ix, iz);
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

  /** Ricolora i chunk sporchi e carica su GPU solo le righe coinvolte. Chiamare al massimo 1 volta per frame. */
  flush() {
    if (!this.dirtyCount) return false;
    const s = this.stride, c = this._tmpColor, col = this.colors.array;
    for (let k = 0; k < this.dirty.length; k++) {
      if (!this.dirty[k]) continue;
      this.dirty[k] = 0;
      const cx = k % this.chunksX, cz = (k / this.chunksX) | 0;
      const x1 = Math.min(s, (cx + 1) * CHUNK), z1 = Math.min(s, (cz + 1) * CHUNK);
      for (let iz = cz * CHUNK; iz < z1; iz++) {
        for (let ix = cx * CHUNK; ix < x1; ix++) {
          const i = iz * s + ix;
          layerColor(this.heights[i], i, c).toArray(col, i * 3);
        }
      }
    }
    this.dirtyCount = 0;

    const start = this.dirtyRowMin * s * 3, count = (this.dirtyRowMax - this.dirtyRowMin + 1) * s * 3;
    const pos = this.geometry.attributes.position;
    pos.clearUpdateRanges(); pos.addUpdateRange(start, count); pos.needsUpdate = true;
    this.colors.clearUpdateRanges(); this.colors.addUpdateRange(start, count); this.colors.needsUpdate = true;
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
      layerColor(this.heights[i], i, c, biomeId).toArray(col, i * 3);
    }
    this.colors.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.group.traverse((o) => { if (o !== this.mesh && o.isMesh) { o.geometry?.dispose(); o.material?.dispose?.(); } });
  }
}

