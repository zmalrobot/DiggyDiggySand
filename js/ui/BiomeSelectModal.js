// Selettore di Spedizione nel Menu Principale (Fase 12): mostra le 4 schede dei biomi
// con illustrazione vettoriale SVG, descrizione narrativa, modificatori attivi e sblocco.
import { i18n } from '../core/I18n.js';

const BIOME_SVGS = {
  desert: `<svg viewBox="0 0 160 84" class="biome-svg" aria-hidden="true">
    <defs>
      <linearGradient id="bg-desert" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1d3b52"/>
        <stop offset="65%" stop-color="#c89849"/>
        <stop offset="100%" stop-color="#6e563b"/>
      </linearGradient>
    </defs>
    <rect width="160" height="84" rx="4" fill="url(#bg-desert)"/>
    <circle cx="126" cy="22" r="11" fill="#fff0d0" opacity="0.85"/>
    <path d="M0 64 Q40 46 85 60 T160 54 L160 84 L0 84 Z" fill="#b88a44"/>
    <path d="M0 72 Q55 58 110 70 T160 66 L160 84 L0 84 Z" fill="#e0c27a"/>
    <polygon points="75,16 80,8 85,16 88,66 72,66" fill="#d4b483" stroke="#f5ba23" stroke-width="1.2"/>
    <polygon points="75,16 80,8 85,16" fill="#f5ba23"/>
    <rect x="74" y="32" width="12" height="2.5" fill="#0fe3c1"/>
    <rect x="73" y="48" width="14" height="2.5" fill="#0fe3c1"/>
  </svg>`,

  ocean: `<svg viewBox="0 0 160 84" class="biome-svg" aria-hidden="true">
    <defs>
      <linearGradient id="bg-ocean" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#072233"/>
        <stop offset="60%" stop-color="#1f5c6e"/>
        <stop offset="100%" stop-color="#1b3240"/>
      </linearGradient>
    </defs>
    <rect width="160" height="84" rx="4" fill="url(#bg-ocean)"/>
    <path d="M22 68 A34 30 0 0 1 90 68" fill="none" stroke="#f5e6ca" stroke-width="4" opacity="0.75"/>
    <path d="M0 66 Q45 54 95 64 T160 58 L160 84 L0 84 Z" fill="#4a7c82"/>
    <path d="M0 74 Q60 64 115 74 T160 70 L160 84 L0 84 Z" fill="#f5e6ca"/>
    <!-- Nave spezzata con prua sollevata -->
    <g transform="translate(68, 42) rotate(-22)">
      <polygon points="-22,12 18,12 28,0 -18,0" fill="#5c3a24" stroke="#f5ba23" stroke-width="1"/>
      <line x1="2" y1="0" x2="2" y2="-22" stroke="#d8c3a5" stroke-width="2.2"/>
      <polygon points="2,-24 7,-17 2,-10 -3,-17" fill="#00f2ff"/>
    </g>
    <circle cx="44" cy="30" r="3" fill="#9be0e8" opacity="0.8"/>
    <circle cx="52" cy="18" r="2" fill="#9be0e8" opacity="0.65"/>
    <circle cx="118" cy="26" r="3.5" fill="#f5ba23" opacity="0.85"/>
  </svg>`,

  glacier: `<svg viewBox="0 0 160 84" class="biome-svg" aria-hidden="true">
    <defs>
      <linearGradient id="bg-glacier" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0f2537"/>
        <stop offset="60%" stop-color="#3f6a87"/>
        <stop offset="100%" stop-color="#2a3b45"/>
      </linearGradient>
    </defs>
    <rect width="160" height="84" rx="4" fill="url(#bg-glacier)"/>
    <polygon points="28,68 42,26 56,68" fill="#7baec2" opacity="0.75"/>
    <polygon points="106,68 120,22 134,68" fill="#7baec2" opacity="0.8"/>
    <polygon points="66,68 72,18 80,10 88,18 94,68" fill="#a8d8ea" stroke="#00f2ff" stroke-width="1.2"/>
    <polygon points="75,28 80,18 85,28 80,38" fill="#00f2ff"/>
    <path d="M0 66 L50 60 L105 68 L160 60 L160 84 L0 84 Z" fill="#7baec2"/>
    <path d="M0 74 L65 68 L120 75 L160 70 L160 84 L0 84 Z" fill="#e8f4f8"/>
  </svg>`,

  jungle: `<svg viewBox="0 0 160 84" class="biome-svg" aria-hidden="true">
    <defs>
      <linearGradient id="bg-jungle" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0d2618"/>
        <stop offset="60%" stop-color="#2e5936"/>
        <stop offset="100%" stop-color="#2e241c"/>
      </linearGradient>
    </defs>
    <rect width="160" height="84" rx="4" fill="url(#bg-jungle)"/>
    <!-- Ziggurat a gradoni -->
    <rect x="44" y="54" width="72" height="12" fill="#4a5240" stroke="#2ecc71" stroke-width="0.8"/>
    <rect x="54" y="42" width="52" height="12" fill="#3d5c38" stroke="#2ecc71" stroke-width="0.8"/>
    <rect x="64" y="30" width="32" height="12" fill="#4a5240" stroke="#2ecc71" stroke-width="0.8"/>
    <polygon points="80,14 87,22 80,30 73,22" fill="#2ecc71"/>
    <!-- Menhir e radici -->
    <rect x="20" y="36" width="10" height="32" fill="#3d5c38"/>
    <rect x="23" y="42" width="4" height="16" fill="#2ecc71"/>
    <path d="M0 66 Q45 58 95 66 T160 62 L160 84 L0 84 Z" fill="#5c4028"/>
    <path d="M0 73 Q60 66 115 74 T160 70 L160 84 L0 84 Z" fill="#3d5c38"/>
  </svg>`,
};

