// Modale Guardaroba: personalizzazione skin pala, tinte sabbia e macchinari.
import { i18n } from '../core/I18n.js';
import { events } from '../core/Events.js';
import { COSMETICS_CATALOG } from '../systems/CosmeticsManager.js';

export class WardrobeModal {
  constructor(modal, cosmeticsManager, save, audio, game = null) {
    this.modal = modal;
    this.cosmetics = cosmeticsManager;
    this.save = save;
    this.audio = audio;
    this.game = game;
    this.currentTab = 'shovel';
    this.root = null;
    this.handle = null;

    events.on('language:changed', () => {
      if (this.handle && this.root) {
        this._buildBody();
        this.handle.setTitle?.(i18n.t('wardrobe.title') || 'Guardaroba delle Dune');
        this.handle.setActionLabel?.(0, i18n.t('common.close') || 'Chiudi');
      }
    });
  }

  _buildBody() {
    if (!this.root) return;
    this.root.innerHTML = '';

    const headerBar = document.createElement('div');
    headerBar.className = 'wardrobe-header-bar';
    const tablets = this.save?.getTablets?.() ?? 0;
    headerBar.innerHTML = `
      <div class="wardrobe-sub muted">${i18n.t('wardrobe.subtitle') || 'Personalizza l\'aspetto del tuo cantiere'}</div>
      <div class="wardrobe-tablets-pill">τ <span class="tab-count">${tablets}</span></div>
    `;

    const tabBar = document.createElement('div');
    tabBar.className = 'tabs wardrobe-tabs';
    tabBar.innerHTML = `
      <button type="button" class="tab wardrobe-tab-btn ${this.currentTab === 'shovel' ? 'active' : ''}" data-tab="shovel">${i18n.t('wardrobe.tabShovel') || 'Pale & Strumenti'}</button>
      <button type="button" class="tab wardrobe-tab-btn ${this.currentTab === 'sand' ? 'active' : ''}" data-tab="sand">${i18n.t('wardrobe.tabSand') || 'Biomi Sabbia'}</button>
      <button type="button" class="tab wardrobe-tab-btn ${this.currentTab === 'machinery' ? 'active' : ''}" data-tab="machinery">${i18n.t('wardrobe.tabMachinery') || 'Macchinari'}</button>
    `;

    const body = document.createElement('div');
    body.className = 'tab-body';

    const container = document.createElement('div');
    container.className = 'wardrobe-grid';
    body.append(container);

    this.root.append(headerBar, tabBar, body);

    const render = () => {
      this._renderGrid(container, this.currentTab, headerBar);
    };

    tabBar.addEventListener('click', (e) => {
      const b = e.target.closest('.tab');
      if (!b) return;
      tabBar.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      b.classList.add('active');
      this.currentTab = b.dataset.tab;
      render();
    });

    render();
  }

  open() {
    this.root = document.createElement('div');
    this.root.className = 'wardrobe-modal';
    this._buildBody();

    this.handle = this.modal.open({
      title: i18n.t('wardrobe.title') || 'Guardaroba delle Dune',
      content: this.root,
      wide: true,
      actions: [{ label: i18n.t('common.close') || 'Chiudi' }],
      onClose: () => {
        this.handle = null;
        this.root = null;
      },
    });
  }

  close() {
    this.handle?.close?.();
    this.handle = null;
    this.root = null;
  }

  _renderGrid(container, category, headerBar) {
    const items = this.cosmetics?.getAll?.(category) ?? [];
    const tablets = this.save?.getTablets?.() ?? 0;
    if (headerBar) {
      const countEl = headerBar.querySelector('.tab-count');
      if (countEl) countEl.textContent = String(tablets);
    }

    container.innerHTML = '';

    for (const item of items) {
      const card = document.createElement('div');
      card.className = `wardrobe-card ${item.isEquipped ? 'equipped' : item.isUnlocked ? 'unlocked' : 'locked'}`;

      const name = i18n.t(`wardrobe.skins.${item.id}.name`) || item.id;
      const desc = i18n.t(`wardrobe.skins.${item.id}.desc`) || '';

      card.innerHTML = `
        <div class="wardrobe-preview" style="border-color: ${item.color};">
          <div class="wardrobe-preview-circle" style="background: radial-gradient(circle, ${item.color} 30%, transparent 75%);"></div>
          <span class="wardrobe-icon">${item.icon}</span>
        </div>
        <div class="wardrobe-info wardrobe-card-info">
          <div class="wardrobe-name wardrobe-card-name">${name}</div>
          <div class="wardrobe-desc wardrobe-card-desc">${desc}</div>
        </div>
        <div class="wardrobe-action wardrobe-card-action"></div>
      `;

      const actionSlot = card.querySelector('.wardrobe-action');

      if (item.isEquipped) {
        actionSlot.innerHTML = `<button type="button" class="btn btn-equipped" disabled>✓ ${i18n.t('wardrobe.equipped') || 'Equipaggiato'}</button>`;
      } else if (item.isUnlocked) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-secondary';
        btn.textContent = i18n.t('wardrobe.equip') || 'Equipaggia';
        btn.addEventListener('click', () => {
          this.cosmetics.equip(category, item.id);
          this.audio?.playClick?.();
          this._renderGrid(container, category, headerBar);
        });
        actionSlot.append(btn);
      } else {
        const cost = item.cost || 0;
        const canAfford = tablets >= cost;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn ${canAfford ? 'btn-unlock' : 'btn-disabled'}`;
        btn.disabled = !canAfford;
        btn.textContent = canAfford
          ? `τ ${cost} - ${i18n.t('wardrobe.unlock') || 'Sblocca'}`
          : `τ ${cost} (${i18n.t('wardrobe.needTablets') || 'Mancano tavolette'})`;

        btn.addEventListener('click', () => {
          const success = this.cosmetics.unlockWithTablets(category, item.id, this.save);
          if (success) {
            this.cosmetics.equip(category, item.id);
            this.audio?.playPurchaseSound?.();
            this._renderGrid(container, category, headerBar);
          }
        });
        actionSlot.append(btn);
      }

      container.append(card);
    }
  }
}

