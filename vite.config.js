import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths"
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['nudge-icon.svg', 'nudge-icon-192.png', 'nudge-icon-512.png'],
      manifest: {
        name: 'Nudge',
        short_name: 'Nudge',
        description: 'Your personal productivity dashboard',
        start_url: '/',
        display: 'standalone',
        background_color: '#191919',
        theme_color: '#697565',
        id: '/',
        orientation: 'any',
        icons: [
          {
            src: '/nudge-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/nudge-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/nudge-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/www\.google\.com\/s2\/favicons/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'favicon-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
  },
})
