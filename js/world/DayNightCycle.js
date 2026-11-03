// Ciclo Giorno/Notte & Illuminazione Dinamica.
// Orbita continua di sole e luna, transizione atmosferica per colori, cielo, nebbia e torce.
import * as THREE from 'three';
import { Sky } from './Sky.js';
import { Torches } from './Torches.js';

export const CYCLE_DURATION = 240; // 4 minuti per un ciclo completo (secondi)

const COLOR_SUN_DAY = new THREE.Color(0xFFF4D4);
const COLOR_SUN_SUNSET = new THREE.Color(0xFF7A36);
const COLOR_SUN_NIGHT = new THREE.Color(0x3B556E);

const COLOR_FOG_DAY = new THREE.Color(0xD9B97A);
const COLOR_FOG_SUNSET = new THREE.Color(0x8C3E38);
const COLOR_FOG_NIGHT = new THREE.Color(0x060B11);

const COLOR_HEMI_SKY_DAY = new THREE.Color(0xA4D4F4);
const COLOR_HEMI_SKY_NIGHT = new THREE.Color(0x0E2233);
const COLOR_HEMI_GND_DAY = new THREE.Color(0x6E563B);
const COLOR_HEMI_GND_NIGHT = new THREE.Color(0x03080E);

export class DayNightCycle {
  constructor(sceneOrManager, options = {}) {
    // Supporta sia DayNightCycle(sceneManager, opts) sia DayNightCycle({ scene, dirLight, hemiLight, ... })
    const isMgr = sceneOrManager && ('scene' in sceneOrManager) && ('sun' in sceneOrManager || 'hemi' in sceneOrManager || 'renderer' in sceneOrManager);
    const opts = (isMgr && typeof options === 'object') ? options : (sceneOrManager || {});

    this.sm = isMgr ? sceneOrManager : null;
    this.scene = isMgr ? sceneOrManager.scene : (opts.scene ?? sceneOrManager?.scene);
    this.sun = isMgr ? (sceneOrManager.sun ?? sceneOrManager.dirLight) : (opts.sun ?? opts.dirLight);
    this.hemi = isMgr ? (sceneOrManager.hemi ?? sceneOrManager.hemiLight) : (opts.hemi ?? opts.hemiLight);
    this.settings = opts.settings ?? sceneOrManager?.settings ?? null;

    this.duration = opts.cycleDuration ?? opts.duration ?? CYCLE_DURATION;
    this.timeOfDay = opts.initialTime ?? 0.45; // 0.0 = mezzanotte, 0.25 = alba, 0.5 = mezzogiorno, 0.75 = tramonto
    this.mode = 'auto'; // 'auto' | 'day' | 'night'
    this.paused = false;

    this.sky = new Sky(this.scene);
    this.torches = new Torches(this.scene);

    this.nightFactor = 0;
    this._sunOrbitRadius = 85;

    if (typeof document !== 'undefined') {
      this._bgCanvas = document.createElement('canvas');
      this._bgCanvas.width = 2;
      this._bgCanvas.height = 256;
      this._bgCtx = this._bgCanvas.getContext('2d');
      this._bgTexture = new THREE.CanvasTexture(this._bgCanvas);
      this._bgTexture.colorSpace = THREE.SRGBColorSpace;
      if (this.scene) this.scene.background = this._bgTexture;
    } else {
      this._bgCanvas = null;
      this._bgCtx = null;
      this._bgTexture = null;
    }

    if (this.settings) {
      const mode = this.settings.get?.('graphics.dayNightCycle') ?? 'auto';
      this.setMode(mode);
      this._unsubSettings = this.settings.subscribe?.('graphics.dayNightCycle', (m) => this.setMode(m));
    } else {
      this.update(0);
    }
  }

  get time() { return this.timeOfDay; }
  set time(t) { this.setTimeOfDay(t); }

  _applyTime(t) { this.setTimeOfDay(t); }

  setMode(mode) {
    if (['auto', 'day', 'night'].includes(mode)) {
      this.mode = mode;
      if (mode === 'day') this.timeOfDay = 0.5;
      else if (mode === 'night') this.timeOfDay = 0.0;
      this.update(0);
    }
  }

  setTimeOfDay(t) {
    this.timeOfDay = ((t % 1) + 1) % 1;
    this.update(0);
  }

