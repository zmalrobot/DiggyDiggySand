// Logger compatto e sanificazione log per ambiente di produzione Gold Master:
// Sopprime messaggi informativi e di debug se debugMode è disattivo e non c'è '?debug=1' o '?cheat=1',
// preservando esclusivamente gli errori critici (console.error).

export class Logger {
  static init() {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search || '');
    const isDebug = urlParams.get('debug') === '1' || urlParams.get('cheat') === '1' || !!window.__DDS_DEBUG_LOGS;

    const originalLog = console.log;
    const originalInfo = console.info;
    const originalDebug = console.debug;

    if (!isDebug) {
      // In produzione: sopprime log, info e debug, mantiene i warning e gli errori critici
      console.log = (...args) => {
        if (window.__DDS_DEBUG_LOGS) originalLog(...args);
      };
      console.info = (...args) => {
        if (window.__DDS_DEBUG_LOGS) originalInfo(...args);
      };
      console.debug = (...args) => {
        if (window.__DDS_DEBUG_LOGS) originalDebug(...args);
      };
    }

    // Banner ufficiale di rilascio Gold Master v1.0.0 formattato con CSS
    const bannerStyle = 'color: #F5BA23; background: #031826; font-family: "Cinzel", serif; font-size: 13px; font-weight: bold; padding: 4px 10px; border: 1px solid #0FE3C1; border-radius: 4px;';

    try {
      (originalLog || console.log)(
        '%c[DDS] Diggy Diggy Sand — v1.0.0 (Gold Master) Ready.',
        bannerStyle
      );
    } catch {
      // Fallback in ambienti senza supporto %c
      (originalLog || console.log)('[DDS] Diggy Diggy Sand — v1.0.0 (Gold Master) Ready.');
    }
  }
}
