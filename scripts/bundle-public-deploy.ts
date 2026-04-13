import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const shouldSkipBuild = process.argv.includes("--skip-build")
const outputDir = path.resolve(".deploy", "public")

if (!shouldSkipBuild) {
  const build = spawnSync("npm", ["run", "build"], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true
  })

  if (build.status !== 0) {
    throw new Error(`Public build failed with status ${build.status}.`)
  }
}

fs.rmSync(outputDir, { recursive: true, force: true })
fs.mkdirSync(outputDir, { recursive: true })
fs.cpSync(path.resolve("dist"), path.join(outputDir, "dist"), {
  recursive: true
})
fs.cpSync(path.resolve("ops", "public"), outputDir, { recursive: true })

console.log(`Public deploy bundle created at ${outputDir}`)
