// Overlay di vittoria / epilogo finale a schermo intero (Stile Atlantean-Kemet, Art Bible §2, §6).
import { formatNumber } from './Hud.js';

export class Overlay {
  constructor(root = document.body) {
    this.root = root;
    this.el = null;
    this._build();
  }

  _build() {
    this.el = document.createElement('div');
    this.el.className = 'overlay-screen hidden';
    this.root.appendChild(this.el);
  }

  /**
   * Mostra la schermata dell'epilogo con statistiche e azioni.
   */
  show(data) {
    const {
      endingId = 'curse',
      title = 'Fine della Spedizione',
      badge = '✦',
      subtitle = '',
      text = '',
      stats = {},
      extra = null,
      onRestart = null,
      onMenu = null,
      onSandbox = null,
    } = data;

    const mins = Math.floor((stats.timeSeconds ?? 0) / 60);
    const secs = (stats.timeSeconds ?? 0) % 60;
    const timeFormatted = `${mins}m ${secs.toString().padStart(2, '0')}s`;
    const sandFormatted = formatNumber(stats.sandTotal ?? 0);
    const clicksFormatted = formatNumber(stats.clicks ?? 0);
    const compFormatted = `${Math.min(100, Math.floor((stats.completion ?? 1) * 100))}%`;

    this.el.innerHTML = `
      <div class="overlay-card panel ending-${endingId}">
        <div class="epilogue-badge">${badge}</div>
        <h1 class="display epilogue-title">${title}</h1>
        <div class="epilogue-sub accent">${subtitle}</div>
        <p class="epilogue-narrative">${text}</p>

        <div class="stats-grid">
          <div class="stat-box">
            <span class="stat-label">Tempo Spedizione</span>
            <span class="stat-val">${timeFormatted}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Sabbia Estratta</span>
            <span class="stat-val accent">${sandFormatted}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Colpi di Pala</span>
            <span class="stat-val">${clicksFormatted}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Completamento</span>
            <span class="stat-val highlight">${compFormatted}</span>
          </div>
        </div>

        ${
          extra
            ? `<div class="extra-stat-banner">
                 <span class="stat-label">${extra.label}:</span>
                 <span class="stat-val-highlight">${extra.value}</span>
               </div>`
            : ''
        }

        <div class="overlay-actions">
          ${
            onSandbox
              ? `<button type="button" class="btn btn-sandbox" data-action="sandbox">Continua in Sandbox</button>`
              : ''
          }
          <button type="button" class="btn" data-action="restart">Nuova Spedizione</button>
          <button type="button" class="btn btn-secondary" data-action="menu">Torna al Menu</button>
        </div>
      </div>
    `;

    this.el.onclick = (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const act = btn.dataset.action;
      if (act === 'restart') {
        this.hide();
        onRestart?.();
      } else if (act === 'menu') {
        this.hide();
        onMenu?.();
      } else if (act === 'sandbox') {
        this.hide();
        onSandbox?.();
      }
    };

    this.el.classList.remove('hidden');
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  hide() {
    this.el.classList.remove('visible');
    setTimeout(() => this.el.classList.add('hidden'), 350);
  }

  dispose() {
    if (this.el?.parentElement) {
      this.el.parentElement.removeChild(this.el);
    }
  }
}
