import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:5001', changeOrigin: true } },
  },
  build: {
    rollupOptions: {
      output: { manualChunks: { charts: ['recharts'], vendor: ['react', 'react-dom', 'react-router-dom', '@reduxjs/toolkit', 'react-redux'] } },
    },
  },
});
