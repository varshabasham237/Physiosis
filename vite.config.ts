import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ollamaDevServerPlugin } from './server/ollama';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), ollamaDevServerPlugin()],
  server: {
    port: 3000,
    open: false
  }
});
