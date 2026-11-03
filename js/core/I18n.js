// Motore di Localizzazione Dinamica (Italiano / Inglese)
// Supporta traduzioni gerarchiche, interpolazione parametri ({count}, {amount})
// e aggiornamento automatico degli elementi DOM tramite selettori [data-i18n].
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
    },
    menu: {
      title: 'Diggy\nDiggy Sand',
      subtitle: 'Svuota il deserto. Scopri cosa dorme sotto.',
      newGame: 'Nuova Spedizione',
      continue: 'Continua',
      gallery: 'Finali Scoperti',
      prestige: 'Santuario dei Predecessori',
      stats: 'Statistiche & Trofei',
      wardrobe: 'Guardaroba & Skin',
      settings: 'Impostazioni',
      credits: 'Crediti',
      noSave: 'Nessun salvataggio disponibile',
    },
    hud: {
      sandLabel: 'Sabbia Estratta',
      spsLabel: 'al secondo',
      radarDepth: 'Profondità',
      radarBedrock: 'Roccia Madre',
      workshop: 'Officina delle Dune',
      pause: 'Pausa',
      stormBoost: 'TEMPESTA +50%',
    },
    shop: {
      title: 'Officina delle Dune',
      tabTools: 'Strumenti',
      tabFleet: 'Flotta Autonoma',
      tabRadar: 'Georadar',
      level: 'Livello',
      cost: 'Costo',
      maxed: 'Massimo',
      buy: 'Acquista',
      dpsLabel: 'DPS',
      powerLabel: 'Potenza',
      freqLabel: 'Frequenza',
      radiusLabel: 'Raggio',
    },
    upgrades: {
      shovel: {
        name: 'Pala Rinforzata',
        desc: 'Aumenta la potenza di ogni colpo di scavo.',
      },
      frequency: {
        name: 'Impugnatura Bilanciata',
        desc: 'Velocizza la cadenza di scavo a mano.',
      },
      radius: {
        name: 'Vanga a Lama Larga',
        desc: 'Allarga il raggio dell\'impatto nel terreno.',
      },
      scarab: {
        name: 'Scarafaggio Meccanico',
        desc: 'Automa agile che setaccia le dune in autonomia.',
      },
      excavator: {
        name: 'Escavatore a Vapore',
        desc: 'Macchinario pesante che frantuma strati profondi.',
      },
      dredge: {
        name: 'Draga d\'Oricalco',
        desc: 'Imponente struttura atlantidea a rotazione continua.',
      },
      georadar: {
        name: 'Georadar di Profondità',
        desc: 'Rileva anomalie e rovine sepolte nel sottosuolo.',
      },
    },
    settings: {
      title: 'Impostazioni',
      tabAudio: 'Audio',
      tabGraphics: 'Grafica',
      tabControls: 'Controlli',
      tabData: 'Dati & Lingua',
      tabCheats: 'Trucchi',
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
        upgradesSection: 'Potenziamenti Massimi',
        maxUpgradesBtn: 'Sblocca Tutti gli Upgrade',
        notInGame: 'I trucchi possono essere utilizzati solo durante una spedizione in corso.',
        hudBadge: 'Trucchi attivi — Obiettivi bloccati',
      },
      master: 'Volume Principale',
      music: 'Ambiente & Musica',
      sfx: 'Effetti Sonori',
      mute: 'Muto',
      language: 'Lingua di Gioco',
      renderScale: 'Risoluzione Render',
      shadows: 'Ombre',
      particles: 'Dettaglio Particelle',
      dayNight: 'Ciclo Giorno/Notte',
      fpsCap: 'Limite Frame Rate',
      cameraSens: 'Sensibilità Telecamera',
      invertY: 'Inverti Asse Verticale',
      screenShake: 'Scuotimento Schermo',
      clearSave: 'Cancella Salvataggio',
      clearSaveConfirm: 'Sei sicuro di voler eliminare la spedizione in corso? Questa azione non può essere annullata.',
      resetSettings: 'Ripristina Impostazioni Predefinite',
      exportSave: 'Esporta Dati',
      importSave: 'Importa Dati',
    },
    pause: {
      title: 'Spedizione in Pausa',
      resume: 'Riprendi Scavo',
      stats: 'Statistiche & Trofei',
      wardrobe: 'Guardaroba & Skin',
      prestige: 'Santuario (τ)',
      saveAndExit: 'Salva ed Esci',
    },
    wardrobe: {
      title: 'Guardaroba delle Dune',
      subtitle: 'Personalizza l\'aspetto dei tuoi strumenti, sabbia e macchinari con le Tavolette Antiche (τ).',
      tablets: 'Tavolette Antiche: {count} τ',
      tabShovel: 'Pale & Strumenti',
      tabShovels: 'Pale & Strumenti',
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
    tutorial: {
      firstDig: 'Tocca o tieni premuto per scavare la duna',
      currency: 'La sabbia estratta è la tua valuta',
      workshopAvailable: 'Nuovi strumenti disponibili nell\'Officina',
    },
    events: {
      sandstormTitle: 'Tempesta di Sabbia',
      sandstormMsg: 'Venti dorati sollevano il deserto! +50% sabbia estratta per 30s!',
      merchantTitle: 'Carovana Nomade',
      merchantMsg: 'Un mercante del deserto si è accampato sul crinale!',
      merchantTrade: 'Commercia',
      merchantDealBought: 'Patto nomade siglato con successo!',
    },
    endings: {
      curse: {
        badge: 'Maledizione',
        title: 'Il Sigillo Infranto',
        desc: 'Hai scavato troppo a fondo. L\'antica oscurità che riposava sotto la città si è risvegliata.',
        quote: 'Forse avresti dovuto lasciare la sabbia dov\'era...',
      },
      treasure: {
        badge: 'Tesoro',
        title: 'La Cripta dell\'Oro Puro',
        desc: 'Le fondamenta della città sommersa risplendono d\'oro massiccio e gemme inestimabili.',
        quote: 'Sei oscenamente ricco. La sabbia ti appartiene.',
      },
      business: {
        badge: 'Impresa',
        title: 'L\'Impresa di Scavo SRL',
        desc: 'Nessun mistero mistico: solo una colossale operazione mineraria altamente redditizia.',
        quote: 'La cava è aperta. La produzione non si ferma mai.',
      },
      secret: {
        badge: 'Ascensione',
        title: 'Il Risveglio di Atlantide',
        desc: 'Le rovine sepolte si sollevano verso il cielo avvolte da luce d\'oricalco.',
        quote: 'I Predecessori hanno riaperto le porte della volta celeste.',
      },
      buttons: {
        newGame: 'Nuova Spedizione',
        menu: 'Torna al Menu',
        sandbox: 'Continua in Sandbox Libera',
      },
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
    achievements: {
      FIRST_DIG: {
        title: 'Primo Colpo d\'Oro',
        desc: 'Effettua il tuo primo colpo di pala nella duna.',
      },
      DUNE_BREAKER: {
        title: 'Dune Breaker',
        desc: 'Accumula 100.000 unità di sabbia in una spedizione.',
      },
      MACHINE_LORD: {
        title: 'Signore delle Macchine',
        desc: 'Schiera almeno 5 lavoratori o escavatori contemporaneamente.',
      },
      ECHOES_PAST: {
        title: 'Echi del Passato',
        desc: 'Riporta alla luce il tempio centrale sotto le dune.',
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
        desc: 'Accumula le tue prime Tavolette Antiche τ.',
      },
      STORM_SURVIVOR: {
        title: 'Cavalcatempeste',
        desc: 'Scava durante una Tempesta di Sabbia attiva.',
      },
      NOMAD_PARTNER: {
        title: 'Affare nel Deserto',
        desc: 'Concludi uno scambio con il Mercante Nomade.',
      },
      COMPLETIONIST: {
        title: 'Archeologo Supremo',
        desc: 'Raggiungi il 100% di scavo di una duna.',
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
        lore: 'Un antico fondale oceanico prosciugato dove giace un galeone atlantideo spezzato in due tra archi di conchiglie giganti.',
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
    },
    menu: {
      title: 'Diggy\nDiggy Sand',
      subtitle: 'Clear the desert. Discover what sleeps below.',
      newGame: 'New Expedition',
      continue: 'Continue',
      gallery: 'Endings Discovered',
      prestige: 'Sanctuary of Ancestors',
      stats: 'Stats & Trophies',
      wardrobe: 'Wardrobe & Skins',
      settings: 'Settings',
      credits: 'Credits',
      noSave: 'No save file available',
    },
    hud: {
      sandLabel: 'Extracted Sand',
      spsLabel: 'per second',
      radarDepth: 'Depth',
      radarBedrock: 'Bedrock',
      workshop: 'Dune Workshop',
      pause: 'Pause',
      stormBoost: 'STORM +50%',
    },
    shop: {
      title: 'Dune Workshop',
      tabTools: 'Tools',
      tabFleet: 'Autonomous Fleet',
      tabRadar: 'Georadar',
      level: 'Level',
      cost: 'Cost',
      maxed: 'Max',
      buy: 'Purchase',
      dpsLabel: 'DPS',
      powerLabel: 'Power',
      freqLabel: 'Frequency',
      radiusLabel: 'Radius',
    },
    upgrades: {
      shovel: {
        name: 'Reinforced Shovel',
        desc: 'Increases the power of each manual shovel strike.',
      },
      frequency: {
        name: 'Balanced Grip',
        desc: 'Accelerates the speed of manual digging.',
      },
      radius: {
        name: 'Wide-Blade Spade',
        desc: 'Widens the impact area on the sand dunes.',
      },
      scarab: {
        name: 'Clockwork Scarab',
        desc: 'Agile automaton that sieves the dunes autonomously.',
      },
      excavator: {
        name: 'Steam Excavator',
        desc: 'Heavy machinery that shatters deep compressed rock layers.',
      },
      dredge: {
        name: 'Orichalcum Dredge',
        desc: 'Massive rotating Atlantean structure of boundless extraction.',
      },
      georadar: {
        name: 'Deep Georadar',
        desc: 'Detects buried anomalies and subterranean ruins.',
      },
    },
    settings: {
      title: 'Settings',
      tabAudio: 'Audio',
      tabGraphics: 'Graphics',
      tabControls: 'Controls',
      tabData: 'Data & Language',
      tabCheats: 'Cheats',
      cheats: {
        title: 'Cheats & Creative Mode',
        subtitle: 'Freely alter parameters and events in the current expedition.',
        warningActive: '⚠️ Cheats active: Achievements are permanently locked for this run.',
        warningInactive: 'Activating any cheat will permanently disable all Achievements for this expedition.',
        confirmTitle: 'Warning: Cheats Mode',
        confirmMsg: 'Activating cheats allows you to freely alter sand, terrain, and events, but permanently disables all Achievements for this expedition. Continue?',
        confirmBtn: 'Confirm and Disable Achievements',
        sandSection: 'Add Sand',
        addSand100k: '+100,000 Sand',
        addSand1M: '+1,000,000 Sand',
        completionSection: 'Fast Excavation Completion',
        comp50: 'Set 50%',
        comp95: 'Set 95%',
        comp99: 'Set 99% (Climax)',
        endingSection: 'Force Expedition Ending',
        endingBtn: 'Trigger Climax Now',
        eventsSection: 'Trigger Desert Event',
        eventStorm: '🌪️ Sandstorm',
        eventMerchant: '⛺ Nomad Merchant',
        godModeSection: 'Super Shovel (God Mode)',
        godModeLabel: 'Super Shovel (God Mode)',
        godModeHint: '10x digging radius and instantaneous strike rate',
        upgradesSection: 'Max Upgrades',
        maxUpgradesBtn: 'Unlock All Upgrades',
        notInGame: 'Cheats can only be used during an active expedition.',
        hudBadge: 'Cheats active — Achievements locked',
      },
      master: 'Master Volume',
      music: 'Ambience & Music',
      sfx: 'Sound Effects',
      mute: 'Mute',
      language: 'Game Language',
      renderScale: 'Render Resolution',
      shadows: 'Shadows',
      particles: 'Particle Detail',
      dayNight: 'Day/Night Cycle',
      fpsCap: 'Frame Rate Cap',
      cameraSens: 'Camera Sensitivity',
      invertY: 'Invert Vertical Axis',
      screenShake: 'Screen Shake',
      clearSave: 'Erase Save Data',
      clearSaveConfirm: 'Are you sure you want to delete the current expedition? This cannot be undone.',
      resetSettings: 'Restore Default Settings',
      exportSave: 'Export Data',
      importSave: 'Import Data',
    },
    pause: {
      title: 'Expedition Paused',
      resume: 'Resume Digging',
      stats: 'Stats & Trophies',
      wardrobe: 'Wardrobe & Skins',
      prestige: 'Sanctuary (τ)',
      saveAndExit: 'Save & Exit',
    },
    wardrobe: {
      title: 'Dune Wardrobe',
      subtitle: 'Customize the look of your tools, sand, and machinery using Ancient Tablets (τ).',
      tablets: 'Ancient Tablets: {count} τ',
      tabShovel: 'Shovels & Tools',
      tabShovels: 'Shovels & Tools',
      tabSand: 'Sand Biomes',
      tabMachinery: 'Machinery Fleet',
      equipped: 'Equipped',
      equip: 'Equip',
      unlock: 'Unlock for {cost} τ',
      needTablets: 'Need tablets',
      free: 'Default',
      skins: {
        shovel_bronze: { name: 'Bronze Shovel', desc: 'Sturdy shovel forged during the earliest excavations' },
        shovel_gold: { name: 'Royal Gold Shovel', desc: 'Golden alloy glistening under the desert sun' },
        shovel_crystal: { name: 'Crystal Shovel', desc: 'Ethereal blade inlaid with glowing orichalcum' },
        shovel_obsidian: { name: 'Obsidian Shovel', desc: 'Black volcanic glass tempered deep underground' },
        sand_classic: { name: 'Classic Sand', desc: 'Original golden grains of the Great Dune' },
        sand_mars: { name: 'Mars Sand', desc: 'Crimson mineral dust from unknown alien horizons' },
        sand_caribbean: { name: 'Caribbean Sand', desc: 'White limestone minerals and coral reef powder' },
        sand_volcanic: { name: 'Volcanic Sand', desc: 'Pitch-black basalt and volcanic lapilli' },
        machinery_standard: { name: 'Standard Fleet', desc: 'Copper and bronze alloy automatons and scarabs' },
        machinery_royal_gold: { name: 'Royal Gold Fleet', desc: 'Ceremonial gilded hulls fit for pharaohs' },
        machinery_atlantis_teal: { name: 'Atlantis Fleet', desc: 'Orichalcum composite with luminescent condensers' },
      },
    },
    tutorial: {
      firstDig: 'Tap or hold to dig into the sand dune',
      currency: 'Extracted sand is your currency',
      workshopAvailable: 'New equipment available in the Workshop',
    },
    events: {
      sandstormTitle: 'Sandstorm',
      sandstormMsg: 'Golden gales sweep the desert! +50% sand extracted for 30s!',
      merchantTitle: 'Nomad Caravan',
      merchantMsg: 'A desert merchant has set up camp on the ridge!',
      merchantTrade: 'Trade',
      merchantDealBought: 'Nomad pact signed successfully!',
    },
    endings: {
      curse: {
        badge: 'Curse',
        title: 'The Shattered Seal',
        desc: 'You dug too deep. Ancient darkness slumbering beneath the city has awakened.',
        quote: 'Perhaps you should have left the sand where it lay...',
      },
      treasure: {
        badge: 'Treasure',
        title: 'The Vault of Pure Gold',
        desc: 'The foundations of the sunken city shine with solid gold and invaluable gems.',
        quote: 'You are obscenely wealthy. The desert belongs to you.',
      },
      business: {
        badge: 'Enterprise',
        title: 'Excavation Inc.',
        desc: 'No mystical mystery: just a colossal, highly profitable quarry operation.',
        quote: 'The quarry is open. Production never sleeps.',
      },
      secret: {
        badge: 'Ascension',
        title: 'The Awakening of Atlantis',
        desc: 'The sunken ruins levitate into the sky shrouded in orichalcum dawn.',
        quote: 'The Ancestors have reopened the celestial gateway.',
      },
      buttons: {
        newGame: 'New Expedition',
        menu: 'Back to Menu',
        sandbox: 'Continue in Free Sandbox',
      },
    },
    stats: {
      title: 'Career & Trophies',
      tabStats: 'Statistics',
      tabTrophies: 'Achievements',
      totalClicks: 'Manual Shovel Strikes',
      totalSandLifetime: 'Lifetime Sand Extracted',
      totalPlaytime: 'Total Playtime',
      ruinsUncovered: 'Ruins Uncovered',
      runsCompleted: 'Expeditions Completed',
      bestRunTime: 'Fastest Completion Time',
      noRecord: 'No record yet',
      trophiesUnlocked: 'Trophies Unlocked',
      dateUnlocked: 'Unlocked on',
      cheatsWarning: 'Achievements disabled: cheats have been used in this expedition',
    },
    achievements: {
      FIRST_DIG: {
        title: 'First Golden Strike',
        desc: 'Perform your first shovel strike into the dune.',
      },
      DUNE_BREAKER: {
        title: 'Dune Breaker',
        desc: 'Accumulate 100,000 units of sand in a single run.',
      },
      MACHINE_LORD: {
        title: 'Machine Lord',
        desc: 'Deploy at least 5 workers or excavators simultaneously.',
      },
      ECHOES_PAST: {
        title: 'Echoes of the Past',
        desc: 'Uncover the central temple beneath the dunes.',
      },
      TRINITY: {
        title: 'Trinity of Sand',
        desc: 'Discover all three base endings (Curse, Treasure, Enterprise).',
      },
      AWAKENING: {
        title: 'The Awakening',
        desc: 'Witness the Ascension of Atlantis in the Secret Ending.',
      },
      SPEEDRUNNER: {
        title: 'Against the Clock',
        desc: 'Complete an expedition in under 20 minutes.',
      },
      SAND_HOARDER: {
        title: 'Keeper of Gold',
        desc: 'Accumulate 1,000,000 total lifetime sand in your career.',
      },
      ANCIENT_WISDOM: {
        title: 'Ancient Wisdom',
        desc: 'Accumulate your first Ancient Tablets τ.',
      },
      STORM_SURVIVOR: {
        title: 'Storm Rider',
        desc: 'Dig while an active Sandstorm sweeps the desert.',
      },
      NOMAD_PARTNER: {
        title: 'Desert Deal',
        desc: 'Complete a transaction with the Nomad Merchant.',
      },
      COMPLETIONIST: {
        title: 'Supreme Archaeologist',
        desc: 'Reach 100% completion of a desert excavation.',
      },
    },
    biomes: {
      modalTitle: 'Select Expedition Biome',
      modalSubtitle: 'Choose the archaeological site for your new expedition',
      startBtn: 'Launch Expedition',
      cancelBtn: 'Cancel',
      selectedBadge: 'Selected',
      selectBtn: 'Select Biome',
      unlockTabletsBtn: 'Unlock ({cost} τ)',
      lockedReq: 'Requires {wins} Win(s) or {cost} τ',
      modifiersLabel: 'Active Modifiers',
      desert: {
        name: 'Golden Desert',
        subtitle: 'The Ancestral Dunes of Kemet',
        lore: 'Millenary golden sands hiding the Obelisk Sanctuary, colonnaded avenues, and orichalcum chambers.',
        modifier: 'Standard Resistance | Volume 100%',
      },
      ocean: {
        name: 'Drained Ocean',
        subtitle: 'Submerged Coral Abyss',
        lore: 'An ancient drained seabed where a sunken Atlantean galleon lies broken in two amidst giant shell arches.',
        modifier: 'Resistance -20% | Volume +15% | Value +25%',
      },
      glacier: {
        name: 'Glacial Frost',
        subtitle: 'Crypt of Eternal Permafrost',
        lore: 'Hexagonal ice monoliths, crystalline spires, and frozen temples guarded by a dense permafrost layer.',
        modifier: 'Permafrost +35% Res. | Ice Shards | Value +35%',
      },
      jungle: {
        name: 'Overgrown Oasis',
        subtitle: 'Emerald Ziggurat & Roots',
        lore: 'Low stepped ziggurat temples and engraved menhirs wrapped in buried roots requiring multiple strikes to break.',
        modifier: 'Buried Roots (-35% Radius) | Value +40%',
      },
    },
  },
};

export class I18n {
  constructor(settings = null) {
    this.settings = settings;
    this.lang = settings?.get?.('game.language') || 'it';

    settings?.subscribe?.('game.language', (val) => {
      if (val && ['it', 'en'].includes(val) && val !== this.lang) {
        this.setLanguage(val);
      }
    });
  }

  setLanguage(lang) {
    if (!['it', 'en'].includes(lang)) return;
    this.lang = lang;
    if (this.settings && this.settings.get('game.language') !== lang) {
      this.settings.set('game.language', lang);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      this.updateDOM();
    }
    events.emit('i18n:changed', { lang });
  }

  getLanguage() {
    return this.lang;
  }

  onLanguageChange(fn) {
    return events.on('i18n:changed', fn);
  }

  /**
   * Risolve una chiave di traduzione nidificata (es. 'menu.newGame' o 'achievements.FIRST_DIG.title').
   * Supporta parametri di interpolazione: t('shop.levelParam', { count: 5 }) => "Livello 5"
   */
  t(key, params = {}) {
    if (!key) return '';
    const parts = key.split('.');
    let cur = DICTIONARY[this.lang] || DICTIONARY.it;

    for (const p of parts) {
      if (!cur || cur[p] === undefined) {
        // Fallback a italiano se la chiave non esiste nella lingua attuale
        cur = null;
        break;
      }
      cur = cur[p];
    }

    if (cur === null || cur === undefined) {
      let fallback = DICTIONARY.it;
      for (const p of parts) {
        if (!fallback || fallback[p] === undefined) {
          fallback = key;
          break;
        }
        fallback = fallback[p];
      }
      cur = fallback;
    }

    if (typeof cur !== 'string') return cur ?? key;

    // Interpolazione parametri
    return cur.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? params[k] : `{${k}}`));
  }

  /**
   * Scansiona ed aggiorna tutti gli elementi con attributo `data-i18n="chiave"`
   * o `data-i18n-title="chiave"` nel sottoalbero specificato.
   */
  updateDOM(root = document) {
    if (!root || !root.querySelectorAll) return;

    // Testo interno
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        const text = this.t(key);
        if (text && el.textContent !== text) {
          el.textContent = text;
        }
      }
    });

    // Attributo title
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.setAttribute('title', this.t(key));
    });

    // Attributo placeholder
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', this.t(key));
    });
  }
}

// Istanza globale singleton pronta all'uso
export const i18n = new I18n();

