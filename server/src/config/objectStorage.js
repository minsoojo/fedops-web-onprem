import AWS from 'aws-sdk';
import { httpUrl } from './deployment.js';

export function objectStorageOptions({ signing = false } = {}) {
  const endpoint = (signing && httpUrl('S3_PUBLIC_ENDPOINT_URL', { optional: true }))
    || httpUrl('S3_ENDPOINT_URL', { optional: true });
  const style = process.env.S3_FORCE_PATH_STYLE ?? (endpoint ? 'true' : undefined);
  if (style !== undefined && !['true', 'false'].includes(style)) {
    throw new Error('S3_FORCE_PATH_STYLE must be true or false.');
  }
  return {
    region: process.env.REGION_NAME || 'ap-northeast-2',
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.ACCESS_SECRET_KEY,
    ...(endpoint ? { endpoint } : {}),
    ...(style !== undefined ? { s3ForcePathStyle: style === 'true' } : {}),
  };
}

// Models, Task files, Baseline and XAI use the same endpoint configuration.
// Without an endpoint, the SDK keeps its AWS default destination.
export const createObjectStorage = options => new AWS.S3(objectStorageOptions(options));
