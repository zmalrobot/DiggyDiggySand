// Modale impostazioni: ogni controllo scrive subito su SettingsManager e si risincronizza ai cambi esterni.
import { SCHEMA } from '../core/SettingsManager.js';

const TABS = [
  { id: 'audio', label: 'Audio' },
  { id: 'graphics', label: 'Grafica' },
  { id: 'controls', label: 'Controlli' },
  { id: 'data', label: 'Dati' },
];

const OPTION_LABELS = {
  'graphics.renderScale': { 0.5: '0.5×', 0.75: '0.75×', 1: '1.0×' },
  'graphics.shadows': { off: 'Disattivate', low: 'Basse', high: 'Alte' },
  'graphics.particles': { low: 'Basse', med: 'Medie', high: 'Alte' },
  'graphics.fpsCap': { 30: '30 FPS', 60: '60 FPS', 0: 'Illimitato' },
};

export class SettingsModal {
  constructor({ settings, modal, save, audio }) {
    this.settings = settings;
    this.modal = modal;
    this.save = save;
    this.audio = audio;
  }

  open() {
    this.unsubs = [];
    const root = document.createElement('div');
    root.className = 'settings';
    const tabBar = document.createElement('div');
    tabBar.className = 'tabs';
    tabBar.setAttribute('role', 'tablist');
    const pages = {};
    const body = document.createElement('div');
    body.className = 'tab-body';

    for (const t of TABS) {
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
}

