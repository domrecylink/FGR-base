import { defineConfig } from 'vitest/config'

// Las pruebas cubren sólo la lógica de dominio (TS puro, sin React ni Next).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
