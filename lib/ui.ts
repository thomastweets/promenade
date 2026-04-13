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
    localeName: "Sprachen",
    visitWebsite: "Website öffnen"
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
    localeName: "Languages",
    visitWebsite: "Visit website"
  },
  es: {
    home: "Inicio",
    artworks: "Obras",
    help: "Ayuda",
    about: "Sobre la exposición",
    menu: "Menú",
    themeLabel: "Tema",
    themeSystem: "Sistema",
    themeLight: "Claro",
    themeDark: "Oscuro",
    switchLabel: "Cambiar idioma",
    localeName: "Idiomas",
    visitWebsite: "Visit website"
  }
} satisfies UiDictionary

export const homeCopy = {
  de: {
    kicker: "Audio Guide",
    lead: "Geben Sie eine Audioguide-Nummer ein oder scannen Sie den QR-Code neben dem Werk, um Bild, Text und Audio direkt zu öffnen.",
    enterPlaceholder: "Audioguide-Nummer eingeben",
    enterButton: "Werk öffnen",
    scanButton: "QR-Code scannen",
    highlightsHeading: "Ausgewählte Arbeiten",
    highlightsEyebrow: "Werkauswahl",
    browseButton: "Alle Werke ansehen",
    statsArtworks: "Werke",
    statsArtists: "Künstler:innen",
    statsLocales: "Sprachen",
    entryHint: "Direkter Einstieg in die Führung"
  },
  en: {
    kicker: "Audio guide",
    lead: "Enter a guide number or scan the QR code next to a work to open images, text, and audio immediately.",
    enterPlaceholder: "Enter guide number",
    enterButton: "Open artwork",
    scanButton: "Scan QR code",
    highlightsHeading: "Selected works",
    highlightsEyebrow: "Selection",
    browseButton: "Browse all artworks",
    statsArtworks: "Works",
    statsArtists: "Artists",
    statsLocales: "Languages",
    entryHint: "Fast access to the guide"
  },
  es: {
    kicker: "Audioguía",
    lead: "Introduce un número de audioguía o escanea el código QR junto a la pieza para abrir imágenes, texto y audio al instante.",
    enterPlaceholder: "Introducir número de audioguía",
    enterButton: "Abrir obra",
    scanButton: "Escanear código QR",
    highlightsHeading: "Obras seleccionadas",
    highlightsEyebrow: "Selección",
    browseButton: "Ver todas las obras",
    statsArtworks: "Obras",
    statsArtists: "Artistas",
    statsLocales: "Idiomas",
    entryHint: "Acceso rápido a la guía"
  }
} satisfies UiDictionary

export const entryCopy = {
  de: {
    invalidNumber: "Bitte geben Sie eine gültige Audioguide-Nummer ein.",
    invalidResult: "Der QR-Code konnte keiner Werkseite zugeordnet werden.",
    cameraError:
      "Die Kamera konnte nicht geöffnet werden. Nutzen Sie alternativ die Werknummer.",
    cameraHint:
      "QR-Scanner lokal im Browser. Die App erkennt absolute Links, lokale Pfade und reine Audioguide-Nummern."
  },
  en: {
    invalidNumber: "Please enter a valid guide number.",
    invalidResult: "The QR code could not be mapped to an artwork page.",
    cameraError:
      "The camera could not be opened. Use the artwork number instead.",
    cameraHint:
      "Browser-side QR scanning. The app accepts absolute URLs, local paths, and plain guide numbers."
  },
  es: {
    invalidNumber: "Introduce un número de audioguía válido.",
    invalidResult: "El código QR no pudo asociarse a una página de obra.",
    cameraError:
      "No se pudo abrir la cámara. Usa el número de obra como alternativa.",
    cameraHint:
      "Escaneo QR en el navegador. La app acepta URLs completas, rutas locales y números simples de audioguía."
  }
} satisfies UiDictionary

