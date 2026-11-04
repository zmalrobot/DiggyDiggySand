// Modale Santuario Ancestrale (Meta-Shop permanente delle Tavolette Antiche τ).
// Consente di imprimere perk ancestrali che persistono attraverso tutte le spedizioni.
import { META_UPGRADES, getMetaUpgradeCost, buyMetaUpgrade } from '../systems/Prestige.js';
import { i18n } from '../core/I18n.js';
import { events } from '../core/Events.js';

export class SanctuaryModal {
  constructor(modal, save, state = null, audio = null) {
    this.modal = modal;
    this.save = save;
    this.state = state;
    this.audio = audio;
    this.wrap = null;
    this.handle = null;

    this._unsubLang = events.on('language:changed', () => {
      if (this.handle && this.wrap) {
        this._render();
        this.handle.setTitle?.(i18n.t('sanctuary.title') || i18n.t('prestige.title') || 'Santuario dei Predecessori');
        this.handle.setActionLabel?.(0, i18n.t('common.close') || 'Chiudi');
      }
    });
  }

  open() {
    this.wrap = document.createElement('div');
    this.wrap.className = 'sanctuary-container prestige-container';
    this._render();

    this.wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-meta-id]');
      if (!btn || btn.disabled) return;
      const id = btn.dataset.metaId;
      const ok = buyMetaUpgrade(id, this.save, this.state, this.audio);
      if (ok) {
        this._render();
      }
    });

    this.handle = this.modal.open({
      title: i18n.t('sanctuary.title') || i18n.t('prestige.title') || 'Santuario dei Predecessori',
      content: this.wrap,
      wide: true,
      actions: [{ label: i18n.t('common.close') || 'Chiudi' }],
      onClose: () => {
        this.handle = null;
        this.wrap = null;
      },
    });
  }

  close() {
    this.handle?.close?.();
    this.handle = null;
    this.wrap = null;
  }

  dispose() {
    this._unsubLang?.();
    this.close();
  }

  _render() {
    if (!this.wrap) return;
    const tablets = this.save ? this.save.getTablets() : (this.state?.tablets ?? 0);
    const meta = this.save ? this.save.getMetaUpgrades() : (this.state?.metaUpgrades ?? {});

    const tabletsLabel = i18n.t('sanctuary.tabletsLabel') || i18n.t('prestige.tabletsLabel') || 'Tavolette Antiche:';
    const introText = i18n.t('sanctuary.intro') || i18n.t('prestige.intro') || 'La conoscenza dei cicli passati non va perduta. Spendi le Tavolette per imprimere perk permanenti validi per tutte le spedizioni future.';

    this.wrap.innerHTML = `
      <div class="sanctuary-header prestige-header">
        <div class="sanctuary-currency prestige-currency">
          <span class="currency-label">${tabletsLabel}</span>
          <span class="currency-val accent">τ ${tablets}</span>
        </div>
        <p class="sanctuary-intro prestige-intro muted">${introText}</p>
      </div>

      <div class="sanctuary-list prestige-list">
        ${Object.values(META_UPGRADES).map((def) => {
          const lvl = meta[def.id] ?? 0;
          const isMax = lvl >= def.maxLevel;
          const cost = getMetaUpgradeCost(def, lvl);
          const canAfford = !isMax && tablets >= cost;

          const name = i18n.t(`sanctuary.upgrades.${def.id}.name`) || i18n.t(`prestige.${def.id}.name`) || i18n.t(`prestige.upgrades.${def.id}.name`) || def.name;
          const desc = i18n.t(`sanctuary.upgrades.${def.id}.desc`) || i18n.t(`prestige.${def.id}.desc`) || i18n.t(`prestige.upgrades.${def.id}.desc`) || def.desc;
          const benefit = def.getBenefit(lvl);

          return `
            <div class="sanctuary-card prestige-card panel ${isMax ? 'card-max' : ''}">
              <div class="sanctuary-badge prestige-badge">${def.badge}</div>
              <div class="sanctuary-info prestige-info">
                <div class="sanctuary-title-row prestige-title-row">
                  <span class="sanctuary-title prestige-title">${name}</span>
                  <span class="sanctuary-lvl prestige-lvl ${isMax ? 'accent' : 'muted'}">Lv. ${lvl}/${def.maxLevel}</span>
                </div>
                <div class="sanctuary-benefit prestige-benefit accent">${benefit}</div>
                <div class="sanctuary-desc prestige-desc muted">${desc}</div>
              </div>
              <div class="sanctuary-action prestige-action">
                <button type="button" class="btn btn-meta" data-meta-id="${def.id}" ${canAfford ? '' : 'disabled'}>
                  ${isMax ? 'MAX' : `τ ${cost}`}
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
}

