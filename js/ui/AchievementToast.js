// Toast Notifica Trofei & Riconoscimenti (Art Bible Atlantean-Kemet).
// Bordo oro lucido, icona SVG, particelle dorate ed animazione fluida.
import { i18n } from '../core/I18n.js';

const TROPHY_SVG = `
<svg class="achievement-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
  <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" stroke="#0FE3C1"/>
  <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" stroke="#0FE3C1"/>
  <path d="M4 3h16v6a8 8 0 0 1-16 0V3z" stroke="#F5BA23" fill="#F5BA23" fill-opacity="0.18"/>
  <path d="M12 17v4m-4 0h8" stroke="#F5BA23"/>
</svg>
`;

export class AchievementToast {
  static show(achievement, audio = null) {
    if (typeof document === 'undefined') return null;

    let host = document.getElementById('achievement-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'achievement-toast-host';
      host.className = 'achievement-toast-host';
      document.body.appendChild(host);
    }

    const title = achievement.name ||
      i18n.t(`achievements.${achievement.id}.title`) ||
      achievement.id;
    const desc = achievement.desc ||
      i18n.t(`achievements.${achievement.id}.desc`) ||
      '';

    const toast = document.createElement('div');
    toast.className = 'panel achievement-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    toast.innerHTML = `
      <div class="achievement-toast-glow"></div>
      <div class="achievement-sparkles-container" aria-hidden="true">
        <span class="sparkle sparkle-1">✦</span>
        <span class="sparkle sparkle-2">✨</span>
        <span class="sparkle sparkle-3">✦</span>
      </div>
      <div class="achievement-toast-badge">${TROPHY_SVG}</div>
      <div class="achievement-toast-content">
        <div class="achievement-toast-tag">${i18n.t('stats.tabTrophies') || 'OBIETTIVO SBLOCCATO'}</div>
        <div class="achievement-toast-title">${title}</div>
        <div class="achievement-toast-desc">${desc}</div>
      </div>
    `;

    host.appendChild(toast);

    // Feedback sonoro cerimoniale
    const audioEngine = audio || (typeof window !== 'undefined' ? window.__dds?.audio : null);
    if (audioEngine) {
      if (typeof audioEngine.playSfx === 'function') {
        audioEngine.playSfx('achievement');
      } else if (typeof audioEngine.playAchievementChime === 'function') {
        audioEngine.playAchievementChime();
      }
    }

    // Ingresso fluido a scorrimento
    void toast.offsetWidth;
    toast.classList.add('in');

    // Persistenza a schermo di 4.0s prima del fade-out automatico
    setTimeout(() => {
      toast.classList.remove('in');
      toast.classList.add('out');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      setTimeout(() => toast.remove(), 600);
    }, 4000);

    return toast;
  }
}

export function showAchievementToast(achievement, audio = null) {
  return AchievementToast.show(achievement, audio);
}

