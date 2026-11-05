import assert from 'node:assert/strict';
import fs from 'node:fs';
import { i18n } from '../js/core/I18n.js';
import { PauseMenu } from '../js/ui/PauseMenu.js';
import { Shop } from '../js/ui/Shop.js';
import { State } from '../js/core/State.js';

console.log('--- TEST UNITARIO MOBILE UI OVERHAUL ---');

// 1. Verifica stringhe I18n Menu Pausa
console.log('1. Verifica I18n Menu Pausa...');
i18n.setLanguage('it');
assert.equal(i18n.t('pause.elapsed'), 'Tempo trascorso', 'pause.elapsed in italiano deve essere "Tempo trascorso"');
assert.equal(i18n.t('pause.prestige'), 'Santuario dei Predecessori', 'pause.prestige in italiano deve essere pulito senza segnaposti duplicati');

i18n.setLanguage('en');
assert.equal(i18n.t('pause.elapsed'), 'Time elapsed', 'pause.elapsed in inglese deve essere "Time elapsed"');
assert.equal(i18n.t('pause.prestige'), 'Sanctuary of Ancestors', 'pause.prestige in inglese deve essere pulito senza segnaposti duplicati');

// Test case-insensitive parameter matching
assert.equal(i18n.t('hud.completionPct', { PCT: 42 }), '42% excavated', 'Interpolazione case-insensitive {PCT} -> {pct} in lingua en');
i18n.setLanguage('it');
assert.equal(i18n.t('hud.completionPct', { pct: 42 }), '42% scavato', 'Interpolazione esatta {pct} in lingua it');
assert.equal(i18n.t('hud.completionPct', { PCT: 42 }), '42% scavato', 'Interpolazione case-insensitive {PCT} -> {pct} in lingua it');

i18n.setLanguage('it');
console.log('✓ Stringhe I18n e interpolazione case-insensitive validate.');

// 2. Verifica Render PauseMenu (Nessun doppio contatore o placeholder)
console.log('2. Verifica Render PauseMenu...');
const mockSave = { getTablets: () => 5 };
const mockGame = { state: new State(), _setPaused: () => {} };
const mockSettings = { get: () => 80, set: () => {} };

// Mock DOM minimo per Node
globalThis.document = {
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    innerHTML: '',
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild: () => {},
  }),
};

const pauseMenu = new PauseMenu(
  { appendChild: () => {} },
  { game: mockGame, settings: mockSettings, save: mockSave }
);

pauseMenu._renderContent();
const html = pauseMenu.el.innerHTML;

assert.ok(html.includes('data-i18n="pause.elapsed"'), 'Il template deve includere data-i18n="pause.elapsed"');
assert.ok(html.includes('Tempo trascorso'), 'Il testo renderizzato deve contenere "Tempo trascorso"');
assert.ok(!html.includes('{COUNT}'), 'Il testo non deve mai contenere il placeholder grezzo {COUNT}');
assert.ok(!html.includes('{count}'), 'Il testo non deve mai contenere il placeholder grezzo {count}');
assert.ok(!html.includes('(T {COUNT})'), 'Nessun (T {COUNT})');
assert.ok(!html.includes('(τ 5) (τ 5)'), 'Nessun doppio contatore tavolette');
assert.ok(html.includes('Santuario dei Predecessori</span> (<span class="tablets-count">τ 5</span>)'), 'Contatore tavolette pulito e singolo');

console.log('✓ Render PauseMenu privo di doppi contatori o stringhe non risolte.');

// 3. Verifica Shop.js DOM markup
console.log('3. Verifica Shop.js DOM markup...');
function createMockEl() {
  return {
    tagName: 'DIV',
    className: '',
    style: {},
    innerHTML: '',
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    addEventListener: () => {},
    querySelector: () => createMockEl(),
    querySelectorAll: () => [],
    appendChild: () => {},
  };
}

const mockRoot = createMockEl();
const shop = new Shop(mockRoot, {
  state: new State(),
  audio: {},
});

assert.ok(shop.root.innerHTML.includes('shop-items-list'), 'Shop root include la classe shop-items-list');
assert.ok(shop.root.innerHTML.includes('upgrade-list'), 'Shop root include la classe upgrade-list');
assert.ok(shop.root.innerHTML.includes('shop-content'), 'Shop root include la classe shop-content');

const cardHtml = shop._renderCard({
  id: 'shovel_speed',
  name: 'Pala veloce',
  branch: 'manual',
  maxLevel: 10,
  baseCost: 10,
  costMult: 1.15,
  getBenefit: () => '+10% velocità scavo',
});
assert.ok(cardHtml.includes('upgrade-card'), 'Card markup include upgrade-card');
assert.ok(cardHtml.includes('shop-item'), 'Card markup include shop-item');
assert.ok(cardHtml.includes('btn-buy'), 'Card markup include btn-buy');
assert.ok(cardHtml.includes('upgrade-buy-btn'), 'Card markup include upgrade-buy-btn');
assert.ok(cardHtml.includes('upgrade-card-foot'), 'Card markup include upgrade-card-foot');

console.log('✓ Classi e selettori Shop.js validati.');

// 4. Verifica Regole CSS style.css
console.log('4. Verifica Regole CSS style.css...');
const css = fs.readFileSync('./css/style.css', 'utf-8');

// Auto-Scaler
assert.ok(css.includes('--ui-scale: 1;'), 'style.css definisce --ui-scale: 1');
assert.ok(css.includes('@media (max-width: 768px)'), 'style.css include media query max-width: 768px');
assert.ok(css.includes('--ui-scale: 0.85;'), 'style.css include --ui-scale: 0.85 per tablet');
assert.ok(css.includes('font-size: 13.5px;'), 'style.css include font-size: 13.5px per tablet');
assert.ok(css.includes('@media (max-width: 480px), (max-height: 740px)'), 'style.css include media query max-width: 480px');
assert.ok(css.includes('--ui-scale: 0.76;'), 'style.css include --ui-scale: 0.76 per smartphone');
assert.ok(css.includes('font-size: 12px;'), 'style.css include font-size: 12px per smartphone');

// Flex-shrink 0 e visibilità bottoni acquisto
assert.ok(css.includes('flex-shrink: 0 !important;'), 'style.css garantisce flex-shrink: 0 !important per schede e bottoni acquisto');
assert.ok(css.includes('height: auto !important;'), 'style.css imposta height: auto !important');
assert.ok(css.includes('max-height: none !important;'), 'style.css imposta max-height: none !important');
assert.ok(css.includes('overflow: visible !important;'), 'style.css imposta overflow: visible !important');

// 100dvh e Safe-area
assert.ok(css.includes('100dvh;'), 'style.css sfrutta 100dvh per evitare overflow della barra di Chrome');
assert.ok(css.includes('82dvh !important;'), 'style.css imposta 82dvh per shop-drawer su mobile');
assert.ok(css.includes('z-index: 850 !important;'), 'style.css protegge la visibilità del dock con z-index: 850 !important');
assert.ok(css.includes('safe-area-inset-bottom'), 'style.css rispetta la safe-area per i pulsanti inferiori');

console.log('✓ Tutte le verifiche CSS e UI hanno avuto esito POSITIVO.');
