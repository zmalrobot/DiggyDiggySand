// Motore di Localizzazione Dinamica e Rigore i18n (Italiano / Inglese).
// Dizionario centralizzato universale, interpolazione parametri ({count}, {pct}, ecc.),
// reattività DOM immediata con data-i18n e sincronizzazione con SettingsManager.
import { events } from './Events.js';

export const DICTIONARY = {
  it: {
    common: {
      close: 'Chiudi',
      cancel: 'Annulla',
      confirm: 'Conferma',
      back: 'Indietro',
      locked: 'Bloccato',
      unlocked: 'Sbloccato',
      sec: 's',
      min: 'm',
      hours: 'h',
      save: 'Salva',
      continue: 'Continua',
      collect: 'Raccogli',
      active: 'Attivo',
      inactive: 'Disattivo',
      yes: 'Sì',
      no: 'No',
      reset: 'Ripristina',
    },
    menu: {
      title: 'Diggy Diggy Sand',
      subtitle: 'Svuota il deserto. Scopri cosa dorme sotto.',
      newGame: 'Nuova Spedizione',
      continue: 'Continua',
      gallery: 'Finali Scoperti',
      prestige: 'Santuario dei Predecessori',
      stats: 'Statistiche & Trofei',
      wardrobe: 'Guardaroba & Skin',
      settings: 'Impostazioni',
      credits: 'Crediti',
      help: 'Aiuto & Comandi',
      noSave: 'Nessun salvataggio disponibile',
      overwriteConfirmTitle: 'Sovrascrivere la Spedizione?',
      overwriteConfirmMsg: "Una spedizione è già in corso nel deserto. Iniziarne una nuova cancellerà i progressi attuali della duna e dell'officina. Desideri procedere?",
      overwriteBtn: 'Sovrascrivi e Inizia',
      cancelBtn: 'Annulla',
      confirmOverwriteTitle: 'Sovrascrivere la Spedizione?',
      confirmOverwriteMsg: "Una spedizione è già in corso nel deserto. Iniziarne una nuova cancellerà i progressi attuali della duna e dell'officina. Desideri procedere?",
      overwrite: 'Sovrascrivi e Inizia',
      creditsTitle: 'Crediti di Sviluppo',
      creditsIntro: 'Diggy Diggy Sand · miner incrementale 3D in low-poly chiseled con rovine e finali dinamici.',
      creditsEngine: 'Motore: Three.js r160. Font: Cinzel Decorative, Cinzel, Syne (Google Fonts).',
      creditsAssets: 'Asset 3D e audio: Licenza CC0 (Kenney, Quaternius, OpenGameArt) con fallback procedurali.',
    },
    hud: {
      sandLabel: 'Sabbia Estratta',
      sand: 'Sabbia',
      spsLabel: 'al secondo',
      spsSuffix: '/s',
      progress: 'Deserto scavato',
      desertExcavated: 'Deserto scavato',
      excavation: 'Deserto scavato',
      completionPct: '{pct}% scavato',
      radarDepth: 'Profondità',
      radarBedrock: 'Roccia Madre',
      workshop: 'Officina',
      workshopFull: 'Officina delle Dune',
      pause: 'Pausa',
      pauseTitle: 'Pausa / Impostazioni',
      help: 'Aiuto',
      helpTitle: 'Guida e Legenda Comandi',
      stormBoost: '⚡ TEMPESTA +50%',
      cheatsBadgeTitle: 'Trucchi attivi — Obiettivi bloccati',
      cheatsBadgeTag: 'TRUCCHI',
      cheatsActive: 'Trucchi attivi — Obiettivi bloccati',
      cheatsTag: 'TRUCCHI',
      radarTitle: 'Georadar',
      radarStatus: 'ATTIVO',
      radarActive: 'ATTIVO',
      radarScanning: 'Scansione in corso...',
    },
    shop: {
      title: 'Officina delle Dune',
      subtitle: 'Forgia la tecnologia e comanda la flotta',
      tabManual: 'Attrezzi Manuali',
      tabFleet: 'Flotta Autonoma',
      tabs: {
        manual: 'Attrezzi Manuali',
        fleet: 'Flotta Autonoma',
        relics: 'Reliquie',
      },
      tabRelics: 'Reliquie',
      tabTools: 'Strumenti',
      tabRadar: 'Georadar',
      level: 'Livello',
      cost: 'Costo',
      maxed: 'Massimo',
      max: 'MAX',
      maxLevel: 'MAX',
      buy: 'Acquista',
      buyAction: 'Acquista',
      completed: 'Completato',
      maxedAction: 'Completato',
      dpsLabel: 'DPS',
      powerLabel: 'Potenza',
      freqLabel: 'Frequenza',
      radiusLabel: 'Raggio',
      closeShop: 'Chiudi Officina',
    },
    upgrades: {
      shovel: {
        name: 'Pala in Oricalco',
        desc: 'Affina la lama e incrementa la sabbia estratta per ogni singolo colpo.',
        benefit: '+1 Sabbia per colpo (Attuale: {amount})',
      },
      frequency: {
        name: 'Ritmo Cinetico',
        desc: 'Riduce l\'intervallo tra i colpi continuati quando tieni premuto il mouse.',
        benefit: 'Frequenza hold: {rate} colpi/s',
      },
      radius: {
        name: 'Raggio di Scavo',
        desc: 'Espande il raggio del cratere conico a ogni impatto sul terreno.',
        benefit: 'Raggio: {radius}m (+0.45m)',
      },
      georadar: {
        name: 'Georadar di Profondità',
        desc: 'Bussola a risonanza che scansiona il sottosuolo e rileva anomalie prima di dissotterrarle.',
        benefitActive: 'Radar attivo nell\'HUD con letture live',
        benefitInactive: 'Sblocca bussola e letture criptiche del sottosuolo',
      },
      scarab: {
        name: 'Scarafaggio Meccanico',
        desc: 'Automa dorato leggero che pattuglia le dune e scava la sabbia a intervalli regolari.',
        benefit: '+1.0 Sabbia/s per livello (Totale: {total}/s)',
      },
      excavator: {
        name: 'Escavatore a Vapore',
        desc: 'Macchinario pesante con braccio a pistone che scava crateri ampi con grande potenza.',
        benefit: '+25.0 Sabbia/s per livello (Totale: {total}/s)',
      },
      dredge: {
        name: 'Draga Sabbiosa Atlantea',
        desc: 'Imponente struttura a tamburo rotante che polverizza interi banchi di sabbia compressa.',
        benefit: '+200.0 Sabbia/s per livello (Totale: {total}/s)',
      },
      relic_cartel: {
        name: 'Sigillo dei Mercanti',
        desc: 'Patto commerciale con la gilda di scavo: incrementa la produzione della flotta del +25%.',
        benefit: '+25% Rendimento Flotta',
      },
      relic_leyline: {
        name: 'Condotti Tellurici',
        desc: 'Canalizza il 4% del DPS totale della flotta direttamente nella forza del colpo manuale.',
        benefit: '+4% Flotta a Click',
      },
      relic_gears: {
        name: 'Ingranaggi Arcaici',
        desc: 'Lega d\'oricalco temprata che raddoppia l\'efficacia di Escavatori e Draghe.',
        benefit: 'x2 Potenza Macchinari Pesanti',
      },
      relic_anomaly: {
        name: 'Cuore dell\'Anomalia',
        desc: 'Matrice cristallina che amplifica la sabbia estratta da ogni fonte del +50%.',
        benefit: '+50% Rendita Totale Sabbia',
      },
      relic_abyss: {
        name: 'Corona dell\'Abisso',
        desc: 'Risonanza primordiale atlantidea: triplica l\'intera potenza ed efficacia di scavo.',
        benefit: 'x3 Efficacia Globale',
      },
    },
    biomes: {
      modalTitle: 'Seleziona Bioma di Spedizione',
      modalSubtitle: 'Scegli il sito archeologico per la tua nuova spedizione',
      startBtn: 'Avvia Spedizione',
      cancelBtn: 'Annulla',
      selectedBadge: 'Selezionato',
      selectBtn: 'Seleziona Bioma',
      unlockTabletsBtn: 'Sblocca ({cost} τ)',
      lockedReq: 'Richiede {wins} Vittoria/e oppure {cost} τ',
      modifiersLabel: 'Modificatori Attivi',
      desert: {
        name: "Deserto d'Oro",
        subtitle: 'Le Dune Ancestrali di Kemet',
        lore: 'Sabbie dorate millenarie che celano il Santuario dell\'Obelisco, viali colonnati e camere d\'oricalco.',
        modifier: 'Resistenza Standard | Volume 100%',
      },
      ocean: {
        name: 'Oceano Prosciugato',
        subtitle: 'Abisso Corallino Sommerso',
        lore: 'Un antico fondale oceanico prosciugato dove giace un galeone atlantideo spezzato tra archi di conchiglie fossili.',
        modifier: 'Resistenza -20% | Volume +15% | Valore +25%',
      },
      glacier: {
        name: 'Ghiacciaio Arcaico',
        subtitle: 'Cripta del Permafrost Eterno',
        lore: 'Monoliti esagonali di ghiaccio, guglie cristalline e templi congelati custoditi da uno strato di permafrost.',
        modifier: 'Permafrost +35% Res. | Schegge Ghiaccio | Valore +35%',
      },
      jungle: {
        name: 'Giungla Sepolta',
        subtitle: 'Ziggurat di Smeraldo e Radici',
        lore: 'Bassi templi a ziggurat e menhir incisi avvolti da radici fossili che richiedono colpi multipli per essere spezzate.',
        modifier: 'Radici Sepolte (-35% Raggio) | Valore +40%',
      },
    },
    endings: {
      curse: {
        badge: '☠️',
        title: 'La Maledizione di Atlantide',
        subtitle: 'L\'Antico Sigillo è Infranto',
        desc: 'Hai scavato troppo in profondità. L\'oscurità primordiale che riposava sotto la città si è risvegliata, tingendo il cielo di sangue e terrore cosmico.',
        quote: 'Forse avresti dovuto lasciare la sabbia dov\'era...',
        text: 'Forse avresti dovuto lasciare la sabbia dov\'era... Hai scavato troppo in profondità e l\'antico sigillo dell\'obelisco è andato in frantumi. Le tenebre millenarie sono state liberate sul mondo, tingendo il cielo di sangue e terrore cosmico.',
      },
      treasure: {
        badge: '👑',
        title: 'Il Tesoro d\'Oro Puro',
        subtitle: 'La Ricchezza Immortale di Atlantide',
        desc: 'Le fondamenta della città sommersa risplendono d\'oro massiccio, monete cerulee e reliquie inestimabili d\'oricalco.',
        quote: 'Sei oscenamente ricco. La sabbia ti appartiene.',
        text: 'Sei oscenamente ricco! Le volte millenarie si sono spalancate, inondando la fossa di monete d\'oro zecchino, gemme cerulee e reliquie inestimabili d\'oricalco. Il deserto è stato domato e il suo tesoro più sontuoso è ora tuo.',
      },
      business: {
        badge: '🏗️',
        title: 'L\'Impresa di Scavo SRL',
        subtitle: 'Certificato di Costituzione Impresa Edile',
        desc: 'Nessun dio mistico, nessun cataclisma: solo un vecchio secchiello arrugginito e un impero minerario miliardario.',
        quote: 'La cava è aperta. La produzione non si ferma mai.',
        text: 'Nessuna antica divinità, nessun cataclisma cosmico e nessun tesoro millenario. In fondo allo scavo c\'era solo un vecchio secchiello arrugginito. In compenso, hai rimosso milioni di tonnellate di sabbia fondando un colosso dell\'edilizia pesante con una flotta inarrestabile!',
      },
      secret: {
        badge: '🔱',
        title: 'L\'Ascensione di Atlantide',
        subtitle: 'Il Risveglio della Civiltà Sommersa',
        desc: 'Le rovine sepolte si sollevano in volo verso il cielo avvolte da luce d\'oricalco, consacrandoti Primo Custode.',
        quote: 'I Predecessori hanno riaperto le porte della volta celeste.',
        text: 'Non hai liberato una maledizione, né cercato mero oro o profitto: hai risvegliato il cuore perduto di Atlantide. La città millenaria risorge dalle sabbie eterne verso il cielo, incoronandoti Primo Custode dell\'Oricalco.',
      },
      buttons: {
        newGame: 'Nuova Spedizione',
        menu: 'Torna al Menu',
        sandbox: 'Continua in Sandbox Libera',
      },
      stats: {
        time: 'Tempo Spedizione',
        sand: 'Sabbia Estratta',
        clicks: 'Colpi di Pala',
        tablets: 'Tavolette Antiche',
        valuation: 'Valutazione d\'Impresa Stimata',
        fleetCount: 'Unità della Flotta',
      },
      toastCollected: '+{amount} Sabbia raccolta!',
    },
    settings: {
      title: 'Impostazioni',
      tabAudio: 'Audio',
      tabGraphics: 'Grafica',
      tabControls: 'Controlli',
      tabData: 'Dati & Lingua',
      tabCheats: 'Trucchi',
      master: 'Volume Principale',
      music: 'Ambiente & Musica',
      sfx: 'Effetti Sonori',
      mute: 'Silenzioso (Muto)',
      language: 'Lingua di Gioco',
      renderScale: 'Risoluzione Render',
      shadows: 'Ombre Dinamiche',
      particles: 'Dettaglio Particelle',
      dayNight: 'Ciclo Giorno/Notte',
      fpsCap: 'Limite Frame Rate',
      cameraSens: 'Sensibilità Telecamera',
      invertY: 'Inverti Asse Verticale',
      screenShake: 'Scuotimento Schermo',
      haptics: 'Feedback aptico (Vibrazione)',
      hapticsHint: 'Vibrazioni tattili su scavi, critici ed esplosioni',
      notation: 'Notazione Numerica',
      notationHint: 'Formato numeri: Standard (1.2k), Scientifica (1.2e3) o Ingegneristica',
      saveSectionTitle: 'Salvataggio Spedizione (Portabile Base64)',
      savePlaceholder: 'Incolla qui la stringa del salvataggio Base64 (DDS1_…) per importarla…',
      exportSave: 'Esporta Salvataggio',
      importSave: 'Importa Salvataggio',
      saveExportedStatus: 'Salvataggio copiato negli appunti e mostrato nel riquadro.',
      saveExportedToast: 'Salvataggio copiato negli appunti!',
      saveEmptyError: 'Incolla prima una stringa di salvataggio valida.',
      confirmImportSaveTitle: 'Sovrascrivere la spedizione?',
      confirmImportSaveMsg: 'L\'importazione sostituirà i progressi attuali della spedizione con quelli del codice incollato. Continuare?',
      saveImportedSuccess: 'Salvataggio importato con successo! Ricarico la sessione...',
      saveImportedToast: 'Salvataggio importato!',
      postProcessing: 'Post-Processing (Bloom & Vignette)',
      postProcessingDesc: 'Bagliori emissivi oricalco e gradiente caldo cinematografico',
      dustMotes: 'Particelle Atmosferiche (Dust Motes)',
      dustMotesDesc: 'Pulviscolo minerale dorato fluttuante nel cratere',
      showProfiler: 'Mostra Diagnostica & FPS',
      showProfilerHint: 'Visualizza framerate, chiamate GPU e utilizzo memoria (F3)',
      reducedMotion: 'Riduzione Movimento',
      reducedMotionHint: 'Attenua animazioni veloci, scuotimenti della telecamera ed effetti tellurici',
      raytracingSSR: 'Raytracing & Riflessi SSR (Sperimentale)',
      raytracingSSRHint: 'Simula riflessi fotorealistici nello spazio dello schermo. Richiede GPU dedicata (Disattivato di default).',
      graphicsLow: 'Bassa (Prestazioni)',
      graphicsMed: 'Media (Bilanciata)',
      graphicsHigh: 'Alta (Dettagliata)',
      shadowsOff: 'Disattivate',
      shadowsLow: 'Morbide',
      shadowsHigh: 'Ultra Dettagliate',
      dayNightAuto: 'Automatico (Continuo)',
      dayNightDay: 'Sempre Giorno',
      dayNightNight: 'Sempre Notte',
      fpsNoLimit: 'Nessun Limite',
      dataExport: 'Esporta Salvataggio',
      dataImport: 'Importa Salvataggio',
      dataReset: 'Ripristina Impostazioni',
      clearSave: 'Elimina Salvataggio Corrente',
      clearSaveConfirm: 'Sei sicuro di voler eliminare la spedizione in corso? Questa azione è irreversibile.',
      saveClearedToast: 'Salvataggio eliminato.',
      resetSettingsConfirm: 'Ripristinare tutte le impostazioni ai valori di fabbrica?',
      jsonPlaceholder: 'Incolla qui un JSON di impostazioni da importare…',
      exportJson: 'Esporta JSON',
      importJson: 'Importa JSON',
      exportedStatus: 'Impostazioni esportate nel riquadro.',
      importedStatus: 'Importate {count} impostazioni modificate.',
      errorStatus: 'Errore',
      resetDefaults: 'Ripristina impostazioni',
      resetTitle: 'Ripristinare i valori predefiniti?',
      resetMsg: 'Tutte le impostazioni torneranno ai valori iniziali. Il salvataggio di gioco non viene toccato.',
      resetConfirm: 'Ripristina',
      resetDone: 'Impostazioni ripristinate.',
      deleteSave: 'Elimina salvataggio',
      noSaveToDelete: 'Nessun salvataggio da eliminare.',
      deleteSaveTitle: 'Eliminare il salvataggio?',
      deleteSaveMsg: 'La spedizione in corso andrà persa per sempre. L\'azione non è reversibile.',
      deleteSaveConfirm: 'Elimina definitivamente',
      saveDeleted: 'Salvataggio eliminato.',
      settingsBackup: 'Backup Impostazioni',
      resetSection: 'Reset & Dati',
      active: 'Attivo',
      inactive: 'Disattivo',
      masterVolume: 'Volume generale',
      musicVolume: 'Musica',
      sfxVolume: 'Effetti sonori',
      webAudioUnsupported: 'Il tuo browser non supporta Web Audio: l\'audio è disattivato.',
      renderScaleHint: 'Scala della risoluzione interna',
      graphicsQuality: 'Qualità particelle',
      postProcessingHint: 'Bagliori emissivi e color grading',
      dustMotesHint: 'Pulviscolo fluttuante nel cratere',
      dayNightHint: 'Auto / Giorno / Notte',
      graphicsOptions: {
        low: 'Bassa (Mobile)',
        med: 'Media (Bilanciata)',
        high: 'Alta (Dettagliata)',
      },
      shadowsOptions: {
        off: 'Disattivate',
        low: 'Basse',
        high: 'Alte',
      },
      dayNightOptions: {
        auto: 'Automatico (Dinamico)',
        day: 'Sempre Giorno',
        night: 'Sempre Notte',
      },
      fpsOptions: {
        '0': 'Illimitato',
        '30': '30 FPS',
        '60': '60 FPS',
      },
      languageOptions: {
        it: 'Italiano',
        en: 'English',
      },
      notationOptions: {
        standard: 'Standard (1.2k)',
        scientific: 'Scientifica (1.20e3)',
        engineering: 'Ingegneristica (1.20e3)',
      },
      cheats: {
        title: 'Modalità Trucchi & Creative',
        subtitle: 'Modifica liberamente parametri ed eventi della spedizione corrente.',
        warningActive: '⚠️ Trucchi attivi: il conseguimento degli Obiettivi è bloccato definitivamente per questa partita.',
        warningInactive: 'L\'attivazione di qualsiasi trucco disabiliterà permanentemente lo sblocco di tutti gli Obiettivi per questa spedizione.',
        confirmTitle: 'Attenzione: Modalità Trucchi',
        confirmMsg: 'L\'attivazione dei trucchi ti permetterà di modificare liberamente la sabbia, il terreno e gli eventi, ma disabiliterà definitivamente lo sblocco di tutti gli Obiettivi per questa spedizione. Continuare?',
        confirmBtn: 'Conferma e Disabilita Obiettivi',
        sandSection: 'Accredito Sabbia',
        addSand100k: '+100.000 Sabbia',
        addSand1M: '+1.000.000 Sabbia',
        completionSection: 'Completamento Scavo Rapido',
        comp50: 'Imposta 50%',
        comp95: 'Imposta 95%',
        comp99: 'Imposta 99% (Climax)',
        endingSection: 'Forza Finale di Spedizione',
        endingBtn: 'Avvia Climax Ora',
        eventsSection: 'Attiva Evento nel Deserto',
        eventStorm: '🌪️ Tempesta di Sabbia',
        eventMerchant: '⛺ Mercante Nomade',
        godModeSection: 'Super Pala (God Mode)',
        godModeLabel: 'Super Pala (God Mode)',
        godModeHint: 'Raggio di scavo decuplicato e zero tempo di attesa tra i colpi',
        godModeActive: 'Attivo',
        godModeInactive: 'Disattivo',
        upgradesSection: 'Potenziamenti Massimi',
        maxUpgradesBtn: 'Sblocca Tutti gli Upgrade',
        notInGame: 'I trucchi possono essere utilizzati solo durante una spedizione in corso.',
        hudBadge: 'Trucchi attivi — Obiettivi bloccati',
        toastSand100k: '+100.000 Sabbia accreditata!',
        toastSand1M: '+1.000.000 Sabbia accreditata!',
        toastComp: 'Completamento scavo impostato al {pct}%',
        toastEnding: 'Finale forzato: {id}',
        toastStorm: 'Tempesta di Sabbia scatenata!',
        toastMerchant: 'Carovana Nomade arrivata!',
        toastGodOn: 'Super Pala (God Mode) Attivata!',
        toastGodOff: 'Super Pala Disattivata.',
        toastMaxUpgrades: 'Tutti gli upgrade sbloccati al massimo!',
      },
    },
    achievements: {
      FIRST_DIG: {
        title: 'Primo Colpo d\'Oro',
        desc: 'Effettua il tuo primo colpo di pala nella duna.',
      },
      DUNE_BREAKER: {
        title: 'Dune Breaker',
        desc: 'Accumula 100.000 unità di sabbia in una singola spedizione.',
      },
      MACHINE_LORD: {
        title: 'Signore delle Macchine',
        desc: 'Schiera almeno 5 lavoratori o escavatori contemporaneamente.',
      },
      ECHOES_PAST: {
        title: 'Echi del Passato',
        desc: 'Riporta alla luce il santuario centrale dell\'obelisco sotto le dune.',
      },
      TRINITY: {
        title: 'Trinità della Sabbia',
        desc: 'Scopri tutti e tre i finali base (Maledizione, Tesoro, Impresa).',
      },
      AWAKENING: {
        title: 'Il Risveglio',
        desc: 'Assisti all\'Ascensione di Atlantide nel Finale Segreto.',
      },
      SPEEDRUNNER: {
        title: 'Corsa contro il Tempo',
        desc: 'Completa una spedizione in meno di 20 minuti.',
      },
      SAND_HOARDER: {
        title: 'Custode dell\'Oro',
        desc: 'Accumula 1.000.000 di sabbia totale nella tua carriera.',
      },
      ANCIENT_WISDOM: {
        title: 'Saggezza Antica',
        desc: 'Accumula le tue prime Tavolette Antiche τ dal Santuario.',
      },
      STORM_SURVIVOR: {
        title: 'Cavalcatempeste',
        desc: 'Scava durante una Tempesta di Sabbia attiva.',
      },
      NOMAD_PARTNER: {
        title: 'Affare nel Deserto',
        desc: 'Concludi uno scambio commerciale con il Mercante Nomade.',
      },
      COMPLETIONIST: {
        title: 'Archeologo Supremo',
        desc: 'Raggiungi il 100% di scavo di una duna.',
      },
    },
    tutorial: {
      firstDig: 'Tocca o tieni premuto per scavare la duna',
      currency: 'La sabbia estratta è la tua valuta!',
      workshopAvailable: 'Nuovi strumenti disponibili nell\'Officina!',
    },
    events: {
      sandstormTitle: 'Tempesta di Sabbia!',
      sandstormMsg: 'Un vento impetuoso solleva la duna: +50% Sabbia per ogni colpo (30s)!',
      sandstormBoostLabel: '⚡ Tempesta: +50% Sabbia (30s)',
      sandstormToastEnded: 'La tempesta di sabbia si è placata.',
      merchantTitle: 'Carovana Nomade',
      merchantMsg: 'Un mercante del deserto si è accampato ai margini dello scavo!',
      merchantAction: 'Commercia',
      merchantToastLeft: 'La carovana nomade è ripartita per le dune.',
      merchantLore: '"Il deserto nasconde segreti a chi ha fretta, ma ricompensa chi sa commerciare."',
      hyperDigTitle: 'Iper-Scavo Nomade',
      hyperDigDesc: '+100% Sabbia per i prossimi 45 secondi.',
      hyperDigBuy: 'Acquista (150 Sabbia)',
      hyperDigBoostLabel: '✨ Iper-Scavo (x2.0): 45s',
      hyperDigSuccess: 'Hai acquistato Iper-Scavo Nomade! (+100% Sabbia per 45s)',
      insufficientSand: 'Sabbia insufficiente per questa merce!',
      decline: 'Rinuncia',
    },
    prestige: {
      title: 'Santuario dei Predecessori',
      currency: 'Tavolette Antiche: τ {count}',
      intro: 'La conoscenza dei cicli passati non va perduta. Spendi le Tavolette Antiche per imprimere perk permanenti validi per tutte le spedizioni future.',
      level: 'Lv. {lvl}/{max}',
      max: 'MAX',
      shovelEcho: {
        name: 'Eco della Pala',
        desc: 'L\'esperienza dei cicli passati guida la lama: +15% potenza base di scavo permanente per livello.',
        benefit: '+{pct}% Potenza di Scavo Permanente',
      },
      excavatorBlueprint: {
        name: 'Progetto dell\'Escavatore',
        desc: 'Inizia ogni futura spedizione con Automi Scarabei già operativi nel cratere.',
        benefit: '{count} Scarabei operativi all\'avvio',
      },
      tabletMagnetism: {
        name: 'Magnetismo delle Tavolette',
        desc: 'Favore antico: sconto del 5% su tutti i costi in sabbia dell\'Officina per livello.',
        benefit: '-{pct}% Costi di Acquisto (Max -25%)',
      },
    },
    wardrobe: {
      title: 'Guardaroba delle Dune',
      subtitle: 'Personalizza l\'aspetto dei tuoi strumenti, sabbia e macchinari con le Tavolette Antiche (τ).',
      tablets: 'Tavolette Antiche: τ {count}',
      tabShovel: 'Pale & Strumenti',
      tabSand: 'Biomi Sabbia',
      tabMachinery: 'Flotta Macchinari',
      equipped: 'Equipaggiato',
      equip: 'Equipaggia',
      unlock: 'Sblocca per {cost} τ',
      needTablets: 'Mancano tavolette',
      free: 'Predefinito',
      skins: {
        shovel_bronze: { name: 'Pala di Bronzo', desc: 'Robusta pala forgiata nei primi scavi' },
        shovel_gold: { name: 'Pala d\'Oro Reale', desc: 'Lega aurea che risplende sotto il sole del deserto' },
        shovel_crystal: { name: 'Pala di Cristallo', desc: 'Lama eterea incastonata con oricalco luminescente' },
        shovel_obsidian: { name: 'Pala d\'Ossidiana', desc: 'Vetro vulcanico nero temprato nelle viscere' },
        sand_classic: { name: 'Sabbia Classica', desc: 'I granelli dorati originari della grande duna' },
        sand_mars: { name: 'Sabbia di Marte', desc: 'Polvere minerale cremisi dalle terre sconosciute' },
        sand_caribbean: { name: 'Sabbia Caraibica', desc: 'Fosfati bianchi calcarei ed atolli marini' },
        sand_volcanic: { name: 'Sabbia Vulcanica', desc: 'Basalto nero e lapilli di basalto spento' },
        machinery_standard: { name: 'Flotta Standard', desc: 'Automi e scarabei in lega di rame e bronzo' },
        machinery_royal_gold: { name: 'Flotta Dorata', desc: 'Scocche dorate cerimoniali dei faraoni' },
        machinery_atlantis_teal: { name: 'Flotta d\'Atlantide', desc: 'Composito oricalco e condensatori luminescenti' },
      },
    },
    gallery: {
      title: 'Galleria dei Finali',
      progress: 'Progresso Collezionista: {count}/{total} ({pct}%)',
      sealedTitle: '??? Sigillo Dormiente',
      unlockedStatus: '✓ Epilogo Sbloccato',
      lockedStatus: 'Non ancora scoperto',
    },
    pause: {
      title: 'Spedizione in Pausa',
      subtitle: 'Tempo trascorso: {time} · Sabbia: {sand}',
      quickSettings: 'Impostazioni Rapide',
      masterVol: 'Volume Master',
      muteLabel: 'Silenzioso (Muto)',
      graphicsLabel: 'Qualità Grafica',
      resume: 'Riprendi Spedizione',
      stats: 'Statistiche & Trofei',
      wardrobe: 'Guardaroba & Skin',
      prestige: 'Santuario dei Predecessori (τ {count})',
      settingsBtn: 'Tutte le Impostazioni',
      saveAndExit: 'Salva ed Esci',
    },
    stats: {
      title: 'Carriera & Trofei',
      tabStats: 'Statistiche',
      tabTrophies: 'Obiettivi',
      totalClicks: 'Colpi di Pala Manuali',
      totalSandLifetime: 'Sabbia Storica Totale',
      totalPlaytime: 'Tempo di Gioco Totale',
      ruinsUncovered: 'Rovine Disseppellite',
      runsCompleted: 'Spedizioni Concluse',
      bestRunTime: 'Miglior Tempo di Scavo',
      noRecord: 'Nessun record',
      trophiesUnlocked: 'Obiettivi Sbloccati',
      dateUnlocked: 'Sbloccato il',
      cheatsWarning: 'Obiettivi disabilitati: sono stati utilizzati trucchi in questa partita',
    },
    loading: {
      title: 'Diggy Diggy Sand',
      subtitle: 'Preparazione della spedizione',
      status: 'Risveglio degli antichi meccanismi…',
      startBtn: 'Inizia Spedizione',
      tips: [
        'La sabbia non mente: ogni granello rimosso avvicina la città dimenticata.',
        'Gli Atlantidei chiamavano l\'oricalco "il metallo che ricorda la luce".',
        'Tieni premuto per scavare senza sosta. Le mani stanche non esistono per un faraone.',
        'I Nomadi scavano piano, ma non dormono mai.',
        'Sotto le dune, qualcosa pulsa di luce turchese. Non è un miraggio.',
        'Un colpo critico splende come il sole di mezzogiorno: cerca le scintille dorate.',
        'Gli obelischi puntano al cielo perché ciò che sta sotto non dovrebbe essere ignorato.',
        'Non tutte le spedizioni finiscono allo stesso modo. Nessuno sa cosa troverà.',
      ],
    },
    offline: {
      title: 'Spedizione Automatica',
      content: 'Mentre eri via, i tuoi scavi hanno prodotto <span class="num accent">+{amount}</span> Sabbia.',
      elapsed: 'Tempo trascorso: {mins} min (Efficienza flotta 50%).',
      claim: 'Raccogli',
    },
    graphics: {
      ssr_title: 'Raytracing & Riflessi SSR',
      ssr_desc: 'Simula riflessi fotorealistici nello spazio dello schermo e occlusione ambientale (SSAO).',
    },
    directives: {
      widgetTitle: 'Direttive di Spedizione',
      contractBadge: 'CONTRATTO ATTIVO',
      noDirective: 'In attesa di nuovi contratti...',
      localExtractionTitle: 'Estrazione Territoriale: {quadrant}',
      localExtractionDesc: 'Estrai {target} sabbia nel settore {quadrant}',
      continuousDiggingTitle: 'Cadenza Continua',
      continuousDiggingDesc: 'Mantieni lo scavo attivo per {seconds}s senza interruzioni',
      deepExcavationTitle: 'Scavo di Profondità',
      deepExcavationDesc: 'Estrai {target} sabbia dagli strati profondi (quota ≤ 4.8)',
      workshopInvestmentTitle: 'Investimento Strutturale',
      workshopInvestmentDesc: 'Acquista {count} livelli nell\'Officina entro {time}s',
      rewardDiscount: '-15% Bottega (45s)',
      rewardBoost: '2x Scavo (30s)',
      quadrants: {
        NE: 'Nord-Est',
        NW: 'Nord-Ovest',
        SE: 'Sud-Est',
        SW: 'Sud-Ovest',
      },
    },
    help: {
      modalTitle: 'Guida e Legenda Comandi',
      desktopTitle: 'Controlli Desktop (Mouse & Tastiera)',
      touchTitle: 'Controlli Touch (Tablet & Smartphone)',
      gameplayTitle: 'Regole della Spedizione',
      digAction: 'Scavo manuale continuo nel punto di contatto',
      zoomAction: 'Zoom cinematico (avvicina / allontana)',
      rotateAction: 'Rotazione orbitale continua attorno alla duna',
      orbitAction: 'Orbita libera manuale e inclinazione',
      spaceAction: 'Innesco dinamite / scavo rapido (se sbloccato)',
      escAction: 'Pausa spedizione o chiusura pannelli',
      f2f3Action: 'Console di debug (F2) e Profiler FPS (F3)',
      touchDig: 'Scavo continuo immediato sul terreno',
      touchPinch: 'Pinch-to-zoom morbido per avvicinare/allontanare',
      touchDrag: 'Rotazione orbitale attorno alla duna e inclinazione',
      touchSwipeDown: 'Chiudi il cassetto inferiore della Bottega',
      gameplayDesc: 'Svuota la duna per riportare alla luce le strutture atlantidee sepolte. Potenzia la tua pala nella Bottega e comanda la flotta di droni e trivelle per accelerare l\'estrazione passiva. Tieni d\'occhio le Direttive di Spedizione sulla sinistra per incassare bonus immediati e moltiplicatori temporanei!',
    },
    credits: {
      modalTitle: 'Crediti & Risorse Open Source',
      badge: 'ATLANTIS HERITAGE',
      versionLabel: 'Versione Client',
      engineTitle: 'Motore Grafico & WebGL',
      engineText: 'Libreria di rendering 3D accelerata via WebGL rilasciata sotto Licenza MIT (© 2010-2024 Three.js Authors, mrdoob).',
      typographyTitle: 'Tipografia e Caratteri',
      typographyText: 'Caratteri distribuiti da Google Fonts sotto licenza SIL Open Font License 1.1 (OFL).',
      assetsTitle: 'Modelli 3D & Risorse Audio',
      legalTitle: 'Note Legali e Trasparenza',
      legalText: 'Tutti i marchi, loghi e risorse appartengono ai rispettivi autori. Il gioco rispetta la totale sovranità dei dati dell\'utente: nessun cookie di terze parti, nessun tracciamento analitico e archiviazione esclusivamente locale (localStorage).',
    },
  },

  en: {
    common: {
      close: 'Close',
      cancel: 'Cancel',
      confirm: 'Confirm',
      back: 'Back',
      locked: 'Locked',
      unlocked: 'Unlocked',
      sec: 's',
      min: 'm',
      hours: 'h',
      save: 'Save',
      continue: 'Continue',
      collect: 'Collect',
      active: 'Active',
      inactive: 'Disabled',
      yes: 'Yes',
      no: 'No',
      reset: 'Reset',
    },
    menu: {
      title: 'Diggy Diggy Sand',
      subtitle: 'Clear the desert. Discover what sleeps below.',
      newGame: 'New Expedition',
      continue: 'Continue',
      gallery: 'Endings Discovered',
      prestige: 'Sanctuary of Ancestors',
      stats: 'Stats & Trophies',
      wardrobe: 'Wardrobe & Skins',
      settings: 'Settings',
      credits: 'Credits',
      help: 'Help & Controls',
      noSave: 'No save file available',
      overwriteConfirmTitle: 'Overwrite Expedition?',
      overwriteConfirmMsg: 'An expedition is already underway. Starting a new one will erase current dune and workshop progress. Do you wish to proceed?',
      overwriteBtn: 'Overwrite & Start',
      cancelBtn: 'Cancel',
      confirmOverwriteTitle: 'Overwrite Expedition?',
      confirmOverwriteMsg: 'An expedition is already underway. Starting a new one will erase current dune and workshop progress. Do you wish to proceed?',
      overwrite: 'Overwrite & Start',
      creditsTitle: 'Development Credits',
      creditsIntro: 'Diggy Diggy Sand · 3D chiseled low-poly incremental miner with sunken ruins and multiple endings.',
      creditsEngine: 'Engine: Three.js r160. Fonts: Cinzel Decorative, Cinzel, Syne (Google Fonts).',
      creditsAssets: '3D and Audio Assets: CC0 License (Kenney, Quaternius, OpenGameArt) with procedural fallbacks.',
    },
    hud: {
      sandLabel: 'Extracted Sand',
      sand: 'Sand',
      spsLabel: 'per second',
      spsSuffix: '/s',
      progress: 'Desert excavated',
      desertExcavated: 'Excavated Desert',
      excavation: 'Excavated Desert',
      completionPct: '{pct}% excavated',
      radarDepth: 'Depth',
      radarBedrock: 'Bedrock',
      workshop: 'Workshop',
      workshopFull: 'Dune Workshop',
      pause: 'Pause',
      pauseTitle: 'Pause / Settings',
      help: 'Help',
      helpTitle: 'Help & Controls Guide',
      stormBoost: '⚡ STORM +50%',
      cheatsBadgeTitle: 'Cheats active — Achievements locked',
      cheatsBadgeTag: 'CHEATS',
      cheatsActive: 'Cheats active — Achievements locked',
      cheatsTag: 'CHEATS',
      radarTitle: 'Georadar',
      radarStatus: 'ACTIVE',
      radarActive: 'ACTIVE',
      radarScanning: 'Scanning in progress...',
    },
    shop: {
      title: 'Dune Workshop',
      subtitle: 'Forge technology and command your autonomous fleet',
      tabManual: 'Manual Tools',
      tabFleet: 'Autonomous Fleet',
      tabs: {
        manual: 'Manual Tools',
        fleet: 'Autonomous Fleet',
        relics: 'Relics',
      },
      tabRelics: 'Relics',
      tabTools: 'Tools',
      tabRadar: 'Georadar',
      level: 'Level',
      cost: 'Cost',
      maxed: 'Maxed',
      max: 'MAX',
      maxLevel: 'MAX',
      buy: 'Buy',
      buyAction: 'Buy',
      completed: 'Completed',
      maxedAction: 'Completed',
      dpsLabel: 'DPS',
      powerLabel: 'Power',
      freqLabel: 'Frequency',
      radiusLabel: 'Radius',
      closeShop: 'Close Workshop',
    },
    upgrades: {
      shovel: {
        name: 'Orichalcum Shovel',
        desc: 'Sharpens the blade to extract more sand with every single strike.',
        benefit: '+1 Sand per strike (Current: {amount})',
      },
      frequency: {
        name: 'Kinetic Rhythm',
        desc: 'Reduces the interval between sustained digging strikes while holding down.',
        benefit: 'Hold frequency: {rate} strikes/s',
      },
      radius: {
        name: 'Digging Radius',
        desc: 'Expands the conical impact radius across the terrain with each blow.',
        benefit: 'Radius: {radius}m (+0.45m)',
      },
      georadar: {
        name: 'Deep Georadar',
        desc: 'Resonance compass that scans the subterranean strata and detects anomalies before unearthing them.',
        benefitActive: 'Active in HUD with real-time sonar readings',
        benefitInactive: 'Unlocks compass and cryptic subterranean readings',
      },
      scarab: {
        name: 'Clockwork Scarab',
        desc: 'Light golden automaton that patrols the dunes and digs sand at steady intervals.',
        benefit: '+1.0 Sand/s per level (Total: {total}/s)',
      },
      excavator: {
        name: 'Steam Excavator',
        desc: 'Heavy machinery with piston arm that carves wide craters with massive power.',
        benefit: '+25.0 Sand/s per level (Total: {total}/s)',
      },
      dredge: {
        name: 'Atlantean Sand Dredge',
        desc: 'Colossal rotating drum excavator that pulverizes entire shelves of compressed bedrock sand.',
        benefit: '+200.0 Sand/s per level (Total: {total}/s)',
      },
      relic_cartel: {
        name: 'Merchants Cartel Seal',
        desc: 'Commercial covenant with the excavation syndicate: boosts passive fleet production by +25%.',
        benefit: '+25% Fleet Yield',
      },
      relic_leyline: {
        name: 'Telluric Leylines',
        desc: 'Channels 4% of passive fleet DPS directly into manual strike power.',
        benefit: '+4% Fleet to Click',
      },
      relic_gears: {
        name: 'Archaic Gears',
        desc: 'Tempered orichalcum gearboxes doubling the power and speed of Steam Excavators and Dredges.',
        benefit: '2x Heavy Machinery Output',
      },
      relic_anomaly: {
        name: 'Anomaly Core',
        desc: 'Resonant crystalline matrix amplifying all excavated sand by +50%.',
        benefit: '+50% Total Sand Gain',
      },
      relic_abyss: {
        name: 'Crown of the Abyss',
        desc: 'Primordial Atlantean artifact: triples all manual and fleet digging effectiveness.',
        benefit: '3x Global Output',
      },
    },
    biomes: {
      modalTitle: 'Select Expedition Biome',
      modalSubtitle: 'Choose the archaeological excavation site for your new expedition',
      startBtn: 'Begin Expedition',
      cancelBtn: 'Cancel',
      selectedBadge: 'Selected',
      selectBtn: 'Select Biome',
      unlockTabletsBtn: 'Unlock ({cost} τ)',
      lockedReq: 'Requires {wins} Victory(ies) or {cost} τ',
      modifiersLabel: 'Active Modifiers',
      desert: {
        name: 'Golden Desert',
        subtitle: 'The Ancestral Dunes of Kemet',
        lore: 'Ancient golden sands concealing the Obelisk Sanctuary, colonnaded avenues, and orichalcum chambers.',
        modifier: 'Standard Resistance | 100% Volume',
      },
      ocean: {
        name: 'Sunken Ocean',
        subtitle: 'Sunken Coral Abyss',
        lore: 'A dried prehistoric ocean floor where an ancient Atlantean galleon lies broken between giant fossil clam arches.',
        modifier: 'Resistance -20% | Volume +15% | Value +25%',
      },
      glacier: {
        name: 'Archaic Glacier',
        subtitle: 'Crypt of Eternal Permafrost',
        lore: 'Hexagonal ice monoliths, crystalline spires, and frozen temples shielded beneath a tough permafrost crust.',
        modifier: 'Permafrost +35% Res. | Ice Shards | Value +35%',
      },
      jungle: {
        name: 'Buried Jungle',
        subtitle: 'Emerald Ziggurat & Roots',
        lore: 'Low-slung stepped temples and inscribed menhirs entwined with petrified roots that take multiple blows to sever.',
        modifier: 'Buried Roots (-35% Radius) | Value +40%',
      },
    },
    endings: {
      curse: {
        badge: '☠️',
        title: 'The Curse of Atlantis',
        subtitle: 'The Ancient Seal is Broken',
        desc: 'You dug too deep. The primordial darkness slumbering under the sunken city has awakened, staining the skies in cosmic dread.',
        quote: 'Perhaps you should have left the sand where it lay...',
        text: 'Perhaps you should have left the sand where it lay... You dug too deep and shattered the ancient obelisk seal. Millennia of slumbering shadows have been unleashed upon the world, dyeing the heavens with blood and cosmic terror.',
      },
      treasure: {
        badge: '👑',
        title: 'The Pure Gold Vault',
        subtitle: 'The Immortal Wealth of Atlantis',
        desc: 'The bedrock of the sunken city gleams with solid gold, cerulean gemstones, and boundless priceless orichalcum relics.',
        quote: 'You are obscenely wealthy. The desert belongs to you.',
        text: 'You are obscenely rich! The ancient vaults have burst open, flooding the excavation crater with pure gold bullion, azure gems, and priceless orichalcum artifacts. The great dune has been conquered and its grandest treasure is yours.',
      },
      business: {
        badge: '🏗️',
        title: 'Excavation Corp Ltd.',
        subtitle: 'Heavy Construction Incorporation Certificate',
        desc: 'No mythical gods, no cosmic doom: just an old rusty bucket and a multibillion-dollar mining conglomerate.',
        quote: 'The quarry is open. Production never stops.',
        text: 'No slumbering gods, no cosmic cataclysm, and no magical treasure. At the bottom of the pit lay only an old rusted bucket. In return, you removed millions of tons of sand and founded a heavy civil engineering titan with an unstoppable fleet!',
      },
      secret: {
        badge: '🔱',
        title: 'The Ascension of Atlantis',
        subtitle: 'Awakening of the Sunken Metropolis',
        desc: 'The buried ruins rise heavenward cloaked in brilliant orichalcum luminescence, crowning you First Warden.',
        quote: 'The Predecessors have reopened the gates of the celestial vault.',
        text: 'You released no dark curse, nor did you seek mere gold or corporate profit: you awakened the lost heart of Atlantis. The thousand-year city ascends from the eternal dunes into the sky, crowning you the First Warden of Orichalcum.',
      },
      buttons: {
        newGame: 'New Expedition',
        menu: 'Back to Menu',
        sandbox: 'Continue in Free Sandbox',
      },
      stats: {
        time: 'Expedition Time',
        sand: 'Extracted Sand',
        clicks: 'Manual Shovel Strikes',
        tablets: 'Ancient Tablets',
        valuation: 'Estimated Company Valuation',
        fleetCount: 'Fleet Units',
      },
      toastCollected: '+{amount} Sand collected!',
    },
    settings: {
      title: 'Settings',
      tabAudio: 'Audio',
      tabGraphics: 'Graphics',
      tabControls: 'Controls',
      tabData: 'Data & Language',
      tabCheats: 'Cheats',
      master: 'Master Volume',
      music: 'Ambient & Music',
      sfx: 'Sound Effects',
      mute: 'Mute Audio',
      language: 'Game Language',
      renderScale: 'Render Resolution',
      shadows: 'Dynamic Shadows',
      particles: 'Particle Detail',
      dayNight: 'Day/Night Cycle',
      fpsCap: 'Frame Rate Limit',
      cameraSens: 'Camera Sensitivity',
      invertY: 'Invert Vertical Pitch',
      screenShake: 'Screen Shake',
      haptics: 'Haptic Feedback (Vibration)',
      hapticsHint: 'Tactile vibrations for digging, crits and explosions',
      notation: 'Number Notation',
      notationHint: 'Number formatting: Standard (1.2k), Scientific (1.2e3) or Engineering',
      saveSectionTitle: 'Expedition Save (Portable Base64)',
      savePlaceholder: 'Paste Base64 save string (DDS1_…) here to import…',
      exportSave: 'Export Save',
      importSave: 'Import Save',
      saveExportedStatus: 'Save copied to clipboard and displayed in text area.',
      saveExportedToast: 'Save copied to clipboard!',
      saveEmptyError: 'Paste a valid save string first.',
      confirmImportSaveTitle: 'Overwrite expedition?',
      confirmImportSaveMsg: 'Importing will replace your current expedition progress with the pasted code. Continue?',
      saveImportedSuccess: 'Save imported successfully! Reloading session...',
      saveImportedToast: 'Save imported!',
      postProcessing: 'Post-Processing (Bloom & Vignette)',
      postProcessingDesc: 'Emissive orichalcum bloom and warm cinematic vignette',
      dustMotes: 'Atmospheric Dust Motes',
      dustMotesDesc: 'Floating golden silica dust particles above the crater',
      showProfiler: 'Show Diagnostics & FPS',
      showProfilerHint: 'Display framerate, GPU draw calls and memory usage (F3)',
      reducedMotion: 'Reduced Motion',
      reducedMotionHint: 'Dampen fast animations, camera shakes, and seismic effects',
      raytracingSSR: 'Raytracing & SSR Reflections (Experimental)',
      raytracingSSRHint: 'Simulates photorealistic screen-space reflections. Dedicated GPU recommended (Disabled by default).',
      graphicsLow: 'Low (Performance)',
      graphicsMed: 'Medium (Balanced)',
      graphicsHigh: 'High (Detailed)',
      shadowsOff: 'Disabled',
      shadowsLow: 'Soft Shadows',
      shadowsHigh: 'Ultra Detailed',
      dayNightAuto: 'Automatic (Continuous)',
      dayNightDay: 'Always Day',
      dayNightNight: 'Always Night',
      fpsNoLimit: 'No Limit',
      dataExport: 'Export Save Data',
      dataImport: 'Import Save Data',
      dataReset: 'Reset Preferences',
      clearSave: 'Delete Current Expedition',
      clearSaveConfirm: 'Are you sure you want to delete your current expedition? This cannot be undone.',
      saveClearedToast: 'Expedition save deleted.',
      resetSettingsConfirm: 'Reset all settings back to default values?',
      jsonPlaceholder: 'Paste settings JSON here to import…',
      exportJson: 'Export JSON',
      importJson: 'Import JSON',
      exportedStatus: 'Settings exported to text area.',
      importedStatus: 'Imported {count} modified settings.',
      errorStatus: 'Error',
      resetDefaults: 'Reset settings',
      resetTitle: 'Restore default values?',
      resetMsg: 'All settings will return to initial values. Game save is untouched.',
      resetConfirm: 'Reset',
      resetDone: 'Settings restored.',
      deleteSave: 'Delete save',
      noSaveToDelete: 'No save to delete.',
      deleteSaveTitle: 'Delete save file?',
      deleteSaveMsg: 'The current expedition will be permanently lost. This action is irreversible.',
      deleteSaveConfirm: 'Delete permanently',
      saveDeleted: 'Save file deleted.',
      settingsBackup: 'Settings Backup',
      resetSection: 'Reset & Data',
      active: 'Active',
      inactive: 'Inactive',
      masterVolume: 'Master volume',
      musicVolume: 'Music',
      sfxVolume: 'Sound effects',
      webAudioUnsupported: 'Your browser does not support Web Audio: audio is disabled.',
      renderScaleHint: 'Internal resolution scale',
      graphicsQuality: 'Particle quality',
      postProcessingHint: 'Emissive glow and color grading',
      dustMotesHint: 'Floating dust motes in the crater',
      showProfiler: 'Show Hardware Profiler & FPS',
      showProfilerHint: 'Display framerate, GPU draw calls and memory footprint (F3)',
      raytracingSSR: 'Raytracing & SSR Reflections (Experimental)',
      raytracingSSRHint: 'Simulates screen-space photorealistic reflections. Requires a dedicated GPU (Off by default).',
      dayNightHint: 'Auto / Day / Night',
      graphicsOptions: {
        low: 'Low (Mobile)',
        med: 'Medium (Balanced)',
        high: 'High (Detailed)',
      },
      shadowsOptions: {
        off: 'Disabled',
        low: 'Low',
        high: 'High',
      },
      dayNightOptions: {
        auto: 'Automatic (Dynamic)',
        day: 'Always Day',
        night: 'Always Night',
      },
      fpsOptions: {
        '0': 'Unlimited',
        '30': '30 FPS',
        '60': '60 FPS',
      },
      languageOptions: {
        it: 'Italiano',
        en: 'English',
      },
      notationOptions: {
        standard: 'Standard (1.2k)',
        scientific: 'Scientifica (1.20e3)',
        engineering: 'Ingegneristica (1.20e3)',
      },
      cheats: {
        title: 'Cheats & Creative Mode',
        subtitle: 'Freely alter parameters, terrain, and events in the active expedition.',
        warningActive: '⚠️ Cheats active: Trophy and Achievement unlocks are permanently locked out for this run.',
        warningInactive: 'Activating any cheat will permanently lock out all Achievements for this expedition.',
        confirmTitle: 'Warning: Cheats Mode',
        confirmMsg: 'Enabling cheats allows unrestricted sand grants, terrain excavation, and event triggers, but will permanently disable all Achievement unlocks for this expedition. Continue?',
        confirmBtn: 'Confirm & Lockout Achievements',
        sandSection: 'Grant Sand',
        addSand100k: '+100,000 Sand',
        addSand1M: '+1,000,000 Sand',
        completionSection: 'Instant Excavation Progress',
        comp50: 'Set to 50%',
        comp95: 'Set to 95%',
        comp99: 'Set to 99% (Climax)',
        endingSection: 'Force Expedition Ending',
        endingBtn: 'Trigger Climax Now',
        eventsSection: 'Trigger Desert Event',
        eventStorm: '🌪️ Sandstorm',
        eventMerchant: '⛺ Nomad Merchant',
        godModeSection: 'Super Shovel (God Mode)',
        godModeLabel: 'Super Shovel (God Mode)',
        godModeHint: '10x digging radius with zero cooldown between consecutive strikes',
        godModeActive: 'Active',
        godModeInactive: 'Disabled',
        upgradesSection: 'Max All Upgrades',
        maxUpgradesBtn: 'Unlock All Upgrades',
        notInGame: 'Cheats can only be used during an active expedition.',
        hudBadge: 'Cheats active — Achievements locked',
        toastSand100k: '+100,000 Sand granted!',
        toastSand1M: '+1,000,000 Sand granted!',
        toastComp: 'Excavation progress set to {pct}%',
        toastEnding: 'Forced ending: {id}',
        toastStorm: 'Sandstorm unleashed!',
        toastMerchant: 'Nomad Caravan arrived!',
        toastGodOn: 'Super Shovel (God Mode) Activated!',
        toastGodOff: 'Super Shovel Disabled.',
        toastMaxUpgrades: 'All upgrades maxed out!',
      },
    },
    achievements: {
      FIRST_DIG: {
        title: 'First Golden Strike',
        desc: 'Execute your very first manual shovel strike into the great dune.',
      },
      DUNE_BREAKER: {
        title: 'Dune Breaker',
        desc: 'Accumulate 100,000 units of sand in a single expedition.',
      },
      MACHINE_LORD: {
        title: 'Lord of the Machines',
        desc: 'Deploy at least 5 autonomous workers or excavators simultaneously.',
      },
      ECHOES_PAST: {
        title: 'Echoes of the Past',
        desc: 'Unearth the central obelisk sanctuary slumbering under the sands.',
      },
      TRINITY: {
        title: 'Trinity of the Sand',
        desc: 'Discover all three core endings (Curse, Treasure, Business).',
      },
      AWAKENING: {
        title: 'The Awakening',
        desc: 'Witness the Ascension of Atlantis in the Secret Ending.',
      },
      SPEEDRUNNER: {
        title: 'Race Against Time',
        desc: 'Complete an entire expedition in under 20 minutes.',
      },
      SAND_HOARDER: {
        title: 'Gold Keeper',
        desc: 'Accumulate a lifetime career total of 1,000,000 sand.',
      },
      ANCIENT_WISDOM: {
        title: 'Ancient Wisdom',
        desc: 'Earn your first Ancient Tablets τ from the Sanctuary.',
      },
      STORM_SURVIVOR: {
        title: 'Storm Rider',
        desc: 'Dig actively while a wild Sandstorm is ravaging the dune.',
      },
      NOMAD_PARTNER: {
        title: 'Desert Deal',
        desc: 'Strike a trade bargain with the Nomad Merchant caravan.',
      },
      COMPLETIONIST: {
        title: 'Supreme Archaeologist',
        desc: 'Reach 100% full excavation of an entire desert crater.',
      },
    },
    tutorial: {
      firstDig: 'Tap or hold down to dig into the dune',
      currency: 'Extracted sand is your currency!',
      workshopAvailable: 'New excavation tools ready in the Workshop!',
    },
    events: {
      sandstormTitle: 'Sandstorm!',
      sandstormMsg: 'Furious desert winds lift the dune: +50% Sand per strike (30s)!',
      sandstormBoostLabel: '⚡ Storm: +50% Sand (30s)',
      sandstormToastEnded: 'The sandstorm has subsided.',
      merchantTitle: 'Nomad Caravan',
      merchantMsg: 'A desert merchant has set up camp along the crater ridge!',
      merchantAction: 'Trade',
      merchantToastLeft: 'The nomad caravan has departed into the dunes.',
      merchantLore: '"The desert hides its secrets from the hurried, but rewards those who trade wisely."',
      hyperDigTitle: 'Nomad Hyper-Dig',
      hyperDigDesc: '+100% Sand extraction for the next 45 seconds.',
      hyperDigBuy: 'Purchase (150 Sand)',
      hyperDigBoostLabel: '✨ Hyper-Dig (x2.0): 45s',
      hyperDigSuccess: 'Purchased Nomad Hyper-Dig! (+100% Sand for 45s)',
      insufficientSand: 'Not enough sand for this trade!',
      decline: 'Decline',
    },
    prestige: {
      title: 'Sanctuary of Ancestors',
      currency: 'Ancient Tablets: τ {count}',
      intro: 'The lore of past cycles is never lost. Spend Ancient Tablets to imprint permanent perks across all future expeditions.',
      level: 'Lv. {lvl}/{max}',
      max: 'MAX',
      shovelEcho: {
        name: 'Echo of the Spade',
        desc: 'Wisdom of past cycles guides your strike: +15% permanent base dig power per level.',
        benefit: '+{pct}% Permanent Dig Power',
      },
      excavatorBlueprint: {
        name: 'Excavator Blueprint',
        desc: 'Begin every future expedition with Clockwork Scarabs already excavating the crater.',
        benefit: '{count} Scarabs operating at start',
      },
      tabletMagnetism: {
        name: 'Tablet Magnetism',
        desc: 'Ancestral favor: grants a 5% discount on all Workshop sand costs per level.',
        benefit: '-{pct}% Purchase Costs (Max -25%)',
      },
    },
    wardrobe: {
      title: 'Dune Wardrobe',
      subtitle: 'Customize the appearance of your shovels, sands, and machinery using Ancient Tablets (τ).',
      tablets: 'Ancient Tablets: τ {count}',
      tabShovel: 'Shovels & Spades',
      tabSand: 'Sand Biomes',
      tabMachinery: 'Machinery Fleet',
      equipped: 'Equipped',
      equip: 'Equip',
      unlock: 'Unlock for {cost} τ',
      needTablets: 'Need more tablets',
      free: 'Default',
      skins: {
        shovel_bronze: { name: 'Bronze Shovel', desc: 'Sturdy shovel forged during initial digs' },
        shovel_gold: { name: 'Royal Gold Spade', desc: 'Golden alloy glistening under the desert sun' },
        shovel_crystal: { name: 'Crystal Blade', desc: 'Ethereal edge inlaid with glowing orichalcum' },
        shovel_obsidian: { name: 'Obsidian Spade', desc: 'Volcanic black glass tempered in the deep earth' },
        sand_classic: { name: 'Classic Sand', desc: 'The original golden grains of the Great Dune' },
        sand_mars: { name: 'Martian Dust', desc: 'Crimson mineral dust from uncharted alien wastes' },
        sand_caribbean: { name: 'Caribbean Coral', desc: 'White limestone minerals from sunken coral atolls' },
        sand_volcanic: { name: 'Volcanic Ash', desc: 'Black basalt and quenched lava granules' },
        machinery_standard: { name: 'Standard Fleet', desc: 'Copper and bronze alloy clockwork automations' },
        machinery_royal_gold: { name: 'Golden Fleet', desc: 'Pharaonic ceremonial polished gold chassis' },
        machinery_atlantis_teal: { name: 'Atlantis Fleet', desc: 'Orichalcum composite with luminescent capacitors' },
      },
    },
    gallery: {
      title: 'Endings Gallery',
      progress: 'Collector Progress: {count}/{total} ({pct}%)',
      sealedTitle: '??? Slumbering Seal',
      unlockedStatus: '✓ Epilogue Unlocked',
      lockedStatus: 'Not yet discovered',
    },
    pause: {
      title: 'Expedition Paused',
      subtitle: 'Time elapsed: {time} · Sand: {sand}',
      quickSettings: 'Quick Settings',
      masterVol: 'Master Volume',
      muteLabel: 'Mute Audio',
      graphicsLabel: 'Graphics Quality',
      resume: 'Resume Expedition',
      stats: 'Stats & Trophies',
      wardrobe: 'Wardrobe & Skins',
      prestige: 'Sanctuary of Ancestors (τ {count})',
      settingsBtn: 'All Settings',
      saveAndExit: 'Save & Exit',
    },
    stats: {
      title: 'Career & Trophies',
      tabStats: 'Statistics',
      tabTrophies: 'Achievements',
      totalClicks: 'Manual Shovel Strikes',
      totalSandLifetime: 'Lifetime Total Sand',
      totalPlaytime: 'Total Playtime',
      ruinsUncovered: 'Unearthed Ruins',
      runsCompleted: 'Completed Expeditions',
      bestRunTime: 'Best Dig Record',
      noRecord: 'No record',
      trophiesUnlocked: 'Achievements Unlocked',
      dateUnlocked: 'Unlocked on',
      cheatsWarning: 'Achievements disabled: cheats have been enabled during this run',
    },
    loading: {
      title: 'Diggy Diggy Sand',
      subtitle: 'Preparing the expedition',
      status: 'Awakening ancient mechanisms…',
      startBtn: 'Begin Expedition',
      tips: [
        'The sand does not lie: every grain moved brings the lost city closer.',
        'The Atlanteans called orichalcum "the metal that remembers light".',
        'Hold down to dig continuously. Weary hands do not exist for a pharaoh.',
        'The Nomads dig slowly, but they never sleep.',
        'Beneath the dunes, something pulses with turquoise light. It is no mirage.',
        'A critical hit blazes like the noonday sun: watch for golden sparks.',
        'Obelisks point heavenward because what lies beneath should never be ignored.',
        'Not all expeditions end the same way. None can foresee what awaits below.',
      ],
    },
    offline: {
      title: 'Automated Expedition',
      content: 'While you were away, your autonomous diggers gathered <span class="num accent">+{amount}</span> Sand.',
      elapsed: 'Elapsed time: {mins} min (Fleet efficiency 50%).',
      claim: 'Claim',
    },
    graphics: {
      ssr_title: 'Raytracing & SSR Reflections',
      ssr_desc: 'Simulates photorealistic screen-space reflections and ambient occlusion (SSAO).',
    },
    directives: {
      widgetTitle: 'Expedition Directives',
      contractBadge: 'ACTIVE CONTRACT',
      noDirective: 'Awaiting new contracts...',
      localExtractionTitle: 'Territorial Extraction: {quadrant}',
      localExtractionDesc: 'Extract {target} sand in quadrant {quadrant}',
      continuousDiggingTitle: 'Continuous Cadence',
      continuousDiggingDesc: 'Keep digging continuously for {seconds}s without pause',
      deepExcavationTitle: 'Deep Excavation',
      deepExcavationDesc: 'Extract {target} sand from deep layers (depth ≤ 4.8)',
      workshopInvestmentTitle: 'Structural Investment',
      workshopInvestmentDesc: 'Purchase {count} levels in the Workshop within {time}s',
      rewardDiscount: '-15% Workshop (45s)',
      rewardBoost: '2x Digging (30s)',
      quadrants: {
        NE: 'North-East',
        NW: 'North-West',
        SE: 'South-East',
        SW: 'South-West',
      },
    },
    help: {
      modalTitle: 'Guide & Controls Legend',
      desktopTitle: 'Desktop Controls (Mouse & Keyboard)',
      touchTitle: 'Touch Controls (Tablet & Smartphone)',
      gameplayTitle: 'Expedition Rules',
      digAction: 'Continuous manual digging at hit point',
      zoomAction: 'Cinematic zoom (in / out)',
      rotateAction: 'Continuous orbital rotation around the dune',
      orbitAction: 'Manual free orbit and tilt',
      spaceAction: 'Dynamite trigger / rapid dig (when unlocked)',
      escAction: 'Pause expedition or close dialogs',
      f2f3Action: 'Debug console (F2) and FPS Profiler (F3)',
      touchDig: 'Instant continuous digging on terrain',
      touchPinch: 'Smooth pinch-to-zoom in / out',
      touchDrag: 'Orbital rotation around the dune and pitch',
      touchSwipeDown: 'Close bottom drawer in Workshop',
      gameplayDesc: 'Excavate the dune to reveal the sunken Atlantean structures below. Upgrade your shovel in the Workshop and command a fleet of drones and dredges to accelerate passive extraction. Keep an eye on Expedition Directives on the left for instant bonuses and temporary multipliers!',
    },
    credits: {
      modalTitle: 'Credits & Open Source Attributions',
      badge: 'ATLANTIS HERITAGE',
      versionLabel: 'Client Version',
      engineTitle: 'Rendering Engine & WebGL',
      engineText: 'Hardware-accelerated 3D rendering library under MIT License (© 2010-2024 Three.js Authors, mrdoob).',
      typographyTitle: 'Typography & Fonts',
      typographyText: 'Fonts distributed by Google Fonts under SIL Open Font License 1.1 (OFL).',
      assetsTitle: '3D Models & Audio Assets',
      legalTitle: 'Legal Notice & Privacy',
      legalText: 'All trademarks, logos, and assets belong to their respective creators. The game guarantees complete user data sovereignty: zero third-party cookies, no tracking or analytics, and local storage only (localStorage).',
    },
  },
};

