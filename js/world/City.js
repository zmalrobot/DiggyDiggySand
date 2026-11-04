// Generatore procedurale della Città Sepolta: quartieri a gradoni, viali colonnati e tempio centrale.
// Collocata interamente sotto la sabbia superficiale (Y da 0 a 8.8), emerge naturalmente con lo scavo.
import * as THREE from 'three';
import { PALETTE_3D } from './ProceduralFactory.js';
import { generateChiseledStoneNormalMap } from './TextureGenerator.js';
import { DisposeUtils } from './DisposeUtils.js';
import { events } from '../core/Events.js';

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });

const mesh = (geo, material, pos = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

export class City {
  constructor({ endingId = 'curse', floor = 0, assets = null, biome = 'desert' } = {}) {
    this.endingId = endingId;
    this.floor = floor;
    this.assets = assets;
    this.biome = biome || 'desert';
    this.group = new THREE.Group();
    this.group.name = 'buried-city';

    this._initMaterials();
    this._buildCity();

    events.on('settings:modelStyleChanged', () => {
      this.rebuild();
    });
  }

  /**
   * Ricostruisce la città sepolta in seguito al cambio di stile dei modelli (GLTF vs Procedurali).
   * Esegue DisposeUtils.deepDispose() su ciascuna entità per deallocare la memoria GPU.
   */
  rebuild() {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      DisposeUtils.deepDispose(child);
    }
    this._buildCity();
  }

  _initMaterials() {
    const stoneNormal = generateChiseledStoneNormalMap();

    this.mats = {
      stone: mat(PALETTE_3D.ruinsStone, {
        roughness: 0.88,
        metalness: 0.02,
        normalMap: stoneNormal,
      }),
      bedrock: mat(PALETTE_3D.sandBedrock, {
        roughness: 0.88,
        metalness: 0.02,
        normalMap: stoneNormal,
      }),
      darkStone: mat(0x352B24, {
        roughness: 0.88,
        metalness: 0.02,
        normalMap: stoneNormal,
      }),
      gold: mat(PALETTE_3D.ruinsGoldInlay, {
        metalness: 0.85,
        roughness: 0.22,
      }),
      orichalcum: mat(PALETTE_3D.orichalcum, {
        metalness: 0.85,
        roughness: 0.22,
      }),
      tealGlow: mat(PALETTE_3D.abyss, {
        emissive: 0x00F2FF,
        emissiveIntensity: 0.9,
        roughness: 0.1,
      }),
      cyanGlow: mat(0x00F2FF, {
        emissive: 0x00F2FF,
        emissiveIntensity: 0.9,
        roughness: 0.1,
      }),
      curseAltar: mat(0x100A0A, {
        emissive: 0x8B0000,
        emissiveIntensity: 0.9,
        roughness: 0.5,
      }),
      treasureGold: mat(PALETTE_3D.ruinsGoldInlay, {
        metalness: 0.85,
        roughness: 0.22,
        emissive: 0x443300,
        emissiveIntensity: 0.3,
      }),
      // Materiali Oceano Prosciugato
      shipWood: mat(0x4A3222, { roughness: 0.92, metalness: 0.02 }),
      shipDarkWood: mat(0x2D1E14, { roughness: 0.95, metalness: 0.02 }),
      coralStone: mat(0xD8C3A5, { roughness: 0.88, metalness: 0.02, normalMap: stoneNormal }),
      coralPink: mat(0xE07A5F, { roughness: 0.75, metalness: 0.05 }),
      marineCrystal: mat(0x00F2FF, {
        emissive: 0x00F2FF,
        emissiveIntensity: 0.9,
        roughness: 0.1,
      }),
      // Materiali Ghiacciaio Arcaico
      glacierIce: mat(0xA8D8EA, {
        roughness: 0.15,
        metalness: 0.1,
        transparent: true,
        opacity: 0.88,
      }),
      permafrostStone: mat(0x2A3B45, { roughness: 0.88, metalness: 0.02, normalMap: stoneNormal }),
      sapphireGlow: mat(0x00B4D8, {
        emissive: 0x00F2FF,
        emissiveIntensity: 0.9,
        roughness: 0.1,
      }),
      // Materiali Giungla Sepolta
      jungleStone: mat(0x4A5240, { roughness: 0.88, metalness: 0.02, normalMap: stoneNormal }),
      mossStone: mat(0x2F4F2F, { roughness: 0.92, metalness: 0.02 }),
      rootWood: mat(0x4E3524, { roughness: 0.95, metalness: 0.02 }),
      emeraldGlow: mat(0x1B4332, {
        emissive: 0x00F2FF,
        emissiveIntensity: 0.9,
        roughness: 0.1,
      }),
    };
  }

  _buildCity() {
    if (this.biome === 'ocean') {
      this._buildOceanCity();
    } else if (this.biome === 'glacier') {
      this._buildGlacierCity();
    } else if (this.biome === 'jungle') {
      this._buildJungleCity();
    } else {
      this._buildCentralSanctuary();
      this._buildMonumentalAvenues();
      this._buildQuarters();
    }
  }

  /** Posiziona il reperto finale al centro del santuario (compatibile con tutti i biomi). */
  _attachEndingRelic(g) {
    if (this.endingId === 'curse') {
      const seal = mesh(new THREE.OctahedronGeometry(0.8, 0), this.mats.curseAltar, [0, 3.8, 2.2]);
      this.curseSeal = seal;
      g.add(seal);
    } else if (this.endingId === 'treasure') {
      const chest = this.assets?.getModel
        ? this.assets.getModel('ruins/chest.glb', () => mesh(new THREE.BoxGeometry(1.4, 0.7, 0.9), this.mats.treasureGold, [0, 3.75, 2.2]))
        : mesh(new THREE.BoxGeometry(1.4, 0.7, 0.9), this.mats.treasureGold, [0, 3.75, 2.2]);
      chest.position.set(0, 3.75, 2.2);
      this.treasureChest = chest;
      g.add(chest);
    } else if (this.endingId === 'business') {
      const bucket = mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.45, 6), mat(0xFF6B00), [0, 3.6, 2.2]);
      const signPost = mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), mat(0x555555), [0.8, 4.1, 2.2]);
      const signBoard = mesh(new THREE.BoxGeometry(0.9, 0.5, 0.05), mat(0xFFDE00), [0.8, 4.6, 2.2]);
      this.businessBucket = bucket;
      g.add(bucket, signPost, signBoard);
    }
  }

  /** Area centrale: Terrazza a gradoni, Obelisco con intarsi dorati e ciano luminescenti (Y max = 8.8) */
  _buildCentralSanctuary() {
    const g = new THREE.Group();
    const { stone, bedrock, gold, tealGlow } = this.mats;

    // Basamento terrazzato
    const tier1 = mesh(new THREE.BoxGeometry(16, 1.2, 16), stone, [0, 0.6, 0]);
    const tier2 = mesh(new THREE.BoxGeometry(11, 1.2, 11), bedrock, [0, 1.8, 0]);
    const tier3 = mesh(new THREE.BoxGeometry(7, 1.0, 7), stone, [0, 2.9, 0]);
    g.add(tier1, tier2, tier3);

    // Grande Obelisco Centrale (apice a Y = 8.8)
    const obeliskBase = mesh(new THREE.CylinderGeometry(0.8, 1.1, 0.8, 4), bedrock, [0, 3.8, 0]);
    const obeliskShaft = mesh(new THREE.CylinderGeometry(0.45, 0.75, 4.0, 4), stone, [0, 6.2, 0]);
    const obeliskCap = mesh(new THREE.ConeGeometry(0.45, 0.9, 4), gold, [0, 8.65, 0]);

    // Fasce geroglifiche ciano luminescenti
    const band1 = mesh(new THREE.CylinderGeometry(0.68, 0.72, 0.16, 4), tealGlow, [0, 4.8, 0]);
    const band2 = mesh(new THREE.CylinderGeometry(0.52, 0.56, 0.16, 4), tealGlow, [0, 7.2, 0]);
    g.add(obeliskBase, obeliskShaft, obeliskCap, band1, band2);

    // Portale monumentale a Sud (Piloni e architrave)
    const pylonL = mesh(new THREE.BoxGeometry(1.6, 5.2, 1.4), stone, [-3.2, 2.6, 6.5]);
    const pylonR = mesh(new THREE.BoxGeometry(1.6, 5.2, 1.4), stone, [3.2, 2.6, 6.5]);
    const lintel = mesh(new THREE.BoxGeometry(8.0, 0.6, 1.6), gold, [0, 5.5, 6.5]);
    g.add(pylonL, pylonR, lintel);

    // Elemento tematico in base al finale
    if (this.endingId === 'curse') {
      const seal = mesh(new THREE.OctahedronGeometry(0.8, 0), this.mats.curseAltar, [0, 3.8, 2.2]);
      this.curseSeal = seal;
      g.add(seal);
    } else if (this.endingId === 'treasure') {
      const chest = this.assets?.getModel
        ? this.assets.getModel('ruins/chest.glb', () => mesh(new THREE.BoxGeometry(1.4, 0.7, 0.9), this.mats.treasureGold, [0, 3.75, 2.2]))
        : mesh(new THREE.BoxGeometry(1.4, 0.7, 0.9), this.mats.treasureGold, [0, 3.75, 2.2]);
      chest.position.set(0, 3.75, 2.2);
      this.treasureChest = chest;
      g.add(chest);
    } else if (this.endingId === 'business') {
      // Secchio di plastica e cartello low-poly
      const bucket = mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.45, 6), mat(0xFF6B00), [0, 3.6, 2.2]);
      const signPost = mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), mat(0x555555), [0.8, 4.1, 2.2]);
      const signBoard = mesh(new THREE.BoxGeometry(0.9, 0.5, 0.05), mat(0xFFDE00), [0.8, 4.6, 2.2]);
      this.businessBucket = bucket;
      g.add(bucket, signPost, signBoard);
    }

    this.group.add(g);
  }

  /** Viali monumentali: Colonnati cerimoniali lungo i 4 punti cardinali */
  _buildMonumentalAvenues() {
    const g = new THREE.Group();
    const { stone, bedrock, gold } = this.mats;

    const dirs = [
      { dx: 0, dz: 1 },  // Sud
      { dx: 0, dz: -1 }, // Nord
      { dx: 1, dz: 0 },  // Est
      { dx: -1, dz: 0 }, // Ovest
    ];

    for (const d of dirs) {
      // Due file di colonne parallele per ogni viale
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 4; i++) {
          const dist = 11 + i * 4.2;
          const offset = 2.8 * side;
          const x = d.dx === 0 ? offset : d.dx * dist;
          const z = d.dz === 0 ? offset : d.dz * dist;

          // Colonna (Y max = 4.8)
          if (this.assets?.getModel) {
            const col = this.assets.getModel('ruins/column.glb', () => {
              const cg = new THREE.Group();
              const base = mesh(new THREE.BoxGeometry(1.1, 0.35, 1.1), bedrock, [0, 0.175, 0]);
              const shaft = mesh(new THREE.CylinderGeometry(0.35, 0.45, 3.8, 6), stone, [0, 2.25, 0]);
              const cap = mesh(new THREE.BoxGeometry(1.0, 0.35, 1.0), gold, [0, 4.32, 0]);
              cg.add(base, shaft, cap);
              return cg;
            });
            col.position.set(x, 0, z);
            g.add(col);
          } else {
            const base = mesh(new THREE.BoxGeometry(1.1, 0.35, 1.1), bedrock, [x, 0.175, z]);
            const shaft = mesh(new THREE.CylinderGeometry(0.35, 0.45, 3.8, 6), stone, [x, 2.25, z]);
            const cap = mesh(new THREE.BoxGeometry(1.0, 0.35, 1.0), gold, [x, 4.32, z]);
            g.add(base, shaft, cap);
          }

          // Architravi longitudinali che collegano le colonne
          if (i < 3) {
            const nextDist = 11 + (i + 0.5) * 4.2;
            const ax = d.dx === 0 ? offset : d.dx * nextDist;
            const az = d.dz === 0 ? offset : d.dz * nextDist;
            const arch = mesh(
              new THREE.BoxGeometry(d.dx === 0 ? 0.6 : 4.4, 0.35, d.dz === 0 ? 0.6 : 4.4),
              stone,
              [ax, 4.65, az]
            );
            g.add(arch);
          }
        }
      }
    }

    this.group.add(g);
  }

  /** Quartieri periferici: blocchi cubici a gradoni, case con tetti piatti e scalinate (Y max = 6.5) */
  _buildQuarters() {
    const g = new THREE.Group();
    const { stone, bedrock, darkStone, cyanGlow } = this.mats;

    // Definizioni quartieri nei 4 quadranti diagonali (NE, NW, SE, SW)
    const quarterCenters = [
      { qx: 22, qz: 22 },
      { qx: -22, qz: 22 },
      { qx: 22, qz: -22 },
      { qx: -22, qz: -22 },
    ];

    quarterCenters.forEach(({ qx, qz }, qIdx) => {
      // 3 edifici a gradoni per quartiere
      const buildings = [
        { ox: 0, oz: 0, w: 7, d: 7, h1: 2.8, h2: 2.2 },
        { ox: -5.5, oz: 5.5, w: 5.5, d: 5, h1: 2.2, h2: 1.8 },
        { ox: 6, oz: -4, w: 6, d: 5.5, h1: 2.5, h2: 2.0 },
      ];

      buildings.forEach((b, bIdx) => {
        const bx = qx + b.ox;
        const bz = qz + b.oz;

        // Livello terra
        const lower = mesh(
          new THREE.BoxGeometry(b.w, b.h1, b.d),
          bIdx % 2 === 0 ? stone : bedrock,
          [bx, b.h1 / 2, bz]
        );
        g.add(lower);

        // Terrazza superiore a gradone (Y max ~ 5.5..6.5)
        const upperW = b.w * 0.65;
        const upperD = b.d * 0.65;
        const upperY = b.h1 + b.h2 / 2;
        const upper = mesh(
          new THREE.BoxGeometry(upperW, b.h2, upperD),
          stone,
          [bx, upperY, bz]
        );
        g.add(upper);

        // Parapetto merlato sulla terrazza
        const parapet = mesh(
          new THREE.BoxGeometry(upperW * 0.95, 0.25, upperD * 0.95),
          darkStone,
          [bx, b.h1 + b.h2 + 0.125, bz]
        );
        g.add(parapet);

        // Scalinata parziale esterna
        const steps = mesh(
          new THREE.BoxGeometry(0.8, 1.2, 1.8),
          bedrock,
          [bx + b.w / 2 + 0.4, 0.9, bz]
        );
        steps.rotation.x = -0.25;
        g.add(steps);


        // Nicchia o intarsio ciano luminescente sulle facciate
        if ((qIdx + bIdx) % 2 === 0) {
          const glyph = mesh(
            new THREE.BoxGeometry(0.1, 0.8, 0.8),
            cyanGlow,
            [bx - b.w / 2 - 0.05, 1.6, bz]
          );
          g.add(glyph);
        }
      });

      // Mura perimetrali basse tra i quartieri
      const wall = mesh(new THREE.BoxGeometry(10, 1.2, 0.8), stone, [qx, 0.6, qz + 10]);
      g.add(wall);
    });

    this.group.add(g);
  }

  /**
   * Oceano Prosciugato: nave sommersa spezzata in due con prua sollevata,
   * archi di conchiglie giganti e colonne incrostate di cristalli marini luminescenti.
   */
  _buildOceanCity() {
    const g = new THREE.Group();
    const { shipWood, shipDarkWood, coralStone, coralPink, marineCrystal, gold } = this.mats;

    // Piattaforma corallina centrale
    const reefBase = mesh(new THREE.CylinderGeometry(9.5, 11.5, 1.4, 8), coralStone, [0, 0.7, 0]);
    const reefMid = mesh(new THREE.CylinderGeometry(6.5, 8.0, 1.6, 8), coralPink, [0, 2.2, 0]);
    g.add(reefBase, reefMid);

    // Nave sommersa spezzata in due con prua sollevata (Y max ~ 8.6)
    const shipGroup = new THREE.Group();
    shipGroup.name = 'sunken-ship';

    // Sezione Prua sollevata a Nord-Ovest
    const prowGroup = new THREE.Group();
    const prowHull = mesh(new THREE.BoxGeometry(3.8, 2.4, 7.5), shipWood, [0, 1.2, 0]);
    const prowTip = mesh(new THREE.ConeGeometry(2.2, 4.2, 4), shipDarkWood, [0, 1.4, -5.2]);
    prowTip.rotation.x = -Math.PI / 2;
    const bowsprit = mesh(new THREE.CylinderGeometry(0.14, 0.25, 4.5, 6), gold, [0, 2.4, -7.2]);
    bowsprit.rotation.x = -Math.PI / 3;
    const brokenMast = mesh(new THREE.CylinderGeometry(0.22, 0.34, 5.2, 6), shipDarkWood, [0, 4.2, -1.0]);
    const prowCrystal = mesh(new THREE.OctahedronGeometry(0.95, 0), marineCrystal, [0, 7.0, -1.0]);
    prowGroup.add(prowHull, prowTip, bowsprit, brokenMast, prowCrystal);
    prowGroup.position.set(-1.5, 2.2, -3.5);
    prowGroup.rotation.x = 0.38; // Prua cabrata verso l'alto
    prowGroup.rotation.z = -0.12;

    // Sezione Poppa spezzata a Sud-Est
    const sternGroup = new THREE.Group();
    const sternHull = mesh(new THREE.BoxGeometry(4.2, 2.6, 6.2), shipWood, [0, 1.3, 0]);
    const sternCabin = mesh(new THREE.BoxGeometry(3.6, 2.0, 3.2), shipDarkWood, [0, 3.2, 1.2]);
    const sternRailing = mesh(new THREE.BoxGeometry(3.9, 0.4, 0.4), gold, [0, 4.4, 2.6]);
    sternGroup.add(sternHull, sternCabin, sternRailing);
    sternGroup.position.set(1.8, 1.5, 4.2);
    sternGroup.rotation.x = -0.22;
    sternGroup.rotation.y = 0.18;

    shipGroup.add(prowGroup, sternGroup);
    this.sunkenShip = shipGroup;
    g.add(shipGroup);

    // Reperto finale nel punto di frattura della nave
    this._attachEndingRelic(g);

    // Archi di conchiglie lungo i 4 punti cardinali
    const shellArches = new THREE.Group();
    shellArches.name = 'shell-arches';
    const dirs = [
      { x: 0, z: 16, ry: 0 },
      { x: 0, z: -16, ry: 0 },
      { x: 16, z: 0, ry: Math.PI / 2 },
      { x: -16, z: 0, ry: Math.PI / 2 },
    ];
    for (const d of dirs) {
      const archGroup = new THREE.Group();
      const torus = mesh(new THREE.TorusGeometry(4.2, 0.55, 6, 10, Math.PI), coralStone, [0, 0.5, 0]);
      const crest = mesh(new THREE.OctahedronGeometry(0.85, 0), marineCrystal, [0, 5.1, 0]);
      const baseL = mesh(new THREE.CylinderGeometry(0.9, 1.2, 1.4, 6), coralPink, [-4.2, 0.7, 0]);
      const baseR = mesh(new THREE.CylinderGeometry(0.9, 1.2, 1.4, 6), coralPink, [4.2, 0.7, 0]);
      archGroup.add(torus, crest, baseL, baseR);
      archGroup.position.set(d.x, 0, d.z);
      archGroup.rotation.y = d.ry;
      shellArches.add(archGroup);
    }
    this.shellArches = shellArches;
    g.add(shellArches);

    // Colonne incrostate di cristalli marini nei 4 quadranti
    const quadrants = [
      [20, 20], [-20, 20], [20, -20], [-20, -20],
      [12, 24], [-12, 24], [12, -24], [-12, -24],
    ];
    quadrants.forEach(([qx, qz], idx) => {
      const colH = 3.8 + (idx % 3) * 0.9;
      const base = mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.6, 6), coralStone, [qx, 0.3, qz]);
      const shaft = mesh(new THREE.CylinderGeometry(0.55, 0.7, colH, 6), coralStone, [qx, 0.6 + colH / 2, qz]);
      const crystal1 = mesh(new THREE.OctahedronGeometry(0.65, 0), marineCrystal, [qx + 0.55, 1.8, qz]);
      const crystal2 = mesh(new THREE.OctahedronGeometry(0.5, 0), marineCrystal, [qx - 0.45, colH * 0.75, qz + 0.3]);
      const cap = mesh(new THREE.ConeGeometry(0.8, 1.1, 6), coralPink, [qx, 0.6 + colH + 0.55, qz]);
      g.add(base, shaft, crystal1, crystal2, cap);
    });

    this.group.add(g);
  }

  /**
   * Ghiacciaio Arcaico: monoliti esagonali di ghiaccio, guglie cristalline
   * e templi congelati in rovina.
   */
  _buildGlacierCity() {
    const g = new THREE.Group();
    const { glacierIce, permafrostStone, sapphireGlow, gold } = this.mats;

    // Santuario centrale con Monolite Esagonale di Ghiaccio (Y max = 8.8)
    const baseHex1 = mesh(new THREE.CylinderGeometry(8.5, 10.0, 1.4, 6), permafrostStone, [0, 0.7, 0]);
    const baseHex2 = mesh(new THREE.CylinderGeometry(5.5, 6.8, 1.6, 6), glacierIce, [0, 2.2, 0]);
    const monolithShaft = mesh(new THREE.CylinderGeometry(1.5, 2.1, 4.4, 6), glacierIce, [0, 5.2, 0]);
    const monolithTip = mesh(new THREE.ConeGeometry(1.5, 1.4, 6), sapphireGlow, [0, 8.1, 0]);
    const coreRing = mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.35, 6), sapphireGlow, [0, 4.8, 0]);
    this.iceMonolith = monolithShaft;
    g.add(baseHex1, baseHex2, monolithShaft, monolithTip, coreRing);

    // 6 Monoliti esagonali minori disposti a corona attorno al centro
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const mx = Math.cos(angle) * 7.2;
      const mz = Math.sin(angle) * 7.2;
      const mh = 4.2 + (i % 2) * 1.1;
      const mCol = mesh(new THREE.CylinderGeometry(0.75, 0.95, mh, 6), glacierIce, [mx, mh / 2, mz]);
      const mCap = mesh(new THREE.ConeGeometry(0.75, 0.9, 6), sapphireGlow, [mx, mh + 0.45, mz]);
      g.add(mCol, mCap);
    }

    // Reperto finale
    this._attachEndingRelic(g);

    // Guglie cristalline lungo i 4 assi cardinali
    const spiresGroup = new THREE.Group();
    spiresGroup.name = 'crystalline-spires';
    const dirs = [
      { dx: 0, dz: 1 }, { dx: 0, dz: -1 }, { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
    ];
    for (const d of dirs) {
      for (let i = 0; i < 3; i++) {
        const dist = 13 + i * 5.2;
        for (const side of [-3.2, 3.2]) {
          const sx = d.dx === 0 ? side : d.dx * dist;
          const sz = d.dz === 0 ? side : d.dz * dist;
          const sh = 4.5 + (i % 2) * 1.2;
          const spire = mesh(new THREE.ConeGeometry(0.95, sh, 6), glacierIce, [sx, sh / 2, sz]);
          const glowBase = mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.6, 6), permafrostStone, [sx, 0.3, sz]);
          const gem = mesh(new THREE.OctahedronGeometry(0.45, 0), sapphireGlow, [sx, sh + 0.35, sz]);
          spiresGroup.add(spire, glowBase, gem);
        }
      }
    }
    this.crystallineSpires = spiresGroup;
    g.add(spiresGroup);

    // Templi congelati in rovina nei 4 quadranti
    const templeCenters = [
      [21, 21], [-21, 21], [21, -21], [-21, -21],
    ];
    templeCenters.forEach(([tx, tz]) => {
      const floorSlab = mesh(new THREE.CylinderGeometry(5.5, 6.2, 1.2, 6), permafrostStone, [tx, 0.6, tz]);
      const roofRing = mesh(new THREE.CylinderGeometry(4.6, 4.8, 0.6, 6), gold, [tx, 4.8, tz]);
      const centerCrystal = mesh(new THREE.OctahedronGeometry(1.1, 0), sapphireGlow, [tx, 2.8, tz]);
      g.add(floorSlab, roofRing, centerCrystal);
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        const px = tx + Math.cos(a) * 4.0;
        const pz = tz + Math.sin(a) * 4.0;
        const ph = p % 2 === 0 ? 3.4 : 2.2; // Alcune colonne spezzate dal gelo
        const pillar = mesh(new THREE.CylinderGeometry(0.48, 0.55, ph, 6), glacierIce, [px, 1.2 + ph / 2, pz]);
        g.add(pillar);
      }
    });

    this.group.add(g);
  }

  /**
   * Giungla Sepolta: templi a ziggurat bassi, blocchi monolitici, radici fossili e menhir incisi.
   */
  _buildJungleCity() {
    const g = new THREE.Group();
    const { jungleStone, mossStone, rootWood, emeraldGlow, gold } = this.mats;

    // Grande Ziggurat centrale a 5 gradoni bassi e larghi (Y max = 8.4)
    const ziggurat = new THREE.Group();
    ziggurat.name = 'stepped-ziggurat';
    const tiers = [
      { w: 18, h: 1.4, y: 0.7, m: jungleStone },
      { w: 14, h: 1.4, y: 2.1, m: mossStone },
      { w: 10.5, h: 1.4, y: 3.5, m: jungleStone },
      { w: 7.2, h: 1.4, y: 4.9, m: mossStone },
      { w: 4.4, h: 1.8, y: 6.5, m: jungleStone },
    ];
    for (const t of tiers) {
      ziggurat.add(mesh(new THREE.BoxGeometry(t.w, t.h, t.w), t.m, [0, t.y, 0]));
    }
    // Santuario sommitale smeraldo e oro
    const altarTop = mesh(new THREE.BoxGeometry(2.6, 1.0, 2.6), gold, [0, 7.9, 0]);
    const emeraldOrb = mesh(new THREE.OctahedronGeometry(0.75, 0), emeraldGlow, [0, 8.6, 0]);
    // Scalinate cerimoniali sui 4 lati della Ziggurat
    const stairN = mesh(new THREE.BoxGeometry(2.8, 5.2, 7.5), jungleStone, [0, 2.6, -6.2]);
    stairN.rotation.x = 0.55;
    const stairS = mesh(new THREE.BoxGeometry(2.8, 5.2, 7.5), jungleStone, [0, 2.6, 6.2]);
    stairS.rotation.x = -0.55;
    ziggurat.add(altarTop, emeraldOrb, stairN, stairS);
    this.steppedZiggurat = ziggurat;
    g.add(ziggurat);

    // Reperto finale sulla terrazza della Ziggurat
    this._attachEndingRelic(g);

    // Menhir incisi con glifi smeraldo lungo i viali e nei quadranti
    const menhirsGroup = new THREE.Group();
    menhirsGroup.name = 'engraved-menhirs';
    const menhirCoords = [
      [0, 15], [0, -15], [15, 0], [-15, 0],
      [11, 11], [-11, 11], [11, -11], [-11, -11],
      [22, 14], [-22, 14], [22, -14], [-22, -14],
    ];
    menhirCoords.forEach(([mx, mz], idx) => {
      const mh = 4.4 + (idx % 3) * 0.85;
      const base = mesh(new THREE.BoxGeometry(2.0, 0.8, 2.0), mossStone, [mx, 0.4, mz]);
      const stoneMonolith = mesh(new THREE.BoxGeometry(1.3, mh, 0.9), jungleStone, [mx, 0.8 + mh / 2, mz]);
      const runeCarving = mesh(new THREE.BoxGeometry(0.45, mh * 0.65, 0.98), emeraldGlow, [mx, 0.8 + mh / 2, mz]);
      const rootWrap = mesh(new THREE.CylinderGeometry(0.22, 0.35, 2.4, 5), rootWood, [mx + 0.65, 1.2, mz]);
      rootWrap.rotation.z = 0.35;
      menhirsGroup.add(base, stoneMonolith, runeCarving, rootWrap);
    });
    this.engravedMenhirs = menhirsGroup;
    g.add(menhirsGroup);

    // Templi secondari bassi a gradoni nei 4 quadranti
    const quadCenters = [
      [21, 21], [-21, 21], [21, -21], [-21, -21],
    ];
    quadCenters.forEach(([qx, qz]) => {
      const b1 = mesh(new THREE.BoxGeometry(8.5, 1.6, 8.5), mossStone, [qx, 0.8, qz]);
      const b2 = mesh(new THREE.BoxGeometry(5.8, 1.5, 5.8), jungleStone, [qx, 2.35, qz]);
      const b3 = mesh(new THREE.BoxGeometry(3.2, 1.4, 3.2), mossStone, [qx, 3.8, qz]);
      const topRune = mesh(new THREE.BoxGeometry(1.4, 0.5, 1.4), emeraldGlow, [qx, 4.75, qz]);
      // Radici giganti che avvolgono i templi
      const rootArch = mesh(new THREE.TorusGeometry(3.8, 0.32, 5, 8, Math.PI), rootWood, [qx, 1.2, qz + 2.5]);
      g.add(b1, b2, b3, topRune, rootArch);
    });

    this.group.add(g);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        if (o.material) [].concat(o.material).forEach((m) => m.dispose?.());
      }
    });
  }
}
