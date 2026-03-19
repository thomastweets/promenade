import { z } from "zod"

const serverEnvSchema = z.object({
  SHOW: z.string().default("demo-show"),
  DEFAULT_LOCALE: z.enum(["de", "en"]).default("de"),
  PUBLIC_SITE_URL: z.url().default("http://localhost:4321"),
  STUDIO_API_ORIGIN: z.url().default("http://localhost:8787"),
  SHOWS_DIR: z.string().default("shows"),
  OPENAI_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_DE_VOICE_ID: z.string().optional(),
  ELEVENLABS_EN_VOICE_ID: z.string().optional(),
  PUBLIC_ANALYTICS_PROVIDER: z
    .enum(["none", "plausible", "goatcounter"])
    .default("none"),
  PUBLIC_ANALYTICS_DOMAIN: z.string().default(""),
  STUDIO_ALLOW_MOCK_AI: z.coerce.boolean().default(true)
})

let cachedEnv: z.infer<typeof serverEnvSchema> | undefined

export function getServerEnv() {
  cachedEnv ??= serverEnvSchema.parse(process.env)
  return cachedEnv
}
