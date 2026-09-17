import axios from 'axios';

const config = window.__FEDOPS_CONFIG__ || {};
function origin(value, key) {
  if (!value) return window.location.origin;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value.replace(/\/$/, '')
    || url.username || url.password) throw new Error(`Invalid public runtime setting: ${key}`);
  return url.origin;
}
export const apiOrigin = origin(config.apiOrigin, 'apiOrigin');
export const socketUrl = origin(config.socketUrl || config.apiOrigin, 'socketUrl');
export const apiUrl = path => `${apiOrigin}${path}`;
// Only the configured object store is bridged through the frontend. Preserve
// the signed path/query; the proxy restores its original Host for S3 signing.
export function downloadUrl(value) {
  if (!value || !config.objectStorageOrigin) return value;
  const url = new URL(value, window.location.origin);
  const storageOrigin = origin(config.objectStorageOrigin, 'objectStorageOrigin');
  if (url.origin !== storageOrigin || url.username || url.password) return value;
  return `/fedops/objects${url.pathname}${url.search}`;
}
axios.defaults.baseURL = apiOrigin;
axios.defaults.withCredentials = true;
