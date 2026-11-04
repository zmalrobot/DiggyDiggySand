// Gestore centralizzato dei tre finali dinamici (Curse, Treasure, Business).
// Interfaccia comune e ciclo vitale: prepare, onProgress, trigger, update, dispose.
import * as THREE from 'three';
import { CurseEnding } from './CurseEnding.js';
import { TreasureEnding } from './TreasureEnding.js';
import { BusinessEnding } from './BusinessEnding.js';
import { SecretEnding } from './SecretEnding.js';
import { calculateTabletsEarned } from '../systems/Prestige.js';
import { events } from '../core/Events.js';

export const ENDING_THRESHOLD = 0.98; // Trigger automatico a completamento quasi totale (98%-100%)

export class EndingManager {
  constructor({ scene, terrain, state, audio, particles, city, controls, overlay, save, game }) {
    this.scene = scene;
    this.terrain = terrain;
    this.state = state;
    this.audio = audio;
    this.particles = particles;
    this.city = city;
    this.controls = controls;
    this.overlay = overlay;
    this.save = save;
    this.game = game;

    this.activeEnding = null;
    this.hasTriggered = false;
    this.sandboxMode = false;
    this.cinematicCamera = false;
    this.isReplay = false;
    this._replayTimer = null;
    this._skipBtn = null;
    this._savedSceneState = null;
    this._onReplayComplete = null;
    this._replayUpdater = null;

    this._initEnding();
  }

  _initEnding() {
    const id = this.state?.endingId || 'curse';
    switch (id) {
      case 'secret':
        this.activeEnding = new SecretEnding();
        break;
      case 'treasure':
        this.activeEnding = new TreasureEnding();
        break;
      case 'business':
        this.activeEnding = new BusinessEnding();
        break;
      case 'curse':
      default:
        this.activeEnding = new CurseEnding();
        break;
    }

    this.activeEnding.prepare({
      scene: this.scene,
      terrain: this.terrain,
      state: this.state,
      audio: this.audio,
      particles: this.particles,
      city: this.city,
      controls: this.controls,
    });
  }

  /**
   * Monitora l'avanzamento dello scavo (chiamato ad ogni aggiornamento o cambio completamento).
   */
  onProgress(completion) {
    if (this.hasTriggered || this.sandboxMode) return;
    this.activeEnding?.onProgress?.(completion);

    if (completion >= ENDING_THRESHOLD) {
      this.trigger();
    }
  }

  /**
   * Avvia la sequenza climax del finale attivo con regia cinematografica.
   */
  trigger() {
    if (this.hasTriggered) return;
    this.hasTriggered = true;
    this.cinematicCamera = true;

    // 1. Applica dissolvenza HUD graduale (.hud-fade-out)
    this._fadeHud(true);

    // 2. Disabilita comandi di scavo standard durante il climax
    if (this.game?.digging) {
      this.game.digging.setEnabled(false);
    }

    // 3. Regia telecamera cinematografica: orientamento su Y=0 e damping morbido
    if (this.controls) {
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 1.6;
    }

    // 4. Abbassa il volume della BGM corrente per dare risalto al climax
    this.audio?.fadeBgm?.(0.12, 1.5);

    this.activeEnding?.trigger?.((result) => {
      const currentBiome = this.state?.currentBiome || 'desert';

      // Registra l'ending scoperto tra i trofei
      this.save?.recordEnding?.(result.endingId, currentBiome);

      // Assegna Tavolette Antiche τ calcolate sulla sabbia totale estratta
      const tabletsEarned = calculateTabletsEarned(this.state?.totalSand ?? 0);
      this.save?.addTablets?.(tabletsEarned);
      if (this.state) {
        this.state.tablets = this.save?.getTablets?.() ?? 0;
      }
      this.save?.save?.();

      const elapsed = this.state?.elapsedSeconds ?? 0;
      this.game?.statsManager?.recordRunCompletion?.(elapsed, currentBiome);
      this.game?.statsManager?.increment?.('tabletsEarned', tabletsEarned);
      this.game?.achievements?.check();

      // Presenta l'epilogo a tutto schermo con Tavolette Antiche
      this.overlay?.show({
        ...result,
        stats: {
          timeSeconds: elapsed,
          sandTotal: this.state?.totalSand ?? 0,
          clicks: this.state?.clicks ?? 0,
          completion: this.state?.completion ?? 1.0,
          tabletsEarned,
        },
        onRestart: () => this.game?.startNewRun?.(),
        onMenu: () => this.game?.returnToMenu?.(),
        onSandbox: result.sandboxAvailable ? () => this.enterSandbox() : null,
      });

      events.emit('ending:completed', { ...result, tabletsEarned, timeSeconds: elapsed });
    });
  }

  _fadeHud(fade) {
    if (typeof document === 'undefined') return;
    const hudEls = [
      document.getElementById('hud'),
      document.getElementById('directives-root'),
      document.getElementById('shop-root'),
      document.getElementById('hud-abilities-dock'),
      document.querySelector('.hud-abilities-dock'),
    ];
    hudEls.forEach((el) => {
      if (!el) return;
      el.classList.toggle('hud-fade-out', !!fade);
    });
  }

