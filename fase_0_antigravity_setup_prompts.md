# Diggy Diggy Sand — Setup Prompts per Antigravity (Fase 0 & Fase 0.5)

Questi 3 prompt guidano **Antigravity** passo dopo passo prima di scrivere la logica di scavo, sfruttando i comandi speciali (`/learn`, `/grill-me`, `/plan`), configurando le regole dell'agente e coprendo l'intero ciclo di boot (Loading asincrono, Main Menu e Impostazioni reattive funzionanti).

---

### Prompt 1: Ingestione Documentazione, Regole e `/learn`

> **Obiettivo:** Far analizzare ad Antigravity tutti i file di specifica in `Ideas/`, fissare le regole visive e comportamentali in un file permanente e fargli apprendere vincoli, asset e formule economiche.

```markdown
Ciao Antigravity! Stiamo iniziando lo sviluppo del gioco 3D per browser "Diggy Diggy Sand".

Nella cartella `Ideas/` trovi i 4 documenti cardine del progetto:
1. `Ideas/diggy-diggy-sand-project.md` (Game Design Document & Architettura)
2. `Ideas/brand_book_art_bible.md` (Art Bible: stile Atlantean-Kemet, font Google, palette Three.js/CSS e direttive visive)
3. `Ideas/upgrade_tree_specification.md` (Formule matematiche, rami di potenziamento e bilanciamento)
4. `Ideas/asset_manifest_download_guide.md` (Manifest asset CC0, directory paths e motori di fallback procedurali)

Esegui queste azioni preliminari:
1. Usa `/learn` per analizzare a fondo tutti e 4 i documenti in `Ideas/` e memorizzare stile visivo, architettura, formule economiche e vincoli tecnici.
2. Crea nella root di progetto un file di regole persistente per l'agente (es. `.agentrules` o istruzioni operative di contesto) in cui fissi:
   - Divieto assoluto di usare font di sistema generici (utilizzare solo Cinzel Decorative, Cinzel e Syne da Google Fonts).
   - Uso di Three.js con `flatShading: true` per il terreno e palette cromatica Atlantean-Kemet (oro/sabbia e ciano/oricalco).
   - Presenza obbligatoria di fallback procedurali per mesh e Web Audio API qualora gli asset esterni non siano caricati.
   - Disaccoppiamento tra loop economico (basato su timestamp/dt reale) e framerate di rendering Three.js.
   - Gestione persistente e immediata delle impostazioni utente su localStorage (`dds_settings_v1`).

Confermami quando hai letto tutto e riassumi in 5 punti chiave i vincoli tassativi che guideranno il tuo sviluppo.
```

---

### Prompt 2: Stress-Test Tecnico con `/grill-me`

> **Obiettivo:** Interrogare criticamente l'architettura su prestazioni Three.js, persistenza, ciclo di vita (Boot/Menu) e scope prima di scrivere codice.

```markdown
/grill-me

Ora che hai appreso il progetto, voglio che mi metti sotto torchio e analizzi criticamente l'architettura tecnica prima di procedere.

In particolare, interrogami e confrontati con me sui seguenti nodi critici per arrivare a una soluzione condivisa:
1. **Flusso di Avvio (Fase 0.5):** Gestione del `THREE.LoadingManager` per asset/font asincroni, sblocco dell'AudioContext del browser al primo click/interazione e transizione fluida tra Schermata di Caricamento e Menu Principale.
2. **Pannello Impostazioni Funzionante:** Come collegare in tempo reale i controlli UI (audio con GainNode Web Audio, qualità ombre, risoluzione/render scale, budget particelle, cap FPS) al motore di rendering e come salvarli su `localStorage`.
3. **Performance della Heightmap:** Ricalcolo delle normali su griglia 256x256 e raycasting continuo durante il click prolungato ("hold") senza cali di framerate.
4. **Persistenza e LocalStorage:** Come serializzare il terreno scavato senza sforare il limite dei 5 MB del browser o bloccare il main thread (array compresso/quantizzato vs snapshot).
5. **Scope del Finale C (Tycoon/Impresa):** Come mantenere l'epilogo divertente e interattivo senza dover sviluppare un secondo motore di gioco gestionale da zero.

Fammi le domande necessarie, proponi la tua soluzione tecnica ottimale per ciascun punto e attendi la mia conferma prima di redigere il piano di lavoro.
```

