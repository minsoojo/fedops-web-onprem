// CRA supplies http-proxy-middleware. Production routing is configured separately.
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  const target = process.env.WEB_BACKEND_PROXY_TARGET;
  if (!target) return; // API origin can point directly at a backend instead.
  const url = new URL(target);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || url.search || url.hash || url.pathname !== '/') {
    throw new Error('WEB_BACKEND_PROXY_TARGET must be an HTTP(S) origin.');
  }
  app.use('/fedops/api', createProxyMiddleware({ target, changeOrigin: true }));
  app.use('/socket.io', createProxyMiddleware({ target, changeOrigin: true, ws: true }));
};
