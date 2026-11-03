// Piccolo event bus globale.
export class Events {
  constructor() { this.map = new Map(); }

  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, new Set());
    this.map.get(name).add(fn);
    return () => this.off(name, fn);
  }

  off(name, fn) { this.map.get(name)?.delete(fn); }

  emit(name, payload) {
    this.map.get(name)?.forEach((fn) => {
      try { fn(payload); } catch (e) { console.error(`[Events] handler "${name}"`, e); }
    });
  }
}

export const events = new Events();