export const entranceSignLabels = {
  de: {
    eyebrow: "Audioguide",
    title: "Zur Ausstellung",
    lead: "Scannen Sie den QR-Code oder öffnen Sie die Adresse im Browser, um die Führung direkt aufzurufen.",
    qrLabel: "Jetzt öffnen",
    urlLabel: "Direktlink",
    languagesLabel: "Sprachen",
    footer:
      "Kostenfrei im Browser. Kein App-Download nötig. Die Sprache kann in der App gewechselt werden.",
    steps: [
      "QR-Code scannen oder URL öffnen",
      "Sprache wählen",
      "Audioguide-Nummern an den Werkbeschriftungen aufrufen"
    ]
  },
  en: {
    eyebrow: "Audio guide",
    title: "For the exhibition",
    lead: "Scan the QR code or open the URL in your browser to enter the guide directly.",
    qrLabel: "Open now",
    urlLabel: "Direct link",
    languagesLabel: "Languages",
    footer:
      "Free in the browser. No app download required. The language can be changed inside the guide.",
    steps: [
      "Scan the QR code or open the URL",
      "Choose a language",
      "Open guide numbers from the artwork signs"
    ]
  },
  es: {
    eyebrow: "Audioguía",
    title: "Para la exposición",
    lead: "Escanea el código QR o abre la dirección en tu navegador para entrar directamente en la guía.",
    qrLabel: "Abrir ahora",
    urlLabel: "Enlace directo",
    languagesLabel: "Idiomas",
    footer:
      "Gratis en el navegador. No hace falta descargar ninguna app. El idioma se puede cambiar dentro de la guía.",
    steps: [
      "Escanea el código QR o abre la URL",
      "Elige un idioma",
      "Abre los números de audioguía que aparecen en las cartelas"
    ]
  }
} satisfies Record<
  Locale,
  {
    eyebrow: string
    title: string
    lead: string
    qrLabel: string
    urlLabel: string
    languagesLabel: string
    footer: string
    steps: [string, string, string]
  }
>

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
  },
  es: {
    play: "Reproducir",
    pause: "Pausa",
    duration: "Duración",
    audioMissing: "El audio todavía se está preparando."
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
    numberLabel: "Audioguide-Nummer eingeben",
    closeAction: "Schließen",
    scanSheetTitle: "QR-Code scannen",
    numberSheetTitle: "Audioguide-Nummer öffnen"
  },
  en: {
    currentArtwork: "Current artwork",
    findAnother: "Open another work",
    previousAction: "Previous artwork",
    nextAction: "Next artwork",
    scanAction: "Scan QR",
    numberAction: "Enter number",
    seekLabel: "Playback position",
    numberLabel: "Enter guide number",
    closeAction: "Close",
    scanSheetTitle: "Scan QR code",
    numberSheetTitle: "Open guide number"
  },
  es: {
    currentArtwork: "Obra actual",
    findAnother: "Abrir otra obra",
    previousAction: "Obra anterior",
    nextAction: "Siguiente obra",
    scanAction: "Escanear QR",
    numberAction: "Introducir número",
    seekLabel: "Posición de reproducción",
    numberLabel: "Introducir número de audioguía",
    closeAction: "Cerrar",
    scanSheetTitle: "Escanear código QR",
    numberSheetTitle: "Abrir número de audioguía"
  }
} satisfies UiDictionary

export const helpLabels = {
  de: {
    title: "So funktioniert die Führung",
    qrs: "QR-Codes öffnen direkt die passende Werkseite. Ist die App bereits geladen, erkennt der Scanner auch lokale Pfade und reine Audioguide-Nummern.",
    offline:
      "Texte, Bilder und Audio werden nach dem ersten Aufruf zwischengespeichert. Das hilft besonders in historischen Gebäuden mit instabiler Netzabdeckung.",
    accessibility:
      "Sie können jederzeit zwischen Deutsch und Englisch wechseln. Die Sprache folgt zuerst der URL, dann Ihrer gespeicherten Auswahl, dann dem Browser."
  },
  en: {
    title: "How the guide works",
    qrs: "QR codes open the matching artwork directly. Once the app is loaded, the scanner also understands local paths and plain guide numbers.",
    offline:
      "Texts, images, and audio are cached after the first request. That matters in older venues with unreliable network coverage.",
    accessibility:
      "You can switch between the available show languages at any time. The language follows the URL first, then your saved preference, then the browser."
  },
  es: {
    title: "Cómo funciona la guía",
    qrs: "Los códigos QR abren directamente la obra correspondiente. Una vez cargada la app, el escáner también entiende rutas locales y números simples de audioguía.",
    offline:
      "Los textos, las imágenes y el audio se guardan en caché tras la primera solicitud. Eso ayuda especialmente en edificios antiguos con una cobertura inestable.",
    accessibility:
      "Puedes cambiar entre los idiomas disponibles de la muestra en cualquier momento. El idioma sigue primero la URL, luego tu preferencia guardada y después el navegador."
  }
} satisfies UiDictionary
