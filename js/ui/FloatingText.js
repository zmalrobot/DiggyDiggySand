// Gestore di Numeri Fluttuanti (Floating Text) a Pool con proiezione 3D -> 2D,
// micro-dispersione per evitare sovrapposizioni e supporto per Colpi Critici e Normali.
import * as THREE from 'three';
import { events } from '../core/Events.js';

export class FloatingTextManager {
  /**
   * @param {Object} deps
   * @param {HTMLElement} [deps.container]
   * @param {THREE.Camera} deps.camera
   * @param {HTMLCanvasElement} deps.canvas
   * @param {number} [deps.poolSize=40]
   */
  constructor({ container = null, camera, canvas, poolSize = 40 }) {
    this.camera = camera;
    this.canvas = canvas;
    this.poolSize = Math.max(10, poolSize);
    this._projVec = new THREE.Vector3();

    // Inizializza il contenitore DOM overlay
    if (!container && typeof document !== 'undefined') {
      let existing = document.getElementById('floating-text-container');
      if (!existing) {
        existing = document.createElement('div');
        existing.id = 'floating-text-container';
        document.body.appendChild(existing);
      }
      this.container = existing;
    } else {
      this.container = container;
    }

    // Pool pre-allocato di elementi DOM per evitare garbage collection continuo
    this.pool = [];
    this.poolIndex = 0;
    this._initPool();

    // Sottoscrizione all'evento globale di scavo
    this._unsubDig = events.on('dig:hit', (data) => {
      if (!data) return;
      this.onDigHit(data);
    });
  }

  _initPool() {
    if (!this.container || typeof document === 'undefined') return;
    for (let i = 0; i < this.poolSize; i++) {
      const el = document.createElement('div');
      el.className = 'floating-text normal';
      el.style.display = 'none';
      this.container.appendChild(el);
      this.pool.push({
        dom: el,
        inUse: false,
        timer: null,
      });
    }
  }

  setCamera(cam) {
    this.camera = cam;
  }

  setCanvas(cvs) {
    this.canvas = cvs;
  }

  /**
   * Genera un testo fluttuante proiettando una coordinata 3D sullo schermo 2D.
   * @param {Object} params
   * @param {number} params.x Coordinata World X
   * @param {number} params.y Coordinata World Y
   * @param {number} params.z Coordinata World Z
   * @param {string|number} params.text Testo da mostrare (es. "+12", "+150 CRIT!")
   * @param {boolean} [params.isCrit=false] Se vero applica grafica e bagliore ciano ingrandito
   */
  spawn3D({ x, y, z, text, isCrit = false }) {
    if (!this.camera || !this.canvas) return null;

    this._projVec.set(x, y + 0.4, z);
    this._projVec.project(this.camera);

    // Se il punto si trova dietro al piano di vista della telecamera, non generare
    if (this._projVec.z > 1.0) return null;

    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || this.canvas.clientWidth || window.innerWidth;
    const height = rect.height || this.canvas.clientHeight || window.innerHeight;

    const screenX = ((this._projVec.x + 1) / 2) * width + rect.left;
    const screenY = ((-this._projVec.y + 1) / 2) * height + rect.top;

    return this.spawn2D({ screenX, screenY, text, isCrit });
  }

  /**
   * Mostra il testo fluttuante direttamente alle coordinate schermo specificate.
   */
  spawn2D({ screenX, screenY, text, isCrit = false }) {
    if (this.pool.length === 0) return null;

    // Seleziona un elemento dal pool circolare
    const slot = this.pool[this.poolIndex];
    this.poolIndex = (this.poolIndex + 1) % this.pool.length;

    if (slot.timer) {
      clearTimeout(slot.timer);
      slot.timer = null;
    }

    const el = slot.dom;
    el.textContent = String(text);
    el.className = isCrit ? 'floating-text crit' : 'floating-text normal';

    // Micro-dispersione casuale orizzontale per evitare sovrapposizioni durante l'hold
    const scatterX = (Math.random() - 0.5) * 32;
    const scatterY = (Math.random() - 0.5) * 12;

    el.style.left = `${Math.round(screenX + scatterX)}px`;
    el.style.top = `${Math.round(screenY + scatterY)}px`;
    el.style.display = 'block';

    // Riavvia l'animazione CSS
    el.style.animation = 'none';
    // Forzatura reflow
    void el.offsetWidth;
    el.style.animation = '';

    slot.inUse = true;
    slot.timer = setTimeout(() => {
      el.style.display = 'none';
      slot.inUse = false;
      slot.timer = null;
    }, 850);

    return el;
  }

  onDigHit({ x, y, z, amount = 0, isCrit = false }) {
    const formattedAmount = Math.max(1, Math.round(amount));
    const label = isCrit ? `+${formattedAmount} CRIT!` : `+${formattedAmount}`;
    this.spawn3D({ x, y, z, text: label, isCrit });
  }

  clear() {
    for (const slot of this.pool) {
      if (slot.timer) clearTimeout(slot.timer);
      slot.timer = null;
      slot.inUse = false;
      if (slot.dom) slot.dom.style.display = 'none';
    }
  }

  dispose() {
    this._unsubDig?.();
    this.clear();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.pool = [];
  }
}
