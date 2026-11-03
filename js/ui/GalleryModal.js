// Modale Galleria Epiloghi: mostra i finali sbloccati (Curse, Treasure, Business) e quelli ancora sigillati.
import { ENDINGS } from '../core/Save.js';

export const GALLERY_DATA = {
  curse: {
    id: 'curse',
    name: 'La Maledizione di Atlantide',
    badge: '☠️',
    hint: 'Rompi il sigillo ancestrale dormiente sotto l\'obelisco centrale.',
    description: 'Forse avresti dovuto lasciare la sabbia dov\'era... Hai liberato una piaga primordiale che ha tinto il cielo di sangue.',
  },
  treasure: {
    id: 'treasure',
    name: 'Il Tesoro d\'Oro Puro',
    badge: '👑',
    hint: 'Svela la cripta dei sovrani sepolta nella roccia.',
    description: 'Montagne d\'oro puro e gemme luminescenti ricoprono la roccia: la ricchezza eterna dei faraoni è tua.',
  },
  business: {
    id: 'business',
    name: 'L\'Impresa di Scavo SRL',
    badge: '🏗️',
    hint: 'Raggiungi il fondo sterile per un anticlimax memorabile.',
    description: 'Nessun dio, nessun tesoro: solo un secchiello e una flotta di macchinari quotata per miliardi in borsa!',
  },
  secret: {
    id: 'secret',
    name: 'L\'Ascensione di Atlantide',
    badge: '🔱',
    hint: 'Scopri prima tutti e 3 i destini della duna per risvegliare l\'antico cuore d\'Oricalco.',
    description: 'Hai risvegliato il cuore perduto di Atlantide: la città risorge in volo verso il cielo.',
  },
};

export class GalleryModal {
  constructor(modal, save) {
    this.modal = modal;
    this.save = save;
  }

  open() {
    const seen = new Set(this.save?.getEndingsSeen?.() ?? []);
    const count = seen.size;
    const total = 4;
    const pct = Math.round((count / total) * 100);

    const wrap = document.createElement('div');
    wrap.className = 'gallery-container';

    wrap.innerHTML = `
      <div class="gallery-header">
        <div class="gallery-progress-bar">
          <div class="gallery-progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="gallery-stats muted">Progresso Collezionista: <span class="accent">${count}/${total}</span> (${pct}%)</div>
      </div>
      <div class="gallery-cards">
        ${Object.values(GALLERY_DATA).map((info) => {
          const unlocked = seen.has(info.id);
          return `
            <div class="gallery-card ${unlocked ? 'unlocked' : 'locked'}">
              <div class="gallery-card-badge">${unlocked ? info.badge : '🔒'}</div>
              <div class="gallery-card-info">
                <div class="gallery-card-title ${unlocked ? 'accent' : 'muted'}">
                  ${unlocked ? info.name : '??? Sigillo Dormiente'}
                </div>
                <div class="gallery-card-desc">
                  ${unlocked ? info.description : info.hint}
                </div>
                <div class="gallery-card-status ${unlocked ? 'status-unlocked' : 'status-locked'}">
                  ${unlocked ? '✓ Epilogo Sbloccato' : 'Non ancora scoperto'}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    this.modal.open({
      title: 'Galleria dei Finali',
      content: wrap,
      actions: [{ label: 'Chiudi' }],
    });
  }
}

