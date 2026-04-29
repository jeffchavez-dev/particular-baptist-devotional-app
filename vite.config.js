import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pb-icon.svg', 'pwa-192.png', 'pwa-512.png'],

      manifest: {
        name: 'Particular Baptist Devotional',
        short_name: 'PB Devotional',
        description: 'A 365-day devotional reading plan through the 2nd London Baptist Confession, Keach\'s Catechism, and the 1st London Baptist Confession.',
        theme_color: '#1d6b5a',
        background_color: '#1a1410',   // splash screen bg matches icon
        display: 'standalone',          // hides browser chrome, keeps status bar
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['education', 'lifestyle'],
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'pb-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },

      workbox: {
        // Inject push notification handler into the generated service worker
        importScripts: ['push-handler.js'],

        // Pre-cache all app assets (JS, CSS, HTML, fonts, icons)
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],

        // Don't cache Supabase auth tokens or user-specific API calls
        navigateFallback: '/index.html',

        runtimeCaching: [
          // Google Fonts stylesheet — cache first, refresh in background
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts files — cache forever (they're versioned by URL)
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Supabase API — network first (fresh data preferred), fall back to cache
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // External images (e.g. theologycheck logo)
          {
            urlPattern: /^https:\/\/theologycheckblog\.wordpress\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'external-images',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // All large JSON data files — cache on first fetch, serve offline thereafter
          // Covers: kjv.json, tagnt.json, tahot.json, strongs-greek.json, strongs-hebrew.json
          // (and any future abab.json or other Bible version files)
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.json') && url.origin === self.location.origin,
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-json-data',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
