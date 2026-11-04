// Overlay di vittoria / epilogo finale a schermo intero (Stile Atlantean-Kemet, Art Bible §2, §6).
import { formatNumber } from './Hud.js';
import { i18n } from '../core/I18n.js';
import { events } from '../core/Events.js';

export class Overlay {
  constructor(root = document.body) {
    this.root = root;
    this.el = null;
    this._lastData = null;
    this._build();

    events.on('language:changed', () => {
      if (this.el && !this.el.classList.contains('hidden') && this._lastData) {
        this.show(this._lastData);
      }
    });
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
    this._lastData = data;
    const {
      endingId = 'curse',
      badge = '✦',
      stats = {},
      extra = null,
      onRestart = null,
      onMenu = null,
      onSandbox = null,
    } = data;

    const title = i18n.t(`endings.${endingId}.title`) || data.title || 'Fine della Spedizione';
    const subtitle = i18n.t(`endings.${endingId}.subtitle`) || data.subtitle || '';
    const text = i18n.t(`endings.${endingId}.text`) || data.text || '';

    const mins = Math.floor((stats.timeSeconds ?? 0) / 60);
    const secs = (stats.timeSeconds ?? 0) % 60;
    const timeFormatted = `${mins}m ${secs.toString().padStart(2, '0')}s`;
    const sandFormatted = formatNumber(stats.sandTotal ?? 0);
    const clicksFormatted = formatNumber(stats.clicks ?? 0);
    const compFormatted = `${Math.min(100, Math.floor((stats.completion ?? 1) * 100))}%`;

    const timeLabel = i18n.t('endings.stats.time') || 'Tempo Spedizione';
    const sandLabel = i18n.t('endings.stats.sand') || 'Sabbia Estratta';
    const clicksLabel = i18n.t('endings.stats.clicks') || 'Colpi di Pala';
    const tabletsLabel = i18n.t('endings.stats.tablets') || 'Tavolette Antiche';

    const extraLabel = extra ? (i18n.t('endings.business.extraLabel') || extra.label) : '';

    this.el.innerHTML = `
      <div class="overlay-card panel ending-${endingId}">
        <div class="epilogue-badge">${badge}</div>
        <h1 class="display epilogue-title">${title}</h1>
        <div class="epilogue-sub accent">${subtitle}</div>
        <p class="epilogue-narrative">${text}</p>

        <div class="stats-grid">
          <div class="stat-box">
            <span class="stat-label" data-i18n="endings.stats.time">${timeLabel}</span>
            <span class="stat-val">${timeFormatted}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label" data-i18n="endings.stats.sand">${sandLabel}</span>
            <span class="stat-val accent">${sandFormatted}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label" data-i18n="endings.stats.clicks">${clicksLabel}</span>
            <span class="stat-val">${clicksFormatted}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label" data-i18n="endings.stats.tablets">${tabletsLabel}</span>
            <span class="stat-val highlight">τ +${stats.tabletsEarned ?? 5}</span>
          </div>
        </div>

        ${
          extra
            ? `<div class="extra-stat-banner">
                 <span class="stat-label">${extraLabel}:</span>
                 <span class="stat-val-highlight">${extra.value}</span>
               </div>`
            : ''
        }

        <div class="overlay-actions">
          ${
            onSandbox
              ? `<button type="button" class="btn btn-sandbox" data-action="sandbox" data-i18n="endings.buttons.sandbox">${i18n.t('endings.buttons.sandbox') || 'Continua in Sandbox'}</button>`
              : ''
          }
          <button type="button" class="btn" data-action="restart" data-i18n="endings.buttons.newGame">${i18n.t('endings.buttons.newGame') || 'Nuova Spedizione'}</button>
          <button type="button" class="btn btn-secondary" data-action="menu" data-i18n="endings.buttons.menu">${i18n.t('endings.buttons.menu') || 'Torna al Menu'}</button>
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
