// Menu di Pausa in-game dedicato (Fase 5 Polish & UI).
// Fornisce opzioni rapide (audio, grafica), ripresa e salvataggio/uscita sincronizzato.
import { formatNumber } from './Hud.js';

export class PauseMenu {
  constructor(root = document.body, { game, settings, settingsModal, audio, save }) {
    this.root = root;
    this.game = game;
    this.settings = settings;
    this.settingsModal = settingsModal;
    this.audio = audio;
    this.save = save;
    this.isOpen = false;
    this.el = null;

    this._build();
  }

  _build() {
    if (typeof document === 'undefined') return;
    this.el = document.createElement('div');
    this.el.className = 'pause-overlay hidden';
    this.root?.appendChild?.(this.el);

    this.el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'resume') {
        this.close();
      } else if (act === 'settings') {
        this.settingsModal?.open?.();
      } else if (act === 'save-exit') {
        this.close();
        this.game?.returnToMenu?.();
      }
    });

    this.el.addEventListener('change', (e) => {
      const target = e.target;
      try {
        if (target.name === 'pause-mute') {
          this.settings?.set?.('audio.mute', target.checked);
        } else if (target.name === 'pause-volume') {
          this.settings?.set?.('audio.master', Number(target.value));
        } else if (target.name === 'pause-graphics') {
          this.settings?.set?.('graphics.particles', target.value);
        }
      } catch (err) {
        console.warn('[PauseMenu] errore impostazione', err);
      }
    });
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.game?._setPaused?.(true);

    if (!this.el) return;

    let isMuted = false;
    let vol = 80;
    let gfx = 'med';
    try {
      isMuted = this.settings?.get?.('audio.mute') ?? false;
      vol = this.settings?.get?.('audio.master') ?? 80;
      gfx = this.settings?.get?.('graphics.particles') ?? 'med';
    } catch (err) {
      console.warn('[PauseMenu] lettura impostazioni fallback', err);
    }

    const s = this.game?.state;
    const mins = Math.floor((s?.elapsedSeconds ?? 0) / 60);
    const secs = (s?.elapsedSeconds ?? 0) % 60;
    const timeFormatted = `${mins}m ${secs.toString().padStart(2, '0')}s`;
    const sandFormatted = formatNumber(s?.sand ?? 0);

    this.el.innerHTML = `
      <div class="pause-card panel">
        <header class="pause-header">
          <div class="pause-badge">⏳</div>
          <h2 class="display pause-title">Pausa Spedizione</h2>
          <div class="pause-sub muted">Tempo trascorso: <span class="accent">${timeFormatted}</span> · Sabbia: <span class="accent">${sandFormatted}</span></div>
        </header>

        <div class="pause-quick-settings">
          <h3 class="quick-title">Impostazioni Rapide</h3>

          <div class="pause-row">
            <label class="pause-label" for="pause-vol">Volume Master</label>
            <div class="pause-ctl">
              <input type="range" id="pause-vol" name="pause-volume" min="0" max="100" value="${vol}" class="slider">
              <span class="pause-val">${vol}%</span>
            </div>
          </div>

          <div class="pause-row">
            <label class="pause-label" for="pause-mute">Silenzioso (Muto)</label>
            <div class="pause-ctl">
              <input type="checkbox" id="pause-mute" name="pause-mute" ${isMuted ? 'checked' : ''} class="toggle">
            </div>
          </div>

          <div class="pause-row">
            <label class="pause-label" for="pause-gfx">Qualità Grafica</label>
            <div class="pause-ctl">
              <select id="pause-gfx" name="pause-graphics" class="select">
                <option value="low" ${gfx === 'low' ? 'selected' : ''}>Bassa (Mobile)</option>
                <option value="med" ${gfx === 'med' ? 'selected' : ''}>Media (Bilanciata)</option>
                <option value="high" ${gfx === 'high' ? 'selected' : ''}>Alta (Dettagliata)</option>
              </select>
            </div>
          </div>
        </div>

        <div class="pause-actions">
          <button type="button" class="btn btn-resume" data-act="resume">Riprendi Spedizione</button>
          <button type="button" class="btn btn-secondary" data-act="settings">Tutte le Impostazioni</button>
          <button type="button" class="btn btn-danger" data-act="save-exit">Salva ed Esci</button>
        </div>
      </div>
    `;

    // Sincronizza valore numerico dello slider
    const slider = this.el.querySelector('#pause-vol');
    const valText = this.el.querySelector('.pause-val');
    if (slider && valText) {
      slider.oninput = () => { valText.textContent = `${slider.value}%`; };
    }

    this.el.classList.remove('hidden');
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.el) {
      this.el.classList.remove('visible');
      setTimeout(() => {
        this.el?.classList?.add('hidden');
      }, 300);
    }
    this.game?._setPaused?.(false);
  }

  dispose() {
    if (this.el?.parentElement) {
      this.el.parentElement.removeChild(this.el);
    }
  }
}
