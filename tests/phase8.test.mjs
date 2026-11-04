// Test unitari della Fase 8: Web App Manifest (PWA), Deployment e Rilascio
// Esecuzione: node --import ./tests/register.mjs tests/phase8.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('ok -', name); };

const root = path.resolve(import.meta.dirname, '..');

t('Manifest PWA: validità e configurazione standalone', () => {
  const manifestPath = path.join(root, 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json deve esistere nella root');

  const content = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(content);

  assert.equal(manifest.name, 'Diggy Diggy Sand: The Sunken City');
  assert.equal(manifest.short_name, 'DiggySand');
  assert.equal(manifest.start_url, './index.html');
  assert.equal(manifest.display, 'standalone', 'display deve essere standalone per gioco nativo');
  assert.equal(manifest.orientation, 'any');
  assert.equal(manifest.background_color, '#060b11');
  assert.equal(manifest.theme_color, '#0b1522');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
  assert.equal(manifest.icons[0].src, './assets/icons/icon.svg');
});

t('Icona SVG: esistenza e grafica vettoriale Atlantean-Kemet', () => {
  const iconPath = path.join(root, 'assets/icons/icon.svg');
  assert.ok(fs.existsSync(iconPath), 'icon.svg deve esistere in assets/icons/');

  const svg = fs.readFileSync(iconPath, 'utf8');
  assert.ok(svg.includes('<svg'), 'Deve essere un file SVG valido');
  assert.ok(svg.includes('#0FE3C1') || svg.includes('cyanGrad'), 'Deve includere i gradienti ciano di Atlantide');
  assert.ok(svg.includes('#F5BA23') || svg.includes('goldGrad'), 'Deve includere i gradienti oro');
});

t('index.html: metadati PWA, Open Graph e percorsi relativi', () => {
  const indexPath = path.join(root, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');

  // Link manifest e icone
  assert.ok(html.includes('rel="manifest" href="./manifest.json"'), 'Link manifest presente');
  assert.ok(html.includes('rel="icon" type="image/svg+xml" href="./assets/icons/icon.svg"'), 'Favicon SVG presente');
  assert.ok(html.includes('rel="apple-touch-icon" href="./assets/icons/icon.svg"'), 'Apple Touch Icon presente');
  assert.ok(html.includes('name="theme-color" content="#031826"') || html.includes('name="theme-color" content="#0b1522"'), 'Meta theme-color presente');
  assert.ok(html.includes('name="mobile-web-app-capable" content="yes"'), 'Mobile web app capable presente');
  assert.ok(html.includes('name="apple-mobile-web-app-capable" content="yes"'), 'Apple mobile web app capable presente');

  // Open Graph
  assert.ok(html.includes('property="og:title"'), 'Open Graph title presente');
  assert.ok(html.includes('property="og:description"'), 'Open Graph description presente');
  assert.ok(html.includes('property="og:image"'), 'Open Graph image presente');

  // Percorsi relativi (nessun percorso assoluto che inizi per /js o /css)
  assert.ok(!html.includes('href="/css/'), 'I percorsi CSS devono essere relativi');
  assert.ok(!html.includes('src="/js/'), 'I percorsi script devono essere relativi');
  assert.ok(html.includes('href="./css/style.css"'), 'CSS stile collegato con percorso relativo');
  assert.ok(html.includes('src="js/main.js"') || html.includes('src="./js/main.js"'), 'Entry point JS con percorso relativo');
});

t('GitHub Actions: workflow deploy.yml per GitHub Pages', () => {
  const deployPath = path.join(root, '.github/workflows/deploy.yml');
  assert.ok(fs.existsSync(deployPath), 'deploy.yml deve esistere');

  const yml = fs.readFileSync(deployPath, 'utf8');
  assert.ok(yml.includes('actions/deploy-pages'), 'Deve usare action ufficiale deploy-pages');
  assert.ok(yml.includes('actions/upload-pages-artifact'), 'Deve usare action upload-pages-artifact');
  assert.ok(yml.includes('main') || yml.includes('master'), 'Deve monitorare i branch principali');
});

t('Documentazione: README.md completo e professionale', () => {
  const readmePath = path.join(root, 'README.md');
  assert.ok(fs.existsSync(readmePath), 'README.md deve esistere');

  const readme = fs.readFileSync(readmePath, 'utf8');
  assert.ok(readme.includes('# Diggy Diggy Sand: The Sunken City'), 'Titolo presente');
  assert.ok(readme.includes('Controlli'), 'Tabella controlli presente');
  assert.ok(readme.includes('Suite Debug'), 'Sezione debug e cheat presente');
  assert.ok(readme.includes('GitHub Pages'), 'Istruzioni di deployment presenti');
  assert.ok(readme.includes('Three.js'), 'Riconoscimenti Three.js presenti');
});

console.log(`\nFase 8: tutti i ${passed} test sono passati con successo!`);

