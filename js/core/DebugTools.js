// Suite di Debug, Cheat e Memory Audit per sviluppo e test (Fase 7).
// Esponibile su window.DDS_DEBUG e attivabile con tasto rapido F2 / ~ (Backquote).
import { UPGRADE_CATALOG } from '../systems/Upgrades.js';
import { toast } from '../ui/Modal.js';
import { formatNumber } from '../ui/Hud.js';

export class DebugTools {
  constructor({ game, scene, state, save, audio, root = document.body }) {
    this.game = game;
    this.scene = scene;
    this.state = state;
    this.save = save;
    this.audio = audio;
    this.root = root;

    this.isOpen = false;
    this.panel = null;
    this.statsEls = {};
    this.rafId = null;
    this.lastTime = performance.now();
    this.frames = 0;
    this.fps = 60;

    this._initGlobal();
    this._buildUI();
    this._bindKeys();
  }

  /** Registra window.DDS_DEBUG come interfaccia programmatica da console. */
  _initGlobal() {
    if (typeof window === 'undefined') return;

    window.DDS_DEBUG = {
      addSand: (amount) => this.addSand(amount),
      setCompletion: (pct) => this.setCompletion(pct),
      forceEnding: (id) => this.forceEnding(id),
      triggerEvent: (type) => this.triggerEvent(type),
      unlockAllUpgrades: () => this.unlockAllUpgrades(),
      addTablets: (amount) => this.addTablets(amount),
      unlockAllEndings: () => this.unlockAllEndings(),
      unlockAchievement: (id) => this.unlockAchievement(id),
      setLanguage: (lang) => this.setLanguage(lang),
      cleanVRAM: () => this.cleanVRAM(),
      resetAll: (hard) => this.resetAll(hard),
      getMemoryReport: () => this.getMemoryReport(),
      togglePanel: () => this.toggle(),
    };
  }

  addSand(amount = 10000) {
    this.game?.state?.addSand(amount);
    toast(`[DEBUG] Aggiunta sabbia: +${formatNumber(amount)}`);
    return this.game?.state?.sand;
  }

  setCompletion(pct = 0.99) {
    const c = Math.min(1, Math.max(0, pct));
    if (this.game?.terrain) {
      this.game.terrain.remainingVolume = this.game.terrain.initialVolume * (1 - c);
    }
    this.game?.state?.setCompletion(c);
    toast(`[DEBUG] Completamento forzato: ${(c * 100).toFixed(1)}%`);
    return c;
  }

  forceEnding(id = 'secret') {
    const valid = ['curse', 'treasure', 'business', 'secret'];
    if (!valid.includes(id)) {
      console.warn(`[DEBUG] Ending non valido (${id}). Ammessi:`, valid);
      return false;
    }
    if (this.game?.state) this.game.state.endingId = id;
    this.setCompletion(0.99);
    if (this.game?.endingManager) {
      this.game.endingManager.forceEnding(id);
    }
    toast(`[DEBUG] Forzato finale: ${id}`);
    return true;
  }

  triggerEvent(type = 'sandstorm') {
    if (!this.game?.worldEvents) {
      console.warn('[DEBUG] Sistema WorldEvents non attivo');
      return false;
    }
    this.game.worldEvents.triggerEvent(type);
    toast(`[DEBUG] Evento lanciato: ${type}`);
    return true;
  }

  unlockAllUpgrades() {
    if (!this.game?.state) return false;
    for (const [id, def] of Object.entries(UPGRADE_CATALOG)) {
      this.game.state.upgrades[id] = def.maxLevel;
    }
    this.game.workers?.syncWithUpgrades?.(this.game.state.upgrades);
    this.game.shop?.render?.();
    this.game.economy?.recalculateSPS?.();
    toast('[DEBUG] Tutti gli upgrade sbloccati al massimo livello!');
    return this.game.state.upgrades;
  }

  addTablets(amount = 10) {
    const cur = this.save?.addTablets(amount) ?? 0;
    if (this.game?.state) this.game.state.tablets = cur;
    toast(`[DEBUG] Aggiunte Tavolette Antiche: +${amount} (Totale: τ ${cur})`);
    return cur;
  }

  unlockAllEndings() {
    const all = ['curse', 'treasure', 'business', 'secret'];
    for (const id of all) this.save?.recordEnding(id);
    toast('[DEBUG] Tutti i 4 finali registrati come scoperti!');
    return this.save?.getEndingsSeen();
  }

