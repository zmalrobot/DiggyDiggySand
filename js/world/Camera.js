// Controllore Camera Avanzato: rotazione orbitale inerziale Q/E e zoom cinematico smorzato con rotellina.
import * as THREE from 'three';

export const CAMERA_LIMITS = {
  minDistance: 12.0,   // Vicino al fondo dello scavo senza compenetrare
  maxDistance: 135.0,  // Vista panoramica completa del cratere e delle dune
  minPolarAngle: 0.25, // Angolo quasi zenitale (top-down)
  maxPolarAngle: 1.20, // Mai sotto l'orizzonte (previene visuale da sotto il terreno)
};

export class CameraController {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} controls
   * @param {HTMLCanvasElement} domElement
   * @param {Object} [options]
   */
  constructor(camera, controls, domElement, options = {}) {
    this.camera = camera;
    this.controls = controls;
    this.domElement = domElement;

    this.minDistance = options.minDistance ?? CAMERA_LIMITS.minDistance;
    this.maxDistance = options.maxDistance ?? CAMERA_LIMITS.maxDistance;
    this.minPolarAngle = options.minPolarAngle ?? CAMERA_LIMITS.minPolarAngle;
    this.maxPolarAngle = options.maxPolarAngle ?? CAMERA_LIMITS.maxPolarAngle;

    this.zoomSpeed = options.zoomSpeed ?? 1.2;
    this.rotAccel = options.rotAccel ?? 4.5;       // rad/s^2
    this.rotDamping = options.rotDamping ?? 5.5;   // fattore smorzamento
    this.maxRotSpeed = options.maxRotSpeed ?? 2.4; // rad/s max

    this.azimuthVelocity = 0;
    this.targetDistance = 45;
    this.currentDistance = 45;

    this._enabled = true;
    this._spherical = new THREE.Spherical();
    this._offset = new THREE.Vector3();

    // Sincronizza lo stato iniziale se camera e controls sono disponibili
    this._syncFromCamera();

    // Disabilita lo zoom standard a scatti di OrbitControls per usare il nostro wheel controller cinematico
    if (this.controls) {
      this.controls.enableZoom = false;
      this.controls.minDistance = this.minDistance;
      this.controls.maxDistance = this.maxDistance;
      this.controls.minPolarAngle = this.minPolarAngle;
      this.controls.maxPolarAngle = this.maxPolarAngle;
    }

    this._onWheel = this._handleWheel.bind(this);
    if (this.domElement && typeof this.domElement.addEventListener === 'function') {
      this.domElement.addEventListener('wheel', this._onWheel, { passive: false });
    }
  }

  get enabled() { return this._enabled; }
  set enabled(v) { this._enabled = !!v; }

  _syncFromCamera() {
    if (!this.camera || !this.controls?.target) return;
    this._offset.copy(this.camera.position).sub(this.controls.target);
    this._spherical.setFromVector3(this._offset);
    this.currentDistance = THREE.MathUtils.clamp(this._spherical.radius, this.minDistance, this.maxDistance);
    this.targetDistance = this.currentDistance;
  }

  _handleWheel(e) {
    if (!this._enabled) return;
    // Intercetta sempre per prevenire lo scrolling accidentale della pagina web
    e.preventDefault();

    // Normalizzazione delta per cross-browser e touchpad
    const rawDelta = e.deltaY;
    const deltaNormalized = Math.sign(rawDelta) * Math.min(Math.abs(rawDelta), 100);
    const zoomAmount = deltaNormalized * 0.08 * this.zoomSpeed;

    this.targetDistance = THREE.MathUtils.clamp(
      this.targetDistance + zoomAmount,
      this.minDistance,
      this.maxDistance
    );
  }

  /**
   * Applica una spinta di zoom diretta (+ avvicina, - allontana).
   * @param {number} delta Distanza in metri
   */
  zoom(delta) {
    this.targetDistance = THREE.MathUtils.clamp(
      this.targetDistance + delta,
      this.minDistance,
      this.maxDistance
    );
  }

  /** Imposta direttamente la distanza target con clamping rigoroso. */
  setDistance(dist) {
    this.targetDistance = THREE.MathUtils.clamp(dist, this.minDistance, this.maxDistance);
    this.currentDistance = this.targetDistance;
    this._applyToCamera();
  }

  /**
   * Ruota manualmente l'azimuth di un angolo in radianti.
   * @param {number} deltaAngle Radianti
   */
  rotate(deltaAngle) {
    this._syncFromCamera();
    this._spherical.theta += deltaAngle;
    this._applyToCamera();
  }

  /**
   * Aggiornamento per-frame: accelera/smorza la rotazione orbitale Q/E e interpola lo zoom.
   * @param {number} dt Delta time in secondi
   * @param {Set<string>|Array<string>} [keys] Insieme dei tasti attivi
   */
  update(dt, keys = null) {
    if (!this._enabled || !this.camera || !this.controls) return;
    if (dt <= 0) return;

    // 1. Controlli Q/E da tastiera per rotazione orbitale cinematografica
    let rotDir = 0;
    if (keys) {
      const hasKey = (code) => (keys.has ? keys.has(code) : keys.includes(code));
      if (hasKey('KeyQ')) rotDir += 1; // Orario
      if (hasKey('KeyE')) rotDir -= 1; // Antiorario
    }

    if (rotDir !== 0) {
      this.azimuthVelocity += rotDir * this.rotAccel * dt;
      this.azimuthVelocity = THREE.MathUtils.clamp(
        this.azimuthVelocity,
        -this.maxRotSpeed,
        this.maxRotSpeed
      );
    }

    // Applicazione smorzamento inerziale esponenziale
    const dampingExp = Math.exp(-this.rotDamping * dt);
    this.azimuthVelocity *= dampingExp;
    if (Math.abs(this.azimuthVelocity) < 0.0001) {
      this.azimuthVelocity = 0;
    }

    // 2. Lettura stato attuale da camera e target (mantiene sincronizzazione con drag manuale di OrbitControls)
    const target = this.controls.target;
    this._offset.copy(this.camera.position).sub(target);
    this._spherical.setFromVector3(this._offset);

    // Se l'utente ha trascinato con il mouse/touch, aggiorna il targetDistance per evitare scatti
    if (Math.abs(this._spherical.radius - this.currentDistance) > 1.5 && Math.abs(this.targetDistance - this.currentDistance) < 0.05) {
      this.currentDistance = THREE.MathUtils.clamp(this._spherical.radius, this.minDistance, this.maxDistance);
      this.targetDistance = this.currentDistance;
    }

    // 3. Interpolazione morbida distanza (zoom lerp / damping)
    this.currentDistance = THREE.MathUtils.damp(
      this.currentDistance,
      this.targetDistance,
      7.0,
      dt
    );
    this.currentDistance = THREE.MathUtils.clamp(this.currentDistance, this.minDistance, this.maxDistance);

    // 4. Applicazione rotazione azimutale inerziale
    if (this.azimuthVelocity !== 0) {
      this._spherical.theta += this.azimuthVelocity * dt;
    }

    this._spherical.radius = this.currentDistance;
    this._spherical.phi = THREE.MathUtils.clamp(this._spherical.phi, this.minPolarAngle, this.maxPolarAngle);

    // 5. Riposiziona camera e aggiorna vista
    this._applyToCamera();
  }

  _applyToCamera() {
    const target = this.controls.target;
    this._offset.setFromSpherical(this._spherical);
    this.camera.position.copy(target).add(this._offset);
    this.camera.lookAt(target);
    this.controls.update();
  }

  dispose() {
    if (this.domElement && typeof this.domElement.removeEventListener === 'function') {
      this.domElement.removeEventListener('wheel', this._onWheel);
    }
    this._enabled = false;
  }
}
