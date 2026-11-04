// Suite Diagnostica Hardware e Profiler WebGL per Diggy Diggy Sand (Fase 16).
// Monitora FPS istantanei e medi (finestra 500ms), Frame Time (ms), Draw Calls, Poligoni e VRAM/Heap.
// Impatto prestazionale nullo quando disattivato.

export class Profiler {
  constructor({ renderer = null, settings = null, sampleWindowMs = 500, maxHistory = 60 } = {}) {
    this.renderer = renderer;
    this.settings = settings;
    this.sampleWindowMs = sampleWindowMs;
    this.maxHistory = maxHistory;

    // Buffer circolare a dimensione fissa per lo storico dei frame recenti
    this.history = new Float32Array(maxHistory);
    this.historyIndex = 0;
    this.historyCount = 0;

    // Metriche Frame & FPS
    this.enabled = false;
    this.fps = 0;
    this.avgFps = 0;
    this.frameTime = 0;
    this.minFrameTime = Infinity;
    this.maxFrameTime = 0;

    // Metriche Three.js (renderer.info)
    this.drawCalls = 0;
    this.triangles = 0;
    this.geometries = 0;
    this.textures = 0;

    // Memoria Heap JavaScript
    this.jsHeapMB = 'N/A';

    // Accumulo temporale per campioni da 500ms
    this._frameCount = 0;
    this._windowStartTime = 0;
    this._frameStartTime = 0;
    this._lastFrameTimestamp = 0;

    // Callback opzionale per aggiornamento listener/overlay
    this.onFrame = null;

    // Sincronizzazione automatica con le impostazioni
    if (this.settings) {
      const initial = !!this.settings.get('graphics.showProfiler') || !!this.settings.get('showProfiler');
      this.enabled = initial;
      this._unsub1 = this.settings.subscribe('graphics.showProfiler', (v) => {
        this.enabled = !!v;
      });
      this._unsub2 = this.settings.subscribe('showProfiler', (v) => {
        this.enabled = !!v;
      });
    }
  }

  setRenderer(renderer) {
    this.renderer = renderer;
  }

  setEnabled(val) {
    this.enabled = !!val;
    if (this.settings) {
      this.settings.set('graphics.showProfiler', this.enabled);
    }
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  /**
   * Avvia la misurazione temporale del frame corrente.
   * Se il profiler è disattivato, esce immediatamente con overhead nullo.
   */
  beginFrame(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (!this.enabled) return;
    this._frameStartTime = now;
  }

  /**
   * Conclude la misurazione temporale del frame ed interroga renderer.info e JS Heap.
   */
  endFrame(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (!this.enabled) return;

    const tStart = this._frameStartTime || now;
    const ft = Math.max(0.01, now - tStart);
    this.frameTime = ft;

    if (ft < this.minFrameTime) this.minFrameTime = ft;
    if (ft > this.maxFrameTime) this.maxFrameTime = ft;

    // Registra nel buffer circolare
    this.history[this.historyIndex] = ft;
    this.historyIndex = (this.historyIndex + 1) % this.maxHistory;
    if (this.historyCount < this.maxHistory) {
      this.historyCount++;
    }

    // Calcolo FPS istantaneo tra frame consecutivi
    if (this._lastFrameTimestamp > 0) {
      const deltaTotal = now - this._lastFrameTimestamp;
      if (deltaTotal > 0) {
        this.fps = 1000 / deltaTotal;
      }
    } else {
      this.fps = 1000 / ft;
    }
    this._lastFrameTimestamp = now;

    // Calcolo FPS medio ponderato su finestra di 500ms
    this._frameCount++;
    if (this._windowStartTime === 0) {
      this._windowStartTime = now;
    }
    const windowElapsed = now - this._windowStartTime;
    if (windowElapsed >= this.sampleWindowMs) {
      this.avgFps = (this._frameCount * 1000) / windowElapsed;
      this._frameCount = 0;
      this._windowStartTime = now;
    }

    // Interrogazione Metriche Three.js
    if (this.renderer?.info) {
      const render = this.renderer.info.render;
      const memory = this.renderer.info.memory;
      this.drawCalls = render?.calls ?? 0;
      this.triangles = render?.triangles ?? 0;
      this.geometries = memory?.geometries ?? 0;
      this.textures = memory?.textures ?? 0;
    }

    // Monitoraggio Memoria Heap
    if (typeof performance !== 'undefined' && performance.memory?.usedJSHeapSize) {
      const bytes = performance.memory.usedJSHeapSize;
      this.jsHeapMB = (bytes / (1024 * 1024)).toFixed(1);
    } else {
      this.jsHeapMB = 'N/A';
    }

    // Notifica l'overlay/callback
    if (this.onFrame) {
      this.onFrame(this.getMetrics());
    }
  }

  /**
   * Ritorna un'istantanea delle metriche hardware e di rendering correnti.
   */
  getMetrics() {
    return {
      enabled: this.enabled,
      fps: this.fps,
      avgFps: this.avgFps || this.fps,
      frameTime: this.frameTime,
      minFrameTime: this.minFrameTime,
      maxFrameTime: this.maxFrameTime,
      drawCalls: this.drawCalls,
      triangles: this.triangles,
      geometries: this.geometries,
      textures: this.textures,
      jsHeapMB: this.jsHeapMB,
      history: this.getHistoryArray(),
      historyIndex: this.historyIndex,
      historyCount: this.historyCount,
    };
  }

  /**
   * Ritorna lo storico dei frame ordinato cronologicamente dal più vecchio al più recente.
   */
  getHistoryArray() {
    const arr = [];
    if (this.historyCount < this.maxHistory) {
      for (let i = 0; i < this.historyCount; i++) {
        arr.push(this.history[i]);
      }
    } else {
      for (let i = 0; i < this.maxHistory; i++) {
        const idx = (this.historyIndex + i) % this.maxHistory;
        arr.push(this.history[idx]);
      }
    }
    return arr;
  }

  dispose() {
    this._unsub1?.();
    this._unsub2?.();
    this.history = null;
    this.renderer = null;
    this.settings = null;
    this.onFrame = null;
  }
}

