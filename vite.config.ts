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
  // runtime environment variables potentially exposed by Gitpod/Cloud Workstations
  const WORKSPACE_URL = process.env.GITPOD_WORKSPACE_URL || process.env.CODESPACE_NAME || process.env.CLOUD_WORKSPACE_URL || '';
  // If workspace url looks like 'https://abc...gitpod.io' or similar, normalize for HMR host
  let hmrHost: string | undefined;
  let hmrProtocol: 'ws' | 'wss' = 'ws';
  let hmrPort: number | undefined;

  if (WORKSPACE_URL) {
    // remove protocol if present and port segments
    const normalized = WORKSPACE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
    // In many remote IDEs the public endpoint uses HTTPS and forwards websockets via 443
    hmrHost = normalized;
    hmrProtocol = 'wss';
    hmrPort = 443;
  } else if (process.env.VITE_HMR_HOST) {
    // manual override via env
    hmrHost = process.env.VITE_HMR_HOST;
    if (process.env.VITE_HMR_PROTOCOL === 'wss') hmrProtocol = 'wss';
    if (process.env.VITE_HMR_PORT) hmrPort = Number(process.env.VITE_HMR_PORT);
  }

  return {
    server: {
      port: Number(env.VITE_PORT || 3000),
      host: '0.0.0.0',
      // optionally enable polling if file event notifications fail in container
      watch: {
        // If you're on a networked filesystem or container, polling may help:
        usePolling: process.env.FORCE_POLLING === 'true' ? true : false,
      },
      hmr: hmrHost
        ? {
            protocol: hmrProtocol,
            host: hmrHost,
            port: hmrPort,
            // The clientPort is used by some proxies, you can set it to 443 for https
            clientPort: hmrPort ?? undefined,
          }
        : {
            // local dev fallback
            protocol: 'ws',
            host: 'localhost',
            port: Number(env.VITE_PORT || 3000),
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
