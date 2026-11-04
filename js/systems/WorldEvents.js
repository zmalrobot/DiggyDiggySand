// Gestione degli Eventi Spontanei nel Deserto (Tempesta di Sabbia, Mercante Nomade).
import * as THREE from 'three';
import { events } from '../core/Events.js';
import { toast } from '../ui/Modal.js';
import { i18n } from '../core/I18n.js';

export function getEventTranslation(key, fallback = '') {
  const text = i18n.t(key);
  if (!text || text === key) {
    return fallback || key;
  }
  return text;
}

export class WorldEvents {
  constructor({ scene, terrain, state, audio, particles, banner, modal }) {
    this.scene = scene;
    this.terrain = terrain;
    this.state = state;
    this.audio = audio;
    this.particles = particles;
    this.banner = banner;
    this.modal = modal;

    this.timer = 0;
    this.nextEventTime = 180 + Math.random() * 120; // 3-5 minuti
    this.activeEvent = null; // null | 'sandstorm' | 'merchant'
    this.eventDuration = 0;

    this.merchantMesh = null;
    this.boostTimer = 0;
    this.origFogDensity = null;
    this.origFogColor = null;

    // Transizione graduale di 2.5s per nebbia dorata e raffiche di vento AudioEngine
    this.stormFactor = 0;
    this.stormTransition = 0; // 0 = idle, 1 = fade in, -1 = fade out
    this.STORM_FADE_DURATION = 2.5;
    this.STORM_FOG_COLOR = new THREE.Color(0xC89849);
  }

  update(dt) {
    // Aggiornamento eventuale boost residuo
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      if (this.boostTimer <= 0) {
        this.state.sandMultiplier = 1.0;
        events.emit('event:boost', { active: false, label: '' });
      }
    }

    // Gestione transizione progressiva continua per la tempesta
    if (this.stormTransition === 1) {
      this.stormFactor = Math.min(1, this.stormFactor + dt / this.STORM_FADE_DURATION);
      if (this.stormFactor >= 1) this.stormTransition = 0;
    } else if (this.stormTransition === -1) {
      this.stormFactor = Math.max(0, this.stormFactor - dt / this.STORM_FADE_DURATION);
      if (this.stormFactor <= 0) {
        this._finalizeStormEnd();
        return;
      }
    }

    if (this.stormFactor > 0 || this.activeEvent === 'sandstorm') {
      if (this.scene?.scene?.fog && this.origFogColor) {
        this.scene.scene.fog.density = THREE.MathUtils.lerp(this.origFogDensity, 0.0125, this.stormFactor);
        this.scene.scene.fog.color.copy(this.origFogColor).lerp(this.STORM_FOG_COLOR, this.stormFactor);
      }
      this.audio?.setStormWind?.(this.stormFactor, 0.2);
    }

    // Avanzamento evento attivo
    if (this.activeEvent) {
      this.eventDuration -= dt;
      if (this.eventDuration <= 0) {
        if (this.activeEvent === 'sandstorm' && this.stormTransition !== -1) {
          this.stormTransition = -1; // Avvia dissolvenza morbida d'uscita (2.5s)
          this.eventDuration = 0;
        } else if (this.activeEvent !== 'sandstorm') {
          this._endActiveEvent();
        }
      }
      return;
    }

