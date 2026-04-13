import fs from "node:fs/promises"
import path from "node:path"
import { seedDemoShow } from "../../scripts/seed-demo-show.mjs"

export default async function globalSetup() {
  const showDir = path.join(process.cwd(), ".playwright-shows")

  await fs.rm(showDir, { recursive: true, force: true })
  await seedDemoShow({ showsDir: showDir })
}