  enterSandbox() {
    this.sandboxMode = true;
    this.cinematicCamera = false;
    if (this.controls) {
      this.controls.autoRotate = false;
    }
    this._fadeHud(false);
    this.overlay?.hide();
    if (this.game?.digging) {
      this.game.digging.setEnabled(true);
    }
  }

  /**
   * Avvia la regia 3D dedicata del finale scelto in modalità cinematografica o replay.
   */
  playCinematic(endingId, { isReplay = false, onComplete = null } = {}) {
    if (this.isReplay) {
      this.disposeReplay();
    } else if (this.activeEnding) {
      this.activeEnding.dispose?.();
      this.activeEnding = null;
    }

    this.isReplay = !!isReplay;
    this.hasTriggered = true;
    this.cinematicCamera = true;
    this._onReplayComplete = onComplete;

    // Salva lo stato della scena prima del replay
    this._savedSceneState = {
      mode: this.scene?.mode,
      cameraPos: this.scene?.camera?.position?.clone?.(),
      cameraRot: this.scene?.camera?.rotation?.clone?.(),
      controlsTarget: this.controls?.target?.clone?.(),
      controlsAutoRotate: this.controls?.autoRotate ?? false,
      controlsAutoRotateSpeed: this.controls?.autoRotateSpeed ?? 1.6,
      sunColor: this.scene?.sun?.color?.clone?.(),
      sunIntensity: this.scene?.sun?.intensity,
      fogColor: this.scene?.scene?.fog?.color?.clone?.(),
      fogDensity: this.scene?.scene?.fog?.density,
    };

    // Dissolvenza HUD
    this._fadeHud(true);
    if (this.game?.digging) {
      this.game.digging.setEnabled(false);
    }

    // Istanzia il finale specifico
    switch (endingId) {
      case 'secret':
        this.activeEnding = new SecretEnding();
        break;
      case 'treasure':
        this.activeEnding = new TreasureEnding();
        break;
      case 'business':
        this.activeEnding = new BusinessEnding();
        break;
      case 'curse':
      default:
        this.activeEnding = new CurseEnding();
        break;
    }

    this.activeEnding.prepare({
      scene: this.scene,
      terrain: this.terrain,
      state: this.state,
      audio: this.audio,
      particles: this.particles,
      city: this.city,
      controls: this.controls,
    });

    // Posiziona la telecamera Three.js sull'orbita scenica del finale scelto
    this._setupCinematicOrbit(endingId);

    // Se la scena era in modalità menu, passa a game per attivare il rendering completo degli elementi 3D
    if (this.scene && this.scene.mode === 'menu') {
      this.scene.setMode('game');
    }

    // Assicura che l'updater sia agganciato a SceneManager durante il replay
    if (this.scene?.updaters) {
      this._replayUpdater = (dt) => this.update(dt);
      this.scene.updaters.add(this._replayUpdater);
    }

    // Abbassa volume BGM corrente
    this.audio?.fadeBgm?.(0.12, 1.5);

    // Attiva illuminazione, effetti particellari e audio del finale
    this.activeEnding.trigger((result) => {
      // In modalità replay non apriamo l'overlay statico né modifichiamo statistiche
      if (!this.isReplay) {
        // normale completamento run
      }
    });

    // Aggiungi pulsante sobrio in alto a destra "✕ Salta Epilogo" durante la sequenza
    if (this.isReplay && typeof document !== 'undefined') {
      this._addSkipButton();

      this._onReplayKeyDown = (e) => {
        if (e.key === 'Escape' || e.code === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.finishReplay();
        }
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', this._onReplayKeyDown, true);
      }

      // Timeout naturale dei 12-14s di cutscene
      this._replayTimer = setTimeout(() => {
        this.finishReplay();
      }, 13000);
    }
  }

  _setupCinematicOrbit(endingId) {
    const cam = this.scene?.camera;
    let targetY = 2;
    let radius = 24;
    let height = 12;

    switch (endingId) {
      case 'curse':
        targetY = 4;
        radius = 22;
        height = 9;
        if (cam) cam.position.set(-15, height, 18);
        break;
      case 'treasure':
        targetY = 1.5;
        radius = 20;
        height = 13;
        if (cam) cam.position.set(14, height, 14);
        break;
      case 'business':
        targetY = 1;
        radius = 26;
        height = 7;
        if (cam) cam.position.set(0, height, 25);
        break;
      case 'secret':
      default:
        targetY = 5;
        radius = 30;
        height = 14;
        if (cam) cam.position.set(22, height, 22);
        break;
    }

    this._orbitTargetY = targetY;
    this._orbitRadius = radius;
    this._orbitHeight = height;

    if (cam) cam.lookAt(0, targetY, 0);

    if (this.controls) {
      this.controls.target.set(0, targetY, 0);
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 1.6;
      this.controls.update?.();
    } else if (cam) {
      this._orbitAngle = Math.atan2(cam.position.z, cam.position.x);
    }
  }

