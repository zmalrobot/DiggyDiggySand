// Illuminazione notturna locale: fiaccole e bracieri d'olio sulle rovine e al campo base.
// Limite rigoroso di max 4 PointLight per preservare il framerate a 60 FPS su mobile.
import * as THREE from 'three';

const TORCH_COLOR = 0xFFA034; // Ambra caldo fuoco/olio
const BASE_INTENSITY = 18;     // Intensità di picco notturna
const TORCH_DISTANCE = 24;    // Raggio d'illuminazione morbido

const TORCH_CONFIGS = [
  { name: 'camp', x: 0, y: 13, z: 42 },         // Bordo duna / campo base
  { name: 'sanctuary', x: 0, y: 4.5, z: 0 },    // Santuario obelisco centrale
  { name: 'portal', x: 0, y: 6.0, z: 7 },       // Portale monumentale a Sud
  { name: 'avenue_east', x: 18, y: 3.5, z: 0 }, // Viale colonnato a Est
];

export class Torches {
  constructor(scene = null) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'torches-lighting';

    this.lights = [];
    this._time = 0;

    this._buildTorches();
    this.scene?.add?.(this.group);
  }

  _buildTorches() {
    for (let i = 0; i < TORCH_CONFIGS.length; i++) {
      const cfg = TORCH_CONFIGS[i];
      const light = new THREE.PointLight(TORCH_COLOR, 0, TORCH_DISTANCE, 2.0);
      light.position.set(cfg.x, cfg.y, cfg.z);
      light.castShadow = false; // PointLight shadows off per budget GPU mobile

      // Piccolo braciere visivo geometrico
      const brazier = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.2, 0.4, 5),
        new THREE.MeshBasicMaterial({ color: 0x241C15 })
      );
      brazier.position.set(cfg.x, cfg.y - 0.2, cfg.z);

      // Fiamma luminescente
      const flame = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.2, 0),
        new THREE.MeshBasicMaterial({ color: 0xFFBA44 })
      );
      flame.position.set(cfg.x, cfg.y + 0.15, cfg.z);

      this.group.add(light, brazier, flame);
      this.lights.push({
        light,
        flame,
        cfg,
        phase: i * 1.7,
      });
    }
  }

  /**
   * Aggiorna lo stato delle torce: accensione in base al fattore notte e sfarfallio fiamma.
   * @param {number} dt Delta time
   * @param {number} nightFactor 0 = spento (giorno), 1 = massimo (notte)
   */
  update(dt, nightFactor) {
    this._time += dt;

    for (let i = 0; i < this.lights.length; i++) {
      const item = this.lights[i];
      if (nightFactor <= 0.05) {
        item.light.intensity = 0;
        item.flame.visible = false;
        continue;
      }

      item.flame.visible = true;

      // Sfarfallio procedurale morbido
      const flicker1 = Math.sin(this._time * 11 + item.phase) * 0.12;
      const flicker2 = Math.sin(this._time * 23 + item.phase * 2) * 0.08;
      const flicker = 1.0 + flicker1 + flicker2;

      const targetIntensity = BASE_INTENSITY * nightFactor * flicker;
      item.light.intensity = Math.max(0, targetIntensity);

      // Micro pulsazione scala fiamma
      const s = 1.0 + flicker1 * 0.5;
      item.flame.scale.set(s, s * 1.2, s);
    }
  }

  dispose() {
    for (const item of this.lights) {
      item.light.dispose?.();
      item.flame.geometry?.dispose?.();
      item.flame.material?.dispose?.();
    }
    this.lights = [];
    this.scene?.remove?.(this.group);
  }
}
