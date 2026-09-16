import qs from 'qs';
import client from './client';

export const createTask = ({
  creationMode,
  displayName,
  registrySlug,
  primaryModelName,
  taskCategory,
  dataModality,
  title,
  description,
  tags,
  serverRepoAddr,
  dataType,
  modelType,
  learningRate,
  numEpochs,
  batchSize,
  numRounds,
  clientPerRound,
  strategy,
  strategyParams,
  xaiEnabled,
  xaiParams,
  llmParams,
  datasetParams,
  clusteringEnabled,
  clusteringParams,
  sbaFlTarget,
  yamlConfig,
  summary,
  visibility,
  participationPolicy,
}) =>
  client.post('/fedops/api/tasks/newcreate', {
    creationMode,
    displayName,
    registrySlug,
    primaryModelName,
    taskCategory,
    dataModality,
    title,
    description: description || 'Auto-generated Federated Task from FedOps platform',
    tags: tags || '',
    serverRepoAddr: serverRepoAddr || '',
    dataType,
    modelType,
    learningRate,
    numEpochs,
    batchSize,
    numRounds,
    clientPerRound,
    strategy,
    strategyParams,
    xaiEnabled,
    xaiParams,
    llmParams,
    datasetParams,
    clusteringEnabled,
    clusteringParams,
    sbaFlTarget,
    yamlConfig,
    summary,
    visibility,
    participationPolicy,
  });

export const readTask = (title) =>
  client.get(`/fedops/api/tasks/${encodeURIComponent(title)}`);

export const listTasks = ({ page, tag, visibility, scope }) => {
  const queryString = qs.stringify({
    page,
    tag,
    visibility,
    scope,
  });
  return client.get(`/fedops/api/tasks?${queryString}`);
};

export const listPublicTasks = ({ page, q, tag, modelType } = {}) => {
  const queryString = qs.stringify({ page, q, tag, modelType });
  return client.get(`/fedops/api/tasks/public?${queryString}`);
};

export const readPublicTask = ({ handle, slug }) =>
  client.get(`/fedops/api/tasks/public/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}`);

export const readPublicTaskActivity = ({ handle, slug }) =>
  client.get(
    `/fedops/api/tasks/public/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}/activity`,
  );

export const readTaskActivity = (title) =>
  client.get(`/fedops/api/tasks/${encodeURIComponent(title)}/activity`);

export const readTaskMonitoring = ({
  title,
  modelVersion,
  clientId = 'all',
  rounds = 25,
}) => {
  const queryString = qs.stringify({
    modelVersion: modelVersion ?? undefined,
    client: clientId,
    rounds,
  });
  return client.get(
    `/fedops/api/tasks/${encodeURIComponent(title)}/monitoring?${queryString}`,
  );
};

export const requestParticipation = (taskId) =>
  client.post(`/fedops/api/tasks/id/${encodeURIComponent(taskId)}/participants`);

export const leaveParticipation = (taskId) =>
  client.delete(
    `/fedops/api/tasks/id/${encodeURIComponent(taskId)}/participants/me`,
  );

export const updateTaskCard = (title, markdown) =>
  client.patch(
    `/fedops/api/tasks/${encodeURIComponent(title)}/card`,
    { markdown },
  );

export const listParticipants = (title) =>
  client.get(`/fedops/api/tasks/${encodeURIComponent(title)}/participants`);

export const reviewParticipant = ({ title, participantId, status }) =>
  client.patch(
    `/fedops/api/tasks/${encodeURIComponent(title)}/participants/${encodeURIComponent(participantId)}`,
    { status },
  );

export const updateTask = ({
  id,
  modificationMode,
  displayName,
  title,
  description,
  tags,
  serverRepoAddr,
  dataType,
  modelType,
  learningRate,
  numEpochs,
  batchSize,
  numRounds,
  clientPerRound,
  strategy,
  strategyParams,
  xaiEnabled,
  xaiParams,
  llmParams,
  datasetParams,
  clusteringEnabled,
  clusteringParams,
  sbaFlTarget,
  yamlConfig,
  summary,
  visibility,
  participationPolicy,
}) => {
  if (modificationMode === 'federated-task-v3') {
    return client.patch(`/fedops/api/tasks/${id}`, {
      displayName,
      summary,
      tags,
      visibility,
      participationPolicy,
    });
  }
  return client.patch(`/fedops/api/tasks/${id}`, {
    title,
    description,
    tags,
    serverRepoAddr,
    dataType,
    modelType,
    learningRate,
    numEpochs,
    batchSize,
    numRounds,
    clientPerRound,
    strategy,
    strategyParams,
    xaiEnabled,
    xaiParams,
    llmParams,
    datasetParams,
    clusteringEnabled,
    clusteringParams,
    sbaFlTarget,
    yamlConfig,
    summary,
    visibility,
    participationPolicy,
  });
};

export const removeTask = (title) => {
  return client.delete(`/fedops/api/tasks/${encodeURIComponent(title)}`);
};

export const removeK8s = (title) => {
  console.log('=== API REMOVE K8S ===');
  console.log('Title:', title);
  console.log('URL:', `/fedops/api/tasks/k8s/${title}`);
  console.log('======================');
  return client.delete(`/fedops/api/tasks/k8s/${title}`);
};
