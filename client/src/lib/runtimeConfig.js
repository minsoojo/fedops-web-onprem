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
axios.defaults.baseURL = apiOrigin;
axios.defaults.withCredentials = true;
