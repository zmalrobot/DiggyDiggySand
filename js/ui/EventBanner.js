// Banner animato di notifica per gli Eventi Spontanei (Tempesta, Mercante).
export class EventBanner {
  constructor(root = document.body) {
    this.root = root;
    this.el = null;
    this.timeout = null;
    this.hideTimeout = null;
    this._build();
  }

  _build() {
    this.el = document.createElement('div');
    this.el.className = 'event-banner hidden';
    this.root.appendChild(this.el);

    this.el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-event-action]');
      if (!btn) return;
      if (btn.dataset.eventAction === 'merchant') {
        this.onAction?.();
      }
    });
  }

  show({ icon = '✦', title = '', message = '', duration = 8000, actionLabel = null, onAction = null }) {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    this.onAction = onAction;

    this.el.innerHTML = `
      <div class="event-banner-card panel">
        <div class="event-banner-icon">${icon}</div>
        <div class="event-banner-body">
          <div class="event-banner-title">${title}</div>
          <div class="event-banner-msg">${message}</div>
        </div>
        ${actionLabel ? `<button type="button" class="btn event-banner-btn" data-event-action="merchant">${actionLabel}</button>` : ''}
      </div>
    `;

    this.el.classList.remove('hidden');
    requestAnimationFrame(() => this.el.classList.add('visible'));

    if (duration > 0) {
      this.timeout = setTimeout(() => this.hide(), duration);
    }
  }

  hide() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    this.el.classList.remove('visible');
    this.hideTimeout = setTimeout(() => {
      this.el.classList.add('hidden');
      this.hideTimeout = null;
    }, 350);
  }

  dispose() {
    if (this.timeout) clearTimeout(this.timeout);
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    if (this.el?.parentElement) {
      this.el.parentElement.removeChild(this.el);
    }
  }
}

