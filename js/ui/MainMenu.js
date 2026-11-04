// Menu principale: Nuova Spedizione, Continua, Impostazioni, Crediti, Galleria Finali, Santuario Predecessori, Statistiche & Trofei.
import { events } from '../core/Events.js';
import { GalleryModal } from './GalleryModal.js';
import { PrestigeModal } from './PrestigeModal.js';
import { StatsModal } from './StatsModal.js';
import { WardrobeModal } from './WardrobeModal.js';
import { BiomeSelectModal } from './BiomeSelectModal.js';
import { HelpModal } from './HelpModal.js';
import { CreditsModal } from './CreditsModal.js';
import { CosmeticsManager } from '../systems/CosmeticsManager.js';
import { BiomeManager } from '../world/BiomeManager.js';
import { i18n } from '../core/I18n.js';

export class MainMenu {
  constructor(root, { save, modal, settingsModal, audio, scene, statsManager, achievements, cosmeticsManager, wardrobeModal, biomeManager, biomeSelectModal }) {
    this.root = root;
    this.save = save;
    this.modal = modal;
    this.settingsModal = settingsModal;
    this.audio = audio;
    this.scene = scene;
    this.statsManager = statsManager;
    this.achievements = achievements;
    this.cosmeticsManager = cosmeticsManager ?? new CosmeticsManager(save);
    this.biomeManager = biomeManager ?? new BiomeManager(save, statsManager);
    this.galleryModal = new GalleryModal(modal, save);
    this.prestigeModal = new PrestigeModal(modal, save, null, audio);
    this.statsModal = new StatsModal(modal, statsManager, achievements, audio);
    this.wardrobeModal = wardrobeModal ?? new WardrobeModal(modal, this.cosmeticsManager, save, audio, null);
    this.biomeSelectModal = biomeSelectModal ?? new BiomeSelectModal(
      this.biomeManager,
      save,
      statsManager,
      audio,
      (chosenBiome) => this.startNewExpedition(chosenBiome),
    );
    this._build();
  }

  _build() {
    this.root.classList.add('main-menu');
    this.root.innerHTML = `
      <div class="menu-inner">
        <header class="menu-header">
          <h1 class="display menu-title" data-i18n="menu.title">Diggy<br>Diggy Sand</h1>
          <div class="menu-tag" data-i18n="menu.subtitle">Svuota il deserto. Scopri cosa dorme sotto.</div>
        </header>
        <nav class="panel menu-panel" aria-label="Menu principale">
          <button type="button" class="btn" data-act="new" data-i18n="menu.newGame">Nuova Spedizione</button>
          <button type="button" class="btn" data-act="continue" data-i18n="menu.continue">Continua</button>
          <button type="button" class="btn" data-act="gallery"><span data-i18n="menu.gallery">Finali Scoperti</span> (<span class="gallery-count">0</span>/4)</button>
          <button type="button" class="btn btn-prestige" data-act="prestige"><span data-i18n="menu.prestige">Santuario dei Predecessori</span> (<span class="tablets-count">τ 0</span>)</button>
          <button type="button" class="btn" data-act="stats" data-i18n="menu.stats">Statistiche & Trofei</button>
          <button type="button" class="btn btn-wardrobe" data-act="wardrobe" data-i18n="menu.wardrobe">Guardaroba & Skin</button>
          <button type="button" class="btn" data-act="help" data-i18n="menu.help">Aiuto & Comandi</button>
          <button type="button" class="btn" data-act="settings" data-i18n="menu.settings">Impostazioni</button>
          <button type="button" class="btn" data-act="credits" data-i18n="menu.credits">Crediti</button>
        </nav>
        <footer class="menu-foot muted">v1.0.0 · Gold Master</footer>
      </div>`;
    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn || btn.disabled) return;
      this[`_${btn.dataset.act}`]();
    });
    this.continueBtn = this.root.querySelector('[data-act="continue"]');
    this.galleryCount = this.root.querySelector('.gallery-count');
    this.tabletsCount = this.root.querySelector('.tablets-count');
    events.on('meta:bought', () => this.refresh());
    events.on('biome:unlocked', () => this.refresh());
    events.on('i18n:changed', () => this.refresh());
    events.on('language:changed', () => this.refresh());
  }

  show() {
    this.refresh();
    this.root.classList.remove('hidden', 'fade-out');
    this.root.classList.add('fade-in');
  }

  hide() { this.root.classList.add('hidden'); }

  /** Aggiorna lo stato di "Continua", finali scoperti e tavolette in base al salvataggio. */
  refresh() {
    i18n.updateDOM(this.root);
    const has = this.save.hasValidSave();
    this.continueBtn.disabled = !has;
    this.continueBtn.title = has ? '' : (i18n.t('menu.noSave') || 'Nessun salvataggio disponibile');
    const seen = this.save.getEndingsSeen?.() ?? [];
    if (this.galleryCount) {
      this.galleryCount.textContent = seen.length.toString();
    }
    if (this.tabletsCount) {
      const tab = this.save.getTablets?.() ?? 0;
      this.tabletsCount.textContent = `τ ${tab}`;
    }
  }

  _stats() {
    this.statsModal.open();
  }

  _wardrobe() {
    this.audio?.playClick();
    this.wardrobeModal.open();
  }

  _gallery() {
    this.galleryModal.open();
  }

  _prestige() {
    this.prestigeModal.open();
  }

  async _new() {
    if (this.save.hasValidSave()) {
      const ok = await this.modal.confirm({
        title: i18n.t('menu.overwriteConfirmTitle'),
        message: i18n.t('menu.overwriteConfirmMsg'),
        confirmLabel: i18n.t('menu.overwriteBtn'),
        cancelLabel: i18n.t('menu.cancelBtn') || i18n.t('common.cancel'),
        danger: true,
      });
      if (!ok) return;
    }
    this.biomeSelectModal.open((chosenBiome) => this.startNewExpedition(chosenBiome));
  }

  startNewExpedition(biomeId = null) {
    const biome = biomeId || this.biomeManager?.currentBiome || 'desert';
    this.biomeManager?.selectBiome(biome);
    const data = this.save.createNew({ biome });
    this.scene?.shake(0.5);
    this.refresh();
    events.emit('game:new', data);
    return data;
  }

  _continue() {
    const data = this.save.load();
    if (!data) { this.refresh(); return; }
    events.emit('game:continue', data);
  }

  _settings() { this.settingsModal.open(); }

  _help() {
    new HelpModal(this.modal).open();
  }

  _credits() {
    new CreditsModal(this.modal).open();
  }
}

