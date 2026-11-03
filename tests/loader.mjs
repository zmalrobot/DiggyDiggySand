// Hook di Node che replica l'import map di index.html ('three' -> vendor/three/), per testare i moduli senza browser.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: pathToFileURL(path.join(root, 'vendor/three/three.module.js')).href, shortCircuit: true };
  if (specifier.startsWith('three/addons/')) return { url: pathToFileURL(path.join(root, 'vendor/three/addons/', specifier.slice(13))).href, shortCircuit: true };
  return next(specifier, context);
}
