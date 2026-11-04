// Overlay diagnostico hardware e WebGL HUD con Sparkline Canvas (Fase 16).
// Visualizzazione discreta, tipografia Syne, pointer-events: none e rendering ad alto rendimento.
import { formatNumber } from './Hud.js';

export class ProfilerOverlay {
  constructor({ profiler = null, parent = document.body } = {}) {
    this.profiler = profiler;
    this.parent = parent || (typeof document !== 'undefined' ? document.body : null);
    this.visible = false;

    this.el = null;
    this.canvas = null;
    this.ctx = null;
    this.fpsEl = null;
    this.ftEl = null;
    this.callsEl = null;
    this.trisEl = null;
    this.vramEl = null;
    this.heapEl = null;

    // Throttle per il refresh del testo DOM (ogni ~100ms per limitare i reflow)
    this._lastTextUpdate = 0;

    this._createDOM();

    if (this.profiler) {
      this.profiler.onFrame = (metrics) => this.update(metrics);
      this.setVisible(this.profiler.enabled);
      if (this.profiler.settings) {
        this.profiler.settings.subscribe('graphics.showProfiler', (v) => this.setVisible(v));
        this.profiler.settings.subscribe('showProfiler', (v) => this.setVisible(v));
      }
    }
  }

  _createDOM() {
    if (typeof document === 'undefined' || !this.parent) return;

    const container = document.createElement('div');
    container.id = 'dds-profiler-overlay';
    container.className = 'dds-profiler-overlay hidden';
    container.setAttribute('aria-hidden', 'true');

    container.innerHTML = `
      <div class="dds-profiler-header">
        <span class="dds-profiler-title">DIAGNOSTICA</span>
        <span class="dds-profiler-fps" data-stat="fps">-- FPS</span>
      </div>
      <canvas class="dds-profiler-sparkline" width="120" height="30"></canvas>
      <div class="dds-profiler-grid">
        <div class="dds-profiler-stat">
          <span class="lbl">Tempo Frame:</span>
          <span class="val" data-stat="ft">-- ms</span>
        </div>
        <div class="dds-profiler-stat">
          <span class="lbl">Draw Calls:</span>
          <span class="val" data-stat="calls">--</span>
        </div>
        <div class="dds-profiler-stat">
          <span class="lbl">Triangoli:</span>
          <span class="val" data-stat="tris">--</span>
        </div>
        <div class="dds-profiler-stat">
          <span class="lbl">VRAM Tex:</span>
          <span class="val" data-stat="vram">--</span>
        </div>
        <div class="dds-profiler-stat" style="grid-column: span 2;">
          <span class="lbl">Memoria Heap:</span>
          <span class="val" data-stat="heap">--</span>
        </div>
      </div>
    `;

    this.el = container;
    this.canvas = container.querySelector('.dds-profiler-sparkline');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }

    this.fpsEl = container.querySelector('[data-stat="fps"]');
    this.ftEl = container.querySelector('[data-stat="ft"]');
    this.callsEl = container.querySelector('[data-stat="calls"]');
    this.trisEl = container.querySelector('[data-stat="tris"]');
    this.vramEl = container.querySelector('[data-stat="vram"]');
    this.heapEl = container.querySelector('[data-stat="heap"]');

    this.parent.append(container);
  }

  setVisible(visible) {
    this.visible = !!visible;
    if (!this.el) return;
    if (this.visible) {
      this.el.classList.remove('hidden');
    } else {
      this.el.classList.add('hidden');
    }
  }

  /**
   * Aggiorna visualizzazione e canvas sparkline.
   * Se l'overlay non è visibile, esce immediatamente con overhead zero.
   */
  update(metrics) {
    if (!this.visible || !this.el) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // 1. Disegna Sparkline Canvas ad ogni frame per fluidità massima
    this._renderSparkline(metrics.history || []);

    // 2. Aggiorna campi di testo DOM a intervalli controllati per evitare layout thrashing
    if (now - this._lastTextUpdate > 100) {
      this._lastTextUpdate = now;
      this._updateTextStats(metrics);
    }
  }

  _updateTextStats(metrics) {
    const fps = metrics.avgFps || metrics.fps || 0;
    const ft = metrics.frameTime || 0;

    if (this.fpsEl) {
      this.fpsEl.textContent = `${fps.toFixed(1)} FPS`;
      this.fpsEl.classList.toggle('good', fps >= 55);
      this.fpsEl.classList.toggle('warn', fps < 55 && fps >= 30);
      this.fpsEl.classList.toggle('bad', fps < 30);
    }

    if (this.ftEl) {
      this.ftEl.textContent = `${ft.toFixed(1)} ms`;
    }

    if (this.callsEl) {
      this.callsEl.textContent = String(metrics.drawCalls ?? 0);
    }

    if (this.trisEl) {
      const tris = metrics.triangles ?? 0;
      this.trisEl.textContent = formatNumber ? formatNumber(tris) : String(tris);
    }

    if (this.vramEl) {
      const tex = metrics.textures ?? 0;
      const geo = metrics.geometries ?? 0;
      this.vramEl.textContent = `${tex} tex / ${geo} geo`;
    }

    if (this.heapEl) {
      this.heapEl.textContent = metrics.jsHeapMB === 'N/A' ? 'N/A' : `${metrics.jsHeapMB} MB`;
    }
  }

  _renderSparkline(history) {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;

    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Sfondo semi-trasparente
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, w, h);

    const count = history.length;
    if (count === 0) return;

    const maxMs = 50.0; // Scala a 50ms (sotto 16.6ms = 60fps, 33.3ms = 30fps)
    const barWidth = w / 60; // 2px per barra

    // Linea di riferimento 16.6ms (60 FPS - verde tratteggiata)
    const y60 = h - (16.6 / maxMs) * h;
    ctx.strokeStyle = 'rgba(46, 204, 113, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y60);
    ctx.lineTo(w, y60);
    ctx.stroke();

    // Linea di riferimento 33.3ms (30 FPS - ambra tratteggiata)
    const y30 = h - (33.3 / maxMs) * h;
    ctx.strokeStyle = 'rgba(245, 186, 35, 0.4)';
    ctx.beginPath();
    ctx.moveTo(0, y30);
    ctx.lineTo(w, y30);
    ctx.stroke();

    // Disegna barre della serie temporale
    for (let i = 0; i < count; i++) {
      const val = history[i];
      const barH = Math.min(h, Math.max(1, (val / maxMs) * h));
      const x = (60 - count + i) * barWidth;
      const y = h - barH;

      if (val <= 16.7) {
        ctx.fillStyle = '#0FE3C1'; // Verde / ciano atlantideo solidi (>= 60 FPS)
      } else if (val <= 33.3) {
        ctx.fillStyle = '#F5BA23'; // Ambra dorata (30-59 FPS)
      } else {
        ctx.fillStyle = '#E74C3C'; // Rosso avviso (< 30 FPS / hitching)
      }

      ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), barH);
    }
  }

  destroy() {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    this.canvas = null;
    this.ctx = null;
  }
}
