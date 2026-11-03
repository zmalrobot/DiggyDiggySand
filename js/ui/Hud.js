// HUD di gioco: contatore Sabbia, barra di completamento (obelisco orizzontale) e pulsante Menu.
import { events } from '../core/Events.js';

const SUFFIXES = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi'];

/** Formattazione compatta: 950 -> "950", 1234 -> "1.2k", 1.5e6 -> "1.5M". */
export function formatNumber(n) {
  if (!Number.isFinite(n)) return '0';
  n = Math.max(0, n);
  if (n < 1000) return String(Math.floor(n));
  let idx = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(n) / 3));
  let scaled = n / 1000 ** idx;
  // Evita "1000k": se l'arrotondamento sale a 1000, passa al suffisso successivo.
  if (Math.round(scaled * 10) / 10 >= 1000 && idx < SUFFIXES.length - 1) { idx++; scaled = n / 1000 ** idx; }
  const txt = scaled < 100 ? scaled.toFixed(1) : String(Math.floor(scaled));
  return `${txt.replace(/\.0$/, '')}${SUFFIXES[idx]}`;
}

/** Percentuale con più precisione quando i valori sono minuscoli, così il progresso si vede subito. */
export function formatPercent(fraction) {
  const p = Math.min(100, Math.max(0, fraction * 100));
  if (p > 0 && p < 0.1) return `${p.toFixed(2)}%`;
  return `${p.toFixed(1)}%`;
}

export class Hud {
  constructor(root, { state }) {
    this.root = root;
    this.state = state;
    this.shownSand = state.sand;
    this.targetSand = state.sand;
    this._build();
    this._unsubs = [
      events.on('sand:changed', ({ sand, delta }) => {
        this.targetSand = sand;
        if (delta > 0) this._pop();
      }),
      events.on('completion:changed', ({ completion }) => this._setCompletion(completion)),
    ];
    this.refresh();
  }

  _build() {
    this.root.innerHTML = `
      <div class="hud-top panel" role="status" aria-live="off">
        <div class="hud-block hud-sand">
          <span class="hud-label">Sabbia</span>
          <span class="hud-num" data-el="sand">0</span>
        </div>
        <div class="hud-block hud-progress">
          <div class="hud-progress-head">
            <span class="hud-label">Deserto scavato</span>
            <span class="hud-percent" data-el="percent">0.0%</span>
          </div>
          <div class="obelisk-bar glow" data-el="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="fill"></div></div>
        </div>
        <button type="button" class="btn hud-menu-btn" data-el="menu">Menu / Opzioni</button>
      </div>`;
    this.el = {
      sand: this.root.querySelector('[data-el="sand"]'),
      percent: this.root.querySelector('[data-el="percent"]'),
      bar: this.root.querySelector('[data-el="bar"]'),
      menu: this.root.querySelector('[data-el="menu"]'),
    };
    this.el.menu.addEventListener('click', () => events.emit('hud:menu'));
  }

  show() { this.root.classList.remove('hidden'); this.refresh(); }
  hide() { this.root.classList.add('hidden'); }

  /** Riallinea l'HUD allo stato (nuova partita o caricamento). */
  refresh() {
    this.shownSand = this.targetSand = this.state.sand;
    this.el.sand.textContent = formatNumber(this.shownSand);
    this._setCompletion(this.state.completion);
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
    void n.offsetWidth; // riavvia l'animazione
    n.classList.add('pop');
  }

  /** Conteggio fluido verso il valore reale (solo cosmetico: lo stato è già aggiornato). */
  update(dt) {
    if (this.shownSand === this.targetSand) return;
    const diff = this.targetSand - this.shownSand;
    const step = diff * Math.min(1, dt * 12);
    this.shownSand = Math.abs(diff) < 0.05 ? this.targetSand : this.shownSand + step;
    this.el.sand.textContent = formatNumber(this.shownSand);
  }

  dispose() { this._unsubs.forEach((u) => u()); }
}

