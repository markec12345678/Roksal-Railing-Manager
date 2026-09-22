import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Testi pokrivajo src/lib — čisto izračunsko jedro in kriptografijo. Brez jsdoma
// in brez Next runtimea, zato celoten suite teče v dobri sekundi.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      // Sejni žetoni so fail-closed: brez skrivnosti sessionSecret() vrže.
      // Testi jo nastavijo tudi sami, tu je zaradi uvoza modulov ob zagonu.
      SESSION_SECRET: 'vitest-local-secret-not-for-production',
      // password.ts uvaža @/lib/db, ki konstruira PrismaClient ob uvozu.
      // Povezava se ne odpre (testi ne delajo poizvedb), a URL mora biti veljaven.
      DATABASE_URL: 'file:../db/custom.db',
      API_KEY_PEPPER: 'vitest-pepper',
    },
  },
})
