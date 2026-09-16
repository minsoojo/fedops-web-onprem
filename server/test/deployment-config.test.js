import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Koa from 'koa';
import cors from '@koa/cors';
import { emailVerificationBaseUrl, runtimeArtifactBaseUrl, publicManagerUrl, aggregationHost, corsOrigins, webPort } from '../src/config/deployment.js';
import { objectStorageOptions, createObjectStorage } from '../src/config/objectStorage.js';

function withEnv(values, action) {
  const saved = { ...process.env };
  Object.assign(process.env, values);
  return Promise.resolve().then(action).finally(() => {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  });
}

test('internal/public addresses use supplied values and missing public host cannot expose a Task LAN IP', () => withEnv({
  EMAIL_VERIFICATION_BASE_URL: 'http://127.0.0.1:8080/', RUNTIME_ARTIFACT_BASE_URL: 'http://127.0.0.1:4000/fedops/api/task-releases/runtime-artifacts',
  FL_SERVER_MANAGER_PUBLIC_URL: 'https://manager.example.invalid/prefix/', FL_AGGREGATION_PUBLIC_HOST: 'fl.example.invalid', PORT: '4567',
}, () => {
  assert.equal(emailVerificationBaseUrl(), 'http://127.0.0.1:8080');
  assert.match(runtimeArtifactBaseUrl(), /\/runtime-artifacts$/);
  assert.equal(publicManagerUrl(), 'https://manager.example.invalid/prefix');
  assert.equal(aggregationHost(), 'fl.example.invalid');
  assert.equal(webPort(), 4567);
  delete process.env.FL_AGGREGATION_PUBLIC_HOST;
  assert.throws(aggregationHost, /FL_AGGREGATION_PUBLIC_HOST/);
}));

test('CORS list controls actual HTTP response headers and rejects wildcard/malformed input', () => withEnv({ CORS_ORIGINS: 'https://a.example.invalid,https://b.example.invalid' }, async () => {
  const allowed = corsOrigins();
  const app = new Koa();
  app.use(cors({ origin: ctx => allowed.includes(ctx.get('Origin')) ? ctx.get('Origin') : '', credentials: true }));
  app.use(ctx => { ctx.body = 'ok'; });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    for (const origin of ['https://a.example.invalid', 'https://b.example.invalid', 'https://outside.example.invalid']) {
      const headers = await new Promise((resolve, reject) => {
        http.get({ hostname: '127.0.0.1', port: server.address().port, headers: { Origin: origin } }, response => {
          response.resume(); response.on('end', () => resolve(response.headers));
        }).on('error', reject);
      });
      assert.equal(headers['access-control-allow-origin'], allowed.includes(origin) ? origin : undefined);
    }
    process.env.CORS_ORIGINS = '*';
    assert.throws(corsOrigins, /CORS_ORIGINS/);
  } finally { await new Promise(resolve => server.close(resolve)); }
}));

test('S3 config retains AWS defaults when unset and signs using a separate public endpoint without rewriting the URL', () => withEnv({
  REGION_NAME: 'ap-northeast-2', ACCESS_KEY_ID: 'local-test-key', ACCESS_SECRET_KEY: 'local-test-secret',
}, async () => {
  delete process.env.S3_ENDPOINT_URL; delete process.env.S3_PUBLIC_ENDPOINT_URL; delete process.env.S3_FORCE_PATH_STYLE;
  assert.equal(Object.hasOwn(objectStorageOptions(), 'endpoint'), false);
  assert.equal(Object.hasOwn(objectStorageOptions(), 's3ForcePathStyle'), false);
  process.env.S3_ENDPOINT_URL = 'http://internal.example.invalid:9000';
  process.env.S3_PUBLIC_ENDPOINT_URL = 'https://objects.example.invalid';
  assert.equal(objectStorageOptions().s3ForcePathStyle, true);
  process.env.S3_FORCE_PATH_STYLE = 'true';
  assert.equal(objectStorageOptions().endpoint, 'http://internal.example.invalid:9000');
  const url = new URL(await createObjectStorage({ signing: true }).getSignedUrlPromise('getObject', {
    Bucket: 'unchanged-bucket', Key: 'task/model.bin', Expires: 60,
  }));
  assert.equal(url.origin, 'https://objects.example.invalid');
  assert.equal(url.pathname, '/unchanged-bucket/task/model.bin');
  process.env.S3_FORCE_PATH_STYLE = 'yes';
  assert.throws(objectStorageOptions, /S3_FORCE_PATH_STYLE/);
}));

test('MinIO paths preserve model, Task and XAI bucket/key for ordinary operations and signing', () => withEnv({
  S3_ENDPOINT_URL: 'http://minio.example.invalid:9000',
  S3_PUBLIC_ENDPOINT_URL: 'https://objects.example.invalid',
  REGION_NAME: 'ap-northeast-2', ACCESS_KEY_ID: 'local-test-key', ACCESS_SECRET_KEY: 'local-test-secret',
}, async () => {
  delete process.env.S3_FORCE_PATH_STYLE;
  const storage = createObjectStorage();
  for (const [bucket, key] of [
    ['global-model', 'task/model.pth'], ['global-model', 'task/template.py'],
    ['global-model-xai', 'task/MNISTClassifier_local_model_V1.png'],
  ]) {
    for (const operation of ['putObject', 'getObject', 'deleteObject']) {
      const request = storage[operation]({ Bucket: bucket, Key: key });
      await new Promise((resolve, reject) => request.build(error => error ? reject(error) : resolve()));
      assert.equal(request.httpRequest.endpoint.host, 'minio.example.invalid:9000');
      assert.equal(request.httpRequest.path, `/${bucket}/${key}`);
    }
    const url = new URL(await createObjectStorage({ signing: true }).getSignedUrlPromise('getObject', {
      Bucket: bucket, Key: key, Expires: 60,
    }));
    assert.equal(url.origin, 'https://objects.example.invalid');
    assert.equal(url.pathname, `/${bucket}/${key}`);
  }
  process.env.S3_FORCE_PATH_STYLE = 'false';
  assert.equal(objectStorageOptions().s3ForcePathStyle, false);
}));
