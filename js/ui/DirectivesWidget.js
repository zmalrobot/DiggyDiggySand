// Widget HUD compatto retrattile per le Direttive di Spedizione.
// Mostra la barra di avanzamento del contratto attivo, countdown e badge ricompensa.
import { events } from '../core/Events.js';
import { i18n } from '../core/I18n.js';
import { formatNumber } from './Hud.js';

export class DirectivesWidget {
  /**
   * @param {HTMLElement} root
   * @param {import('../systems/Directives.js').DirectivesManager} directivesMgr
   */
  constructor(root, directivesMgr) {
    this.root = root;
    this.mgr = directivesMgr;
    this.isCollapsed = false;
    this.el = null;

    this._build();
    this._bind();
  }

  _build() {
    if (!this.root) return;
    this.root.className = 'directives-widget-container';
    this.root.innerHTML = `
      <aside class="panel directives-card" role="region" aria-label="${i18n.t('directives.widgetTitle') || 'Direttive di Spedizione'}">
        <button type="button" class="btn btn-pill directives-toggle-btn" data-act="toggle" title="Minimizza / Espandi" aria-label="Minimizza / Espandi">‹</button>
        <div class="directives-body">
          <header class="directives-header">
            <span class="directives-badge">📜 ${i18n.t('directives.contractBadge') || 'CONTRATTO ATTIVO'}</span>
            <span class="directives-timer hidden" data-el="timer"></span>
          </header>
          <h4 class="directives-title" data-el="title">${i18n.t('directives.noDirective') || 'In attesa di nuovi contratti...'}</h4>
          <div class="directives-progress-wrap">
            <div class="directives-progress-info">
              <span class="directives-progress-text" data-el="progressText">0 / 0</span>
              <span class="directives-reward-badge" data-el="rewardBadge"></span>
            </div>
            <div class="directives-bar-track">
              <div class="directives-bar-fill glow-teal" data-el="bar"></div>
            </div>
          </div>
        </div>
      </aside>
    `;

    this.card = this.root.querySelector('.directives-card');
    this.toggleBtn = this.root.querySelector('[data-act="toggle"]');
    this.timerEl = this.root.querySelector('[data-el="timer"]');
    this.titleEl = this.root.querySelector('[data-el="title"]');
    this.progressTextEl = this.root.querySelector('[data-el="progressText"]');
    this.rewardBadgeEl = this.root.querySelector('[data-el="rewardBadge"]');
    this.barEl = this.root.querySelector('[data-el="bar"]');

    this.toggleBtn?.addEventListener('click', () => {
      this.isCollapsed = !this.isCollapsed;
      this.card.classList.toggle('collapsed', this.isCollapsed);
      this.toggleBtn.textContent = this.isCollapsed ? '›' : '‹';
    });
  }

  show() {
    this.root?.classList?.remove('hidden');
    if (this.mgr?.activeDirective) this.render(this.mgr.activeDirective);
  }

  hide() {
    this.root?.classList?.add('hidden');
  }

  _bind() {
    events.on('directive:generated', (d) => this.render(d));
    events.on('directive:progress', (p) => this.updateProgress(p));
    events.on('directive:completed', (d) => this.onCompleted(d));
    events.on('directive:failed', () => this.onFailed());
    events.on('language:changed', () => {
      if (this.mgr?.activeDirective) {
        this.render(this.mgr.activeDirective);
      }
    });

    if (this.mgr?.activeDirective) {
      this.render(this.mgr.activeDirective);
    }
  }

  render(d) {
    if (!this.titleEl || !d) return;

    this.titleEl.textContent = i18n.t(d.titleKey, d.descParams) || d.title;
    this.updateProgress({
      current: d.current,
      target: d.target,
      pct: Math.min(100, (d.current / d.target) * 100),
    });

    if (this.rewardBadgeEl && d.reward) {
      this.rewardBadgeEl.textContent = d.reward.label;
      this.rewardBadgeEl.className = `directives-reward-badge reward-${d.reward.type}`;
    }

    if (this.timerEl) {
      if (d.timeLimit) {
        this.timerEl.textContent = `⏱️ ${Math.ceil(d.timeLeft)}s`;
        this.timerEl.classList.remove('hidden');
      } else {
        this.timerEl.classList.add('hidden');
      }
    }

    this.card?.classList.remove('completed', 'failed');
  }

  updateProgress({ current, target, pct }) {
    if (this.progressTextEl) {
      const curTxt = typeof current === 'number' && current > 100 ? formatNumber(current) : Math.floor(current);
      const tarTxt = typeof target === 'number' && target > 100 ? formatNumber(target) : target;
      this.progressTextEl.textContent = `${curTxt} / ${tarTxt}`;
    }
    if (this.barEl) {
      this.barEl.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    }
  }

  onCompleted(d) {
    this.card?.classList.add('completed');
    if (this.titleEl) {
      this.titleEl.textContent = `✓ ${i18n.t('directives.completed') || 'Completato!'}`;
    }
    if (this.barEl) {
      this.barEl.style.width = '100%';
    }
  }

  onFailed() {
    this.card?.classList.add('failed');
    if (this.titleEl) {
      this.titleEl.textContent = `✗ ${i18n.t('directives.failed') || 'Contratto Scaduto'}`;
    }
  }

  /** Chiamato ad ogni tick frame per aggiornare il timer a schermo */
  update() {
    if (!this.timerEl || !this.mgr?.activeDirective) return;
    const d = this.mgr.activeDirective;
    if (d.timeLimit && d.timeLeft !== null && !d.completed && !d.failed) {
      this.timerEl.textContent = `⏱️ ${Math.ceil(d.timeLeft)}s`;
      if (d.timeLeft < 10) {
        this.timerEl.classList.add('urgent');
      }
    }
  }
}
