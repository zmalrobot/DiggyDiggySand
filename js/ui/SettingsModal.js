// Modale impostazioni: ogni controllo scrive subito su SettingsManager e si risincronizza ai cambi esterni.
import { SCHEMA } from '../core/SettingsManager.js';
import { i18n } from '../core/I18n.js';
import { events } from '../core/Events.js';
import { UPGRADE_CATALOG } from '../systems/Upgrades.js';
import { toast } from './Modal.js';
import { SaveSerializer } from '../core/SaveSerializer.js';

function getOptionLabel(key, val) {
  const v = String(val);
  if (key === 'graphics.renderScale') return `${v}×`;
  if (key === 'graphics.shadows') {
    return i18n.t(`settings.shadowsOptions.${v}`) || (v === 'off' ? 'Disattivate' : v === 'low' ? 'Basse' : 'Alte');
  }
  if (key === 'graphics.particles') {
    return i18n.t(`settings.graphicsOptions.${v}`) || (v === 'low' ? 'Basse' : v === 'med' ? 'Medie' : 'Alte');
  }
  if (key === 'graphics.dayNightCycle') {
    return i18n.t(`settings.dayNightOptions.${v}`) || (v === 'auto' ? 'Automatico' : v === 'day' ? 'Giorno' : 'Notte');
  }
  if (key === 'graphics.fpsCap') {
    return i18n.t(`settings.fpsOptions.${v}`) || (v === '0' ? 'Illimitato' : `${v} FPS`);
  }
  if (key === 'graphics.modelStyle') {
    if (v === 'gltf') {
      return i18n.t('settings.graphics.model_style_gltf') || 'Modelli Esterni GLTF (Consigliato)';
    }
    return i18n.t('settings.graphics.model_style_procedural') || 'Procedurali Matematici';
  }
  if (key === 'game.language') {
    return i18n.t(`settings.languageOptions.${v}`) || (v === 'it' ? 'Italiano' : 'English');
  }
  if (key === 'game.notation') {
    return i18n.t(`settings.notationOptions.${v}`) || (v === 'standard' ? 'Standard (1.2k)' : v === 'scientific' ? 'Scientifica (1.2e3)' : 'Ingegneristica (1.20e3)');
  }
  return v;
}

export class SettingsModal {
  constructor({ settings, modal, save, audio, game = null }) {
    this.settings = settings;
    this.modal = modal;
    this.save = save;
    this.audio = audio;
    this.game = game;
    this.currentTab = 'audio';
    this.unsubs = [];
    this.modalRoot = null;
    this.handle = null;

    events.on('language:changed', () => {
      if (this.handle && this.modalRoot) {
        this._renderModalBody(this.modalRoot, this.currentTab);
        this.handle.setTitle?.(i18n.t('settings.title') || 'Impostazioni');
        this.handle.setActionLabel?.(0, i18n.t('common.close') || 'Chiudi');
      }
    });
  }

  get activeGame() {
    return this.game ?? (typeof window !== 'undefined' ? window.__dds?.game : null);
  }

  get activeState() {
    return this.activeGame?.state ?? null;
  }

  open(tab = null) {
    if (tab) this.currentTab = tab;
    this.modalRoot = document.createElement('div');
    this.modalRoot.className = 'settings settings-modal';
    this._renderModalBody(this.modalRoot, this.currentTab || 'audio');

    this.handle = this.modal.open({
      title: i18n.t('settings.title') || 'Impostazioni',
      content: this.modalRoot,
      wide: true,
      actions: [{ label: i18n.t('common.close') || 'Chiudi' }],
      onClose: () => {
        this.unsubs.forEach((u) => u());
        this.unsubs = [];
        this.handle = null;
        this.modalRoot = null;
      },
    });
  }

  close() {
    this.handle?.close?.();
  }

