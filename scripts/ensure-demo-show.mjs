import fs from "node:fs"
import path from "node:path"
import { seedDemoShow } from "./seed-demo-show.mjs"

const showsDir = process.env.SHOWS_DIR || "shows"
const showId = process.env.SHOW || "demo-show"
const showFile = path.resolve(showsDir, showId, "show.json")

if (!fs.existsSync(showFile)) {
  if (showId !== "demo-show") {
    throw new Error(
      `Show "${showId}" does not exist in ${showsDir}. Create it in the studio or set SHOW=demo-show.`
    )
  }

  await seedDemoShow({ showsDir })
}
