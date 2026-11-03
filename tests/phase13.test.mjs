// Test Suite: Fase 13 - Integrazione Cheat nel Pannello Impostazioni e Lockout Achievement
import assert from 'node:assert/strict';
import { State } from '../js/core/State.js';
import { Save } from '../js/core/Save.js';
import { Achievements, ACHIEVEMENT_DEFS } from '../js/systems/Achievements.js';
import { SettingsModal } from '../js/ui/SettingsModal.js';
import { SettingsManager } from '../js/core/SettingsManager.js';
import { Hud } from '../js/ui/Hud.js';
import { StatsModal } from '../js/ui/StatsModal.js';
import { StatsManager } from '../js/core/StatsManager.js';
import { events } from '../js/core/Events.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

console.log('--- TEST FASE 13: Cheat nel Pannello Impostazioni & Lockout Achievement ---');

// 1. Test Stato, Persistenza e Reset Cheats
{
  const state = new State();
  assert.equal(state.cheatsEnabled, false, 'cheatsEnabled è false di default');
  assert.equal(state.godMode, false, 'godMode è false di default');

  let eventFired = false;
  const unsub = events.on('cheats:enabled', () => { eventFired = true; });
  state.enableCheats();
  unsub();
  assert.equal(state.cheatsEnabled, true, 'enableCheats imposta cheatsEnabled a true');
  assert.equal(eventFired, true, 'evento cheats:enabled emesso');

  // Verifica persistenza in toSave() e reload
  const storage = new MemoryStorage();
  const save = new Save(storage);
  const saveData = state.toSave();
  assert.equal(saveData.cheatsEnabled, true, 'toSave preserva cheatsEnabled');
  save.write(saveData);

  const loadedData = save.load();
  assert.equal(loadedData.cheatsEnabled, true, 'Save.load ripristina cheatsEnabled');

  const reloadedState = new State();
  reloadedState.reset(loadedData);
  assert.equal(reloadedState.cheatsEnabled, true, 'State.reset ripristina cheatsEnabled dallo storage');

  // Nuova spedizione pulita azzera cheatsEnabled
  const newRun = save.createNew();
  assert.equal(newRun.cheatsEnabled, false, 'Una nuova spedizione ha cheatsEnabled: false');
  console.log('✓ 1. State & Save: cheatsEnabled di default false, abilitazione, persistenza e azzeramento a nuova run');
}

// 2. Test Lockout Permanente degli Achievement
{
  const state = new State();
  const statsManager = new StatsManager();
  const storage = new MemoryStorage();
  const save = new Save(storage);
  const achievements = new Achievements({ state, statsManager, save });

  // Senza cheat: gli achievement possono essere sbloccati
  const ok1 = achievements.unlock('FIRST_DIG');
  assert.equal(ok1, true, 'Achievement sbloccato normalmente senza cheat');
  assert.equal(achievements.isUnlocked('FIRST_DIG'), true);

  // Attivazione cheat
  state.enableCheats();
  assert.equal(state.cheatsEnabled, true);

  // Con cheat attivi: unlock() deve restituire false e bloccare l'assegnazione
  const ok2 = achievements.unlock('DUNE_BREAKER');
  assert.equal(ok2, false, 'Achievement bloccato perché cheatsEnabled è true');
  assert.equal(achievements.isUnlocked('DUNE_BREAKER'), false, 'DUNE_BREAKER non è sbloccato');

  // Con cheat attivi: check() non deve sbloccare nulla
  state.totalSand = 10000000;
  achievements.check();
  assert.equal(achievements.isUnlocked('DUNE_BREAKER'), false, 'check() non assegna obiettivi quando cheatsEnabled è true');
  console.log('✓ 2. Achievements: blocco assoluto di unlock() e check() quando cheatsEnabled === true');
}

// 3. Test Meccaniche Super Pala (God Mode)
{
  const state = new State();
  const normalStats = state.stats;
  assert.equal(state.godMode, false);

  state.godMode = true;
  const godStats = state.stats;
  assert.equal(godStats.radius, normalStats.radius * 10, 'Raggio scavo decuplicato con God Mode');
  assert.ok(godStats.digRate >= 16, 'Dig rate massimo con God Mode');
  assert.ok(godStats.power >= normalStats.power * 10, 'Potenza colpo moltiplicata in God Mode');
  console.log('✓ 3. God Mode: raggio decuplicato, zero cooldown e potenza potenziata verificati');
}

