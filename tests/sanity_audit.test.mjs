// Test unitario per la Suite Diagnostica SanityAudit (Milestone 34: Gold Master Release Gate)
// Esecuzione: node --import ./tests/register.mjs tests/sanity_audit.test.mjs
import assert from 'node:assert/strict';
import { SanityAudit } from '../js/core/SanityAudit.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok -', name); };
const asyncT = async (name, fn) => { await fn(); passed++; console.log('ok -', name); };

t('SanityAudit: auditI18n() convalida 100% copertura e zero discrepanze', () => {
  const diffs = SanityAudit.auditI18n();
  assert.equal(diffs.length, 0, `Discrepanze trovate: ${diffs.join(', ')}`);
});

t('SanityAudit: auditSaveSchema() verifica serializzazione e assenza di valori corrotti', () => {
  const res = SanityAudit.auditSaveSchema();
  assert.equal(res.ok, true, `Errore audit salvataggio: ${res.error}`);
  assert.ok(res.bytes > 100, 'Salvataggio serializzato valido');
});

t('SanityAudit: auditEndings() simula dry-run dei 4 finali', () => {
  const res = SanityAudit.auditEndings();
  assert.equal(res.ok, true, `Errore audit finali: ${res.error}`);
});

t('SanityAudit: auditFallbacks() verifica modelli procedurali e sintesi audio', () => {
  const res = SanityAudit.auditFallbacks();
  assert.equal(res.ok, true, `Errore audit fallbacks: ${res.error}`);
  assert.ok(res.modelsTested >= 10, 'Almeno 10 modelli procedurali collaudati');
});

await asyncT('SanityAudit: run() esegue tutti i 4 audit in meno di 3 secondi', async () => {
  const report = await SanityAudit.run({ silent: true });
  assert.equal(report.ok, true, 'Tutti gli audit devono avere esito positivo');
  assert.equal(report.passed, 4, '4 audit passati');
  assert.equal(report.total, 4, '4 audit totali');
  assert.ok(report.durationMs < 3000, `Durata audit ${report.durationMs}ms deve essere < 3000ms`);
  console.log(`✓ SanityAudit completato con successo in ${report.durationMs} ms`);
});

console.log(`\nSanity Audit Unit Tests completati: ${passed} superati con successo.\n`);

