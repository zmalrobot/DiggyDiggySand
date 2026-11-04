// Feedback Aptico per Dispositivi Mobile tramite navigator.vibrate.
// Impulsi leggeri per scavo manuale, doppio impulso per acquisti ed esplosioni profonde.
// Rispetta rigorosamente il toggle delle impostazioni utente controls.haptics.
import { events } from './Events.js';

export class Haptics {
  /**
   * @param {import('./SettingsManager.js').SettingsManager} [settings]
   */
  constructor(settings = null) {
    this.settings = settings;
    this.enabled = this.settings ? this.settings.get('controls.haptics') !== false : true;

    if (this.settings) {
      this._unsub = this.settings.subscribe('controls.haptics', (val) => {
        this.enabled = !!val;
      });
    }

    // Ascolta eventi globali di gioco per vibrazione automatica
    this._unsubEvents = [
      events.on('dig:hit', (e) => {
        if (e?.isCrit) this.crit();
        else this.dig();
      }),
      events.on('upgrade:bought', () => this.purchase()),
      events.on('worldevent:trigger', (e) => {
        if (e?.id === 'dynamite') this.dynamite();
      }),
    ];
  }

  static get isSupported() {
    try {
      return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    } catch {
      return false;
    }
  }

  get isSupported() {
    return Haptics.isSupported;
  }

  /**
   * Invia un pattern di vibrazione al dispositivo se supportato ed abilitato.
   * @param {number|number[]} pattern Millisecondi di vibrazione o sequenza [vibra, pausa, vibra]
   * @returns {boolean} True se la vibrazione è stata avviata
   */
  vibrate(pattern) {
    if (!this.enabled || !Haptics.isSupported) return false;
    try {
      return navigator.vibrate(pattern);
    } catch (e) {
      return false;
    }
  }

  /** Tocco di scavo manuale: impulso breve e impercettibile (12ms) */
  dig() {
    return this.vibrate(12);
  }

  /** Colpo critico: impulso marcato (28ms) */
  crit() {
    return this.vibrate(28);
  }

  /** Acquisto upgrade riuscito: doppio impulso leggero [15ms, 30ms pausa, 15ms] */
  purchase() {
    return this.vibrate([15, 30, 15]);
  }

  /** Esplosione Dinamite / evento tellurico: pattern profondo [40ms, 25ms, 60ms] */
  dynamite() {
    return this.vibrate([40, 25, 60]);
  }

  dispose() {
    this._unsub?.();
    this._unsubEvents?.forEach((u) => u?.());
  }
}

// Istanza singleton per comodità
export const haptics = new Haptics();
