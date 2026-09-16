import './environment.js';

const normalizeUrl = (value, key) => {
  if (value === undefined || value.trim() === '') return undefined;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)
      || !url.hostname || url.username || url.password || url.search || url.hash) {
      throw new Error();
    }
    return url.href.replace(/\/+$/, '');
  } catch {
    throw new Error(`${key} must be an HTTP(S) base URL without credentials, query, or fragment.`);
  }
};

const primary = normalizeUrl(process.env.FL_SERVER_MANAGER_URL, 'FL_SERVER_MANAGER_URL');
const legacy = normalizeUrl(process.env.SERVER_MANAGER_URL, 'SERVER_MANAGER_URL');

if (primary && legacy && primary !== legacy) {
  throw new Error('FL_SERVER_MANAGER_URL and SERVER_MANAGER_URL must refer to the same base URL.');
}
if (!primary && !legacy) {
  throw new Error('FL_SERVER_MANAGER_URL is required (SERVER_MANAGER_URL is accepted for compatibility).');
}

export const serverManagerUrl = primary || legacy;
