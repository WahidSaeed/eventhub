import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // In development the API runs separately; in the container both are on one origin.
    proxy: {
      '/api': { target: 'http://localhost:3100', changeOrigin: true }
    }
  }
});
