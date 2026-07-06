import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages project sites, CI sets VITE_BASE_PATH to '/<repo-name>/'.
// The './' default produces relative asset URLs, which work both when the
// built dist/index.html is opened directly via file:// and on static hosts.
const base = process.env.VITE_BASE_PATH ?? './'

export default defineConfig({
  base,
  plugins: [react()],
})
