// Sistema Direttive di Spedizione / Taglie Dinamiche:
// Generazione procedurale a rotazione di contratti effimeri con premi immediati in sabbia o buff temporanei.
import { events } from '../core/Events.js';
import { i18n } from '../core/I18n.js';

export const DIRECTIVE_TYPES = [
  'local_extraction',
  'continuous_digging',
  'deep_excavation',
  'workshop_investment',
];

export const QUADRANTS = ['NE', 'NW', 'SE', 'SW'];

export class DirectivesManager {
  /**
   * @param {Object} options
   * @param {import('../core/State.js').State} options.state
   * @param {import('../core/AudioEngine.js').AudioEngine} [options.audio]
   * @param {import('./Digging.js').Digging} [options.digging]
   */
  constructor({ state, audio = null, digging = null }) {
    this.state = state;
    this.audio = audio;
    this.digging = digging;

    this.activeDirective = null;
    this.cooldown = 2.0; // attesa iniziale prima della prima direttiva
    this.buffTimer = 0;
    this.activeBuff = null; // { type: 'discount' | 'boost', value, duration, label }
    this.completedDirectivesCount = 0;

    this._unsubs = [];
    this._bind();
  }

  setDigging(digging) {
    this.digging = digging;
  }

  _bind() {
    // 1. Ascolto colpi di scavo per estrazione locale, scavo profondo e sabbia
    this._unsubs.push(
      events.on('dig:hit', ({ x, y, z, amount }) => {
        if (!this.activeDirective || this.activeDirective.completed || this.activeDirective.failed) return;
        const d = this.activeDirective;

        if (d.type === 'local_extraction') {
          // Quadranti: NE (x>=0, z<0), NW (x<0, z<0), SE (x>=0, z>=0), SW (x<0, z>=0)
          let match = false;
          if (d.quadrant === 'NE' && x >= 0 && z < 0) match = true;
          else if (d.quadrant === 'NW' && x < 0 && z < 0) match = true;
          else if (d.quadrant === 'SE' && x >= 0 && z >= 0) match = true;
          else if (d.quadrant === 'SW' && x < 0 && z >= 0) match = true;

          if (match) {
            d.current = Math.min(d.target, d.current + amount);
            this._checkCompletion();
          }
        } else if (d.type === 'deep_excavation') {
          // Scavo sotto la quota Y <= 4.5 (strati di arenaria scura e oricalco)
          if (y <= 4.8) {
            d.current = Math.min(d.target, d.current + amount);
            this._checkCompletion();
          }
        }
      })
    );

    // 2. Ascolto acquisto upgrade
    this._unsubs.push(
      events.on('upgrade:bought', ({ count }) => {
        if (!this.activeDirective || this.activeDirective.completed || this.activeDirective.failed) return;
        const d = this.activeDirective;
        if (d.type === 'workshop_investment') {
          d.current = Math.min(d.target, d.current + (count || 1));
          this._checkCompletion();
        }
      })
    );
  }

