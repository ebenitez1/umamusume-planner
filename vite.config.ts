import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages project sites, set VITE_BASE_PATH to '/<repo-name>/' in CI.
// For username.github.io repos or local dev, '/' is correct.
const base = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
})
