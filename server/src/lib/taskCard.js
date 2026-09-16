import sanitizeHtml from 'sanitize-html';

const plainText = (value = '') => sanitizeHtml(String(value || ''), {
  allowedTags: [],
  allowedAttributes: {},
}).trim();

const fieldValue = (value, fallback = 'Not specified') => (
  value === null || value === undefined || value === ''
    ? fallback
    : String(value)
);

export const buildDefaultTaskCard = (task = {}) => {
  const title = fieldValue(task.displayName || task.title, 'Federated Learning Task');
  const primaryModel = fieldValue(
    task.primaryModel?.displayName || task.primaryModel?.workingName,
    'To be finalized in Agent Studio',
  );
  const summary = plainText(task.summary || task.description)
    || 'A federated learning task published on FedOps.';
  return `# ${title}

${summary}

## Primary model

- Model: ${primaryModel}
- Registry ID: @${fieldValue(task.ownerHandle, 'owner')}/${fieldValue(task.slug, 'task')}

## Intended use

Describe who should use the global model, supported use cases, and use cases that are out of scope.

## Federated training

- Strategy: ${fieldValue(task.strategy)}
- Model type: ${fieldValue(task.modelType)}
- Communication rounds: ${fieldValue(task.numRounds)}
- Local epochs: ${fieldValue(task.numEpochs)}
- Batch size: ${fieldValue(task.batchSize)}
- Clients per round: ${fieldValue(task.clientPerRound)}

Joining this task means requesting approval to contribute local training to a future federated run.

## Data and input features

- Data modality: ${fieldValue(task.dataType)}

Document the expected input feature names, shapes, dtypes, label definition, allowed missing values, normalization, and train/evaluation split.

## Local setup

Review the files in \`default_baseline/\` before running local training. Replace the baseline model and data preparation functions with task-specific implementations.

## Limitations and privacy

Participant data must remain local. Do not upload raw training data, credentials, device identifiers, or private server configuration to this Task.
`;
};

export const resolveTaskCard = (task = {}) => (
  task.cardMarkdown?.trim() || buildDefaultTaskCard(task)
);
