// Pannello Aiuto / Legenda Controlli Rapida: riassume tastiera, mouse e gesture touch per Desktop, Tablet e Smartphone.
import { i18n } from '../core/I18n.js';

export class HelpModal {
  /**
   * @param {import('./Modal.js').ModalManager} modal
   */
  constructor(modal) {
    this.modal = modal;
    this.handle = null;
  }

  open() {
    if (typeof document === 'undefined') {
      this.handle = this.modal.open({
        title: i18n.t('help.modalTitle') || 'Guida e Legenda Comandi',
        content: null,
        wide: true,
        actions: [{ label: i18n.t('common.close') || 'Chiudi' }],
      });
      return this.handle;
    }
    const wrap = document.createElement('div');
    wrap.className = 'help-modal-content';
    wrap.innerHTML = `
      <div class="help-section">
        <h3 class="help-section-title">🖥️ ${i18n.t('help.desktopTitle') || 'Controlli Desktop (Mouse & Tastiera)'}</h3>
        <div class="help-grid">
          <div class="help-item">
            <kbd class="key-badge">Click Sx / Hold</kbd>
            <span>${i18n.t('help.digAction') || 'Scavo manuale continuo nel punto di contatto'}</span>
          </div>
          <div class="help-item">
            <kbd class="key-badge">Rotellina</kbd>
            <span>${i18n.t('help.zoomAction') || 'Zoom cinematico (avvicina / allontana)'}</span>
          </div>
          <div class="help-item">
            <kbd class="key-badge">Q / E</kbd>
            <span>${i18n.t('help.rotateAction') || 'Rotazione orbitale continua attorno alla duna'}</span>
          </div>
          <div class="help-item">
            <kbd class="key-badge">Click Dx + Drag</kbd>
            <span>${i18n.t('help.orbitAction') || 'Orbita libera manuale e inclinazione'}</span>
          </div>
          <div class="help-item">
            <kbd class="key-badge">Spazio</kbd>
            <span>${i18n.t('help.spaceAction') || 'Innesco dinamite / scavo rapido (se sbloccato)'}</span>
          </div>
          <div class="help-item">
            <kbd class="key-badge">Esc</kbd>
            <span>${i18n.t('help.escAction') || 'Pausa spedizione o chiusura pannelli'}</span>
          </div>
          <div class="help-item">
            <kbd class="key-badge">F2 / F3</kbd>
            <span>${i18n.t('help.f2f3Action') || 'Console di debug (F2) e Profiler FPS (F3)'}</span>
          </div>
        </div>
      </div>

      <div class="help-section">
        <h3 class="help-section-title">📱 ${i18n.t('help.touchTitle') || 'Controlli Touch (Tablet & Smartphone)'}</h3>
        <div class="help-grid">
          <div class="help-item">
            <kbd class="key-badge">1 Dito (Tap / Hold)</kbd>
            <span>${i18n.t('help.touchDig') || 'Scavo continuo immediato sul terreno'}</span>
          </div>
          <div class="help-item">
            <kbd class="key-badge">2 Dita (Pinch)</kbd>
            <span>${i18n.t('help.touchPinch') || 'Pinch-to-zoom morbido per avvicinare/allontanare'}</span>
          </div>
          <div class="help-item">
            <kbd class="key-badge">2 Dita (Drag)</kbd>
            <span>${i18n.t('help.touchDrag') || 'Rotazione orbitale attorno alla duna e inclinazione'}</span>
          </div>
          <div class="help-item">
            <kbd class="key-badge">Swipe In Giù</kbd>
            <span>${i18n.t('help.touchSwipeDown') || 'Chiudi il cassetto inferiore della Bottega'}</span>
          </div>
        </div>
      </div>

      <div class="help-section">
        <h3 class="help-section-title">⚖️ ${i18n.t('help.gameplayTitle') || 'Regole della Spedizione'}</h3>
        <p class="help-desc">
          ${i18n.t('help.gameplayDesc') || 'Svuota la duna per riportare alla luce le strutture atlantidee sepolte. Potenzia la tua pala nella Bottega e comanda la flotta di droni e trivelle per accelerare l\'estrazione passiva. Tieni d\'occhio le Direttive di Spedizione sulla sinistra per incassare bonus immediati e moltiplicatori temporanei!'}
        </p>
      </div>
    `;

    this.handle = this.modal.open({
      title: i18n.t('help.modalTitle') || 'Guida e Legenda Comandi',
      content: wrap,
      wide: true,
      actions: [{ label: i18n.t('common.close') || 'Chiudi' }],
    });
    return this.handle;
  }

  close() {
    this.handle?.close?.();
    this.handle = null;
  }
}
