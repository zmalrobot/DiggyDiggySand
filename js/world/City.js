// Generatore procedurale della Città Sepolta: quartieri a gradoni, viali colonnati e tempio centrale.
// Collocata interamente sotto la sabbia superficiale (Y da 0 a 8.8), emerge naturalmente con lo scavo.
import * as THREE from 'three';
import { PALETTE_3D } from './ProceduralFactory.js';

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
  constructor({ endingId = 'curse', floor = 0, assets = null } = {}) {
    this.endingId = endingId;
    this.floor = floor;
    this.assets = assets;
    this.group = new THREE.Group();
    this.group.name = 'buried-city';

    this._initMaterials();
    this._buildCity();
  }

  _initMaterials() {
    this.mats = {
      stone: mat(PALETTE_3D.ruinsStone),
      bedrock: mat(PALETTE_3D.sandBedrock),
      darkStone: mat(0x352B24),
      gold: mat(PALETTE_3D.ruinsGoldInlay, { metalness: 0.8, roughness: 0.2 }),
      tealGlow: mat(PALETTE_3D.abyss, {
        emissive: PALETTE_3D.atlantisCoreTeal,
        emissiveIntensity: 1.4,
      }),
      cyanGlow: mat(0x00F2FF, {
        emissive: 0x00F2FF,
        emissiveIntensity: 1.2,
      }),
      curseAltar: mat(0x100A0A, {
        emissive: 0x8B0000,
        emissiveIntensity: 0.9,
      }),
      treasureGold: mat(0xFFDF00, {
        metalness: 0.9,
        roughness: 0.15,
        emissive: 0x443300,
      }),
    };
  }

  _buildCity() {
    this._buildCentralSanctuary();
    this._buildMonumentalAvenues();
    this._buildQuarters();
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

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        if (o.material) [].concat(o.material).forEach((m) => m.dispose?.());
      }
    });
  }
}
