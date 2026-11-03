// Sistema di Preavviso e Indizi del Mistero (Foreshadowing):
// Monitora il completamento dello scavo (soglia 60%) e altera progressivamente atmosfera,
// particelle, audio e letture del Georadar in base all'ending scelto (Curse, Treasure, Business).
import * as THREE from 'three';
import { events } from '../core/Events.js';
import { toast } from '../ui/Modal.js';

export class Foreshadowing {
  constructor({ state, scene, audio, particles, terrain }) {
    this.state = state;
    this.scene = scene;
    this.audio = audio;
    this.particles = particles;
    this.terrain = terrain;

    this.endingId = state.endingId || 'curse';
    this.triggered60 = false;
    this.hintTimer = 0;
    this.forced = false;

    // Salva colori e intensità luce originali per eventuale ripristino
    this._origSunColor = scene?.sun?.color?.getHex() ?? 0xFFF3D6;
    this._origSunIntensity = scene?.sun?.intensity ?? 2.4;
    this._origFogColor = scene?.scene?.fog?.color?.getHex() ?? 0xD9B97A;
    this._origFogDensity = scene?.scene?.fog?.density ?? 0.0035;

    // Controlla se il debug cheat è attivo via query string
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('cheat') === '1') this.forced = true;
    } catch {}
  }

  update(dt) {
    const c = this.state.completion;
    const shouldTrigger = c >= 0.60 || this.forced;

    if (shouldTrigger && !this.triggered60) {
      this.triggered60 = true;
      this._applyPrimaryAnomaly();
    }

    if (this.triggered60) {
      this.hintTimer += dt;
      if (this.hintTimer >= 10.0) {
        this.hintTimer = 0;
        this._applyPeriodicSubtleEffect();
      }
    }
  }

  /** Attiva il primo forte indizio visivo, sonoro e UI al raggiungimento del 60%. */
  _applyPrimaryAnomaly() {
    if (this.endingId === 'curse') {
      // Atmosfera velata di cremisi
      if (this.scene?.sun) {
        this.scene.sun.color.setHex(0xFF7A66);
      }
      if (this.scene?.scene?.fog) {
        this.scene.scene.fog.color.setHex(0x5A2328);
        this.scene.scene.fog.density = 0.0065;
      }
      this.audio?.playWhispers?.();
      this.scene?.shake?.(0.12);
      this._showBanner('Un\'eco insolita vibra sotto la sabbia...');
      events.emit('foreshadow:hint', { type: 'curse', text: 'Un\'eco insolita vibra sotto la sabbia...' });

    } else if (this.endingId === 'treasure') {
      // Bagliore solare dorato scintillante
      if (this.scene?.sun) {
        this.scene.sun.color.setHex(0xFFEAA0);
        this.scene.sun.intensity = 2.9;
      }
      this.audio?.playGlintChime?.();
      if (this.particles) {
        this.particles.burst(0, 4.0, 0, { radius: 10, color: 0xFFDF00, sparks: true, intensity: 2.5 });
      }
      this._showBanner('Riflessi dorati brillano tra i granelli di quarzo...');
      events.emit('foreshadow:hint', { type: 'treasure', text: 'Riflessi dorati brillano tra i granelli di quarzo...' });

    } else if (this.endingId === 'business') {
      // Nessun misticismo: luce chiara e cruda da cantiere
      if (this.scene?.sun) {
        this.scene.sun.color.setHex(0xFFFFFF);
      }
      this._showBanner('Nessun canto antico... Solo il silenzio della roccia sterile.');
      events.emit('foreshadow:hint', { type: 'business', text: 'Nessun canto antico... Solo il silenzio della roccia sterile.' });
    }
  }

  /** Effetti atmosferici discreti ricorrenti durante la fase avanzata. */
  _applyPeriodicSubtleEffect() {
    if (this.endingId === 'curse') {
      this.audio?.playWhispers?.();
      // Soffio di polvere scura
      this.particles?.burst?.((Math.random() - 0.5) * 20, 3.5, (Math.random() - 0.5) * 20, {
        radius: 4,
        color: 0x2E1818,
        intensity: 0.8,
      });
    } else if (this.endingId === 'treasure') {
      this.audio?.playGlintChime?.();
      // Scintillio dorato sulle rovine scoperte
      this.particles?.burst?.((Math.random() - 0.5) * 24, 3.0, (Math.random() - 0.5) * 24, {
        radius: 6,
        color: 0xFFDF00,
        sparks: true,
        intensity: 1.2,
      });
    }
  }

  /** Mostra una notifica effimera elegante e non invasiva. */
  _showBanner(message) {
    toast(message, 5500);
  }

  /** Ritorna una lettura contestuale criptica per il Georadar. */
  getRadarReading(avgDepthY = 12) {
    if (avgDepthY > 8) {
      return 'Quota -2m: Strato sabbioso continuo. Nessuna anomalia in superficie.';
    } else if (avgDepthY > 3) {
      return 'Quota -6m: Rilevata sagoma monumentale densa nel settore centrale.';
    } else {
      if (this.endingId === 'curse') {
        return 'Quota -10m: ATTENZIONE: Frequenza sismica oscura in risonanza instabile.';
      } else if (this.endingId === 'treasure') {
        return 'Quota -10m: Risonanza aurea pura: concentrazione metallica incalcolabile.';
      } else {
        return 'Quota -10m: Rilevamento concluso: suolo minerale sterile al 100%.';
      }
    }
  }

  dispose() {
    // Ripristino delle condizioni atmosferiche originali
    if (this.scene?.sun) {
      this.scene.sun.color.setHex(this._origSunColor);
      this.scene.sun.intensity = this._origSunIntensity;
    }
    if (this.scene?.scene?.fog) {
      this.scene.scene.fog.color.setHex(this._origFogColor);
      this.scene.scene.fog.density = this._origFogDensity;
    }
  }
}

