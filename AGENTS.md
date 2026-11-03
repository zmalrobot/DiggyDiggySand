# Diggy Diggy Sand: regole operative per l'agente

Documenti sorgente (in `Ideas/`): `diggy-diggy-sand-project.md` (GDD e architettura), `brand_book_art_bible.md`, `upgrade_tree_specification.md`, `asset_manifest_download_guide.md`. In caso di conflitto prevalgono Art Bible e Upgrade Tree sul GDD (es. `flatShading: true`, costi e formule).

## 1. Tipografia
- Vietati font di sistema o generici: Arial, Inter, Roboto, system-ui, sans-serif/serif come font primario.
- Ammessi solo Google Fonts: `Cinzel Decorative` (700/900, logo e titoli finali), `Cinzel` (600/700, header, shop, pulsanti), `Syne` (400-800, numeri, contatori, body).
- Usare le variabili `--font-display`, `--font-heading`, `--font-data`, `--font-body`.

## 2. Stile visivo
- Three.js "Chiseled Low-Poly": `flatShading: true` su terreno e su tutti i MeshStandardMaterial. Nessuno smoothing e nessuna suddivisione eccessiva.
- Palette Atlantean-Kemet: oro/sabbia (`#E4C580`, `#C89849`, `#8C5828`, `#F5BA23`) per materia e ricchezza. Ciano/teal/oricalco (`#0FE3C1`, `#00B4D8`, `#031826`, `#D87D38`) per mistero, tecnologia e progresso.
- Terreno colorato per altezza: Y>8 sabbia chiara, 3<Y≤8 ocra, Y≤3 pietra scura con venature `0x0FE3C1`.
- UI: vetro blu abisso con `backdrop-filter`, bordo oro/ciano, angoli smussati a 45° (`clip-path`). Mai pannelli flat monocromatici.
- Colori dei finali riservati (Curse, Treasure, Business), come da Art Bible §6.

## 3. Fallback obbligatori
- Ogni `.glb`, texture e audio esterno ha un fallback procedurale: `ProceduralFactory.js` per le mesh, `SoundSynth` (Web Audio API) per l'audio.
- Il caricamento deve avere try/catch o `onError` e non deve mai bloccare il gioco. Creare l'AudioContext solo dopo un gesto utente, con `resume()`.
- Solo asset CC0 o equivalenti, nelle cartelle `assets/{models,textures,audio}/...` previste dal manifest.

## 4. Loop economico disaccoppiato dal rendering
- L'economia (DPS, flotta, offline progress) usa timestamp reali / `dt` (`performance.now()` o `Date.now()`), mai il numero di frame.
- `dt` va limitato in modo sicuro e l'accumulo è indipendente da `requestAnimationFrame`. Il rendering Three.js legge solo lo stato.
- Formule: `Cost(n)=round(Base×Mult^n)` e le formule DPS/tick di `upgrade_tree_specification.md`. Tick minimo di scavo 0.06s.

## 5. Impostazioni utente
- Chiave localStorage `dds_settings_v1` (audio, qualità grafica, ecc.).
- Ogni modifica viene salvata subito (nessun debounce lungo o salvataggio solo alla chiusura) e applicata subito. Il caricamento usa try/catch e valori di default se i dati sono corrotti.
- Il salvataggio di gioco è separato dalle impostazioni, con campo `version` per le migrazioni.

## 6. Altri vincoli tecnici
- HTML/CSS/JS ES modules, Three.js a versione pinnata, struttura cartelle come GDD §7.2.
- Terreno heightmap: res 256 su desktop e 128 su mobile, a chunk 8×8 con dirty flags (si aggiornano solo i chunk toccati dallo scavo). Con `flatShading: true` le normali vengono dallo shader (derivate `dFdx`/`dFdy`) e non con `computeVertexNormals` sull'intera mesh. Raycast analitico sulla heightmap. `InstancedMesh` per workers, monete e gemme.
- Three.js r160 in copia locale in `vendor/three/` (import map in `index.html`). Timeout di caricamento: 10s per asset, 30s globale, poi fallback procedurale.
- Salvataggio terreno: altezze Uint8 su griglia 128×128, RLE/delta + base64, scritto in idle ogni 15s e su `visibilitychange`.
- Finale scelto da seed (mulberry32) e salvato. Debug con `?ending=` e `?cheat=1`.

## 7. Architettura Modali e Dialoghi
- Le finestre di dialogo basate su `ModalManager` risiedono in `#modal-root`. I modali di conferma sovrapposti (`modal.confirm`) si impilano nello stack di `#modal-root`.
- Ogni classe/controller modale (`SettingsModal`, `StatsModal`, `BiomeSelectModal`, `GalleryModal`) deve esporre esplicitamente un metodo `close()` pubblico per garantire un ciclo di vita uniforme e testabile.
- I modali a schermo intero indipendenti usano l'attributo `hidden` per visibilità/accessibilità.

## 8. Convenzione di Test e Runner
- Poiché il progetto usa Three.js con ES modules e import map nativi, tutti i file di test Node.js che importano `three` devono essere eseguiti con il register loader:
  `node --import ./tests/register.mjs tests/<nome-test>.mjs`
- Le suite di browser QA con CDP/Puppeteer devono sempre attendere il caricamento completo del renderer e verificare `0 errori console` e `0 eccezioni pagina`.

## 9. Cheat di Debug e Politica Achievement
- Qualsiasi funzionalità di cheat visiva deve richiedere una conferma esplicita irreversibile prima dell'attivazione se `!state.cheatsEnabled`.
- L'abilitazione scrive immediatamente `cheatsEnabled: true` nel salvataggio persistente (`dds_save_v1`) per prevenire exploit al reload.
- `Achievements.js` blocca incondizionatamente sia `unlock()` che `check()` se `state.cheatsEnabled === true`, e la schermata Trofei espone il banner `.cheats-lockout-banner`.

