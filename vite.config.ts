import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      // audit.html is a standalone content-review dashboard; without an explicit
      // entry Vite would only build index.html and drop it from dist.
      input: {
        main: 'index.html',
        audit: 'audit.html',
      },
    },
  },
});
