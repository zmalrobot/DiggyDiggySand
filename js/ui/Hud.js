// HUD di gioco: contatore Sabbia, rateo passivo (+X/s), barra di completamento (obelisco), pulsanti Officina/Menu
// e modulo Georadar di profondità con visualizzazione a scansione sonar e letture criptiche.
import { events } from '../core/Events.js';
import { i18n } from '../core/I18n.js';

const SUFFIXES = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi'];
let activeNotation = 'standard';

export function setGlobalNotation(notation) {
  if (['standard', 'scientific', 'engineering'].includes(notation)) {
    activeNotation = notation;
  }
}

/** Formattazione compatta o scientifica/ingegneristica: 950 -> "950", 1234 -> "1.2k" o "1.23e+3". */
export function formatNumber(n, notation = null) {
  if (!Number.isFinite(n)) return '0';
  n = Math.max(0, n);
  if (n < 1000) return String(Math.floor(n));

  const mode = notation || activeNotation;

  if (mode === 'scientific') {
    return n.toExponential(2);
  }

  if (mode === 'engineering') {
    const exp = Math.floor(Math.log10(n));
    const engExp = Math.floor(exp / 3) * 3;
    const mantissa = n / 10 ** engExp;
    return `${mantissa.toFixed(2)}e${engExp}`;
  }

  // Standard compatto
  let idx = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(n) / 3));
  let scaled = n / 1000 ** idx;
  if (Math.round(scaled * 10) / 10 >= 1000 && idx < SUFFIXES.length - 1) { idx++; scaled = n / 1000 ** idx; }
  const txt = scaled < 100 ? scaled.toFixed(1) : String(Math.floor(scaled));
  return `${txt.replace(/\.0$/, '')}${SUFFIXES[idx]}`;
}

/** Percentuale con due decimali sotto lo 0.1% per mostrare subito il progresso. */
export function formatPercent(fraction) {
  const p = Math.min(100, Math.max(0, fraction * 100));
  if (p > 0 && p < 0.1) return `${p.toFixed(2)}%`;
  return `${p.toFixed(1)}%`;
}

export class Hud {
  constructor(root, { state, economy = null, audio = null }) {
    this.root = root;
    this.state = state;
    this.economy = economy;
    this.audio = audio;
    this.shownSand = state.sand;
    this.targetSand = state.sand;
    this.sps = economy ? economy.sps : 0;

    this._build();
    this._unsubs = [
      events.on('sand:changed', ({ sand, delta }) => {
        this.targetSand = sand;
        if (delta > 0) this._pop();
      }),
      events.on('completion:changed', ({ completion }) => this._setCompletion(completion)),
      events.on('sps:changed', ({ sps }) => this.setSps(sps)),
      events.on('upgrade:bought', ({ id }) => {
        if (id === 'georadar') this.refreshRadar(true);
      }),
      events.on('settings:changed', ({ key, value }) => {
        if (key === 'game.notation' || key === 'notation') {
          setGlobalNotation(value);
          this.refresh();
        }
      }),
      events.on('cheats:enabled', () => this.refresh()),
      events.on('language:changed', () => {
        i18n.updateDOM(this.root);
        this.refreshRadar(false);
      }),
      events.on('event:boost', ({ active, label }) => {
        if (this.el.boost) {
          if (active) {
            this.el.boost.textContent = label;
            this.el.boost.classList.remove('hidden');
          } else {
            this.el.boost.classList.add('hidden');
          }
        }
      }),
    ];
    this.refresh();
  }

