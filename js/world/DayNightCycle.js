// Ciclo Giorno/Notte & Illuminazione Dinamica.
// Orbita continua di sole e luna, transizione atmosferica per colori, cielo, nebbia e torce.
import * as THREE from 'three';
import { Sky } from './Sky.js';
import { Torches } from './Torches.js';
import { BIOME_CATALOG } from './BiomeManager.js';

export const CYCLE_DURATION = 240; // 4 minuti per un ciclo completo (secondi)

const COLOR_SUN_DAY = new THREE.Color(0xFFF4D4);
const COLOR_SUN_SUNSET = new THREE.Color(0xFF7A36);
const COLOR_SUN_NIGHT = new THREE.Color(0x3B556E);

const COLOR_FOG_DAY = new THREE.Color(0xD9B97A);
const COLOR_FOG_SUNSET = new THREE.Color(0x8C3E38);
const COLOR_FOG_NIGHT = new THREE.Color(0x060B11);

const COLOR_HEMI_SKY_DAY = new THREE.Color(0xA4D4F4);
const COLOR_HEMI_SKY_NIGHT = new THREE.Color(0x1B2A40); // blu abissale #1b2a40
const COLOR_HEMI_GND_DAY = new THREE.Color(0x6E563B);
const COLOR_HEMI_GND_NIGHT = new THREE.Color(0x0D131A); // suolo riflesso #0d131a

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
    this.currentBiome = opts.biome ?? 'desert';

    this._sunDayColor = COLOR_SUN_DAY.clone();
    this._fogDayColor = COLOR_FOG_DAY.clone();
    this._hemiSkyDayColor = COLOR_HEMI_SKY_DAY.clone();
    this._hemiGndDayColor = COLOR_HEMI_GND_DAY.clone();
    this._skyStops = {
      top: '#1d3b52',
      mid: '#7d8f8c',
      horizon: '#e0b979',
      bottom: '#ecd599',
    };
    this._applyBiomePalette(this.currentBiome);

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

  _applyBiomePalette(biomeId = 'desert') {
    const b = BIOME_CATALOG[biomeId] || BIOME_CATALOG.desert;
    const atm = b.atmosphere;
    if (atm) {
      this._sunDayColor.set(atm.sunColor);
      this._fogDayColor.set(atm.fogColor);
      this._hemiSkyDayColor.set(atm.hemiSky);
      this._hemiGndDayColor.set(atm.hemiGround);
      this._skyStops = {
        top: atm.skyTop,
        mid: atm.skyMid,
        horizon: atm.skyHorizon,
        bottom: atm.skyBottom,
      };
    }
  }

  /** Imposta l'atmosfera e la nebbia volumetrica in base al bioma attivo. */
  setBiome(biomeId = 'desert') {
    this.currentBiome = BIOME_CATALOG[biomeId] ? biomeId : 'desert';
    this._applyBiomePalette(this.currentBiome);
    this.update(0);
  }

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
        const sunCol = this._sunDayColor.clone().lerp(COLOR_SUN_SUNSET, sunsetFactor);
        this.sun.color.copy(sunCol);
        this.sun.intensity = Math.max(0.4, 2.4 * (1.0 - nightFactor * 0.85));
      }
    }

    // 2. Luce Ambientale Emisferica (Intensità cielo notturno mai inferiore a 0.25)
    if (this.hemi) {
      const hemiSky = this._hemiSkyDayColor.clone().lerp(COLOR_HEMI_SKY_NIGHT, nightFactor);
      const hemiGnd = this._hemiGndDayColor.clone().lerp(COLOR_HEMI_GND_NIGHT, nightFactor);
      this.hemi.color.copy(hemiSky);
      this.hemi.groundColor.copy(hemiGnd);
      this.hemi.intensity = Math.max(0.25, 0.9 - nightFactor * 0.62);
    }

    // Luce Ambientale Floor: mantiene sempre attiva l'illuminazione minima dal suolo
    if (this.sm?.ambientLight) {
      this.sm.ambientLight.intensity = 0.15;
    }

    // 3. Nebbia (Fog)
    if (this.scene?.fog) {
      const fogCol = this._fogDayColor.clone()
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
      // Giorno adattato al bioma
      grad.addColorStop(0, this._skyStops.top);
      grad.addColorStop(0.55, this._skyStops.mid);
      grad.addColorStop(0.85, this._skyStops.horizon);
      grad.addColorStop(1, this._skyStops.bottom);
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
