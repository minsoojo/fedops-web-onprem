import client from './client';

const root = (taskId) => (
  `/fedops/api/task-releases/tasks/${encodeURIComponent(taskId)}`
);

export const listTaskReleases = (taskId) => client.get(`${root(taskId)}/releases`);

export const publishTaskRelease = ({ taskId, releaseId, makePublic = false }) => client.post(
  `${root(taskId)}/releases/${encodeURIComponent(releaseId)}/publish`,
  { makePublic },
);

export const withdrawTaskRelease = ({ taskId, releaseId }) => client.post(
  `${root(taskId)}/releases/${encodeURIComponent(releaseId)}/withdraw`,
);
