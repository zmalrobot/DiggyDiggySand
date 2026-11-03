// Menu principale: Nuova Spedizione, Continua, Impostazioni, Crediti, Galleria Finali, Santuario Predecessori.
import { events } from '../core/Events.js';
import { GalleryModal } from './GalleryModal.js';
import { PrestigeModal } from './PrestigeModal.js';

export class MainMenu {
  constructor(root, { save, modal, settingsModal, audio, scene }) {
    this.root = root;
    this.save = save;
    this.modal = modal;
    this.settingsModal = settingsModal;
    this.audio = audio;
    this.scene = scene;
    this.galleryModal = new GalleryModal(modal, save);
    this.prestigeModal = new PrestigeModal(modal, save, null, audio);
    this._build();
  }

  _build() {
    this.root.classList.add('main-menu');
    this.root.innerHTML = `
      <div class="menu-inner">
        <header class="menu-header">
          <h1 class="display menu-title">Diggy<br>Diggy Sand</h1>
          <div class="menu-tag">Svuota il deserto. Scopri cosa dorme sotto.</div>
        </header>
        <nav class="panel menu-panel" aria-label="Menu principale">
          <button type="button" class="btn" data-act="new">Nuova Spedizione</button>
          <button type="button" class="btn" data-act="continue">Continua</button>
          <button type="button" class="btn" data-act="gallery">Finali Scoperti (<span class="gallery-count">0</span>/4)</button>
          <button type="button" class="btn btn-prestige" data-act="prestige">Santuario dei Predecessori (<span class="tablets-count">τ 0</span>)</button>
          <button type="button" class="btn" data-act="settings">Impostazioni</button>
          <button type="button" class="btn" data-act="credits">Crediti</button>
        </nav>
        <footer class="menu-foot muted">v6.0 · Fase 6</footer>
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
  }

  show() {
    this.refresh();
    this.root.classList.remove('hidden', 'fade-out');
    this.root.classList.add('fade-in');
  }

  hide() { this.root.classList.add('hidden'); }

  /** Aggiorna lo stato di "Continua", finali scoperti e tavolette in base al salvataggio. */
  refresh() {
    const has = this.save.hasValidSave();
    this.continueBtn.disabled = !has;
    this.continueBtn.title = has ? '' : 'Nessun salvataggio disponibile';
    const seen = this.save.getEndingsSeen?.() ?? [];
    if (this.galleryCount) {
      this.galleryCount.textContent = seen.length.toString();
    }
    if (this.tabletsCount) {
      const tab = this.save.getTablets?.() ?? 0;
      this.tabletsCount.textContent = `τ ${tab}`;
    }
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
        title: 'Sovrascrivere la spedizione?',
        message: 'Esiste già un salvataggio. Iniziare una nuova spedizione lo cancellerà in modo definitivo.',
        confirmLabel: 'Sovrascrivi',
        danger: true,
      });
      if (!ok) return;
    }
    const data = this.save.createNew();
    this.scene?.shake(0.5);
    this.refresh();
    events.emit('game:new', data);
  }

  _continue() {
    const data = this.save.load();
    if (!data) { this.refresh(); return; }
    events.emit('game:continue', data);
  }

  _settings() { this.settingsModal.open(); }

  _credits() {
    const wrap = document.createElement('div');
    wrap.className = 'credits';
    wrap.innerHTML = `
      <p><span class="accent">Diggy Diggy Sand</span> · gioco incrementale 3D con finali casuali.</p>
      <p class="muted">Motore: Three.js r160 (MIT). Font: Cinzel Decorative, Cinzel, Syne (SIL OFL, Google Fonts).</p>
      <p class="muted">Asset 3D e audio: CC0 (Kenney, Quaternius, OpenGameArt) quando presenti. In loro assenza, mesh e suoni procedurali.</p>`;
    this.modal.open({ title: 'Crediti', content: wrap, actions: [{ label: 'Chiudi' }] });
  }
}