    // Conteggio per il prossimo evento spontaneo
    this.timer += dt;
    if (this.timer >= this.nextEventTime) {
      this.timer = 0;
      this.nextEventTime = 180 + Math.random() * 120;
      const pick = Math.random() < 0.5 ? 'sandstorm' : 'merchant';
      this.triggerEvent(pick);
    }
  }

  /** Forza l'attivazione di un evento (utile anche per test e debug). */
  triggerEvent(type) {
    if (this.activeEvent) this._endActiveEvent();

    if (type === 'sandstorm') {
      this._startSandstorm();
    } else if (type === 'merchant') {
      this._startMerchant();
    } else if (type === 'solar_flare') {
      this._startSolarFlare();
    } else if (type === 'earthquake') {
      this._startEarthquake();
    }
  }

  _startSandstorm() {
    this.activeEvent = 'sandstorm';
    this.eventDuration = 30; // 30s
    this.stormTransition = 1; // Avvia dissolvenza morbida d'entrata (2.5s)

    this.audio?.playStormSound?.();
    if (this.scene?.scene?.fog) {
      this.origFogDensity = this.scene.scene.fog.density;
      this.origFogColor = this.scene.scene.fog.color.clone();
    }

    this.state.sandMultiplier = 1.5;
    const boostLabel = getEventTranslation('events.sandstorm.boost', '⚡ Tempesta: +50% Sabbia (30s)');
    events.emit('event:boost', { active: true, label: boostLabel });

    this.banner?.show({
      icon: '🌪️',
      title: getEventTranslation('events.active_banner', 'EVENTO ATTIVO'),
      message: getEventTranslation('events.sandstorm.started', 'Tempesta di Sabbia: Visibilità ridotta, scavo rallentato!'),
      duration: 6000,
    });
  }

  _startSolarFlare() {
    this.activeEvent = 'solar_flare';
    this.eventDuration = 30;
    this.state.orichalcumMultiplier = 2.0;

    this.banner?.show({
      icon: '☀️',
      title: getEventTranslation('events.active_banner', 'EVENTO ATTIVO'),
      message: getEventTranslation('events.solar_flare.started', 'Eruzione Solare: Produzione oricalco raddoppiata!'),
      duration: 6000,
    });
  }

  _startEarthquake() {
    this.activeEvent = 'earthquake';
    this.eventDuration = 20;
    this.scene?.shake?.(0.08);

    this.banner?.show({
      icon: '🌋',
      title: getEventTranslation('events.active_banner', 'EVENTO ATTIVO'),
      message: getEventTranslation('events.earthquake.started', 'Scossa Tettonica: Crolli di sabbia nel cratere!'),
      duration: 6000,
    });
  }

  _startMerchant() {
    this.activeEvent = 'merchant';
    this.eventDuration = 60; // 60s
    this._spawnMerchantCamp();

    this.banner?.show({
      icon: '🐪',
      title: getEventTranslation('events.merchant.title', 'Carovana Nomade'),
      message: getEventTranslation('events.merchant.message', 'Un mercante del deserto si è accampato ai margini dello scavo!'),
      actionLabel: getEventTranslation('events.merchant.trade', 'Commercia'),
      duration: 10000,
      onAction: () => this.openMerchantOffer(),
    });
  }

  _spawnMerchantCamp() {
    this._removeMerchantCamp();
    const g = new THREE.Group();

    // Tenda a cupola/piramide low-poly con drappo oricalco e paletto
    const tentGeo = new THREE.ConeGeometry(2.0, 2.4, 4);
    const tentMat = new THREE.MeshStandardMaterial({
      color: 0xD87D38,
      flatShading: true,
      roughness: 0.7,
    });
    const tent = new THREE.Mesh(tentGeo, tentMat);
    tent.position.set(0, 1.2, 0);

    // Cassa merci
    const boxGeo = new THREE.BoxGeometry(0.8, 0.6, 0.8);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xF5BA23, roughness: 0.4, flatShading: true });
    const crate = new THREE.Mesh(boxGeo, boxMat);
    crate.position.set(1.4, 0.3, 0.6);

    g.add(tent, crate);

    // Posiziona al bordo dello scavo
    const x = 28, z = 28;
    const y = this.terrain ? this.terrain.heightAt(x, z) : 12;
    g.position.set(x, y, z);

    this.merchantMesh = g;
    this.scene?.scene?.add(g);
  }

  _removeMerchantCamp() {
    if (this.merchantMesh) {
      this.scene?.scene?.remove(this.merchantMesh);
      this.merchantMesh.traverse((o) => {
        if (o.isMesh) {
          o.geometry?.dispose?.();
          o.material?.dispose?.();
        }
      });
      this.merchantMesh = null;
    }
  }

  openMerchantOffer() {
    if (!this.activeEvent || this.activeEvent !== 'merchant') return;
    const content = document.createElement('div');
    content.className = 'merchant-modal';
    const quote = i18n.t('events.merchant.quote') || '"Il deserto nasconde segreti a chi ha fretta, ma ricompensa chi sa commerciare."';
    const offerTitle = i18n.t('events.merchant.offerTitle') || 'Iper-Scavo Nomade';
    const offerDesc = i18n.t('events.merchant.offerDesc') || '+100% Sabbia per i prossimi 45 secondi.';
    const buyBtnText = i18n.t('events.merchant.buyBtn', { cost: 150 }) || 'Acquista (150 Sabbia)';

    content.innerHTML = `
      <p class="muted">${quote}</p>
      <div class="merchant-offers">
        <div class="merchant-offer-card panel">
          <div class="offer-title">${offerTitle}</div>
          <div class="offer-desc">${offerDesc}</div>
          <button type="button" class="btn btn-offer" data-offer="boost">${buyBtnText}</button>
        </div>
      </div>
    `;

    content.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-offer]');
      if (!btn) return;
      if (this.state.sand >= 150) {
        this.state.spend(150);
        this.state.sandMultiplier = 2.0;
        this.boostTimer = 45;
        const bLabel = i18n.t('events.merchant.boost') || '✨ Iper-Scavo (x2.0): 45s';
        events.emit('event:boost', { active: true, label: bLabel });
        toast(i18n.t('events.merchant.purchased') || 'Hai acquistato Iper-Scavo Nomade! (+100% Sabbia per 45s)');
        this.modal?.close?.();
        this._endActiveEvent();
      } else {
        toast(i18n.t('events.merchant.notEnough') || 'Sabbia insufficiente per questa merce!');
      }
    });

    this.modal?.open?.({
      title: i18n.t('events.merchant.title') || 'Mercante Nomade',
      content,
      actions: [{ label: i18n.t('events.merchant.decline') || 'Rinuncia' }],
    });
  }

  _finalizeStormEnd() {
    if (this.scene?.scene?.fog && this.origFogDensity !== null) {
      this.scene.scene.fog.density = this.origFogDensity;
      if (this.origFogColor) this.scene.scene.fog.color.copy(this.origFogColor);
    }
    this.audio?.setStormWind?.(0, 0.1);
    this.state.sandMultiplier = 1.0;
    this.activeEvent = null;
    this.stormTransition = 0;
    this.stormFactor = 0;
    events.emit('event:boost', { active: false, label: '' });
    toast(getEventTranslation('events.sandstorm.ended', 'La tempesta di sabbia si è placata.'));
    this.banner?.hide?.();
  }

  _finalizeSolarFlareEnd() {
    this.state.orichalcumMultiplier = 1.0;
    this.activeEvent = null;
    toast(getEventTranslation('events.solar_flare.ended', "L'eruzione solare è terminata."));
    this.banner?.hide?.();
  }

  _finalizeEarthquakeEnd() {
    this.activeEvent = null;
    toast(getEventTranslation('events.earthquake.ended', 'I movimenti tettonici sono cessati.'));
    this.banner?.hide?.();
  }

  _endActiveEvent() {
    if (this.activeEvent === 'sandstorm') {
      this._finalizeStormEnd();
    } else if (this.activeEvent === 'merchant') {
      this._removeMerchantCamp();
      toast(getEventTranslation('events.merchant.departed', 'La carovana nomade è ripartita per le dune.'));
      this.activeEvent = null;
      this.eventDuration = 0;
      this.banner?.hide?.();
    } else if (this.activeEvent === 'solar_flare') {
      this._finalizeSolarFlareEnd();
    } else if (this.activeEvent === 'earthquake') {
      this._finalizeEarthquakeEnd();
    }
  }

  dispose() {
    this._endActiveEvent();
    this.boostTimer = 0;
  }
}

export default WorldEvents;

