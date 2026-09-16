const POSITIVE_INTEGER = /^[1-9]\d*$/;

export const normalizeServerEvaluation = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || typeof value.enabled !== 'boolean') {
    throw new Error('Server Validation enabled must be boolean.');
  }
  if (!value.enabled) return { enabled: false };
  const path = value.dataPath;
  if (typeof path !== 'string' || !path || path !== path.trim()
      || path.includes('\\') || /[\x00-\x1f]/.test(path)
      || path.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Choose a relative directory inside /app/data/server-validation (no traversal).');
  }
  return { enabled: true, dataPath: path };
};

const positiveInteger = (value, label, fallback) => {
  const selected = value ?? fallback;
  if (!POSITIVE_INTEGER.test(String(selected))) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return Number(selected);
};

export const normalizeCampaignConfig = (
  value = {},
  supportedStrategies = ['FedAvg'],
  fallback = {},
) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const fallbackStrategy = fallback?.strategy?.name || supportedStrategies[0] || 'FedAvg';
  const strategyValue = source.strategy;
  const strategy = typeof strategyValue === 'string'
    ? { name: strategyValue, parameters: {} }
    : {
      name: strategyValue?.name || fallbackStrategy,
      parameters: strategyValue?.parameters || fallback?.strategy?.parameters || {},
    };
  if (!supportedStrategies.includes(strategy.name)) {
    throw new Error(`Strategy ${strategy.name} is not supported by the Published Release.`);
  }
  if (!strategy.parameters || typeof strategy.parameters !== 'object' || Array.isArray(strategy.parameters)) {
    throw new Error('Strategy parameters must be an object.');
  }
  const allowedParameters = new Set(['fraction_fit', 'fraction_evaluate']);
  const unknown = Object.keys(strategy.parameters).filter((name) => !allowedParameters.has(name));
  if (unknown.length) {
    throw new Error(`Unsupported strategy parameters: ${unknown.sort().join(', ')}.`);
  }
  for (const [name, parameter] of Object.entries(strategy.parameters)) {
    const number = Number(parameter);
    if (!Number.isFinite(number) || number < 0 || number > 1) {
      throw new Error(`${name} must be between 0 and 1.`);
    }
  }
  const evaluation = source.serverEvaluation ?? fallback.serverEvaluation;
  const serverEvaluation = evaluation === undefined ? undefined : normalizeServerEvaluation(evaluation);
  if (serverEvaluation?.enabled === false && Number(strategy.parameters.fraction_evaluate ?? 1) <= 0) {
    throw new Error('Client evaluation requires fraction_evaluate > 0.');
  }
  return {
    schemaVersion: 1,
    ...(serverEvaluation === undefined ? {} : { serverEvaluation }),
    rounds: positiveInteger(source.rounds, 'Rounds', fallback.rounds || 2),
    clientsPerRound: positiveInteger(
      source.clientsPerRound,
      'Clients per round',
      fallback.clientsPerRound || 1,
    ),
    strategy,
  };
};

export const serverManagerCampaignFields = (campaign = {}, task = {}) => ({
  // The existing Python Server Manager schema keeps these legacy scalar
  // fields as strings. Campaign metadata remains numeric in Web/MongoDB.
  num_rounds: String(campaign?.rounds ?? task.numRounds ?? ''),
  client_per_round: String(campaign?.clientsPerRound ?? task.clientPerRound ?? ''),
  strategy: String(campaign?.strategy?.name ?? task.strategy ?? ''),
});
