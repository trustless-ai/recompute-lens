import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './', // relative asset paths — works served at an ENS/IPFS root or a path-based gateway
  plugins: [react()],
})