// 4. Test SettingsModal: Richiesta di Conferma Irreversibile & Esecuzione Cheat
{
  const settings = new SettingsManager();
  const storage = new MemoryStorage();
  const save = new Save(storage);
  const state = new State();
  let confirmCalled = false;
  let confirmResult = false;

  const mockModal = {
    confirm: async ({ title, message, confirmLabel, danger }) => {
      confirmCalled = true;
      assert.ok(title.includes('Trucchi') || title.includes('Cheats'));
      assert.equal(danger, true, 'Conferma modale contrassegnata come pericolosa/irreversibile');
      return confirmResult;
    },
    open: () => ({ close: () => {} }),
  };

  const mockGame = {
    state,
    save,
    running: true,
    saved: false,
    saveNow() { this.saved = true; },
    terrain: { initialVolume: 1000, remainingVolume: 1000 },
    pauseMenu: { close: () => {} },
  };

  const settingsModal = new SettingsModal({
    settings,
    modal: mockModal,
    save,
    audio: null,
    game: mockGame,
  });

  // A) Caso 1: L'utente ANNULLA la conferma
  confirmResult = false;
  let actionExecuted = false;
  await settingsModal._requireCheatConfirmation(() => { actionExecuted = true; });

  assert.equal(confirmCalled, true, 'confirm modal invocata al primo tentativo');
  assert.equal(actionExecuted, false, 'azione NON eseguita se l\'utente annulla');
  assert.equal(state.cheatsEnabled, false, 'cheatsEnabled resta false dopo annullamento');
  assert.equal(mockGame.saved, false, 'salvataggio non compromesso');

  // B) Caso 2: L'utente CONFERMA e accetta il lockout
  confirmResult = true;
  confirmCalled = false;
  await settingsModal._requireCheatConfirmation(() => { actionExecuted = true; });

  assert.equal(confirmCalled, true);
  assert.equal(actionExecuted, true, 'azione eseguita dopo conferma positiva');
  assert.equal(state.cheatsEnabled, true, 'cheatsEnabled impostato a true');
  assert.equal(mockGame.saved, true, 'salvataggio scritto immediatamente su storage');

  // C) Caso 3: Successive chiamate con cheatsEnabled già true non richiedono ulteriore conferma
  confirmCalled = false;
  let secondAction = false;
  await settingsModal._requireCheatConfirmation(() => { secondAction = true; });
  assert.equal(confirmCalled, false, 'Nessun popup modale aggiuntivo se i trucchi sono già abilitati');
  assert.equal(secondAction, true);
  console.log('✓ 4. SettingsModal: dialogo di conferma irreversibile e salvataggio immediato collaudati');
}

// 5. Test Indicatore Visivo HUD & Banner Lockout Statistiche
{
  // Test HUD badge
  const state = new State();
  state.cheatsEnabled = false;

  // Mock DOM per Hud
  const hudRoot = {
    innerHTML: '',
    classList: { add() {}, remove() {} },
    querySelector(sel) {
      return {
        textContent: '',
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          toggle(c, force) { if (force) this.classes.add(c); else this.classes.delete(c); },
          contains(c) { return this.classes.has(c); },
        },
        style: { setProperty() {} },
        setAttribute() {},
        addEventListener() {},
      };
    },
  };

  const hud = new Hud(hudRoot, { state });
  assert.equal(hud.el.cheatsBadge.classList.contains('hidden'), true, 'Badge trucchi nascosto quando cheatsEnabled è false');

  state.cheatsEnabled = true;
  hud.refresh();
  assert.equal(hud.el.cheatsBadge.classList.contains('hidden'), false, 'Badge trucchi visibile quando cheatsEnabled è true');

  // Test StatsModal banner
  const mockAchievements = {
    state,
    getAll: () => [],
    getUnlockedCount: () => 0,
    getTotalCount: () => 12,
  };
  const statsModal = new StatsModal(null, null, mockAchievements, null);
  const container = { innerHTML: '' };
  statsModal._renderTrophiesPage(container);
  assert.ok(container.innerHTML.includes('cheats-lockout-banner'), 'Banner di avviso trofei presente quando cheatsEnabled è true');

  state.cheatsEnabled = false;
  statsModal._renderTrophiesPage(container);
  assert.ok(!container.innerHTML.includes('cheats-lockout-banner'), 'Banner di avviso trofei assente quando cheatsEnabled è false');
  console.log('✓ 5. HUD badge (.hud-cheats-badge) e StatsModal banner (.cheats-lockout-banner) verificati');
}

console.log('--- TUTTI I TEST DELLA FASE 13 SUPERATI CON SUCCESSO! ---');
