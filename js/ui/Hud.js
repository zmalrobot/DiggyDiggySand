// HUD di gioco: contatore Sabbia, rateo passivo (+X/s), barra di completamento (obelisco), pulsanti Officina/Menu
// e modulo Georadar di profondità con visualizzazione a scansione sonar e letture criptiche.
import { events } from '../core/Events.js';

const SUFFIXES = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi'];

/** Formattazione compatta: 950 -> "950", 1234 -> "1.2k", 1.5e6 -> "1.5M". */
export function formatNumber(n) {
  if (!Number.isFinite(n)) return '0';
  n = Math.max(0, n);
  if (n < 1000) return String(Math.floor(n));
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
    ];
    this.refresh();
  }

  _build() {
    this.root.innerHTML = `
      <div class="hud-top panel" role="status" aria-live="off">
        <div class="hud-block hud-sand">
          <span class="hud-label">Sabbia</span>
          <div class="hud-sand-row">
            <span class="hud-num" data-el="sand">0</span>
            <span class="hud-sps muted" data-el="sps">+0/s</span>
          </div>
        </div>
        <div class="hud-block hud-progress">
          <div class="hud-progress-head">
            <span class="hud-label">Deserto scavato</span>
            <span class="hud-percent" data-el="percent">0.0%</span>
          </div>
          <div class="obelisk-bar glow" data-el="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="fill"></div></div>
        </div>
        <div class="hud-actions">
          <button type="button" class="btn hud-btn hud-shop-btn" data-el="shop">Officina</button>
          <button type="button" class="btn hud-btn hud-menu-btn" data-el="menu">Menu</button>
        </div>
      </div>

      <div class="hud-radar-wrap hidden" data-el="radar">
        <div class="hud-radar-card panel surface glow-teal">
          <div class="radar-scope">
            <div class="radar-sweep"></div>
            <div class="radar-crosshair"></div>
            <div class="radar-blip"></div>
          </div>
          <div class="radar-info">
            <div class="radar-head">
              <span class="radar-title">Georadar</span>
              <span class="radar-status accent">ATTIVO</span>
            </div>
            <div class="radar-reading muted" data-el="radarReading">Scansione in corso...</div>
          </div>
        </div>
      </div>`;

    this.el = {
      sand: this.root.querySelector('[data-el="sand"]'),
      sps: this.root.querySelector('[data-el="sps"]'),
      percent: this.root.querySelector('[data-el="percent"]'),
      bar: this.root.querySelector('[data-el="bar"]'),
      shop: this.root.querySelector('[data-el="shop"]'),
      menu: this.root.querySelector('[data-el="menu"]'),
      radar: this.root.querySelector('[data-el="radar"]'),
      radarReading: this.root.querySelector('[data-el="radarReading"]'),
    };

    this.el.shop.addEventListener('click', () => events.emit('hud:shop'));
    this.el.menu.addEventListener('click', () => events.emit('hud:menu'));
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