  _renderModalBody(root, activeTabId = 'audio') {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    root.innerHTML = '';

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
      this.currentTab = id;
      tabBar.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
      Object.entries(pages).forEach(([k, p]) => p.classList.toggle('hidden', k !== id));
    };

    this._audioTab(pages.audio);
    this._graphicsTab(pages.graphics);
    this._controlsTab(pages.controls);
    this._dataTab(pages.data);
    this._cheatsTab(pages.cheats);

    root.append(tabBar, body);
    select(activeTabId);
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
    input.name = key;
    input.dataset.key = key;
    const track = document.createElement('span');
    track.className = 'track';
    const span = document.createElement('span');
    span.className = 'toggle-text';
    const sync = (v) => {
      input.checked = v;
      span.textContent = v ? (i18n.t('settings.active') || 'Attivo') : (i18n.t('settings.inactive') || 'Disattivo');
    };
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
      o.textContent = getOptionLabel(key, v);
      sel.append(o);
    }
    this.unsubs.push(this.settings.subscribe(key, (v) => { sel.value = String(v); }, { immediate: true }));
    sel.addEventListener('change', () => {
      const val = key === 'graphics.renderScale' || key === 'graphics.fpsCap' ? Number(sel.value) : sel.value;
      this.settings.set(key, val);
    });
    return sel;
  }

  _audioTab(p) {
    p.append(
      this._row(i18n.t('settings.masterVolume') || 'Volume generale', this._slider('audio.master')),
      this._row(i18n.t('settings.musicVolume') || 'Musica', this._slider('audio.music')),
      this._row(i18n.t('settings.sfxVolume') || 'Effetti sonori', this._slider('audio.sfx', { previewSfx: true })),
      this._row(i18n.t('settings.mute') || 'Muto', this._toggle('audio.mute', i18n.t('settings.mute') || 'Muto')),
    );
    if (!this.audio?.supported) {
      const n = document.createElement('p');
      n.className = 'muted';
      n.textContent = i18n.t('settings.webAudioUnsupported') || 'Il tuo browser non supporta Web Audio: l\'audio è disattivato.';
      p.append(n);
    }
  }

  _graphicsTab(p) {
    p.append(
      this._row(i18n.t('settings.renderScale') || 'Risoluzione di rendering', this._select('graphics.renderScale'), i18n.t('settings.renderScaleHint') || 'Scala della risoluzione interna'),
      this._row(
        i18n.t('settings.graphics.model_style_label') || 'Stile Modelli 3D',
        this._select('graphics.modelStyle'),
        i18n.t('settings.graphics.model_style_hint') || 'Alterna tra modelli low-poly GLTF di Kenney/Quaternius e geometrie procedurali matematiche'
      ),
      this._row(i18n.t('settings.shadows') || 'Ombre', this._select('graphics.shadows')),
      this._row(i18n.t('settings.graphicsQuality') || 'Qualità particelle', this._select('graphics.particles')),
      this._row(i18n.t('settings.postProcessing') || 'Post-Processing (Bloom & Vignette)', this._toggle('graphics.postProcessing', 'Post-Processing'), i18n.t('settings.postProcessingHint') || 'Bagliori emissivi e color grading'),
      this._row(i18n.t('settings.dustMotes') || 'Particelle Atmosferiche', this._toggle('graphics.dustMotes', 'Particelle Atmosferiche'), i18n.t('settings.dustMotesHint') || 'Pulviscolo fluttuante nel cratere'),
      this._row(i18n.t('settings.dayNight') || 'Ciclo Giorno/Notte', this._select('graphics.dayNightCycle'), i18n.t('settings.dayNightHint') || 'Auto / Giorno / Notte'),
      this._row(i18n.t('settings.fpsCap') || 'Limite FPS', this._select('graphics.fpsCap')),
      this._row(
        i18n.t('settings.showProfiler') || 'Mostra Diagnostica & FPS',
        this._toggle('graphics.showProfiler', i18n.t('settings.showProfiler') || 'Mostra Diagnostica & FPS'),
        i18n.t('settings.showProfilerHint') || 'Visualizza framerate, chiamate GPU e utilizzo memoria (F3)'
      ),
      this._row(
        i18n.t('settings.raytracingSSR') || 'Raytracing & Riflessi SSR (Sperimentale)',
        this._toggle('graphics.raytracingSSR', i18n.t('settings.raytracingSSR') || 'Raytracing & Riflessi SSR'),
        i18n.t('settings.raytracingSSRHint') || 'Simula riflessi fotorealistici nello spazio dello schermo. Richiede GPU dedicata (Disattivato di default).'
      ),
      this._row(
        i18n.t('settings.reducedMotion') || 'Riduzione Movimento (Accessibilità)',
        this._toggle('accessibility.reducedMotion', i18n.t('settings.reducedMotion') || 'Riduzione Movimento'),
        i18n.t('settings.reducedMotionHint') || 'Disabilita camera shake, particelle rapide e attenua le transizioni visive'
      ),
    );
  }

  _controlsTab(p) {
    p.append(
      this._row(i18n.t('settings.cameraSens') || 'Sensibilità camera', this._slider('controls.cameraSens', { format: (v) => `${Number(v).toFixed(2)}×` })),
      this._row(i18n.t('settings.invertY') || 'Inverti asse Y', this._toggle('controls.invertY', i18n.t('settings.invertY') || 'Inverti asse Y')),
      this._row(i18n.t('settings.screenShake') || 'Screen shake', this._toggle('controls.screenShake', i18n.t('settings.screenShake') || 'Screen shake')),
      this._row(
        i18n.t('settings.haptics') || 'Feedback aptico (Vibrazione)',
        this._toggle('controls.haptics', i18n.t('settings.haptics') || 'Feedback aptico'),
        i18n.t('settings.hapticsHint') || 'Vibrazioni tattili su scavi, critici ed esplosioni'
      ),
    );
  }

  _dataTab(p) {
    const mkBtn = (label, fn, danger = false) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn${danger ? ' danger' : ''}`;
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    };

    p.append(
      this._row(i18n.t('settings.language') || 'Lingua', this._select('game.language'), 'Italiano / English'),
      this._row(
        i18n.t('settings.notation') || 'Notazione Numerica',
        this._select('game.notation'),
        i18n.t('settings.notationHint') || 'Formato numeri: Standard (1.2k), Scientifica (1.2e3) o Ingegneristica'
      ),
    );

    const saveSectionTitle = document.createElement('h4');
    saveSectionTitle.className = 'settings-subhead';
    saveSectionTitle.textContent = i18n.t('settings.saveSectionTitle') || 'Salvataggio Spedizione (Portabile Base64)';
    p.append(saveSectionTitle);

    const saveArea = document.createElement('textarea');
    saveArea.className = 'json-area';
    saveArea.dataset.saveArea = 'true';
    saveArea.rows = 3;
    saveArea.spellcheck = false;
    saveArea.placeholder = i18n.t('settings.savePlaceholder') || 'Incolla qui la stringa del salvataggio Base64 (DDS1_…) per importarla…';
    const saveStatus = document.createElement('div');
    saveStatus.className = 'muted data-status';

    const saveBtns = document.createElement('div');
    saveBtns.className = 'btn-row';
    const exportSaveBtn = mkBtn(i18n.t('settings.exportSave') || 'Esporta Salvataggio', async () => {
      const game = this.activeGame;
      if (game?.saveNow) {
        game.saveNow();
      }
      const res = await SaveSerializer.exportToClipboard(this.save?.storage);
      if (res.ok) {
        saveArea.value = res.code;
        saveStatus.textContent = i18n.t('settings.saveExportedStatus') || 'Salvataggio copiato negli appunti e mostrato nel riquadro.';
        toast(i18n.t('settings.saveExportedToast') || 'Salvataggio copiato negli appunti!');
      } else {
        saveStatus.textContent = `${i18n.t('settings.errorStatus') || 'Errore'}: ${res.error}`;
      }
    });
    exportSaveBtn.dataset.act = 'export-save';

    const importSaveBtn = mkBtn(i18n.t('settings.importSave') || 'Importa Salvataggio', async () => {
      const code = saveArea.value.trim();
      if (!code) {
        saveStatus.textContent = i18n.t('settings.saveEmptyError') || 'Incolla prima una stringa di salvataggio valida.';
        return;
      }
      const ok = await this.modal.confirm({
        title: i18n.t('settings.confirmImportSaveTitle') || 'Sovrascrivere la spedizione?',
        message: i18n.t('settings.confirmImportSaveMsg') || 'L\'importazione sostituirà i progressi attuali della spedizione con quelli del codice incollato. Continuare?',
        confirmLabel: i18n.t('common.confirm') || 'Conferma',
        cancelLabel: i18n.t('common.cancel') || 'Annulla',
      });
      if (ok) {
        const res = SaveSerializer.importFromCode(code, this.save?.storage);
        if (res.ok) {
          saveStatus.textContent = i18n.t('settings.saveImportedSuccess') || 'Salvataggio importato con successo! Ricarico la sessione...';
          toast(i18n.t('settings.saveImportedToast') || 'Salvataggio importato!');
          setTimeout(() => {
            if (typeof window !== 'undefined' && window.location) {
              window.location.reload();
            }
          }, 650);
        } else {
          saveStatus.textContent = `${i18n.t('settings.errorStatus') || 'Errore'}: ${res.error}`;
        }
      }
    });
    importSaveBtn.dataset.act = 'import-save';

    saveBtns.append(exportSaveBtn, importSaveBtn);
    p.append(saveArea, saveBtns, saveStatus);

    const configSectionTitle = document.createElement('h4');
    configSectionTitle.className = 'settings-subhead';
    configSectionTitle.textContent = i18n.t('settings.settingsBackup') || 'Backup Preferenze (JSON)';
    p.append(configSectionTitle);

    const area = document.createElement('textarea');
    area.className = 'json-area';
    area.rows = 4;
    area.spellcheck = false;
    area.placeholder = i18n.t('settings.jsonPlaceholder') || 'Incolla qui un JSON di impostazioni da importare…';
    const status = document.createElement('div');
    status.className = 'muted data-status';

    const io = document.createElement('div');
    io.className = 'btn-row';
    io.append(
      mkBtn(i18n.t('settings.exportJson') || 'Esporta JSON', () => {
        area.value = this.settings.exportJSON();
        status.textContent = i18n.t('settings.exportedStatus') || 'Impostazioni esportate nel riquadro.';
      }),
      mkBtn(i18n.t('settings.importJson') || 'Importa JSON', () => {
        const r = this.settings.importJSON(area.value);
        status.textContent = r.ok
          ? (i18n.t('settings.importedStatus', { count: r.applied }) || `Importate ${r.applied} impostazioni modificate.`)
          : `${i18n.t('settings.errorStatus') || 'Errore'}: ${r.error}`;
      }),
    );

    const reset = document.createElement('div');
    reset.className = 'btn-row';
    reset.append(
      mkBtn(i18n.t('settings.resetDefaults') || 'Ripristina impostazioni', async () => {
        const ok = await this.modal.confirm({
          title: i18n.t('settings.resetTitle') || 'Ripristinare i valori predefiniti?',
          message: i18n.t('settings.resetMsg') || 'Tutte le impostazioni torneranno ai valori iniziali. Il salvataggio di gioco non viene toccato.',
          confirmLabel: i18n.t('settings.resetConfirm') || 'Ripristina',
          cancelLabel: i18n.t('common.cancel') || 'Annulla',
        });
        if (ok) {
          this.settings.resetDefaults();
          status.textContent = i18n.t('settings.resetDone') || 'Impostazioni ripristinate.';
        }
      }),
      mkBtn(i18n.t('settings.deleteSave') || 'Elimina salvataggio', async () => {
        if (!this.save.hasValidSave()) {
          status.textContent = i18n.t('settings.noSaveToDelete') || 'Nessun salvataggio da eliminare.';
          return;
        }
        const ok = await this.modal.confirm({
          title: i18n.t('settings.deleteSaveTitle') || 'Eliminare il salvataggio?',
          message: i18n.t('settings.deleteSaveMsg') || 'La spedizione in corso andrà persa per sempre. L\'azione non è reversibile.',
          confirmLabel: i18n.t('settings.deleteSaveConfirm') || 'Elimina definitivamente',
          cancelLabel: i18n.t('common.cancel') || 'Annulla',
          danger: true,
        });
        if (ok) {
          this.save.clear();
          status.textContent = i18n.t('settings.saveDeleted') || 'Salvataggio eliminato.';
          document.dispatchEvent(new CustomEvent('dds:save-cleared'));
        }
      }, true),
    );

    p.append(
      this._row(i18n.t('settings.settingsBackup') || 'Backup Impostazioni', io),
      area,
      this._row(i18n.t('settings.resetSection') || 'Reset & Dati', reset),
      status
    );
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
        toast(i18n.t('settings.cheats.sandAdded100k') || '+100.000 Sabbia accreditata!');
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
        toast(i18n.t('settings.cheats.sandAdded1M') || '+1.000.000 Sabbia accreditata!');
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
          toast(i18n.t('settings.cheats.compSet', { pct }) || `Completamento scavo impostato al ${pct}%`);
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
      { id: 'curse', label: i18n.t('endings.curse.title') || 'La Maledizione di Atlantide' },
      { id: 'treasure', label: i18n.t('endings.treasure.title') || 'Il Tesoro d\'Oro Puro' },
      { id: 'business', label: i18n.t('endings.business.title') || 'L\'Impresa di Scavo SRL' },
      { id: 'secret', label: i18n.t('endings.secret.title') || 'L\'Ascensione di Atlantide' },
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
        toast(i18n.t('settings.cheats.endingForced', { ending: endingId }) || `Finale forzato: ${endingId}`);
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
          toast(i18n.t('settings.cheats.stormTriggered') || 'Tempesta di Sabbia scatenata!');
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
          toast(i18n.t('settings.cheats.merchantTriggered') || 'Carovana Nomade arrivata!');
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
    godText.textContent = godInput.checked
      ? (i18n.t('settings.active') || 'Attivo')
      : (i18n.t('settings.inactive') || 'Disattivo');

    godInput.addEventListener('change', async () => {
      if (godInput.checked) {
        let confirmed = false;
        await this._requireCheatConfirmation(() => {
          confirmed = true;
          if (this.activeState) this.activeState.godMode = true;
          this.activeGame?.saveNow?.();
          godText.textContent = i18n.t('settings.active') || 'Attivo';
          toast(i18n.t('settings.cheats.godModeOn') || 'Super Pala (God Mode) Attivata!');
        });
        if (!confirmed || !this.activeState?.cheatsEnabled) {
          godInput.checked = false;
          godText.textContent = i18n.t('settings.inactive') || 'Disattivo';
        }
      } else {
        if (this.activeState) this.activeState.godMode = false;
        this.activeGame?.saveNow?.();
        godText.textContent = i18n.t('settings.inactive') || 'Disattivo';
        toast(i18n.t('settings.cheats.godModeOff') || 'Super Pala Disattivata.');
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
        toast(i18n.t('settings.cheats.maxUpgradesDone') || 'Tutti gli upgrade sbloccati al massimo!');
      });
    });
    upgradesRow.append(maxUpgradesBtn);
    p.append(this._row(i18n.t('settings.cheats.upgradesSection') || 'Potenziamenti Massimi', upgradesRow));
  }
}
