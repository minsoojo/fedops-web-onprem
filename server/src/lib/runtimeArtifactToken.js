import { createHmac, timingSafeEqual } from 'node:crypto';


const secret = () => String(
  process.env.RUNTIME_ARTIFACT_SECRET || process.env.JWT_SECRET || '',
);

const encode = (value) => Buffer.from(value).toString('base64url');
const sign = (value) => createHmac('sha256', secret()).update(value).digest('base64url');

export const createRuntimeArtifactToken = (claims, ttlSeconds = null) => {
  if (!secret()) throw new Error('RUNTIME_ARTIFACT_SECRET or JWT_SECRET is required.');
  const now = Math.floor(Date.now() / 1000);
  // A Kubernetes Deployment can be rescheduled long after it was created.
  // Version 2 is therefore a restart-safe, release-scoped capability instead
  // of a short-lived download URL. runtimeArtifactSelection revokes it as soon
  // as this exact Release is no longer the Task's current Published Release.
  const persistentRuntimeToken = ttlSeconds === null || ttlSeconds === undefined;
  const payload = {
    version: persistentRuntimeToken ? 2 : 1,
    purpose: 'published-release-runtime',
    taskId: String(claims.taskId),
    releaseId: String(claims.releaseId),
    modelVersionId: String(claims.modelVersionId),
    issuedAt: now,
  };
  if (!persistentRuntimeToken) {
    payload.expiresAt = now + Math.max(Number(ttlSeconds) || 0, 60);
  }
  const body = encode(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
};

export const verifyRuntimeArtifactToken = (token) => {
  if (!secret()) throw new Error('Runtime artifact token verification is unavailable.');
  const [body, signature, extra] = String(token || '').split('.');
  if (!body || !signature || extra) throw new Error('Invalid runtime artifact token.');
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error('Invalid runtime artifact token.');
  }
  let claims;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid runtime artifact token.');
  }
  const supportedVersion = claims?.version === 1 || claims?.version === 2;
  const expiredV1 = claims?.version === 1
    && Number(claims.expiresAt) <= Math.floor(Date.now() / 1000);
  const invalidV2Purpose = claims?.version === 2
    && claims.purpose !== 'published-release-runtime';
  if (
    !supportedVersion
    || !claims.taskId
    || !claims.releaseId
    || !claims.modelVersionId
    || expiredV1
    || invalidV2Purpose
  ) {
    throw new Error('Expired or incomplete runtime artifact token.');
  }
  return claims;
};
