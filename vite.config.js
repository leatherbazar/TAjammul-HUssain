import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Replaces __BUILD_TIME__ in public/sw.js so each deploy gets a fresh cache name
function swVersionPlugin() {
  return {
    name: 'sw-version',
    closeBundle() {
      const swPath = path.resolve('dist/sw.js')
      if (fs.existsSync(swPath)) {
        const ts = Date.now()
        fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace('__BUILD_TIME__', ts))
      }
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), swVersionPlugin()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 4173,
    allowedHosts: ['tat-bbc9.onrender.com', 'localhost', '.vercel.app', '.web.app']
  }
})
