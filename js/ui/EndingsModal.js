// Modale Galleria dei Finali Scoperti (Codex dell'Archeologo).
// Schede cerimoniali per i 4 destini della duna (Curse, Treasure, Business, Secret).
import { i18n } from '../core/I18n.js';
import { events } from '../core/Events.js';
import { Overlay } from './Overlay.js';

export const ENDINGS_CATALOG = {
  curse: {
    id: 'curse',
    badge: '☠️',
    get name() { return i18n.t('endings.curse.title') || 'La Maledizione di Seth'; },
    get hint() { return i18n.t('gallery.curseHint') || 'Rompi il sigillo ancestrale dormiente sotto l\'obelisco centrale.'; },
    get description() { return i18n.t('endings.curse.text') || 'Forse avresti dovuto lasciare la sabbia dov\'era... Hai liberato una piaga primordiale che ha tinto il cielo di sangue.'; },
    color: '#D87D38',
  },
  treasure: {
    id: 'treasure',
    badge: '👑',
    get name() { return i18n.t('endings.treasure.title') || 'Il Tesoro dei Faraoni'; },
    get hint() { return i18n.t('gallery.treasureHint') || 'Svela la cripta dei sovrani sepolta nella roccia.'; },
    get description() { return i18n.t('endings.treasure.text') || 'Montagne d\'oro puro e gemme luminescenti ricoprono la roccia: la ricchezza eterna dei faraoni è tua.'; },
    color: '#F5BA23',
  },
  business: {
    id: 'business',
    badge: '🏗️',
    get name() { return i18n.t('endings.business.title') || 'L\'Impresa Archeologica Tycoon'; },
    get hint() { return i18n.t('gallery.businessHint') || 'Raggiungi il fondo sterile per un anticlimax memorabile.'; },
    get description() { return i18n.t('endings.business.text') || 'Nessun dio, nessun tesoro: solo un secchiello e una flotta di macchinari quotata per miliardi in borsa!'; },
    color: '#8C5828',
  },
  secret: {
    id: 'secret',
    badge: '🔱',
    get name() { return i18n.t('endings.secret.title') || 'L\'Ascensione Atlantidea'; },
    get hint() { return i18n.t('gallery.secretHint') || 'Scopri prima tutti e 3 i destini della duna per risvegliare l\'antico cuore d\'Oricalco.'; },
    get description() { return i18n.t('endings.secret.text') || 'Hai risvegliato il cuore perduto di Atlantide: la città risorge in volo verso il cielo.'; },
    color: '#0FE3C1',
  },
};

export class EndingsModal {
  constructor(modal, save, game = null, audio = null) {
    this.modal = modal;
    this.save = save;
    this.game = game;
    this.audio = audio;
    this.wrap = null;
    this.handle = null;
    this._overlayReplay = null;

    this._unsubLang = events.on('language:changed', () => {
      if (this.handle && this.wrap) {
        this._render();
        this.handle.setTitle?.(i18n.t('gallery.title') || 'Galleria dei Finali');
        this.handle.setActionLabel?.(0, i18n.t('common.close') || 'Chiudi');
      }
    });
  }

  open() {
    this.wrap = document.createElement('div');
    this.wrap.className = 'gallery-container endings-modal-container';
    this._render();

    this.wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-replay-ending]');
      if (!btn) return;
      const endingId = btn.dataset.replayEnding;
      this.replayEnding(endingId);
    });

    this.handle = this.modal.open({
      title: i18n.t('gallery.title') || 'Galleria dei Finali (Codex dell\'Archeologo)',
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

  replayEnding(endingId) {
    const ending = ENDINGS_CATALOG[endingId];
    if (!ending) return;

    this.audio?.playClick?.();
    const overlay = this.game?.overlay || (this._overlayReplay ??= new Overlay());

    overlay.show({
      endingId,
      badge: ending.badge,
      title: ending.name,
      text: ending.description,
      stats: {
        timeSeconds: 1240,
        sandTotal: 1500000,
        clicks: 450,
        completion: 1.0,
      },
      onMenu: () => overlay.hide(),
      onRestart: () => overlay.hide(),
      onSandbox: () => overlay.hide(),
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
    const replayLabel = i18n.t('gallery.replayBtn') || 'Rivivi Epilogo';

    this.wrap.innerHTML = `
      <div class="gallery-header">
        <div class="gallery-progress-bar">
          <div class="gallery-progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="gallery-stats muted">${collectorLabel}: <span class="accent">${count}/${total}</span> (${pct}%)</div>
      </div>
      <div class="gallery-cards endings-grid">
        ${Object.values(ENDINGS_CATALOG).map((info) => {
          const unlocked = seen.has(info.id);
          const rawDate = this.save?.getEndingUnlockDate?.(info.id);
          const dateStr = rawDate ? new Date(rawDate).toLocaleDateString() : '';

          return `
            <div class="gallery-card ending-card ${unlocked ? 'unlocked' : 'locked'}" data-ending="${info.id}">
              <div class="gallery-card-badge ${unlocked ? '' : 'badge-locked-orichalcum'}">
                ${unlocked ? info.badge : '🔒'}
              </div>
              <div class="gallery-card-info">
                <div class="gallery-card-title ${unlocked ? 'accent' : 'muted'}">
                  ${unlocked ? info.name : dormantLabel}
                </div>
                <div class="gallery-card-desc">
                  ${unlocked ? info.description : info.hint}
                </div>
                <div class="gallery-card-foot">
                  <span class="gallery-card-status ${unlocked ? 'status-unlocked' : 'status-locked'}">
                    ${unlocked ? unlockedStatus : lockedStatus} ${dateStr ? `· ${dateStr}` : ''}
                  </span>
                  ${unlocked ? `
                    <button type="button" class="btn btn-secondary btn-replay" data-replay-ending="${info.id}">
                      ▶ ${replayLabel}
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
}