export class I18n {
  constructor(lang = 'it') {
    this.lang = ['it', 'en'].includes(lang) ? lang : 'it';
    this.settings = null;
    I18n.instance = this;
  }

  static get currentLang() {
    return I18n.instance ? I18n.instance.lang : 'it';
  }

  static set currentLang(lang) {
    if (I18n.instance) I18n.instance.setLanguage(lang);
  }

  get currentLang() {
    return this.lang;
  }

  set currentLang(lang) {
    this.setLanguage(lang);
  }

  bindSettings(settings) {
    this.settings = settings;
    const initial = settings?.get?.('game.language') || 'it';
    this.setLanguage(initial);
    settings?.subscribe?.('game.language', (l) => this.setLanguage(l));
  }

  setLanguage(lang) {
    if (!['it', 'en'].includes(lang)) return;
    this.lang = lang;
    if (this.settings && this.settings.get('game.language') !== lang) {
      this.settings.set('game.language', lang);
    }
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = lang;
      this.updateDOM();
    }
    events.emit('language:changed', lang);
    events.emit('i18n:changed', { lang });
  }

  getLanguage() {
    return this.lang;
  }

  onLanguageChange(fn) {
    const unsub1 = events.on('language:changed', (lang) => fn({ lang }));
    const unsub2 = events.on('i18n:changed', fn);
    return () => { unsub1(); unsub2(); };
  }

  static t(key, params = {}) {
    return (I18n.instance || i18n).t(key, params);
  }

  /**
   * Helper per navigazione nell'albero dizionario con supporto case-insensitive.
   */
  _resolveKey(dict, parts) {
    if (!dict) return undefined;
    let cur = dict;
    for (const p of parts) {
      if (cur === undefined || cur === null) return undefined;
      if (typeof cur !== 'object') return undefined;
      if (p in cur) {
        cur = cur[p];
      } else {
        const lowerP = p.toLowerCase();
        const foundKey = Object.keys(cur).find((k) => k.toLowerCase() === lowerP);
        if (foundKey !== undefined) {
          cur = cur[foundKey];
        } else {
          return undefined;
        }
      }
    }
    return cur;
  }

  /**
   * Risolve una chiave di traduzione nidificata (es. 'hud.sand' o 'achievements.FIRST_DIG.title').
   * Supporta parametri di interpolazione: t('hud.completionPct', { pct: '45.2' }) => "45.2% scavato"
   * e fallback case-insensitive di sicurezza.
   */
  t(key, params = {}) {
    if (!key) return '';
    const parts = key.split('.');

    // 1. Prova con la lingua attiva (esatto + fallback case-insensitive)
    let cur = this._resolveKey(DICTIONARY[this.lang], parts);

    // 2. Fallback alla lingua alternativa (it o en)
    if (cur === undefined || cur === null) {
      const altLang = this.lang === 'it' ? 'en' : 'it';
      cur = this._resolveKey(DICTIONARY[altLang], parts);
    }

    // 3. Fallback alla chiave stessa se assente ovunque
    if (cur === undefined || cur === null) {
      cur = key;
    }

    if (typeof cur !== 'string') return cur ?? key;

    // 4. Interpolazione parametri dinamici {key}
    return cur.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? params[k] : `{${k}}`));
  }

  static updateDOM(root = typeof document !== 'undefined' ? document : null) {
    if (I18n.instance) I18n.instance.updateDOM(root);
  }

  /**
   * Scansiona ed aggiorna tutti gli elementi con attributi di localizzazione nel DOM:
   * - [data-i18n]: textContent
   * - [data-i18n-html]: innerHTML
   * - [data-i18n-title]: attributo title
   * - [data-i18n-placeholder]: attributo placeholder
   * - [data-i18n-aria-label]: attributo aria-label
   */
  updateDOM(root = typeof document !== 'undefined' ? document : null) {
    if (!root || !root.querySelectorAll) return;

    // Testo interno puro
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        const text = this.t(key);
        if (text && el.textContent !== text) {
          el.textContent = text;
        }
      }
    });

    // Testo HTML
    root.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (key) {
        const text = this.t(key);
        if (text && el.innerHTML !== text) {
          el.innerHTML = text;
        }
      }
    });

    // Titoli tooltip
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.setAttribute('title', this.t(key));
    });

    // Segnaposti form
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', this.t(key));
    });

    // Accessibilità screen reader
    root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria-label');
      if (key) el.setAttribute('aria-label', this.t(key));
    });
  }
}

// Istanza globale singleton pronta all'uso
export const i18n = new I18n();
