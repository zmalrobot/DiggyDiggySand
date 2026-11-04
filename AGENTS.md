# Diggy Diggy Sand: regole operative per l'agente (v1.0.0 Gold Master)

Documenti sorgente (in `Ideas/`): `diggy-diggy-sand-project.md` (GDD e architettura), `brand_book_art_bible.md`, `upgrade_tree_specification.md`, `asset_manifest_download_guide.md`. In caso di conflitto prevalgono Art Bible e Upgrade Tree sul GDD (es. `flatShading: true`, costi e formule).

## 1. Tipografia
- Vietati font di sistema o generici: Arial, Inter, Roboto, system-ui, sans-serif/serif come font primario.
- Ammessi solo Google Fonts: `Cinzel Decorative` (700/900, logo e titoli finali), `Cinzel` (600/700, header, shop, pulsanti), `Syne` (400-800, numeri, contatori, body, floating text).
- Usare le variabili `--font-display`, `--font-heading`, `--font-data`, `--font-body`.

## 2. Stile Visivo, PBR Procedurale e Pipeline Grafica
- Three.js "Chiseled Low-Poly": `flatShading: true` su terreno e su tutti i `MeshStandardMaterial`. Nessuno smoothing e nessuna suddivisione eccessiva.
- Palette Atlantean-Kemet: oro/sabbia (`#E4C580`, `#C89849`, `#8C5828`, `#F5BA23`) per materia e ricchezza. Ciano/teal/oricalco (`#0FE3C1`, `#00B4D8`, `#031826`, `#D87D38`) per mistero, tecnologia e progresso.
- Terreno colorato per altezza: $Y>8$ sabbia chiara, $3<Y\le8$ ocra, $Y\le3$ pietra scura con venature `0x0FE3C1`.
- Texture PBR Procedurali 2048px (`TextureGenerator.js`): generate a runtime in memoria tramite FBM a 4 ottave e normal map Sobel analitica. Anisotropia massima GPU abilitata (fino a $16\times$).
- Parametri PBR di riferimento:
  - Sabbia: Roughness 0.90, Metalness 0.00.
  - Arenaria / Colonne: Roughness 0.78, Metalness 0.05.
  - Oricalco Metallico: Roughness 0.25, Metalness 0.85.
  - Cristalli Atlantidei: Roughness 0.10, Metalness 0.10, Emissività 0.85 (Bloom attivo).
  - Oro Solare: Roughness 0.20, Metalness 0.95.
- Ambient Floor Obbligatorio: `AmbientLight(0x0D131A, 0.15)` permanente e cielo notturno $\ge 0.25$ per scongiurare schermi neri a grafica alta.
- Tone Mapping: `THREE.ACESFilmicToneMapping` con esposizione 1.0 e compositing opaco (`gl_FragColor = vec4(col, 1.0)`).
- Raytracing Sperimentale (SSR / SSAO): pass ottico raymarching disattivato di default nelle impostazioni (`graphics.ssrEnabled: false`) con bypass a costo zero.
- UI: vetro blu abisso con `backdrop-filter`, bordo oro/ciano, angoli smussati a 45° (`clip-path`). Mai pannelli flat monocromatici.
- Colori dei finali riservati (Curse, Treasure, Business, Secret), come da Art Bible §6.

## 3. Fallback Obbligatori e PWA Offline
- Ogni `.glb`, texture e audio esterno ha un fallback procedurale: `ProceduralFactory.js` per le mesh, `SoundSynth` (Web Audio API) per l'audio.
- Il caricamento deve avere try/catch o `onError` e non deve mai bloccare il gioco. Creare l'AudioContext solo dopo un gesto utente, con `resume()`.
- Solo asset CC0 o equivalenti, nelle cartelle `assets/{models,textures,audio}/...` previste dal manifest.
- Offline PWA: root `sw.js` con cache `dds_cache_v1.0.0`, Cache-First per risorse statiche e rimozione automatica vecchie cache all'evento `activate`.

## 4. Loop Economico, Formule Multi-Buy e Progressioni
- L'economia (DPS, flotta, offline progress) usa timestamp reali / `dt` (`performance.now()` o `Date.now()`), mai il numero di frame.
- `dt` va limitato in modo sicuro e l'accumulo è indipendente da `requestAnimationFrame`. Il rendering Three.js legge solo lo stato.
- Formule di costo:
  - Singolo livello: $\text{Cost}(n) = \text{round}(\text{Base} \times \text{Mult}^n)$.
  - Multi-Buy ($k$ livelli): $\text{Cost}_{\text{totale}}(k) = B \cdot r^n \cdot \frac{r^k - 1}{r - 1}$.
  - Modalità MAX analitica: $k_{\text{max}} = \left\lfloor \frac{\ln\left(1 + \frac{S \cdot (r - 1)}{B \cdot r^n \cdot (1 - d)}\right)}{\ln(r)} \right\rfloor$.
