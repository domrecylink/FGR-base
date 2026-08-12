/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// El default es la raíz: sirve en Vercel/Netlify y en `vite preview`.
// GitHub Pages publica bajo /<repo>/, así que el workflow define VITE_BASE=/<repo>/.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE || '/',
    plugins: [react()],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }
})
