// Particelle di scavo: InstancedMesh di piccoli prismi (tetraedri flat-shaded), traiettoria a fontana con gravità
// e dissolvenza rapida (vita 0.4-0.7s). Il budget segue l'impostazione `graphics.particles`.
import * as THREE from 'three';
import { PALETTE_3D } from './ProceduralFactory.js';

// Budget per qualità: [massimo particelle vive, fattore di emissione per colpo]. Capped a max 300 (Spec Fase 5).
const BUDGET = { low: [80, 0.35], med: [160, 0.65], high: [300, 1.0] };
const GRAVITY = 22;
const BASE_BURST = 14;

export class Particles {
  constructor(settings) {
    this.settings = settings;
    this.capacity = BUDGET.high[0];
    this.activeWorkers = 0;

    const geo = new THREE.TetrahedronGeometry(0.11, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.7, emissive: 0x3a2a08, emissiveIntensity: 0.35 });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.setColorAt(0, new THREE.Color(PALETTE_3D.particleDust)); // alloca instanceColor

    // Strutture a pool (struct-of-arrays): nessuna allocazione per colpo.
    const n = this.capacity;
    this.px = new Float32Array(n); this.py = new Float32Array(n); this.pz = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n); this.vz = new Float32Array(n);
    this.life = new Float32Array(n); this.maxLife = new Float32Array(n);
    this.size = new Float32Array(n);
    this.rot = new Float32Array(n); this.spin = new Float32Array(n);
    this.alive = 0;
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();

    this.quality = settings?.get?.('graphics.particles') ?? 'high';
    this._unsub = settings?.subscribe?.('graphics.particles', (q) => { this.quality = q; this._clampAlive(); });
  }

  get maxAlive() { return BUDGET[this.quality]?.[0] ?? BUDGET.med[0]; }
  get emitFactor() { return BUDGET[this.quality]?.[1] ?? BUDGET.med[1]; }

  setWorkerCount(count) {
    this.activeWorkers = Math.max(0, count);
  }

  _clampAlive() {
    if (this.alive > this.maxAlive) { this.alive = this.maxAlive; this.mesh.count = this.alive; }
  }

  /**
   * Burst nel punto d'impatto. `radius` scala quantità e dispersione; `color` è il colore della sabbia (hex);
   * `sparks` aggiunge scintille teal (strato di pietra).
   * Applica throttling dinamico se sono attivi molti lavoratori per preservare i 60fps.
   */
  burst(x, y, z, { radius = 1.5, color = PALETTE_3D.particleDust, sparks = false, intensity = 1 } = {}) {
    const scale = Math.max(0.6, radius / 1.5);
    // Throttling intelligente: riduci l'emissione quando molti lavoratori scavano simultaneamente
    const workerThrottle = this.activeWorkers > 0 ? 1 / Math.sqrt(1 + this.activeWorkers * 0.4) : 1;
    const count = Math.max(1, Math.round(BASE_BURST * this.emitFactor * scale * intensity * workerThrottle));
    let colorUpdated = false;

    for (let k = 0; k < count; k++) {
      if (this.alive >= this.maxAlive) {
        // Pool pieno: riusa la particella più vecchia (ring buffer morbido) senza superare il budget.
        this._spawn(Math.floor(Math.random() * this.alive), x, y, z, radius, color, sparks);
        colorUpdated = true;
        continue;
      }
      this._spawn(this.alive++, x, y, z, radius, color, sparks);
      colorUpdated = true;
    }
    this.mesh.count = this.alive;
    if (colorUpdated && this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  _spawn(i, x, y, z, radius, color, sparks) {
    const a = Math.random() * Math.PI * 2;
    const spread = (0.6 + Math.random() * 1.4) * Math.min(2.5, 0.8 + radius * 0.5);
    const isSpark = sparks && Math.random() < 0.3;
    this.px[i] = x + Math.cos(a) * radius * 0.25 * Math.random();
    this.py[i] = y + 0.05;
    this.pz[i] = z + Math.sin(a) * radius * 0.25 * Math.random();
    this.vx[i] = Math.cos(a) * spread;
    this.vz[i] = Math.sin(a) * spread;
    this.vy[i] = 4.5 + Math.random() * 4.5; // fontana
    this.maxLife[i] = this.life[i] = 0.4 + Math.random() * 0.3;
    this.size[i] = (isSpark ? 0.7 : 0.6 + Math.random() * 0.8) * Math.min(1.6, 0.7 + radius * 0.2);
    this.rot[i] = Math.random() * 6.28;
    this.spin[i] = (Math.random() - 0.5) * 14;
    this._color.set(isSpark ? PALETTE_3D.particleSpark : color);
    this._color.multiplyScalar(0.85 + Math.random() * 0.3);
    this.mesh.setColorAt(i, this._color);
  }

  update(dt) {
    let n = this.alive;
    if (!n) return;
    const d = this._dummy;
    let i = 0;
    while (i < n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // Swap-remove: copia l'ultima particella viva nello slot libero.
        n--;
        if (i !== n) this._copy(n, i);
        continue;
      }
      this.vy[i] -= GRAVITY * dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      this.rot[i] += this.spin[i] * dt;
      const f = this.life[i] / this.maxLife[i];
      d.position.set(this.px[i], this.py[i], this.pz[i]);
      d.rotation.set(this.rot[i], this.rot[i] * 0.7, 0);
      d.scale.setScalar(this.size[i] * Math.min(1, f * 2.2)); // dissolvenza rapida a fine vita
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
      i++;
    }
    this.alive = n;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  _copy(from, to) {
    for (const k of ['px', 'py', 'pz', 'vx', 'vy', 'vz', 'life', 'maxLife', 'size', 'rot', 'spin']) this[k][to] = this[k][from];
    this.mesh.getColorAt(from, this._color);
    this.mesh.setColorAt(to, this._color);
    this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this._unsub?.();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose?.();
  }
}

