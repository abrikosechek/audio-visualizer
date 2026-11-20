import { fileURLToPath, URL } from 'node:url'
import dns from 'node:dns'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import { visualizerApi } from './server/visualizer-api.ts'

// VPNs often break IPv6 (::1). Prefer IPv4 so http://127.0.0.1:5173 works.
dns.setDefaultResultOrder('ipv4first')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    visualizerApi(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    hmr: {
      host: '127.0.0.1',
    },
  },
})
