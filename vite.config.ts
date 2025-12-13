import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const pwaManifest = {
  name: 'PharmAI Pro',
  short_name: 'PharmAI',
  description: 'Intelligent Pharmacy OS',
  theme_color: '#059669',
  background_color: '#F1F5F9',
  display: 'standalone',
  scope: '/',
  start_url: '/',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
};

const htmlPlugin = () => ({
  name: 'html-transform',
  transformIndexHtml(html: string) {
    return html.replace(
      '<head>',
      `<head>
        <link rel="manifest" href="/manifest.json">
        <meta name="theme-color" content="${pwaManifest.theme_color}">
      `
    );
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: Number(env.VITE_PORT || 3000),
      host: '0.0.0.0',
      watch: {
        usePolling: process.env.FORCE_POLLING === 'true' ? true : false,
      },
    },
    plugins: [react(), htmlPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
