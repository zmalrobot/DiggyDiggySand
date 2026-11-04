// Onboarding / Micro-Tutorial contestuale (<30s).
// Guida non invasiva al primo scavo, alla valuta sabbia e all'Officina.
import { events } from '../core/Events.js';
import { i18n } from '../core/I18n.js';

export class Tutorial {
  constructor(root = document.body, { state, modal = null } = {}) {
    this.root = root;
    this.state = state;
    this.modal = modal;
    this.step = 0; // 0: inattivo, 1: tocca per scavare, 2: valuta sabbia, 3: officina pronta, 4: finito
    this.timer = 0;
    this.el = null;
    this._unsubs = [];
    this._build();

    this._unsubs.push(
      events.on('language:changed', () => this._refreshCurrentStep())
    );
  }

  _build() {
    if (typeof document === 'undefined') return;
    this.el = document.createElement('div');
    this.el.className = 'tutorial-layer pointer-events-none hidden';
    this.root?.appendChild?.(this.el);
  }

  _refreshCurrentStep() {
    if (!this.el || this.el.classList.contains('hidden')) return;
    if (this.step === 1) this._renderStep1();
    else if (this.step === 2) this._renderStep2();
    else if (this.step === 3) this._renderStep3();
    else if (this.step === 4) this._renderStep4();
  }

  /** Avvia il tutorial solo se non è mai stato completato e non c'è già progresso. */
  start() {
    if (this.state.tutorialDone || (this.state.totalSand ?? 0) > 0 || (this.state.clicks ?? 0) > 0) {
      this.step = 4;
      return;
    }

    this.step = 1;
    this.timer = 0;
    this._renderStep1();

    this._unsubs.push(
      events.on('dig:hit', () => {
        if (this.step === 1) this._advanceToStep2();
      }),
      events.on('sand:changed', ({ sand }) => {
        if (this.step === 2 && sand >= 10) this._advanceToStep3();
      }),
      events.on('hud:shop', () => {
        if (this.step >= 1 && this.step < 4) this.complete();
      })
    );
  }

  openModal(step = this.step || 1) {
    const s = Math.max(1, Math.min(4, step));
    const title = i18n.t(`tutorial.step${s}_title`);
    const desc = i18n.t(`tutorial.step${s}_desc`);
    const btnNext = i18n.t('tutorial.btn_next');
    const btnSkip = i18n.t('tutorial.btn_skip');

    if (this.modal?.open) {
      const content = document.createElement('div');
      content.className = 'tutorial-modal-body';
      content.innerHTML = `<div class="tutorial-modal-desc">${desc}</div>`;
      this.modal.open({
        title,
        content,
        actions: [
          {
            label: btnNext,
            primary: true,
            onClick: () => {
              if (s < 4) this.openModal(s + 1);
              else this.complete();
            },
          },
          {
            label: btnSkip,
            onClick: () => this.complete(),
          },
        ],
      });
      return;
    }

    if (!this.el) return;
    this.el.innerHTML = `
      <div class="tutorial-modal-backdrop">
        <div class="tutorial-modal-card panel">
          <div class="tutorial-card-title">${title}</div>
          <div class="tutorial-card-desc">${desc}</div>
          <div class="tutorial-card-actions">
            <button type="button" class="btn btn-secondary btn-tutorial-skip">${btnSkip}</button>
            <button type="button" class="btn btn-primary btn-tutorial-next">${btnNext}</button>
          </div>
        </div>
      </div>
    `;
    this.el.classList.remove('hidden');
    requestAnimationFrame(() => this.el?.classList?.add('visible'));

    const nextBtn = this.el.querySelector('.btn-tutorial-next');
    const skipBtn = this.el.querySelector('.btn-tutorial-skip');
    nextBtn?.addEventListener('click', () => {
      if (s < 4) this.openModal(s + 1);
      else this.complete();
    });
    skipBtn?.addEventListener('click', () => this.complete());
  }

  _renderStep1() {
    if (!this.el) return;
    const title = i18n.t('tutorial.step1_title') || 'Primo Scavo';
    const desc = i18n.t('tutorial.step1_desc') || i18n.t('tutorial.firstDig') || 'Clicca o tocca la sabbia per scavare i primi granelli del deserto.';
    this.el.innerHTML = `
      <div class="tutorial-pulse-ring">
        <div class="tutorial-ripple"></div>
        <div class="tutorial-hand-icon">👆</div>
        <div class="tutorial-step-box">
          <div class="tutorial-title" data-i18n="tutorial.step1_title">${title}</div>
          <div class="tutorial-text" data-i18n="tutorial.step1_desc">${desc}</div>
        </div>
      </div>
    `;
    this.el.classList.remove('hidden');
    requestAnimationFrame(() => this.el?.classList?.add('visible'));
  }