---

### Prompt 3: Roadmap Esecutiva e Struttura con `/plan` (Include Fase 0.5 Menu)

> **Obiettivo:** Generare la checklist incrementale dettagliata, inserendo formalmente la Fase 0.5 (Loading Screen & Menu Principale completo) prima della Fase 1 di scavo.

```markdown
/plan

Sulla base di tutte le decisioni confermate e dei 4 documenti in `Ideas/`, genera il piano d'azione operativo dettagliato per l'implementazione del gioco.

Il piano deve prevedere una progressione rigorosa suddivisa in milestone con caselle di spunta `[ ]`:

- **Milestone 0 — Foundation & Scaffolding:**
  - Setup cartelle di progetto (`css/`, `js/core/`, `js/world/`, `js/ui/`, `assets/`).
  - `index.html` con import Three.js, Google Fonts (Cinzel Decorative, Cinzel, Syne) e struttura base del canvas.
  - `css/style.css` con variabili colore Atlantean-Kemet, componenti glassmorphism scuro e bordi oricalco.

- **Milestone 0.5 — Boot, Loading Screen & Settings Menu (COMPLETO):**
  - `js/core/SettingsManager.js`: Manager reattivo con pattern Observer e salvataggio su `localStorage` (`dds_settings_v1`) per:
    * Audio: Master, Musica, SFX (0–100%) e Mute.
    * Grafica: Render scale (0.5x, 0.75x, 1.0x), Ombre (Off/Low/High), Qualità particelle (Low/Med/High), FPS Cap (30/60/Uncap).
    * Controlli: Sensibilità camera, Inverti asse Y, Screen shake toggle.
    * Dati: Reset salvataggio con conferma di sicurezza.
  - `js/ui/LoadingScreen.js`: Schermata asincrona con `THREE.LoadingManager`, barra graduata a stile obelisco con bagliore ciano, percentuale e suggerimenti/lore dinamici a rotazione. Bottone "Inizia" per sbloccare l'AudioContext.
  - `js/ui/MainMenu.js`: Menu principale a tema Atlantean-Kemet con pulsanti:
    * *Nuova Partita* (con popup se esiste già un salvataggio).
    * *Continua* (attivo solo se presente un salvataggio in sessione/localStorage).
    * *Impostazioni* (apre modale con slider, toggle e dropdown funzionanti a runtime).
    * *Crediti*.
  - Scena 3D di sfondo minimale nel menu (camera lenta che orbita attorno a una duna/obelisco stilizzato).

- **Milestone 1 — Meccanica di Scavo & Audio Procedurale:**
  - Terreno heightmap 3D (`js/world/Terrain.js`) con mesh deformabile e `flatShading: true`.
  - Raycasting e scavo con raggio di caduta circolare (`js/systems/Digging.js`) per click singolo e hold continuo.
  - Particelle di sabbia e scintille ciane al colpo.
  - Sintetizzatore audio procedurale Web Audio API (`SoundSynth.js`) per colpi morbidi e colpi critici.

- **Milestone 2 — Economia, HUD & Primi Upgrade:**
  - Loop economico temporale disaccoppiato dal framerate (`js/systems/Economy.js`).
  - HUD di gioco con contatore Sabbia, rateo/s e obelisco di progresso percentuale.
  - Shop con i primi 4 upgrade manuali (Shovel, Rate, Radius, Solar Cleave).

- **Milestone 3 — Flotta 3D & Rovine di Atlantide:**
  - Unità automatiche visibili (`Nomad Diggers`, `Steam Excavators`, `Monoliths`) con fallback procedurali.
  - Strutture archeologiche sepolte che emergono gradualmente dal terreno durante lo scavo.

- **Milestone 4 — I Tre Finali & Persistenza:**
  - Sistema seed random per la selezione segreta del finale (`EndingManager.js`).
  - Implementazione sequenze finali (Maledizione, Tesoro, Epilogo Impresa).
  - Salvataggio dello stato di gioco e galleria finali visti.

- **Milestone 5 — Polish & Supporto Mobile:**
  - Ottimizzazione touch (un dito per scavare, due per ruotare/zoomare).
  - Rifinitura bilanciamento tempi (curva 30–40 min).

Mostrami il piano completo con l'indicazione precisa dei file che verranno creati in ciascun passaggio, pronto per avviare la Milestone 0 al mio prossimo comando.
```