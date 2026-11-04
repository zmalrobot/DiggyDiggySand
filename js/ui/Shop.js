// Interfaccia Negozio Upgrade / Officina: cassetto scorrevole a tema Atlantean-Kemet,
// schede per rami Manuale / Flotta, selettore Multi-Buy (1x/10x/100x/MAX), costi cumulativi geometrici e pulsanti glow.
import { events } from '../core/Events.js';
import {
  UPGRADE_CATALOG,
  BRANCHES,
  getUpgradeCost,
  getMultiUpgradeCost,
  getMaxAffordableLevels,
  buyMultiUpgrade,
  getUpgradeName,
  getUpgradeDesc,
} from '../systems/Upgrades.js';
import { formatNumber } from './Hud.js';
import { i18n } from '../core/I18n.js';

export class Shop {
  constructor(root, { state, audio }) {
    this.root = root;
    this.state = state;
    this.audio = audio;
    this.activeTab = 'manual';
    this.multiBuy = 1; // 1 | 10 | 100 | 'MAX'
    this.isOpen = false;

    this._build();
    this._unsubs = [
      events.on('sand:changed', () => this.updateAffordability()),
      events.on('upgrade:bought', () => this.render()),
      events.on('hud:shop', () => this.toggle()),
      events.on('language:changed', () => this.refresh()),
    ];

    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) this.close();
      });
    }
  }

  _build() {
    this.root.className = 'shop-container';
    this.root.innerHTML = `
      <div class="shop-backdrop"></div>
      <aside id="shop-drawer" class="panel shop-drawer" role="dialog" aria-label="${i18n.t('shop.title') || 'Officina degli Scavi'}">
        <div class="shop-drag-handle" aria-hidden="true"></div>
        <div class="shop-header">
          <div class="shop-title-wrap">
            <h2 class="shop-title" data-i18n="shop.title">${i18n.t('shop.title') || 'Officina delle Dune'}</h2>
            <div class="shop-subtitle muted" data-i18n="shop.subtitle">${i18n.t('shop.subtitle') || 'Forgia la tecnologia e comanda la flotta'}</div>
          </div>
          <button type="button" class="btn shop-close-btn" data-act="close" data-i18n-title="common.close" data-i18n-aria-label="common.close" title="${i18n.t('common.close') || 'Chiudi'}" aria-label="${i18n.t('common.close') || 'Chiudi'}">&times;</button>
        </div>

        <div class="shop-tabs tabs" role="tablist">
          <button type="button" class="tab active" data-tab="manual" data-i18n="shop.tabs.manual">${i18n.t('shop.tabs.manual') || 'Attrezzi Manuali'}</button>
          <button type="button" class="tab" data-tab="fleet" data-i18n="shop.tabs.fleet">${i18n.t('shop.tabs.fleet') || 'Flotta Autonoma'}</button>
          <button type="button" class="tab" data-tab="relics" data-i18n="shop.tabs.relics">${i18n.t('shop.tabs.relics') || 'Reliquie'}</button>
        </div>

        <div class="shop-multibuy-bar" role="group" aria-label="Quantità acquisto">
          <span class="multibuy-label muted">Acquisto:</span>
          <div class="multibuy-group">
            <button type="button" class="btn btn-pill multibuy-btn active" data-multibuy="1">1×</button>
            <button type="button" class="btn btn-pill multibuy-btn" data-multibuy="10">10×</button>
            <button type="button" class="btn btn-pill multibuy-btn" data-multibuy="100">100×</button>
            <button type="button" class="btn btn-pill multibuy-btn" data-multibuy="MAX">MAX</button>
          </div>
        </div>

        <div class="shop-content" data-el="content">
          <!-- Carte degli upgrade -->
        </div>
      </aside>`;

    this.backdrop = this.root.querySelector('.shop-backdrop');
    this.drawer = this.root.querySelector('.shop-drawer');
    this.content = this.root.querySelector('[data-el="content"]');
    this.tabs = this.root.querySelectorAll('.tab');
    this.multibuyBtns = this.root.querySelectorAll('[data-multibuy]');

    this.backdrop.addEventListener('click', () => this.close());
    this.root.querySelector('[data-act="close"]').addEventListener('click', () => this.close());

    this.tabs.forEach((t) => {
      t.addEventListener('click', () => {
        this.tabs.forEach((b) => b.classList.toggle('active', b === t));
        this.activeTab = t.dataset.tab;
        this.render();
      });
    });

    this.multibuyBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.multibuy;
        this.multiBuy = val === 'MAX' ? 'MAX' : Number(val);
        this.multibuyBtns.forEach((b) => b.classList.toggle('active', b === btn));
        this.render();
      });
    });

    this.content.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-buy]');
      if (!btn || btn.disabled) return;
      const id = btn.dataset.buy;
      buyMultiUpgrade(id, this.multiBuy, this.state, this.audio);
    });

    // Supporto Touch Swipe-down per chiusura Bottom Sheet su Tablet Portrait e Smartphone
    let touchStartY = 0;
    let touchCurrentY = 0;
    let isSwiping = false;

    this.drawer.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        touchCurrentY = touchStartY;
        if ((this.content && this.content.scrollTop <= 5) || e.target.closest?.('.shop-header, .shop-drag-handle')) {
          isSwiping = true;
        }
      }
    }, { passive: true });

    this.drawer.addEventListener('touchmove', (e) => {
      if (!isSwiping || !e.touches || e.touches.length !== 1) return;
      touchCurrentY = e.touches[0].clientY;
    }, { passive: true });

    this.drawer.addEventListener('touchend', () => {
      if (!isSwiping) return;
      isSwiping = false;
      const diffY = touchCurrentY - touchStartY;
      if (diffY > 60) {
        this.close();
      }
    }, { passive: true });

    this.render();
    this.close(true);
  }

  open() {
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.root.classList.add('open', 'is-open');
    if (this.drawer) {
      this.drawer.classList.add('is-open', 'active');
    }
    try {
      this.render();
    } catch (e) {
      console.error('[Shop] Error during render:', e);
    }
  }

  close(instant = false) {
    this.isOpen = false;
    this.root.classList.remove('open', 'is-open');
    if (this.drawer) {
      this.drawer.classList.remove('is-open', 'active');
    }
    if (instant) {
      this.root.classList.add('hidden');
    } else {
      setTimeout(() => {
        if (!this.isOpen) this.root.classList.add('hidden');
      }, 300);
    }
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  render() {
    i18n.updateDOM(this.root);
    const list = Object.values(UPGRADE_CATALOG).filter((u) => u.branch === this.activeTab);
    this.content.innerHTML = list.map((def) => this._renderCard(def)).join('');
    this.updateAffordability();
  }

  refresh() {
    this.render();
  }

  _calculateBuyInfo(def) {
    const lvl = this.state.upgrades[def.id] ?? 0;
    const isMax = lvl >= def.maxLevel;
    const discount = this.state?.costDiscount ?? 0;
    const completion = this.state?.completion ?? 0;
    const isLocked = !!(def.minCompletion && completion < def.minCompletion);
    const lockReq = def.minCompletion ? Math.round(def.minCompletion * 100) : 0;

    if (isLocked) {
      const singleCost = getUpgradeCost(def, lvl, discount);
      return { lvl, isMax: false, isLocked: true, lockReq, count: 0, cost: singleCost, canAfford: false };
    }

    if (isMax) {
      return { lvl, isMax: true, isLocked: false, lockReq, count: 0, cost: Infinity, canAfford: false };
    }

    if (this.multiBuy === 'MAX') {
      const maxInfo = getMaxAffordableLevels(def, lvl, this.state.sand, discount);
      if (maxInfo.count > 0) {
        return {
          lvl,
          isMax: false,
          isLocked: false,
          lockReq,
          count: maxInfo.count,
          cost: maxInfo.cost,
          canAfford: true,
        };
      }
      // Non può comprarne nessuno: mostra il costo di 1 per riferimento
      const singleCost = getUpgradeCost(def, lvl, discount);
      return {
        lvl,
        isMax: false,
        isLocked: false,
        lockReq,
        count: 1,
        cost: singleCost,
        canAfford: false,
      };
    }

    const requested = Number(this.multiBuy) || 1;
    const count = Math.min(requested, def.maxLevel - lvl);
    const cost = getMultiUpgradeCost(def, lvl, count, discount);
    const canAfford = this.state.sand >= cost && count > 0;

    return { lvl, isMax: false, isLocked: false, lockReq, count, cost, canAfford };
  }

  _renderCard(def) {
    const info = this._calculateBuyInfo(def);
    const name = getUpgradeName(def);
    const desc = getUpgradeDesc(def);
    const benefit = def.getBenefit(info.lvl);
    const maxText = i18n.t('shop.maxLevel') || 'MAX';
    const completedText = i18n.t('shop.maxedAction') || 'Completato';

    let actionLabel = '';
    if (info.isLocked) {
      actionLabel = `🔒 ${info.lockReq}%`;
    } else if (info.isMax) {
      actionLabel = completedText;
    } else if (this.multiBuy === 'MAX') {
      actionLabel = info.canAfford ? `+${info.count} MAX` : `+1 MAX`;
    } else if (info.count > 1) {
      actionLabel = `+${info.count}`;
    } else {
      actionLabel = `+1`;
    }

    return `
      <div class="panel surface upgrade-card ${info.isMax ? 'maxed' : ''} ${info.isLocked ? 'locked' : ''}" data-card="${def.id}">
        <div class="upgrade-card-head">
          <span class="upgrade-name">${name}</span>
          <span class="upgrade-level num">Lv. ${info.lvl}${info.isMax ? ` (${maxText})` : ` / ${def.maxLevel}`}</span>
        </div>
        <p class="upgrade-desc muted">${desc}</p>
        ${info.isLocked ? `<div class="upgrade-lock-note muted" style="color: var(--color-gold-deep); font-size: 0.78rem; margin: 4px 0;">🔒 Richiede ${info.lockReq}% di completamento scavo</div>` : ''}
        <div class="upgrade-benefit accent">${benefit}</div>
        <div class="upgrade-card-foot">
          <button type="button" class="btn btn-buy ${info.canAfford ? 'glow' : ''}" data-buy="${def.id}" ${info.canAfford ? '' : 'disabled'}>
            <span class="buy-action">${actionLabel}</span>
            ${info.isMax ? '' : `<span class="buy-cost num">${formatNumber(info.cost)} ⟡</span>`}
          </button>
        </div>
      </div>`;
  }

  updateAffordability() {
    if (!this.isOpen) return;
    const cards = this.content.querySelectorAll('[data-card]');
    cards.forEach((card) => {
      const id = card.dataset.card;
      const def = UPGRADE_CATALOG[id];
      if (!def) return;
      const info = this._calculateBuyInfo(def);

      const btn = card.querySelector('[data-buy]');
      if (btn) {
        btn.disabled = !info.canAfford;
        btn.classList.toggle('glow', info.canAfford);

        // Se siamo in modalità MAX, aggiorna dinamicamente anche la label del conteggio e costo
        if (this.multiBuy === 'MAX' && !info.isMax) {
          const actionSpan = btn.querySelector('.buy-action');
          const costSpan = btn.querySelector('.buy-cost');
          if (actionSpan) actionSpan.textContent = info.canAfford ? `+${info.count} MAX` : `+1 MAX`;
          if (costSpan) costSpan.textContent = `${formatNumber(info.cost)} ⟡`;
        }
      }
    });
  }

  update() {
    this.updateAffordability();
  }

  dispose() {
    this._unsubs.forEach((u) => u());
  }
}

