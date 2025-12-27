import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // Changed from autoUpdate to prevent reload loops
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.js',
      manifest: {
        name: 'PharmAI - Inventory & Marketplace',
        short_name: 'PharmAI',
        description: 'Advanced Pharmacy Inventory Management System',
        theme_color: '#4F46E5',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3')) {
              return 'vendor-charts';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('lucide-react') || id.includes('sonner')) {
              return 'vendor-ui';
            }
            if (id.includes('react') || id.includes('react-dom')) {
              // return 'vendor-react'; // React is core, keeping it in main vendor often better or let Vite handle it
            }
          }
        }
      }
    }
  }
})