  _advanceToStep2() {
    this.step = 2;
    this._renderStep2();
    // Rimuovi dopo 3.5s o se si raggiunge la sabbia del negozio
    setTimeout(() => {
      if (this.step === 2 && (this.state.sand ?? 0) < 10) {
        this.el?.classList?.remove('visible');
      }
    }, 3500);
  }

  _renderStep2() {
    if (!this.el) return;
    const title = i18n.t('tutorial.step2_title') || "L'Officina";
    const desc = i18n.t('tutorial.step2_desc') || i18n.t('tutorial.currency') || 'Apri l\'Officina in basso per reclutare lavoratori e potenziare la pala.';
    this.el.innerHTML = `
      <div class="tutorial-tooltip tooltip-sand">
        <span class="tutorial-arrow">▲</span>
        <div class="tutorial-bubble">
          <div class="tutorial-title" data-i18n="tutorial.step2_title">${title}</div>
          <div class="tutorial-desc" data-i18n="tutorial.step2_desc">${desc}</div>
        </div>
      </div>
    `;
  }

  _advanceToStep3() {
    this.step = 3;
    this._renderStep3();
  }

  _renderStep3() {
    if (!this.el) return;
    this.el.classList.remove('hidden');
    const title = i18n.t('tutorial.step3_title') || 'Dinamite da Cantiere';
    const desc = i18n.t('tutorial.step3_desc') || i18n.t('tutorial.workshopAvailable') || 'Premi la Barra Spaziatrice o tocca il medaglione per sgomberare ampie aree.';
    this.el.innerHTML = `
      <div class="tutorial-tooltip tooltip-shop">
        <div class="tutorial-bubble pulse-gold">
          <div class="tutorial-title" data-i18n="tutorial.step3_title">${title}</div>
          <div class="tutorial-desc" data-i18n="tutorial.step3_desc">${desc}</div>
        </div>
      </div>
    `;
    requestAnimationFrame(() => this.el?.classList?.add('visible'));

    // Fai pulsare il pulsante officina se presente
    if (typeof document !== 'undefined') {
      const shopBtn = document.querySelector('[data-act="shop"]');
      if (shopBtn) shopBtn.classList.add('pulse-attention');
    }
  }

  _renderStep4() {
    if (!this.el) return;
    this.el.classList.remove('hidden');
    const title = i18n.t('tutorial.step4_title') || 'I Segreti Sotterranei';
    const desc = i18n.t('tutorial.step4_desc') || 'Scava in profondità fino al basamento archeologico per scoprire cosa riposa sotto la duna.';
    this.el.innerHTML = `
      <div class="tutorial-tooltip tooltip-bedrock">
        <div class="tutorial-bubble pulse-cyan">
          <div class="tutorial-title" data-i18n="tutorial.step4_title">${title}</div>
          <div class="tutorial-desc" data-i18n="tutorial.step4_desc">${desc}</div>
        </div>
      </div>
    `;
    requestAnimationFrame(() => this.el?.classList?.add('visible'));
  }

  update(dt) {
    if (this.step === 0 || this.step === 4) return;
    this.timer += dt;
    // Timeout di sicurezza: il tutorial si auto-conclude in massimo 30 secondi
    if (this.timer >= 30) {
      this.complete();
    }
  }

  complete() {
    this.step = 4;
    this.state.tutorialDone = true;
    if (typeof document !== 'undefined') {
      const shopBtn = document.querySelector('[data-act="shop"]');
      if (shopBtn) shopBtn.classList.remove('pulse-attention');
    }

    if (this.el) {
      this.el.classList.remove('visible');
      setTimeout(() => {
        this.el.classList.add('hidden');
        this.el.innerHTML = '';
      }, 350);
    }
    this._disposeEvents();
  }

  _disposeEvents() {
    this._unsubs.forEach((u) => u());
    this._unsubs = [];
  }

  dispose() {
    this.complete();
    if (this.el?.parentElement) {
      this.el.parentElement.removeChild(this.el);
    }
  }
}
