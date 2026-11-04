// Schermata Crediti Ufficiali & Riconoscimenti Legali:
// Attribuzioni open source (Three.js MIT, Google Fonts SIL OFL, Kenney/Quaternius/OpenGameArt CC0/CC-BY).
import { i18n } from '../core/I18n.js';

export class CreditsModal {
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
        title: i18n.t('credits.modalTitle') || 'Crediti & Risorse Open Source',
        content: null,
        wide: true,
        actions: [{ label: i18n.t('common.close') || 'Chiudi' }],
      });
      return this.handle;
    }
    const wrap = document.createElement('div');
    wrap.className = 'credits-modal-content';
    wrap.innerHTML = `
      <div class="credits-header-banner">
        <span class="credits-badge">⚖️ ${i18n.t('credits.badge') || 'ATLANTIS HERITAGE'}</span>
        <h3 class="credits-game-title">Diggy Diggy Sand: The Sunken City</h3>
        <div class="credits-version muted">${i18n.t('credits.versionLabel') || 'Versione Client'}: <span class="accent">v1.0.0</span> · Gold Master</div>
      </div>

      <div class="credits-section">
        <h4 class="credits-sec-title">🏛️ ${i18n.t('credits.engineTitle') || 'Motore Grafico & WebGL'}</h4>
        <p class="credits-item">
          <strong>Three.js (r160)</strong> — ${i18n.t('credits.engineText') || 'Libreria di rendering 3D accelerata via WebGL rilasciata sotto Licenza MIT (© 2010-2024 Three.js Authors, mrdoob).'}
          <br><a href="https://threejs.org" target="_blank" rel="noopener noreferrer" class="credits-link">threejs.org ↗</a>
        </p>
      </div>

      <div class="credits-section">
        <h4 class="credits-sec-title">✒️ ${i18n.t('credits.typographyTitle') || 'Tipografia e Caratteri'}</h4>
        <p class="credits-item">
          <strong>Cinzel Decorative & Cinzel</strong> (Natanael Gama) e <strong>Syne</strong> (Bonjour Monde, Lucas Descroix).
          <br>${i18n.t('credits.typographyText') || 'Caratteri distribuiti da Google Fonts sotto licenza SIL Open Font License 1.1 (OFL).'}
          <br><a href="https://fonts.google.com" target="_blank" rel="noopener noreferrer" class="credits-link">fonts.google.com ↗</a>
        </p>
      </div>

      <div class="credits-section">
        <h4 class="credits-sec-title">🏺 ${i18n.t('credits.assetsTitle') || 'Modelli 3D & Risorse Audio'}</h4>
        <ul class="credits-list">
          <li><strong>Kenney.nl</strong> — Asset low-poly modulari e SFX originali (Licenza CC0 1.0 Universal - Public Domain). <a href="https://kenney.nl" target="_blank" rel="noopener noreferrer" class="credits-link">kenney.nl ↗</a></li>
          <li><strong>Quaternius</strong> — Modelli ambientali desertici e rovine (Licenza CC0 1.0 Public Domain). <a href="https://quaternius.com" target="_blank" rel="noopener noreferrer" class="credits-link">quaternius.com ↗</a></li>
          <li><strong>OpenGameArt.org</strong> — Campionamenti sonori atmosferici ed effetti tellurici (Licenze CC0 e CC-BY 3.0). <a href="https://opengameart.org" target="_blank" rel="noopener noreferrer" class="credits-link">opengameart.org ↗</a></li>
          <li><strong>Sintesi Procedurale Web Audio</strong> — Sound synth analitico nativo a frequenze calcolate al volo via Web Audio API.</li>
        </ul>
      </div>

      <div class="credits-section">
        <h4 class="credits-sec-title">📜 ${i18n.t('credits.legalTitle') || 'Note Legali e Trasparenza'}</h4>
        <p class="credits-text muted">
          ${i18n.t('credits.legalText') || 'Tutti i marchi, loghi e risorse appartengono ai rispettivi autori. Il gioco rispetta la totale sovranità dei dati dell\'utente: nessun cookie di terze parti, nessun tracciamento analitico e archiviazione esclusivamente locale (localStorage).'}
        </p>
      </div>
    `;

    this.handle = this.modal.open({
      title: i18n.t('credits.modalTitle') || 'Crediti & Risorse Open Source',
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
