// Menu di Pausa in-game dedicato (Fase 5 Polish & UI).
// Fornisce opzioni rapide (audio, grafica), ripresa e salvataggio/uscita sincronizzato.
import { formatNumber } from './Hud.js';
import { PrestigeModal } from './PrestigeModal.js';
import { StatsModal } from './StatsModal.js';
import { i18n } from '../core/I18n.js';
import { events } from '../core/Events.js';

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
    this._unsubLang = events.on('language:changed', () => {
      if (this.isOpen) this._renderContent();
    });
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
      } else if (act === 'stats') {
        new StatsModal(this.game?.modal, this.game?.statsManager, this.game?.achievements, this.audio).open();
      } else if (act === 'wardrobe') {
        this.game?.openWardrobe?.();
      } else if (act === 'prestige') {
        new PrestigeModal(this.game?.modal, this.save, this.game?.state, this.audio).open();
      } else if (act === 'settings') {
        if (this.settingsModal) this.settingsModal.game = this.game;
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

  _renderContent() {
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

    const titleText = i18n.t('pause.title') || 'Pausa Spedizione';
    const elapsedLabel = i18n.t('pause.elapsed') || 'Tempo trascorso';
    const sandLabel = i18n.t('hud.sand') || 'Sabbia';
    const quickTitle = i18n.t('pause.quickSettings') || 'Impostazioni Rapide';
    const masterVolLabel = i18n.t('settings.masterVolume') || 'Volume Master';
    const muteLabel = i18n.t('settings.mute') || 'Silenzioso (Muto)';
    const gfxLabel = i18n.t('settings.graphicsQuality') || 'Qualità Grafica';
    const optLow = i18n.t('settings.graphicsOptions.low') || 'Bassa (Mobile)';
    const optMed = i18n.t('settings.graphicsOptions.med') || 'Media (Bilanciata)';
    const optHigh = i18n.t('settings.graphicsOptions.high') || 'Alta (Dettagliata)';

    this.el.innerHTML = `
      <div class="pause-card panel">
        <header class="pause-header">
          <div class="pause-badge">⏳</div>
          <h2 class="display pause-title" data-i18n="pause.title">${titleText}</h2>
          <div class="pause-sub muted">${elapsedLabel}: <span class="accent">${timeFormatted}</span> · ${sandLabel}: <span class="accent">${sandFormatted}</span></div>
        </header>

        <div class="pause-quick-settings">
          <h3 class="quick-title" data-i18n="pause.quickSettings">${quickTitle}</h3>

          <div class="pause-row">
            <label class="pause-label" for="pause-vol" data-i18n="settings.masterVolume">${masterVolLabel}</label>
            <div class="pause-ctl">
              <input type="range" id="pause-vol" name="pause-volume" min="0" max="100" value="${vol}" class="slider">
              <span class="pause-val">${vol}%</span>
            </div>
          </div>

          <div class="pause-row">
            <label class="pause-label" for="pause-mute" data-i18n="settings.mute">${muteLabel}</label>
            <div class="pause-ctl">
              <input type="checkbox" id="pause-mute" name="pause-mute" ${isMuted ? 'checked' : ''} class="toggle">
            </div>
          </div>

          <div class="pause-row">
            <label class="pause-label" for="pause-gfx" data-i18n="settings.graphicsQuality">${gfxLabel}</label>
            <div class="pause-ctl">
              <select id="pause-gfx" name="pause-graphics" class="select">
                <option value="low" ${gfx === 'low' ? 'selected' : ''}>${optLow}</option>
                <option value="med" ${gfx === 'med' ? 'selected' : ''}>${optMed}</option>
                <option value="high" ${gfx === 'high' ? 'selected' : ''}>${optHigh}</option>
              </select>
            </div>
          </div>
        </div>

        <div class="pause-actions">
          <button type="button" class="btn btn-resume" data-act="resume" data-i18n="pause.resume">${i18n.t('pause.resume') || 'Riprendi Spedizione'}</button>
          <button type="button" class="btn btn-secondary" data-act="stats" data-i18n="pause.stats">${i18n.t('pause.stats') || 'Statistiche & Trofei'}</button>
          <button type="button" class="btn btn-secondary" data-act="wardrobe" data-i18n="pause.wardrobe">${i18n.t('pause.wardrobe') || 'Guardaroba & Skin'}</button>
          <button type="button" class="btn btn-secondary" data-act="prestige"><span data-i18n="pause.prestige">${i18n.t('pause.prestige') || 'Santuario dei Predecessori'}</span> (τ ${this.save?.getTablets?.() ?? 0})</button>
          <button type="button" class="btn btn-secondary" data-act="settings" data-i18n="settings.title">${i18n.t('settings.title') || 'Tutte le Impostazioni'}</button>
          <button type="button" class="btn btn-danger" data-act="save-exit" data-i18n="pause.saveAndExit">${i18n.t('pause.saveAndExit') || 'Salva ed Esci'}</button>
        </div>
      </div>
    `;

    // Sincronizza valore numerico dello slider
    const slider = this.el.querySelector('#pause-vol');
    const valText = this.el.querySelector('.pause-val');
    if (slider && valText) {
      slider.oninput = () => { valText.textContent = `${slider.value}%`; };
    }
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.game?._setPaused?.(true);
    if (!this.el) return;

    this._renderContent();
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
    this._unsubLang?.();
    if (this.el?.parentElement) {
      this.el.parentElement.removeChild(this.el);
    }
  }
}