  /**
   * Genera un nuovo micro-obiettivo procedurale parametrato sul progresso attuale del giocatore.
   */
  generateDirective() {
    const type = DIRECTIVE_TYPES[Math.floor(Math.random() * DIRECTIVE_TYPES.length)];
    const currentSand = this.state?.sand || 0;
    const power = this.state?.stats?.power || 1;
    const scale = Math.max(1, Math.log10(Math.max(10, currentSand)));

    let target = 100;
    let timeLimit = null;
    let quadrant = null;
    let titleKey = '';
    let descParams = {};

    switch (type) {
      case 'local_extraction': {
        quadrant = QUADRANTS[Math.floor(Math.random() * QUADRANTS.length)];
        target = Math.round(Math.max(80, (200 + power * 40) * scale * 0.4));
        titleKey = 'directives.localExtractionTitle';
        descParams = {
          target,
          quadrant: i18n.t(`directives.quadrants.${quadrant}`) || quadrant,
        };
        break;
      }
      case 'continuous_digging': {
        target = Math.floor(Math.random() * 5) + 6; // 6s - 10s
        titleKey = 'directives.continuousDiggingTitle';
        descParams = { seconds: target };
        break;
      }
      case 'deep_excavation': {
        target = Math.round(Math.max(60, (150 + power * 30) * scale * 0.35));
        titleKey = 'directives.deepExcavationTitle';
        descParams = { target };
        break;
      }
      case 'workshop_investment': {
        target = Math.floor(Math.random() * 4) + 2; // 2 - 5 livelli
        timeLimit = 60; // 60 secondi
        titleKey = 'directives.workshopInvestmentTitle';
        descParams = { count: target, time: 60 };
        break;
      }
    }

    // Generazione della ricompensa: sabbia immediata (60%), buff sconto (20%) o buff boost scavo 2x (20%)
    const rewardRoll = Math.random();
    let reward = null;
    if (rewardRoll < 0.6) {
      const sandBonus = Math.round(Math.max(300, (400 + power * 80) * scale * 0.5));
      reward = {
        type: 'sand',
        amount: sandBonus,
        label: `+${sandBonus} ${i18n.t('hud.sand') || 'Sabbia'}`,
      };
    } else if (rewardRoll < 0.8) {
      reward = {
        type: 'discount',
        value: 0.15,
        duration: 45,
        label: i18n.t('directives.rewardDiscount') || '-15% Bottega (45s)',
      };
    } else {
      reward = {
        type: 'boost',
        value: 2.0,
        duration: 30,
        label: i18n.t('directives.rewardBoost') || '2x Scavo (30s)',
      };
    }

    this.activeDirective = {
      id: `dir_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type,
      quadrant,
      titleKey,
      title: i18n.t(titleKey, descParams),
      descParams,
      current: 0,
      target,
      timeLimit,
      timeLeft: timeLimit,
      reward,
      completed: false,
      failed: false,
    };

    events.emit('directive:generated', this.activeDirective);
    return this.activeDirective;
  }

  _checkCompletion() {
    if (!this.activeDirective || this.activeDirective.completed) return;
    const d = this.activeDirective;

    events.emit('directive:progress', {
      id: d.id,
      current: d.current,
      target: d.target,
      pct: Math.min(100, (d.current / d.target) * 100),
    });

    if (d.current >= d.target) {
      this._completeDirective();
    }
  }

  _completeDirective() {
    const d = this.activeDirective;
    d.completed = true;
    d.current = d.target;
    this.completedDirectivesCount++;

    // Applica la ricompensa
    if (d.reward.type === 'sand') {
      this.state.addSand(d.reward.amount);
    } else if (d.reward.type === 'discount') {
      this.state.temporaryDiscount = d.reward.value;
      this.activeBuff = d.reward;
      this.buffTimer = d.reward.duration;
      events.emit('event:boost', { active: true, label: d.reward.label });
    } else if (d.reward.type === 'boost') {
      this.state.sandMultiplier = d.reward.value;
      this.activeBuff = d.reward;
      this.buffTimer = d.reward.duration;
      events.emit('event:boost', { active: true, label: d.reward.label });
    }

    this.audio?.playConfirm?.();
    events.emit('directive:completed', d);

    // Cooldown prima del prossimo contratto (5 secondi)
    this.cooldown = 5.0;
  }

  _failDirective() {
    const d = this.activeDirective;
    d.failed = true;
    events.emit('directive:failed', d);
    this.cooldown = 6.0;
  }

  /**
   * Ciclo di aggiornamento per-frame disaccoppiato con dt reale limitato.
   * @param {number} dt Delta time in secondi
   */
  update(dt) {
    if (dt <= 0) return;

    // Gestione scadenza buff temporaneo
    if (this.activeBuff) {
      this.buffTimer -= dt;
      if (this.buffTimer <= 0) {
        if (this.activeBuff.type === 'discount') {
          this.state.temporaryDiscount = 0;
        } else if (this.activeBuff.type === 'boost') {
          this.state.sandMultiplier = 1.0;
        }
        events.emit('event:boost', { active: false, label: '' });
        events.emit('directive:buffExpired', this.activeBuff);
        this.activeBuff = null;
        this.buffTimer = 0;
      }
    }

    // Gestione direttiva attiva
    if (this.activeDirective && !this.activeDirective.completed && !this.activeDirective.failed) {
      const d = this.activeDirective;

      // Timer limite per contratti a tempo
      if (d.timeLimit !== null && d.timeLeft !== null) {
        d.timeLeft -= dt;
        if (d.timeLeft <= 0) {
          d.timeLeft = 0;
          this._failDirective();
          return;
        }
      }

      // Direttiva: scavo continuo senza interruzioni
      if (d.type === 'continuous_digging') {
        const isHolding = !!this.digging?.holding;
        if (isHolding) {
          d.current = Math.min(d.target, d.current + dt);
          this._checkCompletion();
        } else if (d.current > 0 && !d.completed) {
          // Interruzione dello scavo: reset del contatore continuo
          d.current = 0;
          events.emit('directive:progress', {
            id: d.id,
            current: 0,
            target: d.target,
            pct: 0,
          });
        }
      }
      return;
    }

    // Se non c'è una direttiva attiva (o è stata completata/fallita), gestisci il cooldown
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      this.generateDirective();
    }
  }

  dispose() {
    this._unsubs.forEach((u) => u());
    this._unsubs = [];
    if (this.activeBuff) {
      this.state.temporaryDiscount = 0;
      this.state.sandMultiplier = 1.0;
      events.emit('event:boost', { active: false, label: '' });
      this.activeBuff = null;
    }
  }
}