  _build() {
    this.root.innerHTML = `
      <!-- 2. Top-Center: Metriche di Progressione -->
      <header id="hud-metrics-center" class="hud-zone hud-top-center">
        <div class="hud-panel hud-metrics-panel hud-top panel" role="status" aria-live="off">
          <div class="hud-currency hud-block hud-sand">
            <span class="currency-label hud-label" data-i18n="hud.sand">${i18n.t('hud.sand')}</span>
            <div class="currency-value-row hud-sand-row">
              <span id="sand-counter" class="currency-amount hud-num" data-el="sand">0</span>
              <span id="sand-rate" class="currency-rate hud-sps muted" data-el="sps">+0/s</span>
            </div>
            <div class="hud-boost-tag hidden accent" data-el="boost"></div>
          </div>
          <div class="hud-divider" aria-hidden="true"></div>
          <div class="hud-progress hud-block">
            <div class="progress-labels hud-progress-head">
              <span class="hud-label" data-i18n="hud.excavation">${i18n.t('hud.excavation')}</span>
              <span id="completion-pct" class="hud-percent" data-el="percent">0.00%</span>
            </div>
            <div class="progress-bar-track obelisk-bar glow" data-el="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <div id="completion-bar" class="progress-bar-fill fill"></div>
            </div>
          </div>
        </div>
      </header>

      <!-- 3. Bottom-Center: Dock Comandi Principale -->
      <nav id="hud-bottom-dock" class="hud-zone hud-bottom-center" aria-label="Comandi di Spedizione">
        <div class="hud-panel hud-dock-panel hud-actions panel">
          <button id="btn-help" class="hud-dock-btn hud-btn hud-help-btn" data-act="help" data-el="help" data-i18n-title="hud.helpTitle" data-i18n-aria-label="hud.helpTitle" title="${i18n.t('hud.helpTitle')}" aria-label="${i18n.t('hud.helpTitle')}">
            <svg class="hud-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span class="hud-dock-btn-text hud-btn-text" data-i18n="hud.help">${i18n.t('hud.help')}</span>
          </button>
          <button id="btn-shop" class="hud-dock-btn hud-dock-btn-primary hud-btn hud-shop-btn" data-act="shop" data-el="shop" data-i18n-title="hud.workshop" data-i18n-aria-label="hud.workshop" title="${i18n.t('hud.workshop')}" aria-label="${i18n.t('hud.workshop')}">
            <svg class="hud-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            <span class="hud-dock-btn-text hud-btn-text" data-i18n="hud.workshop">${i18n.t('hud.workshop')}</span>
          </button>
          <button id="btn-pause" class="hud-dock-btn hud-btn hud-menu-btn" data-act="menu" data-el="menu" data-i18n-title="hud.pauseTitle" data-i18n-aria-label="hud.pauseTitle" title="${i18n.t('hud.pauseTitle')}" aria-label="${i18n.t('hud.pauseTitle')}">
            <svg class="hud-btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span class="hud-dock-btn-text hud-btn-text" data-i18n="hud.pause">${i18n.t('hud.pause')}</span>
          </button>
        </div>
      </nav>

      <!-- 4. Bottom-Right: Simbolo/Sigillo Trucchi -->
      <div id="hud-cheats-zone" class="hud-zone hud-bottom-right">
        <button id="btn-cheats-toggle" class="cheats-sigil-btn" data-el="cheatsToggle" data-act="cheats" title="${i18n.t('settings.tabCheats') || 'Trucchi / Sandbox'}" aria-label="Trucchi">
          <!-- Icona vettoriale stilizzata: chiave inglese, sigillo spezzato o glifo d'avviso -->
          <svg viewBox="0 0 24 24" class="cheats-sigil-icon" width="22" height="22" aria-hidden="true">
            <path d="M12 2L2 22h20L12 2zm0 4.2L18.8 19H5.2L12 6.2zm-1 5.8h2v4h-2zm0 5h2v2h-2z" fill="currentColor"/>
          </svg>
          <span class="cheats-pulse-ring" aria-hidden="true"></span>
        </button>
        <div class="hud-cheats-badge hidden" data-el="cheatsBadge" data-i18n-title="hud.cheatsActive" data-i18n-aria-label="hud.cheatsActive" title="${i18n.t('hud.cheatsActive')}" aria-label="${i18n.t('hud.cheatsActive')}">
          <span class="cheats-icon">🛠️</span>
          <span class="cheats-tag" data-i18n="hud.cheatsTag">${i18n.t('hud.cheatsTag')}</span>
        </div>
      </div>

      <!-- Modulo Georadar di profondità -->
      <div class="hud-radar-wrap hidden" data-el="radar">
        <div class="hud-radar-card panel surface glow-teal">
          <div class="radar-scope">
            <div class="radar-sweep"></div>
            <div class="radar-crosshair"></div>
            <div class="radar-blip"></div>
          </div>
          <div class="radar-info">
            <div class="radar-head">
              <span class="radar-title" data-i18n="hud.radarTitle">${i18n.t('hud.radarTitle')}</span>
              <span class="radar-status accent" data-i18n="hud.radarActive">${i18n.t('hud.radarActive')}</span>
            </div>
            <div class="radar-reading muted" data-el="radarReading" data-i18n="hud.radarScanning">${i18n.t('hud.radarScanning')}</div>
          </div>
        </div>
      </div>`;

    this.el = {
      sand: this.root.querySelector('[data-el="sand"]'),
      sps: this.root.querySelector('[data-el="sps"]'),
      percent: this.root.querySelector('[data-el="percent"]'),
      bar: this.root.querySelector('[data-el="bar"]'),
      help: this.root.querySelector('[data-el="help"]'),
      shop: this.root.querySelector('[data-el="shop"]'),
      menu: this.root.querySelector('[data-el="menu"]'),
      radar: this.root.querySelector('[data-el="radar"]'),
      radarReading: this.root.querySelector('[data-el="radarReading"]'),
      boost: this.root.querySelector('[data-el="boost"]'),
      cheatsBadge: this.root.querySelector('[data-el="cheatsBadge"]'),
      cheatsToggle: this.root.querySelector('[data-el="cheatsToggle"]'),
    };

    this.el.help?.addEventListener('click', () => events.emit('hud:help'));
    this.el.shop?.addEventListener('click', () => events.emit('hud:shop'));
    this.el.menu?.addEventListener('click', () => events.emit('hud:menu'));
    this.el.cheatsToggle?.addEventListener('click', () => events.emit('hud:cheats'));
  }

