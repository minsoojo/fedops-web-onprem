// One forwarded frontend port serves the UI, API, sockets and signed downloads.
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

  const storageTarget = process.env.OBJECT_STORAGE_PROXY_TARGET;
  const storagePublic = process.env.OBJECT_STORAGE_PUBLIC_ORIGIN;
  if (!storageTarget && !storagePublic) return;
  for (const value of [storageTarget, storagePublic]) {
    const endpoint = new URL(value);
    if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username
      || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') {
      throw new Error('Object storage proxy endpoints must be HTTP(S) origins.');
    }
  }
  const signedHost = new URL(storagePublic).host;
  app.use('/fedops/objects', (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return res.sendStatus(405);
    return next();
  }, createProxyMiddleware({
    target: storageTarget,
    changeOrigin: true,
    pathRewrite: { '^/fedops/objects': '' },
    onProxyReq: proxyReq => {
      proxyReq.setHeader('Host', signedHost);
      // The S3 query signature authorizes access; never forward login cookies.
      proxyReq.removeHeader('cookie');
      proxyReq.removeHeader('authorization');
    },
  }));
};
