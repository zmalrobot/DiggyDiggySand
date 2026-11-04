// Onboarding / Micro-Tutorial contestuale (<30s).
// Guida non invasiva al primo scavo, alla valuta sabbia e all'Officina.
import { events } from '../core/Events.js';
import { i18n } from '../core/I18n.js';

export class Tutorial {
  constructor(root = document.body, { state }) {
    this.root = root;
    this.state = state;
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

  _renderStep1() {
    if (!this.el) return;
    const txt = i18n.t('tutorial.step1') || 'Tocca o tieni premuto per scavare la duna';
    this.el.innerHTML = `
      <div class="tutorial-pulse-ring">
        <div class="tutorial-ripple"></div>
        <div class="tutorial-hand-icon">👆</div>
        <div class="tutorial-text" data-i18n="tutorial.step1">${txt}</div>
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
    const txt = i18n.t('tutorial.step2') || 'La sabbia estratta è la tua valuta!';
    this.el.innerHTML = `
      <div class="tutorial-tooltip tooltip-sand">
        <span class="tutorial-arrow">▲</span>
        <div class="tutorial-bubble" data-i18n="tutorial.step2">${txt}</div>
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
    const txt = i18n.t('tutorial.step3') || 'Nuovi strumenti disponibili nell\'Officina!';
    this.el.innerHTML = `
      <div class="tutorial-tooltip tooltip-shop">
        <div class="tutorial-bubble pulse-gold" data-i18n="tutorial.step3">
          ${txt}
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
