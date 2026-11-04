// Modale Galleria Epiloghi: mostra i finali sbloccati (Curse, Treasure, Business, Secret) e quelli ancora sigillati.
import { ENDINGS } from '../core/Save.js';
import { i18n } from '../core/I18n.js';
import { events } from '../core/Events.js';

export const GALLERY_DATA = {
  curse: {
    id: 'curse',
    badge: '☠️',
    get name() { return i18n.t('endings.curse.title') || 'La Maledizione di Atlantide'; },
    get hint() { return i18n.t('gallery.curseHint') || 'Rompi il sigillo ancestrale dormiente sotto l\'obelisco centrale.'; },
    get description() { return i18n.t('endings.curse.text') || 'Forse avresti dovuto lasciare la sabbia dov\'era... Hai liberato una piaga primordiale che ha tinto il cielo di sangue.'; },
  },
  treasure: {
    id: 'treasure',
    badge: '👑',
    get name() { return i18n.t('endings.treasure.title') || 'Il Tesoro d\'Oro Puro'; },
    get hint() { return i18n.t('gallery.treasureHint') || 'Svela la cripta dei sovrani sepolta nella roccia.'; },
    get description() { return i18n.t('endings.treasure.text') || 'Montagne d\'oro puro e gemme luminescenti ricoprono la roccia: la ricchezza eterna dei faraoni è tua.'; },
  },
  business: {
    id: 'business',
    badge: '🏗️',
    get name() { return i18n.t('endings.business.title') || 'L\'Impresa di Scavo SRL'; },
    get hint() { return i18n.t('gallery.businessHint') || 'Raggiungi il fondo sterile per un anticlimax memorabile.'; },
    get description() { return i18n.t('endings.business.text') || 'Nessun dio, nessun tesoro: solo un secchiello e una flotta di macchinari quotata per miliardi in borsa!'; },
  },
  secret: {
    id: 'secret',
    badge: '🔱',
    get name() { return i18n.t('endings.secret.title') || 'L\'Ascensione di Atlantide'; },
    get hint() { return i18n.t('gallery.secretHint') || 'Scopri prima tutti e 3 i destini della duna per risvegliare l\'antico cuore d\'Oricalco.'; },
    get description() { return i18n.t('endings.secret.text') || 'Hai risvegliato il cuore perduto di Atlantide: la città risorge in volo verso il cielo.'; },
  },
};

export class GalleryModal {
  constructor(modal, save) {
    this.modal = modal;
    this.save = save;
    this.wrap = null;
    this.handle = null;

    events.on('language:changed', () => {
      if (this.handle && this.wrap) {
        this._render();
        this.handle.setTitle?.(i18n.t('gallery.title') || 'Galleria dei Finali');
        this.handle.setActionLabel?.(0, i18n.t('common.close') || 'Chiudi');
      }
    });
  }

  _render() {
    if (!this.wrap) return;
    const seen = new Set(this.save?.getEndingsSeen?.() ?? []);
    const count = seen.size;
    const total = 4;
    const pct = Math.round((count / total) * 100);

    const collectorLabel = i18n.t('gallery.collectorProgress') || 'Progresso Collezionista';
    const dormantLabel = i18n.t('gallery.dormantSeal') || '??? Sigillo Dormiente';
    const unlockedStatus = i18n.t('gallery.unlockedStatus') || '✓ Epilogo Sbloccato';
    const lockedStatus = i18n.t('gallery.lockedStatus') || 'Non ancora scoperto';

    this.wrap.innerHTML = `
      <div class="gallery-header">
        <div class="gallery-progress-bar">
          <div class="gallery-progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="gallery-stats muted">${collectorLabel}: <span class="accent">${count}/${total}</span> (${pct}%)</div>
      </div>
      <div class="gallery-cards">
        ${Object.values(GALLERY_DATA).map((info) => {
          const unlocked = seen.has(info.id);
          return `
            <div class="gallery-card ${unlocked ? 'unlocked' : 'locked'}">
              <div class="gallery-card-badge">${unlocked ? info.badge : '🔒'}</div>
              <div class="gallery-card-info">
                <div class="gallery-card-title ${unlocked ? 'accent' : 'muted'}">
                  ${unlocked ? info.name : dormantLabel}
                </div>
                <div class="gallery-card-desc">
                  ${unlocked ? info.description : info.hint}
                </div>
                <div class="gallery-card-status ${unlocked ? 'status-unlocked' : 'status-locked'}">
                  ${unlocked ? unlockedStatus : lockedStatus}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  open() {
    this.wrap = document.createElement('div');
    this.wrap.className = 'gallery-container';
    this._render();

    this.handle = this.modal.open({
      title: i18n.t('gallery.title') || 'Galleria dei Finali',
      content: this.wrap,
      actions: [{ label: i18n.t('common.close') || 'Chiudi' }],
      onClose: () => {
        this.handle = null;
        this.wrap = null;
      },
    });
  }

  close() {
    this.handle?.close?.();
  }
}
