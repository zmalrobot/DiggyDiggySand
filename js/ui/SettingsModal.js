// Modale impostazioni: ogni controllo scrive subito su SettingsManager e si risincronizza ai cambi esterni.
import { SCHEMA } from '../core/SettingsManager.js';
import { i18n } from '../core/I18n.js';
import { UPGRADE_CATALOG } from '../systems/Upgrades.js';
import { toast } from './Modal.js';

const TABS = [
  { id: 'audio', label: 'Audio' },
  { id: 'graphics', label: 'Grafica' },
  { id: 'controls', label: 'Controlli' },
  { id: 'data', label: 'Dati & Lingua' },
  { id: 'cheats', label: 'Trucchi' },
];

const OPTION_LABELS = {
  'graphics.renderScale': { 0.5: '0.5×', 0.75: '0.75×', 1: '1.0×' },
  'graphics.shadows': { off: 'Disattivate', low: 'Basse', high: 'Alte' },
  'graphics.particles': { low: 'Basse', med: 'Medie', high: 'Alte' },
  'graphics.dayNightCycle': { auto: 'Automatico (Dinamico)', day: 'Sempre Giorno', night: 'Sempre Notte' },
  'graphics.fpsCap': { 30: '30 FPS', 60: '60 FPS', 0: 'Illimitato' },
  'game.language': { it: 'Italiano', en: 'English' },
};

export class SettingsModal {
  constructor({ settings, modal, save, audio, game = null }) {
    this.settings = settings;
    this.modal = modal;
    this.save = save;
    this.audio = audio;
    this.game = game;
  }

  get activeGame() {
    return this.game ?? (typeof window !== 'undefined' ? window.__dds?.game : null);
  }

  get activeState() {
    return this.activeGame?.state ?? null;
  }

