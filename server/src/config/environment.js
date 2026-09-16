import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load before application modules capture process.env at import time.
// Injected process variables take precedence over the optional local file.
const explicitPath = process.env.DOTENV_CONFIG_PATH;
const result = dotenv.config({
  path: explicitPath || fileURLToPath(new URL('../../.env', import.meta.url)),
  override: false,
});

if (result.error && (explicitPath || result.error.code !== 'ENOENT')) {
  // Do not include file contents or credentials in startup errors.
  throw new Error('Unable to read the environment configuration file.');
}
