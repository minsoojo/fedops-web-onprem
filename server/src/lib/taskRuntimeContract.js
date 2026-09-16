const LEGACY_PROFILE = Object.freeze({
  name: 'legacy-v1',
  schemaVersion: 1,
  fedopsVersion: '1.1.30.13',
  sourceRevision: '7cdd9840d7cacdef7ce3be96248a206fd06d496b',
});

const FEDERATED_TASK_V2_PROFILE = Object.freeze({
  name: 'federated-task-v2',
  schemaVersion: 2,
  fedopsVersion: '1.1.30.14',
  sourceRevision: 'b88732b4c75194034ba651df514cf5a32334150d',
});

const FEDERATED_TASK_V3_PROFILE = Object.freeze({
  name: 'federated-task-v3',
  schemaVersion: 3,
  fedopsVersion: '1.1.30.15',
  sourceRevision: 'fde3137f6e94bc4558352b109a8c87186d20208c',
});

const PROFILE_BY_NAME = Object.freeze({
  [LEGACY_PROFILE.name]: LEGACY_PROFILE,
  [FEDERATED_TASK_V2_PROFILE.name]: FEDERATED_TASK_V2_PROFILE,
  [FEDERATED_TASK_V3_PROFILE.name]: FEDERATED_TASK_V3_PROFILE,
});

const EVALUATION_PROFILE = Object.freeze({
  ...FEDERATED_TASK_V3_PROFILE,
  fedopsVersion: '1.1.30.18',
  sourceRevision: '733f1696edc234073f0c1cd1a96e6580bfbcffeb',
});

const withBaseline = (profile, baselineVersion = null) => ({
  ...profile,
  baselineVersion: baselineVersion || null,
});

const usesFederatedTaskV3 = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version || ''));
  if (!match) return false;
  const [, major, minor] = match.map(Number);
  return major > 0 || minor >= 7;
};

export const buildLegacyTaskRuntimeContract = () => withBaseline(LEGACY_PROFILE);

export const buildDefaultTaskRuntimeContract = (baseline) => (
  withBaseline(
    baseline?.version === '0.19.0' ? EVALUATION_PROFILE : usesFederatedTaskV3(baseline?.version)
      ? FEDERATED_TASK_V3_PROFILE
      : FEDERATED_TASK_V2_PROFILE,
    baseline?.version,
  )
);

export const resolveTaskRuntimeContract = (task = {}) => {
  const storedName = task?.runtimeContract?.name;
  if (storedName && PROFILE_BY_NAME[storedName]) {
    let profile = PROFILE_BY_NAME[storedName];
    const revision = task.runtimeContract.sourceRevision;
    if (storedName === EVALUATION_PROFILE.name && revision === EVALUATION_PROFILE.sourceRevision) {
      profile = EVALUATION_PROFILE;
    }
    if (revision && revision !== profile.sourceRevision) {
      throw new Error('Unsupported immutable FedOps Runtime revision.');
    }
    if (task.runtimeContract.fedopsVersion && task.runtimeContract.fedopsVersion !== profile.fedopsVersion) {
      throw new Error('FedOps Runtime version does not match its pinned revision.');
    }
    return withBaseline(
      profile,
      task.runtimeContract.baselineVersion || task?.baselineTemplate?.version,
    );
  }

  const baselineVersion = task?.baselineTemplate?.version;
  // An existing MongoDB Task has no stored contract. Baseline metadata alone
  // must never upgrade it: only Tasks created with an explicit v2 contract use
  // the shared parameter transport.
  return withBaseline(LEGACY_PROFILE, baselineVersion);
};

export const taskRuntimeManagerPayload = (task) => {
  const contract = resolveTaskRuntimeContract(task);
  return {
    runtime_contract: contract.name,
  };
};
