import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env from root or parent directory if not already loaded
let dir = process.cwd();
for (let i = 0; i < 5; i++) {
  const envPath = resolve(dir, '.env');
  if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath);
      break;
    } catch {
      // ignore
    }
  }
  const parent = resolve(dir, '..');
  if (parent === dir) break;
  dir = parent;
}
