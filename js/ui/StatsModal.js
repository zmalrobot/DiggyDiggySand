// Modale Statistiche di Carriera e Galleria Trofei
// Doppia scheda con numeri in font Syne, icone araldiche e stato di sblocco in tempo reale.
import { i18n } from '../core/I18n.js';
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
  }

  open() {
    const root = document.createElement('div');
    root.className = 'stats-modal';

    const tabBar = document.createElement('div');
    tabBar.className = 'tabs';
    tabBar.innerHTML = `
      <button type="button" class="tab active" data-tab="stats">${i18n.t('stats.tabStats')}</button>
      <button type="button" class="tab" data-tab="trophies">${i18n.t('stats.tabTrophies')} (${this.achievements?.getUnlockedCount?.() ?? 0}/${this.achievements?.getTotalCount?.() ?? 12})</button>
    `;

    const body = document.createElement('div');
    body.className = 'tab-body';

    const statsPage = document.createElement('div');
    statsPage.className = 'tab-page';
    this._renderStatsPage(statsPage);

    const trophiesPage = document.createElement('div');
    trophiesPage.className = 'tab-page hidden';
    this._renderTrophiesPage(trophiesPage);

    body.append(statsPage, trophiesPage);
    root.append(tabBar, body);

    tabBar.addEventListener('click', (e) => {
      const b = e.target.closest('.tab');
      if (!b) return;
      tabBar.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      b.classList.add('active');
      const target = b.dataset.tab;
      statsPage.classList.toggle('hidden', target !== 'stats');
      trophiesPage.classList.toggle('hidden', target !== 'trophies');
    });

    this.handle = this.modal.open({
      title: i18n.t('stats.title'),
      content: root,
      wide: true,
      actions: [{ label: i18n.t('common.close') }],
    });
  }

  _renderStatsPage(container) {
    const s = this.statsManager?.stats ?? {};
    const bestTimeStr = s.bestRunTime !== null && s.bestRunTime !== undefined
      ? formatDuration(s.bestRunTime)
      : i18n.t('stats.noRecord');

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">⛏️</div>
          <div class="stat-value">${(s.totalClicks ?? 0).toLocaleString()}</div>
          <div class="stat-label">${i18n.t('stats.totalClicks')}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🏜️</div>
          <div class="stat-value">${formatNumber(s.totalSandLifetime ?? 0)}</div>
          <div class="stat-label">${i18n.t('stats.totalSandLifetime')}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⏳</div>
          <div class="stat-value">${formatDuration(s.totalPlaytime ?? 0)}</div>
          <div class="stat-label">${i18n.t('stats.totalPlaytime')}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🏛️</div>
          <div class="stat-value">${(s.ruinsUncovered ?? 0).toLocaleString()}</div>
          <div class="stat-label">${i18n.t('stats.ruinsUncovered')}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🏁</div>
          <div class="stat-value">${(s.runsCompleted ?? 0).toLocaleString()}</div>
          <div class="stat-label">${i18n.t('stats.runsCompleted')}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚡</div>
          <div class="stat-value">${bestTimeStr}</div>
          <div class="stat-label">${i18n.t('stats.bestRunTime')}</div>
        </div>
      </div>
    `;
  }

  _renderTrophiesPage(container) {
    const list = this.achievements?.getAll?.() ?? [];
    let html = `<div class="trophies-list">`;

    for (const item of list) {
      const title = i18n.t(`achievements.${item.id}.title`);
      const desc = i18n.t(`achievements.${item.id}.desc`);
      const isUnlocked = item.unlocked;
      const dateStr = item.unlockedAt
        ? new Date(item.unlockedAt).toLocaleDateString()
        : '';

      html += `
        <div class="trophy-card ${isUnlocked ? 'unlocked' : 'locked'}">
          <div class="trophy-badge">${isUnlocked ? item.icon : '🔒'}</div>
          <div class="trophy-info">
            <div class="trophy-title">${title}</div>
            <div class="trophy-desc">${desc}</div>
            ${isUnlocked && dateStr ? `<div class="trophy-date">${i18n.t('stats.dateUnlocked')}: ${dateStr}</div>` : ''}
          </div>
          <div class="trophy-status">
            ${isUnlocked ? `<span class="badge-unlocked">${i18n.t('common.unlocked')}</span>` : `<span class="badge-locked">${i18n.t('common.locked')}</span>`}
          </div>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
  }
}
