import { createObjectStorage } from '../src/config/objectStorage.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  templateObjectPrefix,
  validateBaselineManifest,
} from '../src/lib/baselineTemplate.js';


const BUCKET_NAME = process.env.BUCKET_NAME;
const sourceDirectory = path.resolve(process.argv[2] || '');
const dryRun = process.argv.includes('--dry-run');
const offline = process.argv.includes('--offline');

if (!BUCKET_NAME && !offline) {
  throw new Error('BUCKET_NAME is required.');
}
if (!process.argv[2]) {
  throw new Error(
    'Usage: node scripts/publish-baseline-template.js '
    + '<release-directory> [--dry-run] [--offline]',
  );
}

const s3 = createObjectStorage();

const sha256 = (body) => createHash('sha256').update(body).digest('hex');

const headObjectOrNull = async (key) => {
  try {
    return await s3.headObject({ Bucket: BUCKET_NAME, Key: key }).promise();
  } catch (error) {
    if (['NotFound', 'NoSuchKey'].includes(error?.code) || error?.statusCode === 404) {
      return null;
    }
    throw error;
  }
};

const manifestBody = await fs.readFile(
  path.join(sourceDirectory, 'baseline-manifest.json'),
);
const manifest = JSON.parse(manifestBody.toString('utf8'));
const template = {
  name: manifest.baseline?.name,
  version: manifest.baseline?.release_version,
  revision: Number(manifest.baseline?.template_revision),
};
validateBaselineManifest(manifest, template);
const prefix = templateObjectPrefix(template);

const objects = [
  {
    key: `${prefix}/baseline-manifest.json`,
    body: manifestBody,
    contentType: 'application/json; charset=utf-8',
    checksum: sha256(manifestBody),
  },
];
for (const file of manifest.files) {
  const body = await fs.readFile(path.join(sourceDirectory, file.path));
  const actualChecksum = sha256(body);
  if (body.length !== file.size || actualChecksum !== file.sha256) {
    throw new Error(`Release file does not match manifest: ${file.path}`);
  }
  objects.push({
    key: `${prefix}/files/${file.path}`,
    body,
    contentType: file.content_type,
    checksum: actualChecksum,
  });
}

for (const object of objects) {
  if (offline) {
    console.log(`validated ${object.key}`);
    continue;
  }
  const existing = await headObjectOrNull(object.key);
  if (existing) {
    if (
      Number(existing.ContentLength) !== object.body.length
      || existing.Metadata?.sha256 !== object.checksum
    ) {
      throw new Error(`Immutable template object already differs: ${object.key}`);
    }
    console.log(`verified ${object.key}`);
    continue;
  }
  if (dryRun) {
    console.log(`would upload ${object.key}`);
    continue;
  }
  await s3.putObject({
    Bucket: BUCKET_NAME,
    Key: object.key,
    Body: object.body,
    ContentType: object.contentType,
    CacheControl: 'private, max-age=31536000, immutable',
    Metadata: {
      sha256: object.checksum,
      'baseline-name': template.name,
      'baseline-version': template.version,
      'template-revision': String(template.revision),
    },
  }).promise();
  console.log(`uploaded ${object.key}`);
}

if (!dryRun && !offline) {
  for (const object of objects) {
    const downloaded = await s3.getObject({
      Bucket: BUCKET_NAME,
      Key: object.key,
    }).promise();
    const body = Buffer.from(downloaded.Body || []);
    if (body.length !== object.body.length || sha256(body) !== object.checksum) {
      throw new Error(`Uploaded template verification failed: ${object.key}`);
    }
  }
  console.log(
    `published ${template.name}@${template.version} `
    + `(${objects.length} immutable objects)`,
  );
}
