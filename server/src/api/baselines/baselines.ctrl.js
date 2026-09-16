import fs from 'node:fs';
import path from 'node:path';
import { getDefaultBaselineDownloadSession } from '../../lib/taskFiles.js';
import {
  getBundledBaselineArtifact,
  getBundledBaselineSession,
} from '../../lib/bundledBaseline.js';

export const readDefault = async (ctx) => {
  try {
    if (ctx.query.distribution === 'legacy-s3') {
      ctx.body = await getDefaultBaselineDownloadSession();
      return;
    }
    ctx.body = getBundledBaselineSession(ctx.query.version || undefined);
  } catch (error) {
    ctx.status = 503;
    ctx.body = {
      message: 'The default FedOps Baseline release is unavailable.',
    };
    ctx.app.emit('error', error, ctx);
  }
};

export const readBundledArtifact = async (ctx) => {
  try {
    const artifact = getBundledBaselineArtifact(ctx.params.artifactId);
    if (!artifact) {
      ctx.status = 404;
      ctx.body = { message: 'Baseline artifact not found.' };
      return;
    }
    ctx.type = artifact.content_type || 'application/octet-stream';
    ctx.length = artifact.size;
    ctx.set('X-Content-Type-Options', 'nosniff');
    ctx.set('ETag', `"${artifact.sha256}"`);
    ctx.set(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(path.basename(artifact.path))}"`,
    );
    ctx.body = fs.createReadStream(artifact.absolutePath);
  } catch (error) {
    ctx.status = 503;
    ctx.body = { message: 'The bundled FedOps Baseline artifact is unavailable.' };
    ctx.app.emit('error', error, ctx);
  }
};