export class BiomeSelectModal {
  constructor(biomeManager, save, statsManager, audio, onConfirmBiome) {
    this.biomeManager = biomeManager;
    this.save = save;
    this.statsManager = statsManager;
    this.audio = audio;
    this.onConfirmBiome = onConfirmBiome;
    this.isOpen = false;
    this.el = null;

    this._build();
    this._unsubLang = i18n.onLanguageChange(() => {
      if (this.isOpen) this.render();
    });
  }

  _build() {
    this.el = document.createElement('div');
    this.el.id = 'biome-select-modal';
    this.el.className = 'modal-backdrop';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-labelledby', 'biome-modal-title');

    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });

    const parent = document.getElementById('ui-root') || document.body;
    parent?.appendChild(this.el);
  }

  open(onConfirmOverride = null) {
    if (onConfirmOverride) this.onConfirmBiome = onConfirmOverride;
    this.isOpen = true;
    this.render();
    this.el.hidden = false;
    this.audio?.playClick?.();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.hidden = true;
    this.audio?.playClick?.();
  }

  render() {
    const tablets = this.save?.getTablets?.() ?? 0;
    const wins = this.biomeManager.getWinsCount(this.save, this.statsManager);
    const items = this.biomeManager.getAll(this.save, this.statsManager);
    const currentId = this.biomeManager.currentBiome || 'desert';

    const cardsHtml = items.map((b) => {
      const name = i18n.t(`biomes.${b.id}.name`);
      const subtitle = i18n.t(`biomes.${b.id}.subtitle`);
      const lore = i18n.t(`biomes.${b.id}.lore`);
      const modifier = i18n.t(`biomes.${b.id}.modifier`);
      const svg = BIOME_SVGS[b.id] || BIOME_SVGS.desert;

      let footerHtml = '';
      if (b.isSelected) {
        footerHtml = `<button type="button" class="btn btn-primary biome-action-btn is-selected" data-action="select" data-biome="${b.id}">
          ✓ ${i18n.t('biomes.selectedBadge')}
        </button>`;
      } else if (b.isUnlocked) {
        footerHtml = `<button type="button" class="btn btn-secondary biome-action-btn" data-action="select" data-biome="${b.id}">
          ${i18n.t('biomes.selectBtn')}
        </button>`;
      } else {
        const canAfford = tablets >= b.unlock.tabletCost;
        const reqText = i18n.t('biomes.lockedReq', { wins: b.unlock.minWins, cost: b.unlock.tabletCost });
        footerHtml = `
          <div class="biome-lock-req">${reqText}</div>
          <button type="button" class="btn btn-secondary biome-action-btn ${canAfford ? 'can-afford' : 'is-disabled'}"
            data-action="unlock" data-biome="${b.id}" ${canAfford ? '' : 'disabled'}>
            ${i18n.t('biomes.unlockTabletsBtn', { cost: b.unlock.tabletCost })}
          </button>
        `;
      }

      return `
        <article class="biome-card ${b.isSelected ? 'is-selected' : ''} ${b.isUnlocked ? 'is-unlocked' : 'is-locked'}" data-biome="${b.id}">
          <div class="biome-card__art">
            ${svg}
            <div class="biome-card__swatches" aria-hidden="true">
              <span class="biome-swatch" style="background:${b.colors.layer1}"></span>
              <span class="biome-swatch" style="background:${b.colors.layer2}"></span>
              <span class="biome-swatch" style="background:${b.colors.layer3}"></span>
              <span class="biome-swatch biome-swatch--vein" style="background:${b.colors.vein}"></span>
            </div>
          </div>
          <header class="biome-card__header">
            <h3 class="biome-card__title">${name}</h3>
            <p class="biome-card__subtitle">${subtitle}</p>
          </header>
          <div class="biome-card__body">
            <p class="biome-card__lore">${lore}</p>
            <div class="biome-card__modifier" title="${i18n.t('biomes.modifiersLabel')}">
              <span class="biome-modifier-dot">◆</span> ${modifier}
            </div>
          </div>
          <footer class="biome-card__footer">
            ${footerHtml}
          </footer>
        </article>
      `;
    }).join('');

    this.el.innerHTML = `
      <div class="modal-dialog panel-glass biome-modal-dialog">
        <header class="modal-header">
          <div>
            <h2 id="biome-modal-title" class="modal-title">${i18n.t('biomes.modalTitle')}</h2>
            <p class="biome-modal-subtitle">${i18n.t('biomes.modalSubtitle')}</p>
          </div>
          <div class="wardrobe-header-actions">
            <div class="wardrobe-tablets-pill" title="Tavolette Antiche">
              <span class="tablet-glyph">τ</span>
              <span id="biome-tablets-count">${tablets}</span>
            </div>
            <button type="button" class="btn-icon" data-action="close" aria-label="Chiudi">✕</button>
          </div>
        </header>

        <div class="biome-cards-grid">
          ${cardsHtml}
        </div>

        <footer class="modal-footer biome-modal-footer">
          <button type="button" class="btn btn-secondary" data-action="close">${i18n.t('biomes.cancelBtn')}</button>
          <button type="button" class="btn btn-primary" id="btn-confirm-biome" data-action="launch" data-biome="${currentId}">
            ${i18n.t('biomes.startBtn')} (${i18n.t(`biomes.${currentId}.name`)})
          </button>
        </footer>
      </div>
    `;

    this.el.querySelectorAll('[data-action="close"]').forEach((btn) => {
      btn.addEventListener('click', () => this.close());
    });

    // Click sull'intera card sbloccata la seleziona
    this.el.querySelectorAll('.biome-card.is-unlocked').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const id = card.dataset.biome;
        if (this.biomeManager.selectBiome(id)) {
          this.audio?.playClick?.();
          this.render();
        }
      });
    });

    this.el.querySelectorAll('[data-action="select"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.biome;
        if (this.biomeManager.selectBiome(id)) {
          this.audio?.playClick?.();
          this.render();
        }
      });
    });

    this.el.querySelectorAll('[data-action="unlock"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.biome;
        if (this.biomeManager.unlockWithTablets(id, this.save)) {
          this.biomeManager.selectBiome(id);
          this.audio?.playPurchaseSound?.();
          this.render();
        } else {
          this.audio?.playWarn?.();
        }
      });
    });

    const launchBtn = this.el.querySelector('[data-action="launch"]');
    launchBtn?.addEventListener('click', () => {
      const chosenBiome = this.biomeManager.currentBiome || 'desert';
      this.close();
      this.onConfirmBiome?.(chosenBiome);
    });
  }

  dispose() {
    this._unsubLang?.();
    this.el?.remove();
  }
}

