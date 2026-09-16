const V3_START_COMMAND = [
  'cd /app/code',
  'mkdir -p /app/data/logs',
  'PID_FILE=/app/data/fl-server.pid',
  'if [ -s "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then echo "FL Server is already running"; exit 1; fi',
  'rm -f "$PID_FILE"',
  "{ nohup /bin/sh -c 'PID_FILE=/app/data/fl-server.pid; child=; cleanup() { rm -f \"$PID_FILE\"; }; stop() { if [ -n \"$child\" ] && kill -0 \"$child\" 2>/dev/null; then kill \"$child\"; fi; wait \"$child\" 2>/dev/null || true; cleanup; exit 143; }; trap stop TERM INT; .venv/bin/python -m federated_task.federated_learning.server_main & child=$!; wait \"$child\"; code=$?; cleanup; exit \"$code\"' > /app/data/logs/serverlog.txt 2>&1 </dev/null & echo $! > /app/data/fl-server.pid; }",
  'sleep 2',
  'kill -0 "$(cat /app/data/fl-server.pid)"',
  'echo "FL Server started"',
].join(' && ');

const V3_STOP_COMMAND = [
  'PID_FILE=/app/data/fl-server.pid',
  'if [ ! -s "$PID_FILE" ]; then echo "FL Server is not running"; exit 0; fi',
  'PID="$(cat "$PID_FILE")"',
  'if kill -0 "$PID" 2>/dev/null; then kill "$PID"; fi',
  'for attempt in 1 2 3 4 5; do if ! kill -0 "$PID" 2>/dev/null; then break; fi; sleep 1; done',
  'if kill -0 "$PID" 2>/dev/null; then kill -KILL "$PID"; fi',
  'rm -f "$PID_FILE"',
  'echo "FL Server stopped"',
].join(' && ');

const shellQuote = (value) => `'${String(value).replace(/'/g, `'"'"'`)}'`;

export const campaignEnvironmentCommand = (campaign, campaignRun = null) => {
  if (!campaign) return '';
  const strategy = typeof campaign.strategy === 'string'
    ? { name: campaign.strategy, parameters: {} }
    : campaign.strategy || { name: 'FedAvg', parameters: {} };
  const values = {
    FEDOPS_CAMPAIGN_CONFIG: JSON.stringify(campaign),
    FL_NUM_ROUNDS: campaign.rounds,
    FL_CLIENT_PER_ROUND: campaign.clientsPerRound,
    FL_STRATEGY: strategy.name,
    FL_STRATEGY_PARAMS: JSON.stringify(strategy.parameters || {}),
    FEDOPS_CAMPAIGN_RUN_ID: campaignRun?.runId,
    FEDOPS_BASE_GLOBAL_MODEL_VERSION: campaignRun?.baseGlobalModelVersion,
    FEDOPS_TARGET_GLOBAL_MODEL_VERSION: campaignRun?.targetGlobalModelVersion,
  };
  return Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([name, value]) => `export ${name}=${shellQuote(value)}`)
    .join(' && ');
};

export const validationCheckCommand = (campaign) => [
  campaignEnvironmentCommand(campaign),
  'cd /app/code',
  '.venv/bin/python -m fedops.server.validation',
].filter(Boolean).join(' && ');

export const assertAggregationStarted = (runtimeContract, result) => {
  if (runtimeContract?.name === 'federated-task-v3'
      && !String(result?.output || '').split('\n').some((line) => line.trim() === 'FL Server started')) {
    throw new Error('FL Server did not start. Check evaluation setup and server logs before retrying.');
  }
};

export const classicServerStartCommand = [
  'cd /app/code',
  'RUNTIME_PYTHON=/app/data/runtime/venv/bin/python',
  'if [ ! -x "$RUNTIME_PYTHON" ]; then RUNTIME_PYTHON=python3; fi',
  '"$RUNTIME_PYTHON" -c "import fedops,hydra,flwr,omegaconf"',
  '{ nohup "$RUNTIME_PYTHON" server_main.py > /app/data/logs/serverlog.txt 2>&1 </dev/null & }',
  'echo "FL Server started"',
].join(' && ');

export const classicServerStopCommand = [
  'pkill -f "[s]erver_main.py" || true',
  'echo "FL Server stopped"',
].join(' && ');

export const aggregationServerStartCommand = (
  runtimeContract,
  campaign = null,
  campaignRun = null,
) => {
  if (runtimeContract?.name !== 'federated-task-v3') return classicServerStartCommand;
  const campaignEnvironment = campaignEnvironmentCommand(campaign, campaignRun);
  const preflight = campaign?.serverEvaluation
    ? 'cd /app/code && .venv/bin/python -m fedops.server.validation && ' : '';
  return campaignEnvironment
    ? `${campaignEnvironment} && ${preflight}${V3_START_COMMAND}`
    : V3_START_COMMAND;
};

export const aggregationServerStopCommand = (runtimeContract) => (
  runtimeContract?.name === 'federated-task-v3'
    ? V3_STOP_COMMAND
    : classicServerStopCommand
);
