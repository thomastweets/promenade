import type { Artwork, Locale, Show } from "@lib/schema"
import { localeMeta } from "@lib/schema"

export type NarrationPlan = {
  baseText: string
  speechText: string
  cueTextUsed: string
  instructionsUsed: string
}

export function buildAudioInstructions(
  show: Pick<Show, "audioGuideStyle">,
  locale: Locale
) {
  const fixedInstruction =
    locale === "de"
      ? "Sprich den bereitgestellten Text ruhig, klar und gleichmaessig. Lies ihn wortgetreu vor. Paraphrasiere nicht, kuerze nicht, erweitere nicht und veraendere keine Fakten."
      : locale === "es"
        ? "Lee el texto proporcionado con calma, claridad y constancia. Leelo de forma fiel y textual. No parafrasees, no abrevies, no amplifiques ni cambies los hechos."
        : "Read the provided text calmly, clearly, and evenly. Read it verbatim. Do not paraphrase, shorten, expand, or change any facts."

  const parts = [fixedInstruction]
  const showStyle = show.audioGuideStyle[locale].trim()

  if (showStyle) {
    parts.push(
      locale === "de"
        ? `Optionaler Tonkontext, nur fuer die Haltung der Stimme:\n${showStyle}`
        : locale === "es"
          ? `Contexto tonal opcional, solo para la actitud de la voz:\n${showStyle}`
          : `Optional tone context for voice attitude only:\n${showStyle}`
    )
  }

  return parts.join("\n\n")
}

export function buildNarrationPlan(
  show: Pick<Show, "audioGuideStyle">,
  artwork: Pick<Artwork, "description">,
  locale: Locale
): NarrationPlan {
  const baseText = artwork.description[locale].trim()

  if (!baseText) {
    throw new Error(
      `Audio generation requires guide description text in ${localeMeta[locale].englishLabel}.`
    )
  }

  return {
    baseText,
    speechText: baseText,
    cueTextUsed: "",
    instructionsUsed: buildAudioInstructions(show, locale)
  }
}
