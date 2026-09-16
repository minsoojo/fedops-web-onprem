import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import got from 'got';


const baseUrl = () => String(process.env.REGISTRY_API_BASE_URL || '').replace(/\/$/, '');
const timeout = { request: Number(process.env.REGISTRY_API_TIMEOUT_MS || 30000) };

const markRegistryError = (error) => {
  error.isRegistryApiError = true;
  return error;
};

export const registryApiConfigured = () => Boolean(baseUrl());

const registryUrl = (namespace, taskId, fileName = null) => {
  if (!registryApiConfigured()) throw new Error('Registry API is not configured.');
  const root = `${baseUrl()}/v1/registry/${namespace}/${encodeURIComponent(String(taskId))}`;
  return fileName
    ? `${root}/files/${encodeURIComponent(fileName)}`
    : `${root}/files`;
};

export const putRegistryFile = async ({ namespace, taskId, fileName, filePath, contentType }) => {
  let response;
  try {
    response = await got.put(registryUrl(namespace, taskId, fileName), {
      body: fs.createReadStream(filePath),
      headers: { 'content-type': contentType || 'application/octet-stream' },
      timeout,
      retry: { limit: 1, methods: ['PUT'] },
    });
  } catch (error) {
    throw markRegistryError(error);
  }
  if (!response.body) return {};
  try {
    return JSON.parse(response.body);
  } catch {
    return { message: response.body };
  }
};

export const downloadRegistryFile = async ({ namespace, taskId, fileName, destination }) => {
  try {
    await pipeline(
      got.stream(registryUrl(namespace, taskId, fileName), {
        timeout,
        retry: { limit: 1, methods: ['GET'] },
      }),
      fs.createWriteStream(destination, { flags: 'wx' }),
    );
  } catch (error) {
    throw markRegistryError(error);
  }
  return destination;
};

export const registryFileStream = ({ namespace, taskId, fileName }) => (
  got.stream(registryUrl(namespace, taskId, fileName), {
    timeout,
    retry: { limit: 1, methods: ['GET'] },
  })
);

export const deleteRegistryFile = async ({ namespace, taskId, fileName }) => {
  try {
    await got.delete(registryUrl(namespace, taskId, fileName), {
      timeout,
      retry: { limit: 1, methods: ['DELETE'] },
    });
  } catch (error) {
    throw markRegistryError(error);
  }
};

export const listRegistryFiles = async ({ namespace, taskId }) => (
  got.get(registryUrl(namespace, taskId), {
    timeout,
    retry: { limit: 1, methods: ['GET'] },
  }).json()
);
