import type { Locale } from "./schema"

type UiDictionary = Record<Locale, Record<string, string>>

export const chromeCopy = {
  de: {
    home: "Start",
    artworks: "Werke",
    help: "Hilfe",
    about: "Über die Schau",
    menu: "Menü",
    themeLabel: "Ansicht",
    themeSystem: "System",
    themeLight: "Hell",
    themeDark: "Dunkel",
    switchLabel: "Sprache wechseln",
    localeName: "English",
    offlineBadge: "offline nach dem ersten Aufruf",
    browseBadge: "zweisprachig",
    studioBadge: "lokal kuratierbar"
  },
  en: {
    home: "Home",
    artworks: "Artworks",
    help: "Help",
    about: "About the show",
    menu: "Menu",
    themeLabel: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    switchLabel: "Switch language",
    localeName: "Deutsch",
    offlineBadge: "offline after first load",
    browseBadge: "bilingual",
    studioBadge: "locally curated"
  }
} satisfies UiDictionary

export const homeCopy = {
  de: {
    kicker: "Audio Guide",
    lead: "Scannen, hören, schauen: Die neue Promenade führt Werke, Bilder und Audiotexte in einer klaren mobilen Oberfläche zusammen.",
    enterPlaceholder: "Werknummer eingeben",
    enterButton: "Werk öffnen",
    scanButton: "QR-Code scannen",
    highlightsHeading: "Ausgewählte Arbeiten",
    browseButton: "Alle Werke ansehen",
    statsArtworks: "Werke",
    statsLocales: "Sprachen",
    statsMode: "Betrieb",
    statsModeValue: "statisch + offlinefreundlich"
  },
  en: {
    kicker: "Audio guide",
    lead: "Scan, listen, browse: the new Promenade experience brings artworks, images, and audio into a clear mobile-first interface.",
    enterPlaceholder: "Enter artwork number",
    enterButton: "Open artwork",
    scanButton: "Scan QR code",
    highlightsHeading: "Selected works",
    browseButton: "Browse all artworks",
    statsArtworks: "Works",
    statsLocales: "Languages",
    statsMode: "Mode",
    statsModeValue: "static + offline friendly"
  }
} satisfies UiDictionary

export const entryCopy = {
  de: {
    invalidNumber: "Bitte geben Sie eine gültige Werknummer ein.",
    invalidResult: "Der QR-Code konnte keiner Werkseite zugeordnet werden.",
    cameraError:
      "Die Kamera konnte nicht geöffnet werden. Nutzen Sie alternativ die Werknummer.",
    cameraHint:
      "QR-Scanner lokal im Browser. Die App erkennt absolute Links, lokale Pfade und reine Werknummern."
  },
  en: {
    invalidNumber: "Please enter a valid artwork number.",
    invalidResult: "The QR code could not be mapped to an artwork page.",
    cameraError:
      "The camera could not be opened. Use the artwork number instead.",
    cameraHint:
      "Browser-side QR scanning. The app accepts absolute URLs, local paths, and plain artwork numbers."
  }
} satisfies UiDictionary

export const audioCopy = {
  de: {
    play: "Wiedergabe",
    pause: "Pause",
    duration: "Laufzeit",
    audioMissing: "Audioversion wird noch vorbereitet."
  },
  en: {
    play: "Play",
    pause: "Pause",
    duration: "Duration",
    audioMissing: "Audio is still being prepared."
  }
} satisfies UiDictionary

export const artworkDockCopy = {
  de: {
    currentArtwork: "Aktuelles Werk",
    findAnother: "Werk wechseln",
    previousAction: "Vorheriges Werk",
    nextAction: "Nächstes Werk",
    scanAction: "QR scannen",
    numberAction: "Nummer eingeben",
    seekLabel: "Wiedergabeposition",
    numberLabel: "Werknummer eingeben",
    closeAction: "Schließen",
    scanSheetTitle: "QR-Code scannen",
    numberSheetTitle: "Werknummer öffnen"
  },
  en: {
    currentArtwork: "Current artwork",
    findAnother: "Open another work",
    previousAction: "Previous artwork",
    nextAction: "Next artwork",
    scanAction: "Scan QR",
    numberAction: "Enter number",
    seekLabel: "Playback position",
    numberLabel: "Enter artwork number",
    closeAction: "Close",
    scanSheetTitle: "Scan QR code",
    numberSheetTitle: "Open artwork number"
  }
} satisfies UiDictionary

export const helpLabels = {
  de: {
    title: "So funktioniert die Führung",
    qrs: "QR-Codes öffnen direkt die passende Werkseite. Ist die App bereits geladen, erkennt der Scanner auch lokale Pfade und reine Werknummern.",
    offline:
      "Texte, Bilder und Audio werden nach dem ersten Aufruf zwischengespeichert. Das hilft besonders in historischen Gebäuden mit instabiler Netzabdeckung.",
    accessibility:
      "Sie können jederzeit zwischen Deutsch und Englisch wechseln. Die Sprache folgt zuerst der URL, dann Ihrer gespeicherten Auswahl, dann dem Browser."
  },
  en: {
    title: "How the guide works",
    qrs: "QR codes open the matching artwork directly. Once the app is loaded, the scanner also understands local paths and plain artwork numbers.",
    offline:
      "Texts, images, and audio are cached after the first request. That matters in older venues with unreliable network coverage.",
    accessibility:
      "You can switch between German and English at any time. The language follows the URL first, then your saved preference, then the browser."
  }
} satisfies UiDictionary
