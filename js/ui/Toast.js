// Toast Notifiche Achievement & Eventi (Art Bible Atlantean-Kemetism)
// Bordo oro, riflesso ciano luminescente, badge araldico e animazione fluida.
import { i18n } from '../core/I18n.js';

const TROPHY_SVG = `
<svg class="achievement-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" stroke="#0FE3C1"/>
  <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" stroke="#0FE3C1"/>
  <path d="M4 3h16v6a8 8 0 0 1-16 0V3z" stroke="#F5BA23" fill="#F5BA23" fill-opacity="0.15"/>
  <path d="M12 17v4m-4 0h8" stroke="#F5BA23"/>
</svg>
`;

export function showAchievementToast(achievement) {
  if (typeof document === 'undefined') return;

  let host = document.getElementById('achievement-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'achievement-toast-host';
    host.className = 'achievement-toast-host';
    document.body.append(host);
  }

  const title = achievement.name || i18n.t(`achievements.${achievement.id}.title`) || achievement.id;
  const desc = achievement.desc || i18n.t(`achievements.${achievement.id}.desc`) || '';

  const toast = document.createElement('div');
  toast.className = 'panel achievement-toast';
  toast.innerHTML = `
    <div class="achievement-toast-glow"></div>
    <div class="achievement-toast-badge">${TROPHY_SVG}</div>
    <div class="achievement-toast-content">
      <div class="achievement-toast-tag">${i18n.t('stats.tabTrophies') || 'OBIETTIVO SBLOCCATO'}</div>
      <div class="achievement-toast-title">${title}</div>
      <div class="achievement-toast-desc">${desc}</div>
    </div>
  `;

  host.append(toast);

  // Forza reflow per animazione CSS
  void toast.offsetWidth;
  toast.classList.add('in');

  setTimeout(() => {
    toast.classList.remove('in');
    toast.classList.add('out');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 4200);
}

