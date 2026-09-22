import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Tests cover src/lib only — the pure calculation layer. No jsdom, no Next
// runtime, so the whole suite runs in well under a second.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
