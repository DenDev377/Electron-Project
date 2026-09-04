import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // base: './' diperlukan saat build production untuk Electron,
  // agar path asset menggunakan relative path (bukan '/asset.js')
  base: './',
})
