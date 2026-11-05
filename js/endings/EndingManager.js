// Gestore centralizzato dei tre finali dinamici (Curse, Treasure, Business).
// Interfaccia comune e ciclo vitale: prepare, onProgress, trigger, update, dispose.
import * as THREE from 'three';
import { CurseEnding } from './CurseEnding.js';
import { TreasureEnding } from './TreasureEnding.js';
import { BusinessEnding } from './BusinessEnding.js';
import { SecretEnding } from './SecretEnding.js';
import { calculateTabletsEarned } from '../systems/Prestige.js';
import { events } from '../core/Events.js';
import { deepDispose } from '../world/DisposeUtils.js';

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

    // Se siamo in modalità replay, allestiamo l'ambiente scenico completo ReplayStage
    let cityRef = this.city;
    if (this.isReplay) {
      this._buildReplayStage(endingId);
      cityRef = {
        group: this._replayStageGroup,
        curseSeal: this._replayProps?.curseSeal,
        treasureChest: this._replayProps?.treasureChest,
      };
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
      city: cityRef,
      controls: this.controls,
    });

    // Posiziona la telecamera Three.js in prospettiva rialzata a tre quarti sul basamento archeologico:
    // camera.position.set(0, 8, 14); camera.lookAt(0, 1, 0); con orbita continua
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
      if (!this.isReplay) {
        // normale completamento run
      }
    });

    // Inserisci overlay fisso in alto a destra "✕ Torna al Menu" (con supporto a tasto Escape)
    if (this.isReplay && typeof document !== 'undefined') {
      this._showReplayOverlay();

      // Timeout naturale dei 14s di cutscene
      this._replayTimer = setTimeout(() => {
        this.finishReplay();
      }, 14000);
    }
  }

  /**
   * Allestisce l'ambiente 3D completo per il Replay:
   * - Cratere scavato al 100% ad anfiteatro
   * - Pavimento archeologico lastricato a Y = 0
   * - Colonne e rovine monumentali
   * - Forziere/reliquia e set di luci dedicato
   */
  _buildReplayStage(endingId) {
    this._removeReplayStage();
    const g = new THREE.Group();
    g.name = 'replay-stage';

    // 1. Illuminazione Scenica Dedicata
    const ambLight = new THREE.AmbientLight(0xFFE4A0, 0.45);
    ambLight.name = 'replay-ambient-light';
    g.add(ambLight);

    const dirLight = new THREE.DirectionalLight(0xFFF2D0, 2.6);
    dirLight.name = 'replay-dir-light';
    dirLight.position.set(14, 24, 12);
    dirLight.target.position.set(0, 0, 0);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    g.add(dirLight);
    g.add(dirLight.target);

    // Luce d'accento specifica per finale
    let accentLight;
    if (endingId === 'curse') {
      accentLight = new THREE.PointLight(0xFF0033, 4.0, 35, 1.2);
      accentLight.position.set(0, 2.5, 0);
    } else if (endingId === 'treasure') {
      accentLight = new THREE.PointLight(0xF5BA23, 3.2, 35, 1.2);
      accentLight.position.set(0, 2.5, 0);
    } else if (endingId === 'secret') {
      accentLight = new THREE.PointLight(0x0FE3C1, 4.0, 35, 1.2);
      accentLight.position.set(0, 3.5, 0);
    } else {
      accentLight = new THREE.PointLight(0xFFFFFF, 2.2, 35, 1.2);
      accentLight.position.set(0, 4.0, 0);
    }
    accentLight.name = 'replay-accent-light';
    g.add(accentLight);

    // 2. Basamento e Cratere Scavato al 100%
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x3A2E26,
      roughness: 0.82,
      metalness: 0.05,
      flatShading: true,
    });
    const bedrockMat = new THREE.MeshStandardMaterial({
      color: 0x241D18,
      roughness: 0.88,
      metalness: 0.02,
      flatShading: true,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xF5BA23,
      roughness: 0.22,
      metalness: 0.85,
      flatShading: true,
    });
    const orichalcumMat = new THREE.MeshStandardMaterial({
      color: 0xD87D38,
      roughness: 0.25,
      metalness: 0.85,
      flatShading: true,
    });
    const tealMat = new THREE.MeshStandardMaterial({
      color: 0x0FE3C1,
      emissive: 0x0FE3C1,
      emissiveIntensity: 1.5,
      roughness: 0.1,
      flatShading: true,
    });
    const sandTerraceMat = new THREE.MeshStandardMaterial({
      color: 0xB88A44,
      roughness: 0.90,
      metalness: 0.0,
      flatShading: true,
    });
    const lightSandMat = new THREE.MeshStandardMaterial({
      color: 0xE0C27A,
      roughness: 0.92,
      metalness: 0.0,
      flatShading: true,
    });

    // Pavimento Archeologico a Y = 0 (disco raggio 14m, spessore 0.6 da Y=-0.6 a Y=0)
    const floorGeo = new THREE.CylinderGeometry(14, 14.5, 0.6, 24);
    const floorMesh = new THREE.Mesh(floorGeo, stoneMat);
    floorMesh.position.set(0, -0.3, 0);
    floorMesh.receiveShadow = true;
    g.add(floorMesh);

    // Piattaforma centrale rialzata a gradoni bassi
    const step1Geo = new THREE.BoxGeometry(8, 0.3, 8);
    const step1Mesh = new THREE.Mesh(step1Geo, bedrockMat);
    step1Mesh.position.set(0, 0.15, 0);
    step1Mesh.receiveShadow = true;
    step1Mesh.castShadow = true;

    const step2Geo = new THREE.BoxGeometry(5, 0.3, 5);
    const step2Mesh = new THREE.Mesh(step2Geo, stoneMat);
    step2Mesh.position.set(0, 0.45, 0);
    step2Mesh.receiveShadow = true;
    step2Mesh.castShadow = true;

    // Intarsio centrale d'Oricalco con venatura ciano
    const ringGeo = new THREE.RingGeometry(2.2, 2.6, 24);
    const ringMesh = new THREE.Mesh(ringGeo, orichalcumMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, 0.61, 0);

    const coreTealGeo = new THREE.CircleGeometry(0.8, 16);
    const coreTealMesh = new THREE.Mesh(coreTealGeo, tealMat);
    coreTealMesh.rotation.x = -Math.PI / 2;
    coreTealMesh.position.set(0, 0.615, 0);

    g.add(step1Mesh, step2Mesh, ringMesh, coreTealMesh);

    // Cratere Scavato a gradoni concentrici (Anfiteatro archeologico da Y=0 a Y=12)
    // Terrazza 1: Y=0..3, R=14..19 (bedrock)
    const t1Geo = new THREE.CylinderGeometry(19, 14, 3, 24, 1, true);
    const t1Mesh = new THREE.Mesh(t1Geo, bedrockMat);
    t1Mesh.position.set(0, 1.5, 0);
    t1Mesh.receiveShadow = true;

    // Terrazza 2: Y=3..6, R=19..25 (arenaria)
    const t2Geo = new THREE.CylinderGeometry(25, 19, 3, 24, 1, true);
    const t2Mesh = new THREE.Mesh(t2Geo, stoneMat);
    t2Mesh.position.set(0, 4.5, 0);
    t2Mesh.receiveShadow = true;

    // Terrazza 3: Y=6..9, R=25..32 (sabbia ocra)
    const t3Geo = new THREE.CylinderGeometry(32, 25, 3, 24, 1, true);
    const t3Mesh = new THREE.Mesh(t3Geo, sandTerraceMat);
    t3Mesh.position.set(0, 7.5, 0);
    t3Mesh.receiveShadow = true;

    // Terrazza 4: Y=9..12, R=32..40 (sabbia chiara superficiale)
    const t4Geo = new THREE.CylinderGeometry(40, 32, 3, 24, 1, true);
    const t4Mesh = new THREE.Mesh(t4Geo, lightSandMat);
    t4Mesh.position.set(0, 10.5, 0);
    t4Mesh.receiveShadow = true;

    g.add(t1Mesh, t2Mesh, t3Mesh, t4Mesh);

    // 3. Colonne Perimetrali Monumentali (8 colonne a raggio 9.5m)
    const colBaseGeo = new THREE.BoxGeometry(1.2, 0.4, 1.2);
    const colCapGeo = new THREE.BoxGeometry(1.3, 0.4, 1.3);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const cx = Math.cos(angle) * 9.5;
      const cz = Math.sin(angle) * 9.5;
      const colGroup = new THREE.Group();
      colGroup.position.set(cx, 0, cz);

      // Basamento
      const baseM = new THREE.Mesh(colBaseGeo, stoneMat);
      baseM.position.set(0, 0.2, 0);
      baseM.castShadow = true;
      baseM.receiveShadow = true;
      colGroup.add(baseM);

      // Fusto colonna (alcune integre da 5.4m, altre spezzate)
      const isBroken = (i === 2 || i === 5);
      const colHeight = isBroken ? 2.6 : 5.4;
      const shaftGeo = new THREE.CylinderGeometry(0.42, 0.48, colHeight, 8);
      const shaftM = new THREE.Mesh(shaftGeo, stoneMat);
      shaftM.position.set(0, 0.4 + colHeight / 2, 0);
      shaftM.castShadow = true;
      shaftM.receiveShadow = true;
      colGroup.add(shaftM);

      if (!isBroken) {
        // Capitello dorato atlantideo
        const capM = new THREE.Mesh(colCapGeo, goldMat);
        capM.position.set(0, 0.4 + colHeight + 0.2, 0);
        capM.castShadow = true;
        colGroup.add(capM);
      } else {
        // Blocco crollato alla base
        const rubbleGeo = new THREE.BoxGeometry(0.8, 0.6, 0.8);
        const rubbleM = new THREE.Mesh(rubbleGeo, stoneMat);
        rubbleM.position.set(0.9, 0.3, 0.5);
        rubbleM.rotation.set(0.2, 0.5, 0.1);
        rubbleM.castShadow = true;
        colGroup.add(rubbleM);
      }

      g.add(colGroup);
    }

    // 4. Props e Reliquia Centrale specifica per il finale
    this._replayProps = {};
    if (endingId === 'treasure') {
      // Forziere dorato aperto posizionato a Y = 0.6
      const chestGroup = new THREE.Group();
      chestGroup.position.set(0, 0.6, 0);

      // Base baule
      const chestBodyGeo = new THREE.BoxGeometry(1.4, 0.7, 0.9);
      const chestBody = new THREE.Mesh(chestBodyGeo, goldMat);
      chestBody.position.set(0, 0.35, 0);
      chestBody.castShadow = true;
      chestGroup.add(chestBody);

      // Coperchio aperto inclinato
      const lidGeo = new THREE.BoxGeometry(1.45, 0.25, 0.95);
      const lidMesh = new THREE.Mesh(lidGeo, goldMat);
      lidMesh.position.set(0, 0.8, -0.2);
      lidMesh.rotation.x = -Math.PI / 3;
      lidMesh.castShadow = true;
      chestGroup.add(lidMesh);

      // Cumulo d'oro dentro e attorno
      const goldPileGeo = new THREE.ConeGeometry(0.9, 0.4, 8);
      const goldPile = new THREE.Mesh(goldPileGeo, goldMat);
      goldPile.position.set(0, 0.6, 0);
      chestGroup.add(goldPile);

      g.add(chestGroup);
      this._replayProps.treasureChest = chestGroup;

    } else if (endingId === 'curse') {
      // Altare del Sigillo di Sangue
      const altarGroup = new THREE.Group();
      altarGroup.position.set(0, 0.6, 0);

      const altarBaseGeo = new THREE.CylinderGeometry(1.5, 1.8, 1.0, 6);
      const altarBase = new THREE.Mesh(altarBaseGeo, bedrockMat);
      altarBase.position.set(0, 0.5, 0);
      altarBase.castShadow = true;
      altarGroup.add(altarBase);

      const sealMat = new THREE.MeshStandardMaterial({
        color: 0x100A0A,
        emissive: 0xFF0033,
        emissiveIntensity: 3.5,
        roughness: 0.3,
        flatShading: true,
      });
      const sealGeo = new THREE.OctahedronGeometry(0.85, 0);
      const sealMesh = new THREE.Mesh(sealGeo, sealMat);
      sealMesh.position.set(0, 1.6, 0);
      sealMesh.castShadow = true;
      altarGroup.add(sealMesh);

      // 4 bracieri di pietra nera
      for (let b = 0; b < 4; b++) {
        const bAngle = (b / 4) * Math.PI * 2;
        const brazierGeo = new THREE.CylinderGeometry(0.35, 0.25, 0.8, 6);
        const brazier = new THREE.Mesh(brazierGeo, bedrockMat);
        brazier.position.set(Math.cos(bAngle) * 3.2, 0.4, Math.sin(bAngle) * 3.2);
        brazier.castShadow = true;

        const flameGeo = new THREE.ConeGeometry(0.2, 0.5, 5);
        const flameMat = new THREE.MeshStandardMaterial({
          color: 0x8B0000,
          emissive: 0xFF0033,
          emissiveIntensity: 2.5,
          roughness: 0.2,
        });
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.set(0, 0.55, 0);
        brazier.add(flame);
        altarGroup.add(brazier);
      }

      g.add(altarGroup);
      this._replayProps.curseSeal = sealMesh;

    } else if (endingId === 'secret') {
      // Grande Obelisco d'Oricalco con cristallo ciano
      const obeliskGroup = new THREE.Group();
      obeliskGroup.position.set(0, 0.6, 0);

      const obeliskShaftGeo = new THREE.CylinderGeometry(0.8, 1.4, 6.5, 4);
      const obeliskShaft = new THREE.Mesh(obeliskShaftGeo, orichalcumMat);
      obeliskShaft.position.set(0, 3.25, 0);
      obeliskShaft.rotation.y = Math.PI / 4;
      obeliskShaft.castShadow = true;
      obeliskGroup.add(obeliskShaft);

      // Cuspide piramidale di cristallo ciano
      const crystalPyramidGeo = new THREE.ConeGeometry(0.8, 1.5, 4);
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0x84FFF0,
        emissive: 0x0FE3C1,
        emissiveIntensity: 3.0,
        roughness: 0.1,
        flatShading: true,
      });
      const crystalPyramid = new THREE.Mesh(crystalPyramidGeo, crystalMat);
      crystalPyramid.position.set(0, 6.5 + 0.75, 0);
      crystalPyramid.rotation.y = Math.PI / 4;
      obeliskGroup.add(crystalPyramid);

      // Anello d'Oricalco fluttuante
      const floatingRingGeo = new THREE.TorusGeometry(1.8, 0.12, 8, 24);
      const floatingRing = new THREE.Mesh(floatingRingGeo, goldMat);
      floatingRing.rotation.x = Math.PI / 2;
      floatingRing.position.set(0, 4.2, 0);
      obeliskGroup.add(floatingRing);
      this._floatingRing = floatingRing;

      g.add(obeliskGroup);
      this._replayProps.obelisk = obeliskGroup;

    } else if (endingId === 'business') {
      // Cantiere edile con secchiello
      const siteGroup = new THREE.Group();
      siteGroup.position.set(0, 0.6, 0);

      const bucketMat = new THREE.MeshStandardMaterial({ color: 0xFF5722, roughness: 0.4, flatShading: true });
      const bucketGeo = new THREE.CylinderGeometry(0.35, 0.25, 0.55, 8);
      const bucket = new THREE.Mesh(bucketGeo, bucketMat);
      bucket.position.set(0, 0.28, 0);
      bucket.castShadow = true;
      siteGroup.add(bucket);

      const postGeo = new THREE.BoxGeometry(0.08, 1.6, 0.08);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5 });
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(1.2, 0.8, 0);
      const boardGeo = new THREE.BoxGeometry(1.2, 0.6, 0.05);
      const boardMat = new THREE.MeshStandardMaterial({ color: 0xFFDE00, roughness: 0.5 });
      const board = new THREE.Mesh(boardGeo, boardMat);
      board.position.set(1.2, 1.4, 0);
      siteGroup.add(post, board);

      const coneGeo = new THREE.ConeGeometry(0.28, 0.85, 8);
      const coneMat = new THREE.MeshStandardMaterial({ color: 0xFF5722, roughness: 0.5, flatShading: true });
      for (let c = 0; c < 4; c++) {
        const ca = (c / 4) * Math.PI * 2;
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(Math.cos(ca) * 2.5, 0.42, Math.sin(ca) * 2.5);
        cone.castShadow = true;
        siteGroup.add(cone);
      }

      g.add(siteGroup);
      this._replayProps.businessSite = siteGroup;
    }

    // Inserisci nella scena Three.js
    const targetScene = this.scene?.scene || this.scene;
    if (targetScene && typeof targetScene.add === 'function') {
      targetScene.add(g);
    }
    this._replayStageGroup = g;
    return g;
  }

  _removeReplayStage() {
    if (this._replayStageGroup) {
      const targetScene = this.scene?.scene || this.scene;
      if (targetScene && typeof targetScene.remove === 'function') {
        targetScene.remove(this._replayStageGroup);
      }
      deepDispose(this._replayStageGroup);
      this._replayStageGroup = null;
      this._replayProps = null;
      this._floatingRing = null;
    }
  }

  _setupCinematicOrbit(endingId) {
    const cam = this.scene?.camera;
    // Prospettiva rialzata a tre quarti puntata sul basamento archeologico:
    // camera.position.set(0, 8, 14); camera.lookAt(0, 1, 0);
    const targetY = 1.0;
    const height = 8.0;
    const radius = 14.0;

    if (cam) {
      cam.position.set(0, height, radius);
      cam.lookAt(0, targetY, 0);
    }

    this._orbitTargetY = targetY;
    this._orbitRadius = radius;
    this._orbitHeight = height;
    this._orbitAngle = Math.PI / 2;

    if (this.controls) {
      this.controls.target.set(0, targetY, 0);
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 1.2;
      this.controls.update?.();
    }
  }

  _showReplayOverlay() {
    this._removeReplayOverlay();
    if (typeof document === 'undefined') return;

    const overlay = document.createElement('div');
    overlay.id = 'replay-hud-overlay';
    overlay.className = 'replay-overlay';

    const btn = document.createElement('button');
    btn.id = 'btn-exit-replay';
    btn.type = 'button';
    btn.className = 'btn-exit-replay';
    btn.setAttribute('aria-label', 'Torna al Menu');

    const icon = document.createElement('span');
    icon.className = 'exit-icon';
    icon.textContent = '✕';

    const text = document.createElement('span');
    text.setAttribute('data-i18n', 'endings.exit_replay');
    text.textContent = 'TORNA AL MENU';

    btn.appendChild(icon);
    btn.appendChild(text);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.audio?.playClick?.();
      this.finishReplay();
    });

    overlay.appendChild(btn);
    document.body.appendChild(overlay);
    this._replayOverlayEl = overlay;

    this._onReplayKeyDown = (e) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.audio?.playClick?.();
        this.finishReplay();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._onReplayKeyDown, true);
    }
  }

  _removeReplayOverlay() {
    if (this._replayOverlayEl) {
      this._replayOverlayEl.remove();
      this._replayOverlayEl = null;
    }
    if (this._onReplayKeyDown && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._onReplayKeyDown, true);
      this._onReplayKeyDown = null;
    }
    this._removeSkipButton();
  }

  _addSkipButton() {
    this._showReplayOverlay();
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
    this._removeReplayOverlay();

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
    }, 350);
  }

  disposeReplay() {
    if (this._replayTimer) {
      clearTimeout(this._replayTimer);
      this._replayTimer = null;
    }
    this._removeReplayOverlay();
    this._removeReplayStage();

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

      // Animazione props addizionali replay
      if (this._floatingRing) {
        this._floatingRing.rotation.z += dt * 0.8;
      }

      // Orbita cinematografica continua attorno al basamento archeologico
      if (this.cinematicCamera) {
        if (this.controls) {
          const ty = this._orbitTargetY ?? 1;
          this.controls.target.lerp(new THREE.Vector3(0, ty, 0), Math.min(1, dt * 1.5));
          this.controls.update();
        } else if (this.scene?.camera) {
          this._orbitAngle = (this._orbitAngle || 0) + dt * 0.15;
          const r = this._orbitRadius || 14;
          const h = this._orbitHeight || 8;
          const ty = this._orbitTargetY || 1;
          this.scene.camera.position.x = Math.sin(this._orbitAngle) * r;
          this.scene.camera.position.z = Math.cos(this._orbitAngle) * r;
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

