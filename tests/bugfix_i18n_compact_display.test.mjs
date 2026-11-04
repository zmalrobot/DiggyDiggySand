import assert from 'node:assert/strict';
import { i18n, DICTIONARY } from '../js/core/I18n.js';

console.log('--- TEST BUGFIX: I18N CASE-INSENSITIVE & DIZIONARIO SOVRASCRITTURA ---');

// 1. Verifica chiavi formali in it ed en
assert.equal(i18n.t('menu.overwriteConfirmTitle'), 'Sovrascrivere la Spedizione?');
assert.equal(i18n.t('menu.overwriteConfirmMsg'), "Una spedizione è già in corso nel deserto. Iniziarne una nuova cancellerà i progressi attuali della duna e dell'officina. Desideri procedere?");
assert.equal(i18n.t('menu.overwriteBtn'), 'Sovrascrivi e Inizia');
assert.equal(i18n.t('menu.cancelBtn'), 'Annulla');

// 2. Normalizzazione case-insensitive
assert.equal(i18n.t('MENU.OVERWRITECONFIRMTITLE'), 'Sovrascrivere la Spedizione?');
assert.equal(i18n.t('MENU.OVERWRITEBTN'), 'Sovrascrivi e Inizia');
assert.equal(i18n.t('menu.overwriteconfirmmsg'), "Una spedizione è già in corso nel deserto. Iniziarne una nuova cancellerà i progressi attuali della duna e dell'officina. Desideri procedere?");
assert.equal(i18n.t('MENU.CANCELBTN'), 'Annulla');

// 3. Verifica in inglese
i18n.setLanguage('en');
assert.equal(i18n.t('menu.overwriteConfirmTitle'), 'Overwrite Expedition?');
assert.equal(i18n.t('menu.overwriteConfirmMsg'), 'An expedition is already underway. Starting a new one will erase current dune and workshop progress. Do you wish to proceed?');
assert.equal(i18n.t('menu.overwriteBtn'), 'Overwrite & Start');
assert.equal(i18n.t('menu.cancelBtn'), 'Cancel');

assert.equal(i18n.t('MENU.OVERWRITECONFIRMTITLE'), 'Overwrite Expedition?');
assert.equal(i18n.t('MENU.OVERWRITEBTN'), 'Overwrite & Start');
assert.equal(i18n.t('menu.overwriteconfirmmsg'), 'An expedition is already underway. Starting a new one will erase current dune and workshop progress. Do you wish to proceed?');
assert.equal(i18n.t('MENU.CANCELBTN'), 'Cancel');

// Ripristina lingua it
i18n.setLanguage('it');

console.log('✓ Tutte le verifiche unitarie di traduzione case-insensitive e chiavi sovrascrittura superate con successo!');

