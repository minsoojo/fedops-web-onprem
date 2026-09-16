const STRATEGY_LABELS = {
  FedAVG: 'FedAvg',
};

export const formatStrategyLabel = (strategy) => (
  STRATEGY_LABELS[strategy] || strategy
);

export const parseTaskTags = (tags) => {
  const values = Array.isArray(tags) ? tags : String(tags || '').split(/[,\n]/);

  return values
    .map((tag) => String(tag).trim().replace(/^#/, ''))
    .filter(Boolean);
};

export const getTaskModelKind = (task) => {
  const modelType = String(task?.modelType || '').trim().toLocaleLowerCase();
  if (modelType === 'llm') return 'LLM';
  if (modelType) return 'AI';

  const inferred = [
    task?.dataType,
    task?.dataModality,
    task?.primaryModel?.task,
  ].map((value) => String(value || '').trim().toLocaleLowerCase());
  return inferred.some((value) => [
    'llm',
    'large-language-model',
    'text-generation',
    'text_generation',
    'causal-language-modeling',
    'causal_lm',
    'chat',
  ].includes(value)) ? 'LLM' : 'AI';
};

export const getTaskCardMetadata = (task, limit = 5) => {
  const candidates = [
    { label: getTaskModelKind(task), kind: 'model' },
    task?.taskCategory && {
      label: String(task.taskCategory).replaceAll('_', ' '),
      kind: 'task',
    },
    task?.dataModality && task.dataModality !== 'undecided' && {
      label: String(task.dataModality).replaceAll('_', ' '),
      kind: 'data',
    },
    task?.strategy && {
      label: formatStrategyLabel(task.strategy),
      kind: 'strategy',
    },
    ...parseTaskTags(task?.tags).map((tag) => ({
      label: tag,
      kind: 'tag',
    })),
  ].filter(Boolean);

  const seen = new Set();

  return candidates.filter((item) => {
    const normalized = item.label.toLocaleLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).slice(0, limit);
};
