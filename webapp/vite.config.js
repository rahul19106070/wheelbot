import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    allowedHosts: true, // Allow all hosts to fix tunnel blocking
  }
});
