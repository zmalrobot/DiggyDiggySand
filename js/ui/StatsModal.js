// Modale Statistiche di Carriera e Registro Trofei (Art Bible §2, §6).
// Doppia scheda (Carriera / Trofei) con numeri in font Syne e banner lockout trucchi persistente.
import { i18n } from '../core/I18n.js';
import { events } from '../core/Events.js';
import { formatNumber } from './Hud.js';

function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds < 0) return '0s';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export class StatsModal {
  constructor(modal, statsManager, achievements, audio) {
    this.modal = modal;
    this.statsManager = statsManager;
    this.achievements = achievements;
    this.audio = audio;
    this.currentTab = 'stats';
    this.root = null;
    this.handle = null;

    this._unsubLang = events.on('language:changed', () => {
      if (this.handle && this.root) {
        this._renderContent();
        this.handle.setTitle?.(i18n.t('stats.title'));
        this.handle.setActionLabel?.(0, i18n.t('common.close'));
      }
    });
  }

  _renderContent() {
    if (!this.root) return;
    this.root.innerHTML = '';

    const isCheated = !!(
      this.achievements?.state?.cheatsEnabled ||
      this.statsManager?.state?.cheatsEnabled ||
      (typeof window !== 'undefined' && window.__dds?.game?.state?.cheatsEnabled) ||
      (typeof window !== 'undefined' && window.__dds?.save?.load?.()?.cheatsEnabled)
    );

    // Banner di Lockout Permanente in cima al modale se i trucchi sono stati usati
    if (isCheated) {
      const banner = document.createElement('div');
      banner.className = 'cheats-lockout-banner';
      banner.setAttribute('role', 'alert');
      banner.innerHTML = `
        <span class="lockout-icon">⚠️</span>
        <span class="lockout-text">${i18n.t('stats.cheatsWarning') || '[ ⚠ MODALITÀ TRUCCHI ATTIVA — TROFEI DISABILITATI PER QUESTA SPEDIZIONE ]'}</span>
      `;
      this.root.appendChild(banner);
    }

    const tabBar = document.createElement('div');
    tabBar.className = 'tabs';
    tabBar.innerHTML = `
      <button type="button" class="tab ${this.currentTab === 'stats' ? 'active' : ''}" data-tab="stats">${i18n.t('stats.tabStats') || 'Statistiche di Carriera'}</button>
      <button type="button" class="tab ${this.currentTab === 'trophies' ? 'active' : ''}" data-tab="trophies">${i18n.t('stats.tabTrophies') || 'Trofei'} (${this.achievements?.getUnlockedCount?.() ?? 0}/${this.achievements?.getTotalCount?.() ?? 12})</button>
    `;

    const body = document.createElement('div');
    body.className = 'tab-body';

    const statsPage = document.createElement('div');
    statsPage.className = `tab-page ${this.currentTab === 'stats' ? '' : 'hidden'}`;
    this._renderStatsPage(statsPage);

    const trophiesPage = document.createElement('div');
    trophiesPage.className = `tab-page ${this.currentTab === 'trophies' ? '' : 'hidden'}`;
    this._renderTrophiesPage(trophiesPage);

    body.append(statsPage, trophiesPage);
    this.root.append(tabBar, body);

    tabBar.addEventListener('click', (e) => {
      const b = e.target.closest('.tab');
      if (!b) return;
      this.audio?.playClick?.();
      tabBar.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      b.classList.add('active');
      this.currentTab = b.dataset.tab;
      statsPage.classList.toggle('hidden', this.currentTab !== 'stats');
      trophiesPage.classList.toggle('hidden', this.currentTab !== 'trophies');
    });
  }

  open() {
    this.root = document.createElement('div');
    this.root.className = 'stats-modal';
    this._renderContent();

    this.handle = this.modal.open({
      title: i18n.t('stats.title') || 'Carriera & Trofei',
      content: this.root,
      wide: true,
      actions: [{ label: i18n.t('common.close') || 'Chiudi' }],
      onClose: () => {
        this.handle = null;
        this.root = null;
      },
    });
  }

  close() {
    this.handle?.close?.();
    this.handle = null;
    this.root = null;
  }

  dispose() {
    this._unsubLang?.();
    this.close();
  }

  _renderStatsPage(container) {
    const s = this.statsManager?.stats ?? {};
    const saveRef = typeof window !== 'undefined' ? window.__dds?.save : null;
    const tabletsSpent = s.tabletsSpent || saveRef?.getTabletsSpent?.() || 0;
    const tabletsEarned = s.tabletsEarned || (saveRef?.getTablets?.() ?? 0) + tabletsSpent;

    const bestTimeStr = s.bestRunTime !== null && s.bestRunTime !== undefined
      ? formatDuration(s.bestRunTime)
      : (i18n.t('stats.noRecord') || 'Nessun record');

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">⛏️</div>
          <div class="stat-value">${(s.totalClicks ?? 0).toLocaleString()}</div>
          <div class="stat-label">${i18n.t('stats.totalClicks') || 'Colpi di Pala Manuali'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🏜️</div>
          <div class="stat-value">${formatNumber(s.totalSandLifetime ?? 0)}</div>
          <div class="stat-label">${i18n.t('stats.totalSandLifetime') || 'Sabbia Storica Totale'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🧨</div>
          <div class="stat-value">${(s.dynamiteUsed ?? 0).toLocaleString()}</div>
          <div class="stat-label">${i18n.t('stats.dynamiteUsed') || 'Cariche di Dinamite Innescate'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⏳</div>
          <div class="stat-value">${formatDuration(s.totalPlaytime ?? 0)}</div>
          <div class="stat-label">${i18n.t('stats.totalPlaytime') || 'Tempo di Gioco Totale'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🏛️</div>
          <div class="stat-value">${(s.ruinsUncovered ?? 0).toLocaleString()}</div>
          <div class="stat-label">${i18n.t('stats.ruinsUncovered') || 'Rovine Disseppellite'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🏁</div>
          <div class="stat-value">${(s.runsCompleted ?? 0).toLocaleString()}</div>
          <div class="stat-label">${i18n.t('stats.runsCompleted') || 'Spedizioni Concluse'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚡</div>
          <div class="stat-value">${bestTimeStr}</div>
          <div class="stat-label">${i18n.t('stats.bestRunTime') || 'Miglior Tempo di Scavo'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📜</div>
          <div class="stat-value">τ ${tabletsEarned.toLocaleString()}</div>
          <div class="stat-label">${i18n.t('stats.tabletsAccumulated') || 'Tavolette (τ) Accumulate'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🏛️</div>
          <div class="stat-value">τ ${tabletsSpent.toLocaleString()}</div>
          <div class="stat-label">${i18n.t('stats.tabletsSpent') || 'Tavolette (τ) Spese'}</div>
        </div>
      </div>
    `;
  }

  _renderTrophiesPage(container) {
    const isCheated = !!(
      this.achievements?.state?.cheatsEnabled ||
      this.statsManager?.state?.cheatsEnabled ||
      (typeof window !== 'undefined' && window.__dds?.game?.state?.cheatsEnabled) ||
      (typeof window !== 'undefined' && window.__dds?.save?.load?.()?.cheatsEnabled)
    );
    const list = this.achievements?.getAll?.() ?? [];
    let html = '';

    if (isCheated) {
      html += `
        <div class="cheats-lockout-banner" role="alert">
          <span class="lockout-icon">⚠️</span>
          <span class="lockout-text">${i18n.t('stats.cheatsWarning') || '[ ⚠ MODALITÀ TRUCCHI ATTIVA — TROFEI DISABILITATI PER QUESTA SPEDIZIONE ]'}</span>
        </div>
      `;
    }

    html += `<div class="trophies-list">`;

    for (const item of list) {
      const title = i18n.t(`achievements.${item.id}.title`) || item.id;
      const desc = i18n.t(`achievements.${item.id}.desc`) || '';
      const isUnlocked = item.unlocked;
      const dateStr = item.unlockedAt
        ? new Date(item.unlockedAt).toLocaleDateString()
        : '';

      html += `
        <div class="trophy-card ${isUnlocked ? 'unlocked' : 'locked'}" data-trophy="${item.id}">
          <div class="trophy-badge">${isUnlocked ? item.icon : '🔒'}</div>
          <div class="trophy-info">
            <div class="trophy-title">${title}</div>
            <div class="trophy-desc">${desc}</div>
            ${isUnlocked && dateStr ? `<div class="trophy-date">${i18n.t('stats.dateUnlocked') || 'Sbloccato il'}: ${dateStr}</div>` : ''}
          </div>
          <div class="trophy-status">
            ${isUnlocked
              ? `<span class="badge-unlocked">${i18n.t('common.unlocked') || 'Sbloccato'}</span>`
              : `<span class="badge-locked">${i18n.t('common.locked') || 'Bloccato'}</span>`}
          </div>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
  }
}