  update(dt) {
    if (this.mode === 'auto' && !this.paused && dt > 0) {
      this.timeOfDay = (this.timeOfDay + dt / this.duration) % 1;
    }

    // 0.0 = mezzanotte (-pi/2), 0.25 = alba (0), 0.5 = mezzogiorno (pi/2), 0.75 = tramonto (pi)
    const angle = (this.timeOfDay - 0.25) * Math.PI * 2;
    // Sole sorge a Est (X+), sale a Sud-Est (Y+), tramonta a Ovest (X-)
    const sunX = -Math.cos(angle) * this._sunOrbitRadius;
    const sunY = Math.sin(angle) * 75;
    const sunZ = Math.sin(angle * 0.5) * 35;

    if (this.sun) {
      this.sun.position.set(sunX, Math.max(-20, sunY), sunZ);
    }

    const moonPos = new THREE.Vector3(-sunX, -sunY + 15, -sunZ);

    // Calcolo altitudine normalizzata del sole (-1..1)
    const sinElev = Math.sin(angle);
    // nightFactor: 0 a pieno giorno (sinElev > 0.2), 1 a notte fonda (sinElev < -0.15)
    this.nightFactor = Math.max(0, Math.min(1, (-sinElev + 0.2) / 0.5));

    // sunsetFactor: picco a sinElev ~ 0 (orizzonte)
    const sunsetFactor = Math.max(0, 1.0 - Math.abs(sinElev) * 4.5);

    this._updateAtmosphere(sinElev, sunsetFactor, this.nightFactor);
    this.sky.update(this.nightFactor, moonPos);
    this.torches.update(dt, this.nightFactor);
  }

  _updateAtmosphere(sinElev, sunsetFactor, nightFactor) {
    // 1. Luce Solare / Lunare
    if (this.sun) {
      if (nightFactor >= 0.95) {
        // Luce notturna lunare tenue
        this.sun.color.copy(COLOR_SUN_NIGHT);
        this.sun.intensity = 0.35;
      } else {
        const sunCol = COLOR_SUN_DAY.clone().lerp(COLOR_SUN_SUNSET, sunsetFactor);
        this.sun.color.copy(sunCol);
        this.sun.intensity = Math.max(0.4, 2.4 * (1.0 - nightFactor * 0.85));
      }
    }

    // 2. Luce Ambientale Emisferica
    if (this.hemi) {
      const hemiSky = COLOR_HEMI_SKY_DAY.clone().lerp(COLOR_HEMI_SKY_NIGHT, nightFactor);
      const hemiGnd = COLOR_HEMI_GND_DAY.clone().lerp(COLOR_HEMI_GND_NIGHT, nightFactor);
      this.hemi.color.copy(hemiSky);
      this.hemi.groundColor.copy(hemiGnd);
      this.hemi.intensity = 0.9 - nightFactor * 0.62;
    }

    // 3. Nebbia (Fog)
    if (this.scene.fog) {
      const fogCol = COLOR_FOG_DAY.clone()
        .lerp(COLOR_FOG_SUNSET, sunsetFactor)
        .lerp(COLOR_FOG_NIGHT, nightFactor);
      this.scene.fog.color.copy(fogCol);
    }

    // 4. Gradiente Sfondo Cielo Dinamico
    this._renderSkyGradient(sunsetFactor, nightFactor);
  }

  _renderSkyGradient(sunsetFactor, nightFactor) {
    if (!this._bgCtx) return;
    const g = this._bgCtx;
    const grad = g.createLinearGradient(0, 0, 0, 256);

    if (nightFactor > 0.85) {
      // Notte Abisso Stellare
      grad.addColorStop(0, '#02060a');
      grad.addColorStop(0.5, '#060b11');
      grad.addColorStop(1, '#0b1522');
    } else if (sunsetFactor > 0.25) {
      // Tramonto Cremisi & Oro
      grad.addColorStop(0, '#2e153b');
      grad.addColorStop(0.5, '#8c3e38');
      grad.addColorStop(0.8, '#d96b34');
      grad.addColorStop(1, '#f5ba23');
    } else {
      // Giorno Dorato
      grad.addColorStop(0, '#1d3b52');
      grad.addColorStop(0.55, '#7d8f8c');
      grad.addColorStop(0.85, '#e0b979');
      grad.addColorStop(1, '#ecd599');
    }

    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 256);
    this._bgTexture.needsUpdate = true;
  }

  dispose() {
    this._unsubSettings?.();
    this.sky?.dispose();
    this.torches?.dispose();
    this._bgTexture?.dispose();
  }
}
