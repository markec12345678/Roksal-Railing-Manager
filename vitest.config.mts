import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Testi pokrivajo src/lib — čisto izračunsko jedro, kriptografijo in business
// integracije. S+9 (issue #4, korak 1): DB testi tečejo proti lokalnemu
// PostgreSQL (roksal_test, tools/vitest-global-setup.ts zagotovi instanco +
// migracije) — SQLite ni več testni vir.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['./tools/vitest-global-setup.ts'],
    // Integracijski testi (viz, inventory, numbering) si delijo testno bazo —
    // vzporedne datoteke se tekmujejo za iste vrstice (delete race). Zaporedno.
    fileParallelism: false,
    // Determinizem/SDK testi ob hladnem PG presežejo privzetih 5 s.
    testTimeout: 15000,
    env: {
      // Sejni žetoni so fail-closed: brez skrivnosti sessionSecret() vrže.
      // Testi jo nastavijo tudi sami, tu je zaradi uvoza modulov ob zagonu.
      SESSION_SECRET: 'vitest-local-secret-not-for-production',
      // PostgreSQL testna baza (embedded PG :5433, db roksal_test).
      DATABASE_URL: 'postgresql://roksal:roksal@localhost:5433/roksal_test',
      API_KEY_PEPPER: 'vitest-pepper',
    },
  },
})
