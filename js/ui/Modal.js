// Modali e toast in stile vetro/oro. Il contenitore #modal-root si nasconde da solo quando è vuoto.
import { i18n } from '../core/I18n.js';

export class ModalManager {
  constructor(root) {
    this.root = root;
    this.stack = [];
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.stack.length) this.stack[this.stack.length - 1].close();
    });
  }

  /** content: Node | string. actions: [{label, onClick, danger, keepOpen}] */
  open({ title, content, actions = [], wide = false, onClose } = {}) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const panel = document.createElement('div');
    panel.className = `panel modal${wide ? ' wide' : ''}`;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');

    if (title) {
      const h = document.createElement('h2');
      h.className = 'modal-title';
      h.textContent = title;
      panel.append(h);
    }
    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof content === 'string') {
      const p = document.createElement('p');
      p.textContent = content;
      body.append(p);
    } else if (content) body.append(content);
    panel.append(body);

    const handle = {
      close: () => {},
      panel,
      setTitle: (newTitle) => {
        const h = panel.querySelector('.modal-title');
        if (h) h.textContent = newTitle;
      },
      setActionLabel: (index, newLabel) => {
        const btns = panel.querySelectorAll('.modal-actions .btn');
        if (btns[index]) btns[index].textContent = newLabel;
      },
    };
    if (actions.length) {
      const bar = document.createElement('div');
      bar.className = 'modal-actions';
      for (const a of actions) {
        const b = document.createElement('button');
        b.type = 'button';
        if (a.id) b.id = a.id;
        b.className = `btn${a.danger ? ' danger' : ''}${a.className ? ` ${a.className}` : ''}`;
        b.textContent = a.label;
        b.addEventListener('click', () => {
          a.onClick?.();
          if (!a.keepOpen) handle.close();
        });
        bar.append(b);
      }
      panel.append(bar);
    }

    backdrop.append(panel);
    backdrop.addEventListener('pointerdown', (e) => { if (e.target === backdrop) handle.close(); });
    this.root.append(backdrop);

    let closed = false;
    handle.close = () => {
      if (closed) return;
      closed = true;
      this.stack = this.stack.filter((h) => h !== handle);
      backdrop.remove();
      onClose?.();
    };
    this.stack.push(handle);
    panel.querySelector('.btn')?.focus({ preventScroll: true });
    return handle;
  }

  closeTop() {
    if (this.stack.length) this.stack[this.stack.length - 1].close();
  }

  close() {
    this.closeTop();
  }

  /** Conferma di sicurezza. Risolve true/false. */
  confirm({
    title,
    message,
    confirmLabel = i18n.t('common.confirm') || 'Conferma',
    cancelLabel = i18n.t('common.cancel') || 'Annulla',
    danger = false,
  }) {
    return new Promise((resolve) => {
      let answered = false;
      const answer = (v) => { answered = true; resolve(v); };
      this.open({
        title,
        content: message,
        actions: [
          { label: confirmLabel, danger, className: 'btn-confirm-action', id: 'btn-confirm-overwrite', onClick: () => answer(true) },
          { label: cancelLabel, className: 'btn-secondary btn-cancel-action', id: 'btn-cancel-overwrite', onClick: () => answer(false) },
        ],
        onClose: () => { if (!answered) resolve(false); },
      });
    });
  }
}

export function toast(message, ms = 4200) {
  if (typeof document === 'undefined') return;
  let host = document.getElementById('toast-host');

  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    document.body.append(host);
  }
  const el = document.createElement('div');
  el.className = 'panel toast';
  el.textContent = message;
  host.append(el);
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 500); }, ms);
}