  unlockAchievement(id) {
    if (this.game?.achievements) {
      this.game.achievements.unlock(id);
      toast(`[DEBUG] Achievement sbloccato: ${id}`);
    }
  }

  setLanguage(lang = 'en') {
    if (window.__dds?.i18n) {
      window.__dds.i18n.setLanguage(lang);
      toast(`[DEBUG] Lingua impostata: ${lang}`);
    }
  }

  cleanVRAM() {
    this.scene?.renderer?.renderLists?.dispose?.();
    toast('[DEBUG] Render lists WebGL liberate con successo.');
  }

  resetAll(hard = true) {
    try {
      localStorage.removeItem('dds_save_v1');
      localStorage.removeItem('dds_settings_v1');
      localStorage.removeItem('dds_tablets_v1');
      localStorage.removeItem('dds_meta_v1');
      localStorage.removeItem('dds_endings_seen');
      localStorage.removeItem('dds_stats_v1');
      localStorage.removeItem('dds_achievements_v1');
      toast('[DEBUG] Salvataggi cancellati. Ricaricamento...');
      if (hard && typeof window !== 'undefined' && window.location?.reload) {
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (e) {
      console.error('[DEBUG] Errore reset:', e);
    }
  }

  getMemoryReport() {
    const r = this.scene?.renderer;
    const mem = window.performance?.memory;
    return {
      fps: Math.round(this.fps),
      drawCalls: r?.info?.render?.calls ?? 0,
      triangles: r?.info?.render?.triangles ?? 0,
      geometries: r?.info?.memory?.geometries ?? 0,
      textures: r?.info?.memory?.textures ?? 0,
      activeParticles: this.game?.particles?.alive ?? 0,
      jsHeapMB: mem ? (mem.usedJSHeapSize / (1024 * 1024)).toFixed(1) + ' MB' : 'N/A',
    };
  }

  _buildUI() {
    if (typeof document === 'undefined') return;

    this.panel = document.createElement('div');
    this.panel.className = 'dds-debug-panel panel hidden';
    this.panel.innerHTML = `
      <div class="debug-panel-head">
        <span class="debug-panel-title accent">🛠️ DDS DEBUG SUITE</span>
        <button type="button" class="debug-close-btn" data-debug-act="close" aria-label="Chiudi Debug">✕</button>
      </div>

      <div class="debug-stats-grid">
        <div class="debug-stat"><span class="d-label">FPS:</span> <span class="d-val accent" data-d="fps">60</span></div>
        <div class="debug-stat"><span class="d-label">Draw Calls:</span> <span class="d-val" data-d="calls">0</span></div>
        <div class="debug-stat"><span class="d-label">Triangoli:</span> <span class="d-val" data-d="triangles">0</span></div>
        <div class="debug-stat"><span class="d-label">Geometrie:</span> <span class="d-val" data-d="geometries">0</span></div>
        <div class="debug-stat"><span class="d-label">Texture:</span> <span class="d-val" data-d="textures">0</span></div>
        <div class="debug-stat"><span class="d-label">Particelle:</span> <span class="d-val" data-d="particles">0</span></div>
        <div class="debug-stat full-row"><span class="d-label">JS Heap:</span> <span class="d-val" data-d="heap">N/A</span></div>
      </div>

      <div class="debug-actions-section">
        <div class="debug-sec-label muted">Comandi Rapidi Economia & Scavo</div>
        <div class="debug-btns-row">
          <button type="button" class="btn debug-btn" data-debug-act="add-sand">+50k Sabbia</button>
          <button type="button" class="btn debug-btn" data-debug-act="comp-99">99% Scavo</button>
          <button type="button" class="btn debug-btn" data-debug-act="max-upgrades">Max Upgrade</button>
          <button type="button" class="btn debug-btn" data-debug-act="add-tablets">+10 τ</button>
        </div>

        <div class="debug-sec-label muted">Eventi Spontanei nel Deserto</div>
        <div class="debug-btns-row">
          <button type="button" class="btn debug-btn" data-debug-act="event-storm">🌪️ Tempesta</button>
          <button type="button" class="btn debug-btn" data-debug-act="event-merchant">⛺ Mercante</button>
        </div>

        <div class="debug-sec-label muted">Forzatura Finali Spedizione</div>
        <div class="debug-btns-row">
          <button type="button" class="btn debug-btn" data-debug-act="end-curse">☠️ Curse</button>
          <button type="button" class="btn debug-btn" data-debug-act="end-treasure">👑 Treasure</button>
          <button type="button" class="btn debug-btn" data-debug-act="end-business">🏗️ Business</button>
          <button type="button" class="btn debug-btn" data-debug-act="end-secret">🔱 Secret</button>
        </div>

        <div class="debug-sec-label muted">Manutenzione & Memoria WebGL</div>
        <div class="debug-btns-row">
          <button type="button" class="btn debug-btn" data-debug-act="clean-vram">🧹 Pulisci VRAM</button>
          <button type="button" class="btn debug-btn btn-danger" data-debug-act="reset-all">⚠️ Reset Totale</button>
        </div>
      </div>
    `;

    this.root.appendChild(this.panel);

    this.statsEls = {
      fps: this.panel.querySelector('[data-d="fps"]'),
      calls: this.panel.querySelector('[data-d="calls"]'),
      triangles: this.panel.querySelector('[data-d="triangles"]'),
      geometries: this.panel.querySelector('[data-d="geometries"]'),
      textures: this.panel.querySelector('[data-d="textures"]'),
      particles: this.panel.querySelector('[data-d="particles"]'),
      heap: this.panel.querySelector('[data-d="heap"]'),
    };

    this.panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-debug-act]');
      if (!btn) return;
      const act = btn.dataset.debugAct;
      this._handleAction(act);
    });
  }

  _bindKeys() {
    if (typeof window === 'undefined' || !window.addEventListener) return;

    this._onKeyDown = (e) => {
      // Toggle con F2 oppure Backquote / Tilde (~)
      if (e.key === 'F2' || e.code === 'Backquote') {
        e.preventDefault();
        this.toggle();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  _handleAction(act) {
    const dbg = window.DDS_DEBUG;
    if (!dbg) return;

    switch (act) {
      case 'close':
        this.close();
        break;
      case 'add-sand':
        dbg.addSand(50000);
        break;
      case 'comp-99':
        dbg.setCompletion(0.99);
        break;
      case 'max-upgrades':
        dbg.unlockAllUpgrades();
        break;
      case 'add-tablets':
        dbg.addTablets(10);
        break;
      case 'event-storm':
        dbg.triggerEvent('sandstorm');
        break;
      case 'event-merchant':
        dbg.triggerEvent('merchant');
        break;
      case 'end-curse':
        dbg.forceEnding('curse');
        break;
      case 'end-treasure':
        dbg.forceEnding('treasure');
        break;
      case 'end-business':
        dbg.forceEnding('business');
        break;
      case 'end-secret':
        dbg.forceEnding('secret');
        break;
      case 'clean-vram':
        this.scene?.renderer?.renderLists?.dispose?.();
        toast('[DEBUG] Render lists WebGL liberate con successo.');
        break;
      case 'reset-all':
        if (confirm('Azzerare completamente tutti i salvataggi e ricaricare?')) {
          dbg.resetAll(true);
        }
        break;
    }
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.panel?.classList?.remove('hidden');
    this.lastTime = performance.now();
    this.frames = 0;
    this._renderReport();
    this._startLoop();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.panel?.classList?.add('hidden');
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  _startLoop() {
    const loop = () => {
      if (!this.isOpen) return;
      this._updateStats();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  _renderReport() {
    const rep = this.getMemoryReport();
    if (this.statsEls.fps) this.statsEls.fps.textContent = String(rep.fps);
    if (this.statsEls.calls) this.statsEls.calls.textContent = String(rep.drawCalls);
    if (this.statsEls.triangles) this.statsEls.triangles.textContent = String(rep.triangles);
    if (this.statsEls.geometries) this.statsEls.geometries.textContent = String(rep.geometries);
    if (this.statsEls.textures) this.statsEls.textures.textContent = String(rep.textures);
    if (this.statsEls.particles) this.statsEls.particles.textContent = String(rep.activeParticles);
    if (this.statsEls.heap) this.statsEls.heap.textContent = rep.jsHeapMB;
  }

  _updateStats() {
    const now = performance.now();
    this.frames++;
    if (now - this.lastTime >= 400) {
      const computed = (this.frames * 1000) / (now - this.lastTime);
      this.fps = Math.round(Math.min(60, Math.max(1, computed)));
      this.frames = 0;
      this.lastTime = now;
      this._renderReport();
    }
  }

  dispose() {
    this.close();
    if (typeof window !== 'undefined' && window.removeEventListener && this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
    }
    if (this.panel?.parentElement) {
      this.panel.parentElement.removeChild(this.panel);
    }
    this.panel = null;
  }
}