  _addSkipButton() {
    this._removeSkipButton();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-skip-cinematic';
    btn.textContent = '✕ Salta Epilogo';
    btn.setAttribute('aria-label', 'Salta Epilogo');
    btn.addEventListener('click', () => {
      this.audio?.playClick?.();
      this.finishReplay();
    });
    document.body.appendChild(btn);
    this._skipBtn = btn;
  }

  _removeSkipButton() {
    if (this._skipBtn) {
      this._skipBtn.remove();
      this._skipBtn = null;
    }
  }

  finishReplay() {
    if (!this.isReplay) return;
    if (this._replayTimer) {
      clearTimeout(this._replayTimer);
      this._replayTimer = null;
    }
    this._removeSkipButton();

    let fadeEl = document.querySelector('.screen-fade');
    if (!fadeEl) {
      fadeEl = document.createElement('div');
      fadeEl.className = 'screen-fade';
      document.body.appendChild(fadeEl);
    }
    fadeEl.classList.add('on');

    setTimeout(() => {
      const cb = this._onReplayComplete;
      this._onReplayComplete = null;
      this.disposeReplay();
      cb?.();
      setTimeout(() => {
        fadeEl.classList.remove('on');
        setTimeout(() => {
          if (!fadeEl.classList.contains('on')) {
            fadeEl.remove();
          }
        }, 400);
      }, 100);
    }, 400);
  }

  disposeReplay() {
    if (this._replayTimer) {
      clearTimeout(this._replayTimer);
      this._replayTimer = null;
    }
    this._removeSkipButton();

    if (this._onReplayKeyDown && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._onReplayKeyDown, true);
      this._onReplayKeyDown = null;
    }

    if (this._replayUpdater && this.scene?.updaters) {
      this.scene.updaters.delete(this._replayUpdater);
      this._replayUpdater = null;
    }

    if (this.activeEnding) {
      this.activeEnding.dispose?.();
      this.activeEnding = null;
    }

    if (this._savedSceneState) {
      const s = this._savedSceneState;
      if (s.mode && this.scene) {
        this.scene.setMode(s.mode);
      }
      if (s.cameraPos && this.scene?.camera) {
        this.scene.camera.position.copy(s.cameraPos);
      }
      if (s.cameraRot && this.scene?.camera) {
        this.scene.camera.rotation.copy(s.cameraRot);
      }
      if (this.controls) {
        if (s.controlsTarget) this.controls.target.copy(s.controlsTarget);
        this.controls.autoRotate = s.controlsAutoRotate;
        this.controls.autoRotateSpeed = s.controlsAutoRotateSpeed;
        this.controls.update?.();
      }
      if (s.sunColor && this.scene?.sun) {
        this.scene.sun.color.copy(s.sunColor);
        this.scene.sun.intensity = s.sunIntensity;
      }
      if (s.fogColor && this.scene?.scene?.fog) {
        this.scene.scene.fog.color.copy(s.fogColor);
        this.scene.scene.fog.density = s.fogDensity;
      }
      this._savedSceneState = null;
    }

    this._fadeHud(false);
    if (this.game?.digging) {
      this.game.digging.setEnabled(true);
    }

    const currentBiome = this.state?.currentBiome || 'desert';
    if (this.game?.running) {
      this.audio?.playMusic?.(currentBiome);
    } else {
      this.audio?.playMusic?.('menu');
    }

    this.isReplay = false;
    this.cinematicCamera = false;
    this.hasTriggered = false;
  }

  forceEnding(id) {
    if (this.activeEnding) {
      this.activeEnding.dispose?.();
      this.activeEnding = null;
    }
    this.hasTriggered = false;
    this.sandboxMode = false;
    this.cinematicCamera = false;
    if (this.controls) {
      this.controls.autoRotate = false;
    }
    this._fadeHud(false);
    if (this.state) this.state.endingId = id;
    this._initEnding();
    this.trigger();
  }

  update(dt) {
    if (this.hasTriggered && !this.sandboxMode) {
      this.activeEnding?.update?.(dt);

      // Orbita cinematografica continua attorno al centro archeologico a Y = 0
      if (this.cinematicCamera) {
        if (this.controls) {
          const ty = this._orbitTargetY ?? 0;
          this.controls.target.lerp(new THREE.Vector3(0, ty, 0), Math.min(1, dt * 1.5));
          this.controls.update();
        } else if (this.scene?.camera) {
          this._orbitAngle = (this._orbitAngle || 0) + dt * 0.18;
          const r = this._orbitRadius || 24;
          const h = this._orbitHeight || 10;
          const ty = this._orbitTargetY || 2;
          this.scene.camera.position.x = Math.cos(this._orbitAngle) * r;
          this.scene.camera.position.z = Math.sin(this._orbitAngle) * r;
          this.scene.camera.position.y = h;
          this.scene.camera.lookAt(0, ty, 0);
        }
      }
    }
  }

  dispose() {
    this.disposeReplay();
    this._fadeHud(false);
    if (this.controls) {
      this.controls.autoRotate = false;
    }
    this.cinematicCamera = false;
    this.activeEnding?.dispose?.();
    this.activeEnding = null;
    this.hasTriggered = false;
    this.sandboxMode = false;
  }
}

