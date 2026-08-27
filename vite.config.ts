import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

/**
 * GitHub Pages serves the repo root and cannot compile TypeScript or Tailwind.
 * Source HTML lives in `dev/`; `npm run build` publishes a compiled copy to the
 * repo root. During `vite` we rewrite `/` and `/audit.html` to those sources.
 */
function serveDevHtml(): Plugin {
  return {
    name: 'serve-dev-html',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url;
        if (!url) {
          next();
          return;
        }
        const q = url.indexOf('?');
        const path = q === -1 ? url : url.slice(0, q);
        const query = q === -1 ? '' : url.slice(q);
        if (path === '/' || path === '/index.html') {
          req.url = `/dev/index.html${query}`;
        } else if (path === '/audit.html') {
          req.url = `/dev/audit.html${query}`;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [tailwindcss(), serveDevHtml()],
  // Pages hosts this project at /StoryKeys/. Dev keeps `/` so local tooling
  // (`npm run dev`, smoke tests) continues to work unchanged.
  base: command === 'build' ? '/StoryKeys/' : '/',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./dev/index.html', import.meta.url)),
        audit: fileURLToPath(new URL('./dev/audit.html', import.meta.url)),
      },
    },
  },
}));