  show() { this.root.classList.remove('hidden'); this.refresh(); }
  hide() { this.root.classList.add('hidden'); }

  setSps(sps) {
    this.sps = sps;
    if (this.el.sps) {
      this.el.sps.textContent = sps > 0 ? `+${formatNumber(sps)}/s` : '+0/s';
      this.el.sps.classList.toggle('active', sps > 0);
    }
  }

  setRadarReading(text) {
    if (this.el.radarReading && text) {
      this.el.radarReading.textContent = text;
    }
  }

  refreshRadar(justBought = false) {
    const hasRadar = (this.state.upgrades.georadar ?? 0) >= 1;
    if (hasRadar) {
      this.el.radar.classList.remove('hidden');
      if (justBought) {
        this.audio?.playRadarPing?.();
      }
    } else {
      this.el.radar.classList.add('hidden');
    }
  }

  refresh() {
    this.shownSand = this.targetSand = this.state.sand;
    this.el.sand.textContent = formatNumber(this.shownSand);
    this._setCompletion(this.state.completion);
    if (this.economy) this.setSps(this.economy.sps);
    this.refreshRadar();
    const cheatsActive = !!this.state.cheatsEnabled;
    if (this.el.cheatsToggle) {
      this.el.cheatsToggle.classList.toggle('cheats-active', cheatsActive);
      this.el.cheatsToggle.classList.toggle('is-active', cheatsActive);
      if (cheatsActive) {
        this.el.cheatsToggle.setAttribute('title', i18n.t('settings.cheats.hudBadge') || 'Trucchi attivi — Obiettivi bloccati');
      } else {
        this.el.cheatsToggle.setAttribute('title', i18n.t('settings.tabCheats') || 'Trucchi / Sandbox');
      }
    }
    if (this.el.cheatsBadge) {
      this.el.cheatsBadge.classList.toggle('hidden', !cheatsActive);
    }
  }

  _setCompletion(c) {
    const p = Math.min(100, Math.max(0, c * 100));
    this.el.percent.textContent = formatPercent(c);
    this.el.bar.style.setProperty('--p', p.toFixed(3));
    this.el.bar.setAttribute('aria-valuenow', p.toFixed(1));
  }

  _pop() {
    const n = this.el.sand;
    n.classList.remove('pop');
    void n.offsetWidth;
    n.classList.add('pop');
  }

  update(dt) {
    if (this.shownSand === this.targetSand) return;
    const diff = this.targetSand - this.shownSand;
    const step = diff * Math.min(1, dt * 12);
    this.shownSand = Math.abs(diff) < 0.05 ? this.targetSand : this.shownSand + step;
    this.el.sand.textContent = formatNumber(this.shownSand);
  }

  dispose() { this._unsubs.forEach((u) => u()); }
}
