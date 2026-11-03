// Interfaccia Negozio Upgrade / Officina: cassetto scorrevole a tema Atlantean-Kemet,
// schede per rami Manuale / Flotta, costi dinamici e pulsanti con bagliore dorato.
import { events } from '../core/Events.js';
import { UPGRADE_CATALOG, BRANCHES, getUpgradeCost, buyUpgrade } from '../systems/Upgrades.js';
import { formatNumber } from './Hud.js';

export class Shop {
  constructor(root, { state, audio }) {
    this.root = root;
    this.state = state;
    this.audio = audio;
    this.activeTab = 'manual';
    this.isOpen = false;

    this._build();
    this._unsubs = [
      events.on('sand:changed', () => this.updateAffordability()),
      events.on('upgrade:bought', () => this.render()),
      events.on('hud:shop', () => this.toggle()),
    ];

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  _build() {
    this.root.className = 'shop-container';
    this.root.innerHTML = `
      <div class="shop-backdrop"></div>
      <aside class="panel shop-drawer" role="dialog" aria-label="Officina degli Scavi">
        <div class="shop-header">
          <div class="shop-title-wrap">
            <h2 class="shop-title">Officina delle Dune</h2>
            <div class="shop-subtitle muted">Forgia la tecnologia e comanda la flotta</div>
          </div>
          <button type="button" class="btn shop-close-btn" data-act="close" title="Chiudi Officina" aria-label="Chiudi">&times;</button>
        </div>

        <div class="shop-tabs tabs" role="tablist">
          <button type="button" class="tab active" data-tab="manual">Attrezzi Manuali</button>
          <button type="button" class="tab" data-tab="fleet">Flotta Autonoma</button>
        </div>

        <div class="shop-content" data-el="content">
          <!-- Carte degli upgrade -->
        </div>
      </aside>`;

    this.backdrop = this.root.querySelector('.shop-backdrop');
    this.drawer = this.root.querySelector('.shop-drawer');
    this.content = this.root.querySelector('[data-el="content"]');
    this.tabs = this.root.querySelectorAll('.tab');

    this.backdrop.addEventListener('click', () => this.close());
    this.root.querySelector('[data-act="close"]').addEventListener('click', () => this.close());

    this.tabs.forEach((t) => {
      t.addEventListener('click', () => {
        this.tabs.forEach((b) => b.classList.toggle('active', b === t));
        this.activeTab = t.dataset.tab;
        this.render();
      });
    });

    this.content.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-buy]');
      if (!btn || btn.disabled) return;
      const id = btn.dataset.buy;
      buyUpgrade(id, this.state, this.audio);
    });

    this.render();
    this.close(true);
  }

  open() {
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.root.classList.add('open');
    this.render();
  }

  close(instant = false) {
    this.isOpen = false;
    this.root.classList.remove('open');
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
    const list = Object.values(UPGRADE_CATALOG).filter((u) => u.branch === this.activeTab);
    this.content.innerHTML = list.map((def) => this._renderCard(def)).join('');
    this.updateAffordability();
  }

  refresh() {
    this.render();
  }

  _renderCard(def) {
    const lvl = this.state.upgrades[def.id] ?? 0;
    const isMax = lvl >= def.maxLevel;
    const cost = getUpgradeCost(def, lvl);
    const canAfford = this.state.sand >= cost && !isMax;

    return `
      <div class="panel surface upgrade-card ${isMax ? 'maxed' : ''}" data-card="${def.id}">
        <div class="upgrade-card-head">
          <span class="upgrade-name">${def.name}</span>
          <span class="upgrade-level num">Lv. ${lvl}${isMax ? ' (MAX)' : ` / ${def.maxLevel}`}</span>
        </div>
        <p class="upgrade-desc muted">${def.desc}</p>
        <div class="upgrade-benefit accent">${def.getBenefit(lvl)}</div>
        <div class="upgrade-card-foot">
          <button type="button" class="btn btn-buy ${canAfford ? 'glow' : ''}" data-buy="${def.id}" ${canAfford ? '' : 'disabled'}>
            <span class="buy-action">${isMax ? 'Completato' : 'Acquista'}</span>
            ${isMax ? '' : `<span class="buy-cost num">${formatNumber(cost)} ⟡</span>`}
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
      const lvl = this.state.upgrades[id] ?? 0;
      const isMax = lvl >= def.maxLevel;
      const cost = getUpgradeCost(def, lvl);
      const canAfford = this.state.sand >= cost && !isMax;

      const btn = card.querySelector('[data-buy]');
      if (btn) {
        btn.disabled = !canAfford;
        btn.classList.toggle('glow', canAfford);
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