  open() {
    this.unsubs = [];
    const root = document.createElement('div');
    root.className = 'settings settings-modal';
    const tabBar = document.createElement('div');
    tabBar.className = 'tabs';
    tabBar.setAttribute('role', 'tablist');
    const pages = {};
    const body = document.createElement('div');
    body.className = 'tab-body';

    const tabs = [
      { id: 'audio', label: i18n.t('settings.tabAudio') || 'Audio' },
      { id: 'graphics', label: i18n.t('settings.tabGraphics') || 'Grafica' },
      { id: 'controls', label: i18n.t('settings.tabControls') || 'Controlli' },
      { id: 'data', label: i18n.t('settings.tabData') || 'Dati & Lingua' },
      { id: 'cheats', label: i18n.t('settings.tabCheats') || 'Trucchi' },
    ];

    for (const t of tabs) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.textContent = t.label;
      b.dataset.tab = t.id;
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => select(t.id));
      tabBar.append(b);
      pages[t.id] = document.createElement('div');
      pages[t.id].className = 'tab-page';
      body.append(pages[t.id]);
    }
    const select = (id) => {
      tabBar.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
      Object.entries(pages).forEach(([k, p]) => p.classList.toggle('hidden', k !== id));
    };

    this._audioTab(pages.audio);
    this._graphicsTab(pages.graphics);
    this._controlsTab(pages.controls);
    this._dataTab(pages.data);
    this._cheatsTab(pages.cheats);
    root.append(tabBar, body);
    select('audio');

    this.handle = this.modal.open({
      title: 'Impostazioni',
      content: root,
      wide: true,
      actions: [{ label: 'Chiudi' }],
      onClose: () => this.unsubs.forEach((u) => u()),
    });
  }

  close() {
    this.handle?.close?.();
  }

  _row(label, control, hint) {
    const row = document.createElement('div');
    row.className = 'row';
    const l = document.createElement('div');
    l.className = 'row-label';
    l.textContent = label;
    if (hint) { const h = document.createElement('small'); h.className = 'muted'; h.textContent = hint; l.append(h); }
    row.append(l, control);
    return row;
  }

  _slider(key, { format = (v) => `${Math.round(v)}%`, previewSfx = false } = {}) {
    const def = SCHEMA[key];
    const wrap = document.createElement('div');
    wrap.className = 'ctl';
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'slider';
    input.min = def.min; input.max = def.max; input.step = def.step;
    const out = document.createElement('span');
    out.className = 'num ctl-val';
    const sync = (v) => { input.value = v; out.textContent = format(v); };
    this.unsubs.push(this.settings.subscribe(key, sync, { immediate: true }));
    input.addEventListener('input', () => this.settings.set(key, input.value));
    if (previewSfx) input.addEventListener('change', () => this.audio?.playClick());
    wrap.append(input, out);
    return wrap;
  }

  _toggle(key, text) {
    const label = document.createElement('label');
    label.className = 'toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    const track = document.createElement('span');
    track.className = 'track';
    const span = document.createElement('span');
    span.className = 'toggle-text';
    const sync = (v) => { input.checked = v; span.textContent = v ? 'Attivo' : 'Disattivo'; };
    this.unsubs.push(this.settings.subscribe(key, sync, { immediate: true }));
    input.addEventListener('change', () => this.settings.set(key, input.checked));
    label.append(input, track, span);
    label.setAttribute('aria-label', text);
    return label;
  }

  _select(key) {
    const def = SCHEMA[key];
    const sel = document.createElement('select');
    sel.className = 'select';
    sel.name = key;
    sel.dataset.key = key;
    for (const v of def.values) {
      const o = document.createElement('option');
      o.value = String(v);
      o.textContent = OPTION_LABELS[key]?.[v] ?? String(v);
      sel.append(o);
    }
    this.unsubs.push(this.settings.subscribe(key, (v) => { sel.value = String(v); }, { immediate: true }));
    sel.addEventListener('change', () => this.settings.set(key, sel.value));
    return sel;
  }

  _audioTab(p) {
    p.append(
      this._row('Volume generale', this._slider('audio.master')),
      this._row('Musica', this._slider('audio.music')),
      this._row('Effetti sonori', this._slider('audio.sfx', { previewSfx: true })),
      this._row('Muto', this._toggle('audio.mute', 'Muto')),
    );
    if (!this.audio?.supported) {
      const n = document.createElement('p');
      n.className = 'muted';
      n.textContent = 'Il tuo browser non supporta Web Audio: l\'audio è disattivato.';
      p.append(n);
    }
  }

  _graphicsTab(p) {
    p.append(
      this._row('Risoluzione di rendering', this._select('graphics.renderScale'), 'Scala della risoluzione interna'),
      this._row('Ombre', this._select('graphics.shadows')),
      this._row('Qualità particelle', this._select('graphics.particles')),
      this._row('Post-Processing (Bloom & Vignette)', this._toggle('graphics.postProcessing', 'Post-Processing'), 'Bagliori emissivi e color grading'),
      this._row('Particelle Atmosferiche', this._toggle('graphics.dustMotes', 'Particelle Atmosferiche'), 'Pulviscolo fluttuante nel cratere'),
      this._row(i18n.t('settings.dayNight') || 'Ciclo Giorno/Notte', this._select('graphics.dayNightCycle'), 'Auto / Giorno / Notte'),
      this._row('Limite FPS', this._select('graphics.fpsCap')),
    );
  }

  _controlsTab(p) {
    p.append(
      this._row('Sensibilità camera', this._slider('controls.cameraSens', { format: (v) => `${Number(v).toFixed(2)}×` })),
      this._row('Inverti asse Y', this._toggle('controls.invertY', 'Inverti asse Y')),
      this._row('Screen shake', this._toggle('controls.screenShake', 'Screen shake')),
    );
  }

  _dataTab(p) {
    p.append(
      this._row(i18n.t('settings.language') || 'Lingua', this._select('game.language'), 'Italiano / English')
    );

    const area = document.createElement('textarea');
    area.className = 'json-area';
    area.rows = 6;
    area.spellcheck = false;
    area.placeholder = 'Incolla qui un JSON di impostazioni da importare…';
    const status = document.createElement('div');
    status.className = 'muted data-status';

    const mkBtn = (label, fn, danger = false) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn${danger ? ' danger' : ''}`;
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    };

    const io = document.createElement('div');
    io.className = 'btn-row';
    io.append(
      mkBtn('Esporta JSON', () => {
        area.value = this.settings.exportJSON();
        status.textContent = 'Impostazioni esportate nel riquadro.';
      }),
      mkBtn('Importa JSON', () => {
        const r = this.settings.importJSON(area.value);
        status.textContent = r.ok ? `Importate ${r.applied} impostazioni modificate.` : `Errore: ${r.error}`;
      }),
    );

    const reset = document.createElement('div');
    reset.className = 'btn-row';
    reset.append(
      mkBtn('Ripristina impostazioni', async () => {
        const ok = await this.modal.confirm({
          title: 'Ripristinare i valori predefiniti?',
          message: 'Tutte le impostazioni torneranno ai valori iniziali. Il salvataggio di gioco non viene toccato.',
          confirmLabel: 'Ripristina',
        });
        if (ok) { this.settings.resetDefaults(); status.textContent = 'Impostazioni ripristinate.'; }
      }),
      mkBtn('Elimina salvataggio', async () => {
        if (!this.save.hasValidSave()) { status.textContent = 'Nessun salvataggio da eliminare.'; return; }
        const ok = await this.modal.confirm({
          title: 'Eliminare il salvataggio?',
          message: 'La spedizione in corso andrà persa per sempre. L\'azione non è reversibile.',
          confirmLabel: 'Elimina definitivamente',
          danger: true,
        });
        if (ok) {
          this.save.clear();
          status.textContent = 'Salvataggio eliminato.';
          document.dispatchEvent(new CustomEvent('dds:save-cleared'));
        }
      }, true),
    );

    p.append(this._row('Impostazioni', io), area, this._row('Reset', reset), status);
  }

  async _requireCheatConfirmation(actionFn) {
    const game = this.activeGame;
    const state = this.activeState;
    if (!state) {
      toast(i18n.t('settings.cheats.notInGame') || 'I trucchi possono essere utilizzati solo durante una spedizione in corso.');
      return;
    }

    if (state.cheatsEnabled) {
      actionFn();
      return;
    }

    const ok = await this.modal.confirm({
      title: i18n.t('settings.cheats.confirmTitle') || 'Attenzione: Modalità Trucchi',
      message: i18n.t('settings.cheats.confirmMsg') || "L'attivazione dei trucchi ti permetterà di modificare liberamente la sabbia, il terreno e gli eventi, ma disabiliterà definitivamente lo sblocco di tutti gli Obiettivi per questa spedizione. Continuare?",
      confirmLabel: i18n.t('settings.cheats.confirmBtn') || 'Conferma e Disabilita Obiettivi',
      cancelLabel: i18n.t('common.cancel') || 'Annulla',
      danger: true,
    });

    if (ok) {
      state.enableCheats();
      game?.saveNow?.();
      this._updateCheatsBanner?.();
      actionFn();
    }
  }

  _cheatsTab(p) {
    const state = this.activeState;
    const game = this.activeGame;

    const banner = document.createElement('div');
    banner.className = 'cheats-status-box';
    this._updateCheatsBanner = () => {
      const active = !!this.activeState?.cheatsEnabled;
      banner.className = `cheats-status-box ${active ? 'active' : 'inactive'}`;
      banner.textContent = active
        ? (i18n.t('settings.cheats.warningActive') || '⚠️ Trucchi attivi: il conseguimento degli Obiettivi è disabilitato per questa partita.')
        : (i18n.t('settings.cheats.warningInactive') || 'L\'attivazione di qualsiasi trucco disabiliterà permanentemente lo sblocco di tutti gli Obiettivi per questa spedizione.');
    };
    this._updateCheatsBanner();
    p.append(banner);

    if (!game?.running && !state) {
      const notice = document.createElement('p');
      notice.className = 'muted';
      notice.textContent = i18n.t('settings.cheats.notInGame') || 'I trucchi possono essere utilizzati solo durante una spedizione in corso.';
      p.append(notice);
      return;
    }

    // 1. Accredito Sabbia
    const sandRow = document.createElement('div');
    sandRow.className = 'btn-row cheats-btn-row';
    const btn100k = document.createElement('button');
    btn100k.id = 'cheat-add-sand-100k';
    btn100k.type = 'button';
    btn100k.className = 'btn';
    btn100k.textContent = i18n.t('settings.cheats.addSand100k') || '+100.000 Sabbia';
    btn100k.addEventListener('click', () => {
      this._requireCheatConfirmation(() => {
        this.activeState?.addSand(100000);
        this.activeGame?.saveNow?.();
        toast('+100.000 Sabbia accreditata!');
      });
    });

    const btn1M = document.createElement('button');
    btn1M.id = 'cheat-add-sand-1m';
    btn1M.type = 'button';
    btn1M.className = 'btn';
    btn1M.textContent = i18n.t('settings.cheats.addSand1M') || '+1.000.000 Sabbia';
    btn1M.addEventListener('click', () => {
      this._requireCheatConfirmation(() => {
        this.activeState?.addSand(1000000);
        this.activeGame?.saveNow?.();
        toast('+1.000.000 Sabbia accreditata!');
      });
    });
    sandRow.append(btn100k, btn1M);
    p.append(this._row(i18n.t('settings.cheats.sandSection') || 'Accredito Sabbia', sandRow));

    // 2. Completamento Scavo Rapido
    const compRow = document.createElement('div');
    compRow.className = 'btn-row cheats-btn-row';
    const makeCompBtn = (pct, labelKey, defaultLabel) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = i18n.t(labelKey) || defaultLabel;
      b.addEventListener('click', () => {
        this._requireCheatConfirmation(() => {
          const g = this.activeGame;
          const s = this.activeState;
          const fraction = pct / 100;
          if (g?.terrain) {
            g.terrain.remainingVolume = g.terrain.initialVolume * (1 - fraction);
          }
          s?.setCompletion(fraction);
          g?.saveNow?.();
          toast(`Completamento scavo impostato al ${pct}%`);
        });
      });
      return b;
    };
    compRow.append(
      makeCompBtn(50, 'settings.cheats.comp50', 'Imposta 50%'),
      makeCompBtn(95, 'settings.cheats.comp95', 'Imposta 95%'),
      makeCompBtn(99, 'settings.cheats.comp99', 'Imposta 99% (Climax)')
    );
    p.append(this._row(i18n.t('settings.cheats.completionSection') || 'Completamento Scavo Rapido', compRow));

    // 3. Forza Finale
    const endingRow = document.createElement('div');
    endingRow.className = 'cheats-select-row';
    const endingSel = document.createElement('select');
    endingSel.className = 'select';
    const endings = [
      { id: 'curse', label: 'La Maledizione di Atlantide (Curse)' },
      { id: 'treasure', label: 'Il Tesoro d\'Oro Puro (Treasure)' },
      { id: 'business', label: 'L\'Impresa di Scavo SRL (Business)' },
      { id: 'secret', label: 'L\'Ascensione di Atlantide (Secret)' },
    ];
    endings.forEach((e) => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.label;
      if (e.id === (state?.endingId || 'curse')) opt.selected = true;
      endingSel.append(opt);
    });

    const triggerEndingBtn = document.createElement('button');
    triggerEndingBtn.type = 'button';
    triggerEndingBtn.className = 'btn btn-primary';
    triggerEndingBtn.textContent = i18n.t('settings.cheats.endingBtn') || 'Avvia Climax Ora';
    triggerEndingBtn.addEventListener('click', () => {
      this._requireCheatConfirmation(() => {
        const endingId = endingSel.value;
        const g = this.activeGame;
        const s = this.activeState;
        if (s) s.endingId = endingId;
        if (g?.terrain) {
          g.terrain.remainingVolume = g.terrain.initialVolume * 0.01;
        }
        s?.setCompletion(0.99);
        if (g?.endingManager) {
          g.endingManager.forceEnding(endingId);
        }
        g?.saveNow?.();
        this.handle?.close?.();
        g?.pauseMenu?.close?.();
        toast(`Finale forzato: ${endingId}`);
      });
    });
    endingRow.append(endingSel, triggerEndingBtn);
    p.append(this._row(i18n.t('settings.cheats.endingSection') || 'Forza Finale di Spedizione', endingRow));

    // 4. Attiva Evento
    const eventsRow = document.createElement('div');
    eventsRow.className = 'btn-row cheats-btn-row';
    const stormBtn = document.createElement('button');
    stormBtn.type = 'button';
    stormBtn.className = 'btn';
    stormBtn.textContent = i18n.t('settings.cheats.eventStorm') || '🌪️ Tempesta di Sabbia';
    stormBtn.addEventListener('click', () => {
      this._requireCheatConfirmation(() => {
        const g = this.activeGame;
        if (g?.worldEvents) {
          g.worldEvents.triggerEvent('sandstorm');
          g.saveNow?.();
          this.handle?.close?.();
          g.pauseMenu?.close?.();
          toast('Tempesta di Sabbia scatenata!');
        }
      });
    });

    const merchantBtn = document.createElement('button');
    merchantBtn.type = 'button';
    merchantBtn.className = 'btn';
    merchantBtn.textContent = i18n.t('settings.cheats.eventMerchant') || '⛺ Mercante Nomade';
    merchantBtn.addEventListener('click', () => {
      this._requireCheatConfirmation(() => {
        const g = this.activeGame;
        if (g?.worldEvents) {
          g.worldEvents.triggerEvent('merchant');
          g.saveNow?.();
          this.handle?.close?.();
          g.pauseMenu?.close?.();
          toast('Carovana Nomade arrivata!');
        }
      });
    });
    eventsRow.append(stormBtn, merchantBtn);
    p.append(this._row(i18n.t('settings.cheats.eventsSection') || 'Attiva Evento nel Deserto', eventsRow));

    // 5. Super Pala (God Mode)
    const godLabel = document.createElement('label');
    godLabel.className = 'toggle';
    const godInput = document.createElement('input');
    godInput.id = 'cheat-god-mode';
    godInput.type = 'checkbox';
    godInput.checked = !!state?.godMode;
    const godTrack = document.createElement('span');
    godTrack.className = 'track';
    const godText = document.createElement('span');
    godText.className = 'toggle-text';
    godText.textContent = godInput.checked ? 'Attivo' : 'Disattivo';

    godInput.addEventListener('change', async () => {
      if (godInput.checked) {
        let confirmed = false;
        await this._requireCheatConfirmation(() => {
          confirmed = true;
          if (this.activeState) this.activeState.godMode = true;
          this.activeGame?.saveNow?.();
          godText.textContent = 'Attivo';
          toast('Super Pala (God Mode) Attivata!');
        });
        if (!confirmed || !this.activeState?.cheatsEnabled) {
          godInput.checked = false;
          godText.textContent = 'Disattivo';
        }
      } else {
        if (this.activeState) this.activeState.godMode = false;
        this.activeGame?.saveNow?.();
        godText.textContent = 'Disattivo';
        toast('Super Pala Disattivata.');
      }
    });
    godLabel.append(godInput, godTrack, godText);
    p.append(this._row(
      i18n.t('settings.cheats.godModeLabel') || 'Super Pala (God Mode)',
      godLabel,
      i18n.t('settings.cheats.godModeHint') || 'Raggio di scavo decuplicato e zero tempo di attesa tra i colpi'
    ));

    // 6. Sblocca Tutti gli Upgrade
    const upgradesRow = document.createElement('div');
    upgradesRow.className = 'btn-row cheats-btn-row';
    const maxUpgradesBtn = document.createElement('button');
    maxUpgradesBtn.type = 'button';
    maxUpgradesBtn.className = 'btn btn-primary';
    maxUpgradesBtn.textContent = i18n.t('settings.cheats.maxUpgradesBtn') || 'Sblocca Tutti gli Upgrade';
    maxUpgradesBtn.addEventListener('click', () => {
      this._requireCheatConfirmation(() => {
        const g = this.activeGame;
        const s = this.activeState;
        if (!s) return;
        for (const [id, def] of Object.entries(UPGRADE_CATALOG)) {
          s.upgrades[id] = def.maxLevel;
        }
        g?.workers?.syncWithUpgrades?.(s.upgrades);
        g?.shop?.render?.();
        g?.economy?.recalculateSPS?.();
        g?.saveNow?.();
        toast('Tutti gli upgrade sbloccati al massimo!');
      });
    });
    upgradesRow.append(maxUpgradesBtn);
    p.append(this._row(i18n.t('settings.cheats.upgradesSection') || 'Potenziamenti Massimi', upgradesRow));
  }
}

