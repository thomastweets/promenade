import { setActiveShowId } from "@lib/content"

const showId = process.argv[2]

if (!showId) {
  throw new Error("Usage: npm run show:activate -- <show-id>")
}

setActiveShowId(showId)
console.log(`Activated show "${showId}".`)
