import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { downloadRegistryFile } from '../integrations/registryApi.js';
import { extractReleaseEntry, sha256File } from './taskReleases.js';

export const supportsEvaluationOverride = (contract) => contract?.name === 'federated-task-v3'
  && (contract.fedopsVersion === '1.1.30.19+onprem.20260916'
    || (/^1\.1\.30\.(\d+)$/.test(contract.fedopsVersion || '')
      && Number(contract.fedopsVersion.split('.')[3]) >= 18));

export const parseReleaseEvaluation = (configText, serverText) => {
  // Read data only: never import or execute user-authored Release Python code.
  const config = yaml.load(configText, { schema: yaml.JSON_SCHEMA });
  if (!serverText.includes('prepare_validation_loader')) {
    throw new Error('Publish a compatible Release to use Validation ON/OFF.');
  }
  const enabled = config?.server_evaluation?.enabled;
  if (typeof enabled !== 'boolean') {
    throw new Error('Set server_evaluation.enabled to true or false in the Release config.');
  }
  return { supported: true, enabled };
};

export const createReleaseEvaluationReader = ({
  download = downloadRegistryFile, checksum = sha256File, extract = extractReleaseEntry,
} = {}) => {
  const cache = new Map();
  return async (task, release, contract) => {
    if (!supportsEvaluationOverride(contract)) {
      return { supported: false, enabled: null, reason: 'Publish a compatible Release to use Validation ON/OFF.' };
    }
    if (!release) return { supported: false, enabled: null, reason: 'Publish a Task Release first.' };
    const key = `${task._id}:${release.releaseId}:${release.bundleSha256}`;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.promise;
    const entry = { expires: Infinity };
    entry.promise = (async () => {
      let directory;
      try {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), 'fedops-evaluation-'));
        const archive = path.join(directory, 'release.zip');
        await download({ namespace: 'task-assets', taskId: task._id, fileName: release.bundleName, destination: archive });
        if (await checksum(archive) !== release.bundleSha256) throw new Error('Release checksum mismatch.');
        const config = await extract(archive, 'federated_task/conf/config.yaml', 512 * 1024);
        const server = await extract(archive, 'federated_task/federated_learning/server_main.py', 512 * 1024);
        return parseReleaseEvaluation(config.toString('utf8'), server.toString('utf8'));
      } catch (_) {
        entry.expires = Date.now() + 30000;
        return { supported: false, enabled: null, reason: 'Could not read compatible evaluation settings from this Release. Check the published Release and refresh.' };
      } finally {
        if (directory) await fs.rm(directory, { recursive: true, force: true });
      }
    })();
    cache.set(key, entry);
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    return entry.promise;
  };
};

export const readReleaseEvaluation = createReleaseEvaluationReader();