- Prevenzione overflow: ogni calcolo di costo è limitato superiormente a `Number.MAX_SAFE_INTEGER`.
- Curva target calibrata: 30–35 minuti per la run completa, convalidabile da console con `window.__DDS_DEBUG.simulateProgression()`. Tick minimo di scavo 0.06s.

## 5. Impostazioni Utente e Salvataggi
- Chiave localStorage `dds_settings_v1` (audio, qualità grafica, lingua, profiler, ecc.).
- Ogni modifica viene salvata ed applicata subito. Il caricamento usa try/catch e valori di default se i dati sono corrotti.
- Salvataggio di gioco (`dds_save_v1` e backup `dds_save_backup`) separato dalle impostazioni, con campo `version` per le migrazioni.
- Import/Export portabile del salvataggio serializzato in Base64 con verifica di integrità CRC32 (`SaveSerializer.js`).

## 6. Gestione Memoria e Deallocazione GPU
- Deallocazione profonda ricorsiva obbligatoria su smantellamento/riavvio spedizione (`DisposeUtils.deepDispose(group)`): geometrie, materiali, texture (`map`, `normalMap`, `roughnessMap`, `depthTexture`) e render target di post-processing.
- Object Pool per particelle (`Particles.js`, max 300) e per cifre numeriche fluttuanti (`FloatingText.js`) per prevenire garbage collection spikes.

## 7. Architettura Modali e Dialoghi
- Le finestre di dialogo basate su `ModalManager` risiedono in `#modal-root`. I modali di conferma sovrapposti (`modal.confirm`) si impilano nello stack di `#modal-root`.
- Ogni classe/controller modale (`SettingsModal`, `StatsModal`, `BiomeSelectModal`, `GalleryModal`, `HelpModal`, `CreditsModal`, `WardrobeModal`) espone un metodo `close()` pubblico per garantire un ciclo di vita uniforme e testabile.
- I modali a schermo intero indipendenti usano l'attributo `hidden` per visibilità/accessibilità.

## 8. Convenzione di Test e Runner
- Tutti i file di test Node.js che importano `three` devono essere eseguiti con il register loader:
  `node --import ./tests/register.mjs tests/<nome-test>.mjs`
- Le suite di browser QA con CDP/Puppeteer devono sempre attendere il caricamento completo del renderer e verificare `0 errori console` e `0 eccezioni pagina`.

## 9. Cheat di Debug e Politica Achievement
- Qualsiasi funzionalità di cheat visiva richiede una conferma esplicita irreversibile prima dell'attivazione se `!state.cheatsEnabled`.
- L'abilitazione scrive immediatamente `cheatsEnabled: true` nel salvataggio persistente (`dds_save_v1`) per prevenire exploit al reload.
- `Achievements.js` blocca incondizionatamente sia `unlock()` che `check()` se `state.cheatsEnabled === true`, e la schermata Trofei espone il banner `.cheats-lockout-banner`.

## 10. Architettura Reattiva Multi-Tier (Desktop, Tablet, Smartphone)
- Nessuna duplicazione di markup: adattamento gestito via CSS media queries e pointer queries.
- Tier 1 Desktop ($\ge 1025\text{px}$): topbar orizzontale, drawer Negozio laterale destro (380px), controlli tastiera (`WASD`, `Q/E`, `Space`, `F2`, `F3`).
- Tier 2 Tablet ($601\text{px} - 1024\text{px}$): touch target allargati a minimo $44\text{px} \times 44\text{px}$, drawer adattivo al $45\%$ (landscape) o $55\%$ (portrait).
- Tier 3 Smartphone ($\le 600\text{px}$): Negozio trasformato in Bottom Sheet a scomparsa dal basso con bordi superiori arrotondati (20px) e maniglia tattile, rispetto di `env(safe-area-inset-*)` e compensazione dinamica del FOV verticale della telecamera.
- Gesture touch: un dito per scavare (con feedback aptico `Haptics.js`), due dita per pinch-zoom e rotazione camera.

## 11. Accessibilità e Comfort Visivo
- Supporto al preset *Reduced Motion*: disattivazione del trauma camera shake e riduzione particellare.
- Supporto a *Smart Pause*: sospensione automatica del calcolo $dt$ durante il cambio di tab in background per evitare salti o de-sincronizzazioni.
