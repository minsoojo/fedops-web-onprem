import { resolveTaskRuntimeContract } from './taskRuntimeContract.js';

export const FEDERATED_TASK_V3_MODIFY_FIELDS = Object.freeze([
  'displayName',
  'summary',
  'tags',
  'visibility',
  'participationPolicy',
]);

export const LEGACY_TASK_MODIFY_FIELDS = Object.freeze([
  'title',
  'description',
  'tags',
  'serverRepoAddr',
  'dataType',
  'modelType',
  'learningRate',
  'numEpochs',
  'batchSize',
  'numRounds',
  'clientPerRound',
  'strategy',
  'strategyParams',
  'xaiEnabled',
  'xaiParams',
  'llmParams',
  'datasetParams',
  'clusteringEnabled',
  'clusteringParams',
  'sbaFlTarget',
  'yamlConfig',
  'summary',
  'visibility',
  'participationPolicy',
]);

export const taskModificationMode = (task = {}) => (
  resolveTaskRuntimeContract(task).name === 'federated-task-v3'
    ? 'federated-task-v3'
    : 'legacy-v1'
);

const pickDefined = (source, fields) => fields.reduce((result, field) => {
  if (source[field] !== undefined) result[field] = source[field];
  return result;
}, {});

// The server owns this allow-list. A v3 metadata edit can therefore never
// mutate its immutable Release, runtime identity, model contract, or YAML.
export const selectTaskModification = (task, values = {}) => pickDefined(
  values,
  taskModificationMode(task) === 'federated-task-v3'
    ? FEDERATED_TASK_V3_MODIFY_FIELDS
    : LEGACY_TASK_MODIFY_FIELDS,
);
