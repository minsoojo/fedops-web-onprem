import './environment.js';

export function httpUrl(key, { optional = false } = {}) {
  const value = (process.env[key] || '').trim();
  if (!value && optional) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname
      || url.username || url.password || url.search || url.hash) throw new Error();
    return url.href.replace(/\/+$/, '');
  } catch {
    throw new Error(`${key} must be an HTTP(S) URL without credentials, query, or fragment.`);
  }
}

export const emailVerificationBaseUrl = () => httpUrl('EMAIL_VERIFICATION_BASE_URL');
export const runtimeArtifactBaseUrl = () => httpUrl('RUNTIME_ARTIFACT_BASE_URL');
export const publicManagerUrl = () => httpUrl('FL_SERVER_MANAGER_PUBLIC_URL');
export function aggregationHost() {
  const value = (process.env.FL_AGGREGATION_PUBLIC_HOST || '').trim();
  if (!value || /[\s/?:#@]/.test(value)) {
    throw new Error('FL_AGGREGATION_PUBLIC_HOST must be a hostname or IPv4 address without a port.');
  }
  return value;
}

export function corsOrigins() {
  const values = (process.env.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
  if (!values.length) throw new Error('CORS_ORIGINS must list the allowed browser origins.');
  return values.map(value => {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value.replace(/\/$/, '')
        || url.username || url.password) throw new Error();
      return url.origin;
    } catch { throw new Error('CORS_ORIGINS must contain HTTP(S) origins, without wildcards or paths.'); }
  });
}

export function webPort() {
  const raw = process.env.PORT || '4000';
  if (!/^\d+$/.test(raw) || +raw < 1 || +raw > 65535) throw new Error('PORT must be between 1 and 65535.');
  return +raw;
}

export function validateWebConfiguration() {
  emailVerificationBaseUrl(); runtimeArtifactBaseUrl(); publicManagerUrl(); aggregationHost();
  httpUrl('REGISTRY_API_BASE_URL'); corsOrigins(); webPort();
  if (!/^mongodb(?:\+srv)?:\/\//.test(process.env.MONGO_URI || '')) throw new Error('MONGO_URI is required.');
  if (!process.env.JWT_SECRET?.trim()) throw new Error('JWT_SECRET is required.');
}
