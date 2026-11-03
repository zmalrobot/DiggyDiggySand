// Schermata di caricamento: progresso da THREE.LoadingManager, lore a rotazione, pulsante "Inizia Spedizione".
const TIPS = [
  'La sabbia non mente: ogni granello rimosso avvicina la città dimenticata.',
  'Gli Atlantidei chiamavano l\'oricalco "il metallo che ricorda la luce".',
  'Tieni premuto per scavare senza sosta. Le mani stanche non esistono per un faraone.',
  'I Nomadi scavano piano, ma non dormono mai.',
  'Sotto le dune, qualcosa pulsa di luce turchese. Non è un miraggio.',
  'Un colpo critico splende come il sole di mezzogiorno: cerca le scintille dorate.',
  'Gli obelischi puntano al cielo perché ciò che sta sotto non dovrebbe essere ignorato.',
  'Non tutte le spedizioni finiscono allo stesso modo. Nessuno sa cosa troverà.',
];

export class LoadingScreen {
  constructor(root) {
    this.root = root;
    this.display = 0;   // progresso mostrato (monotono, con easing)
    this.target = 0;    // progresso reale
    this.finished = false;
    this.tipIndex = Math.floor(Math.random() * TIPS.length);
    this._build();
  }

  _build() {
    this.root.classList.add('loading-screen');
    this.root.innerHTML = `
      <div class="loading-inner">
        <h1 class="display loading-title">Diggy Diggy Sand</h1>
        <div class="loading-sub">Preparazione della spedizione</div>
        <div class="loading-bar-wrap">
          <div class="obelisk-bar glow"><div class="fill"></div></div>
          <div class="loading-pct num">0%</div>
        </div>
        <div class="loading-status muted">Risveglio degli antichi meccanismi…</div>
        <p class="loading-tip"></p>
        <button type="button" class="btn start-btn hidden">Inizia Spedizione</button>
      </div>`;
    this.bar = this.root.querySelector('.obelisk-bar');
    this.pct = this.root.querySelector('.loading-pct');
    this.status = this.root.querySelector('.loading-status');
    this.tip = this.root.querySelector('.loading-tip');
    this.btn = this.root.querySelector('.start-btn');
    this._showTip();
    this.tipTimer = setInterval(() => this._showTip(), 3400);
  }

  _showTip() {
    this.tip.classList.add('swap');
    setTimeout(() => {
      this.tip.textContent = TIPS[this.tipIndex++ % TIPS.length];
      this.tip.classList.remove('swap');
    }, 280);
  }

  _render() {
    const p = Math.round(this.display * 100);
    this.bar.style.setProperty('--p', p);
    this.pct.textContent = `${p}%`;
  }

  /**
   * Avvia il monitoraggio. Risolve al click su "Inizia Spedizione" (dopo la dissolvenza).
   * @param {THREE.LoadingManager} manager
   * @param {Promise} loadPromise risolta a fine caricamento (anche con fallback)
   * @param {{audio, report}} hooks
   */
  run(manager, loadPromise, { audio, getReport } = {}) {
    manager.onProgress = (_url, loaded, total) => {
      if (total > 0) this.target = Math.max(this.target, loaded / total);
    };
    loadPromise.then(() => {
      this.target = 1;
      this.finished = true;
      const fb = getReport?.().fallback.length ?? 0;
      this.status.textContent = fb
        ? `Pronto. ${fb} risorse sostituite da versioni procedurali.`
        : 'Pronto.';
    });

    // Easing verso il target, velocità minima: la barra non salta mai e il lore resta leggibile.
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      const diff = this.target - this.display;
      if (diff > 0) this.display = Math.min(this.target, this.display + Math.max(diff * 4 * dt, 0.22 * dt));
      this._render();
      if (this.display >= 0.999 && this.finished) {
        this.display = 1;
        this._render();
        this.btn.classList.remove('hidden');
        this.btn.focus({ preventScroll: true });
        return;
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);

    return new Promise((resolve) => {
      this.btn.addEventListener('click', async () => {
        this.btn.disabled = true;
        // Il click è il gesto utente che sblocca l'AudioContext.
        await audio?.unlock();
        audio?.playConfirm();
        clearInterval(this.tipTimer);
        this.root.classList.add('fade-out');
        setTimeout(() => { this.root.classList.add('hidden'); resolve(); }, 650);
      }, { once: true });
    });
  }

  showError(message) {
    this.status.textContent = message;
    this.status.classList.add('error');
  }
}

