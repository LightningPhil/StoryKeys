/**
 * Minimal Node module-resolution hook so `node --test` can import extensionless
 * TypeScript modules under `src/` without adding third-party test runners.
 */
import { existsSync } from 'node:fs';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (
      err?.code === 'ERR_MODULE_NOT_FOUND'
      && (specifier.startsWith('./') || specifier.startsWith('../'))
      && context.parentURL
    ) {
      const candidateUrl = new URL(`${specifier}.ts`, context.parentURL);
      if (candidateUrl.protocol === 'file:' && existsSync(fileURLToPath(candidateUrl))) {
        return nextResolve(candidateUrl.href, context);
      }
    }
    throw err;
  }
}

if (!process.execArgv.some((arg) => arg.includes('ts-loader.mjs')) || import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  // Imported as hook module itself when registered below
}

export function registerTsLoader() {
  register(import.meta.url, pathToFileURL('./'));
}

// Auto-register when loaded via `node --import ./tools/ts-loader.mjs`
if (typeof globalThis.__skTsLoaderRegistered === 'undefined') {
  globalThis.__skTsLoaderRegistered = true;
  register(import.meta.url, pathToFileURL('./'));
}
