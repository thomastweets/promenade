import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/unit/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      exclude: [
        "coverage/**",
        "dist/**",
        "legacy/**",
        ".astro/**",
        ".playwright-shows/**",
        "public/**",
        "src/**/*.astro",
        "studio/**",
        "tests/**",
        "**/*.config.*"
      ]
    },
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"]
  }
})
