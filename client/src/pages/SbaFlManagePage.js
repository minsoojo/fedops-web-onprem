import { downloadUrl } from '../lib/runtimeConfig';
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
} from '@mui/material';
import Chart from '../components/monitoring/Chart';
import serverControlAPI from '../lib/api/serverControlAPI';
import { readTask } from '../modules/task';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const statusColor = (state) => {
  if (state === 'finished') return '#757575';
  if (state === 'ready') return '#2e7d32';
  if (state === 'starting') return '#ef6c00';
  return '#c62828';
};

const StatusDot = ({ state }) => (
  <Box
    component="span"
    sx={{
      width: 12,
      height: 12,
      borderRadius: '50%',
      bgcolor: statusColor(state),
      display: 'inline-block',
      mr: 1,
    }}
  />
);

const metricValue = (item, camelKey, snakeKey) => item?.[camelKey] ?? item?.[snakeKey] ?? null;

export const createSbaFlChartData = (rounds = []) => ({
  labels: rounds.map((item) => `Round ${item.round}`),
  datasets: [
    {
      label: 'Distributed Loss',
      data: rounds.map((item) => metricValue(item, 'distributedLoss', 'distributed_loss')),
      borderColor: '#1565c0',
      backgroundColor: 'rgba(21, 101, 192, 0.2)',
    },
    {
      label: 'Fit Results',
      data: rounds.map((item) => metricValue(item, 'fitResults', 'fit_results')),
      borderColor: '#2e7d32',
      backgroundColor: 'rgba(46, 125, 50, 0.2)',
    },
    {
      label: 'Evaluate Results',
      data: rounds.map((item) => metricValue(item, 'evaluateResults', 'evaluate_results')),
      borderColor: '#ef6c00',
      backgroundColor: 'rgba(239, 108, 0, 0.2)',
    },
  ],
});

export const sbaFlChartOptions = {
  responsive: true,
  plugins: {
    legend: { position: 'top' },
    title: { display: true, text: 'SBA-FL Round Metrics' },
  },
  interaction: { mode: 'index', intersect: false },
};

const getReadyFlag = (status) => {
  if (typeof status?.infoStatus?.Server_Status?.FLSeReady === 'boolean') {
    return status.infoStatus.Server_Status.FLSeReady;
  }
  const readyStatus = status?.readyStatus;
  if (typeof readyStatus?.ready === 'boolean') return readyStatus.ready;
  if (typeof readyStatus?.fl_ready === 'boolean') return readyStatus.fl_ready;
  return false;
};

const getReadySourceText = (status) => {
  if (typeof status?.infoStatus?.Server_Status?.FLSeReady === 'boolean') {
    return 'FLSe/info response';
  }
  const readyStatus = status?.readyStatus;
  if (typeof readyStatus?.ready === 'boolean' || typeof readyStatus?.fl_ready === 'boolean') {
    return 'CheckServerReady response';
  }
  return 'No Python aggregation server response';
};

const getProcessRunningFlag = (status) => {
  const output = String(status?.processOutput || '').trim();
  if (!output) return false;
  return output
    .split('\n')
    .some((line) => !/<defunct>|\sZ\s/.test(line) && /server_main|main\.py/.test(line));
};

const getAggregationServerSourceText = (processRunning, recentStartRequested, readySourceText) => {
  if (processRunning) return 'process check';
  if (recentStartRequested) return 'start command';
  return readySourceText;
};

const parseSbaFlServerStartMs = (status) => {
  const value = status?.infoStatus?.Server_Status?.FLServer_start;
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
    0,
  );
};

const isCurrentSbaFlRunFinished = (summary, status, lastStartRequestedAt) => {
  if (!summary?.finished) return false;
  const finishedAt = Number(summary.finishedAtEpochMs || 0);
  const serverStartedAt = parseSbaFlServerStartMs(status);
  if (!Number.isFinite(finishedAt) || finishedAt <= 0) return false;
  if (lastStartRequestedAt > 0 && finishedAt < lastStartRequestedAt - 1000) return false;
  if (
    lastStartRequestedAt > 0 &&
    Number.isFinite(serverStartedAt) &&
    serverStartedAt > 0 &&
    serverStartedAt < lastStartRequestedAt - 1000
  ) {
    return false;
  }
  if (!Number.isFinite(serverStartedAt) || serverStartedAt <= 0) return true;
  return finishedAt >= serverStartedAt;
};

const getAggregationServerState = (ready, processRunning, recentStartRequested, summary, currentRunFinished) => {
  if (currentRunFinished) {
    return {
      key: 'finished',
      label: 'FINISHED',
      helper: '현재 연합학습 라운드 종료 확인',
    };
  }
  if (ready) {
    return {
      key: 'ready',
      label: 'READY / RUNNING',
      helper: '집계 서버 Python 코드 응답 확인',
    };
  }
  if (processRunning || recentStartRequested) {
    return {
      key: 'starting',
      label: processRunning ? 'STARTING / RUNNING' : 'START REQUESTED',
      helper: processRunning
        ? '집계 서버 Python 프로세스 실행 확인'
        : '집계 서버 시작 명령 실행 직후',
    };
  }
  if (summary?.finished) {
    return {
      key: 'finished',
      label: 'FINISHED',
      helper: '이전 연합학습 라운드 종료 확인',
    };
  }
  return {
    key: 'not_ready',
    label: 'NOT READY',
    helper: '집계 서버 Python 코드 응답 없음',
  };
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const getRoundLabel = (model) => {
  if (model.artifactType === 'latest') return 'Latest';
  if (model.artifactType === 'versionedLatest') return model.globalModelVersion || 'Versioned Latest';
  if (model.round != null) return `Round ${model.round}`;
  const match = String(model.name || '').match(/round_(\d+)/);
  return match ? `Round ${match[1]}` : '-';
};

const getArtifactLabel = (model) => {
  if (model.artifactType === 'latest') return 'Latest';
  if (model.artifactType === 'versionedLatest') return 'Latest Version';
  if (model.artifactType === 'runSnapshot') return 'Run Snapshot';
  return 'Round Snapshot';
};

const getArtifactColor = (model) => {
  if (model.artifactType === 'latest') return 'primary';
  if (model.artifactType === 'versionedLatest') return 'secondary';
  return 'default';
};

const SbaFlManagePage = ({ title }) => {
  const dispatch = useDispatch();
  const { task } = useSelector((state) => state.task);
  const { user } = useSelector((state) => state.user);
  const isAdmin = user?.isAdmin === true || user?.username === 'ccl@ccl.com';
  const isSbaFl = task?.title === title && task?.modelType === 'SBA-FL';

  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState(null);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [config, setConfig] = useState({ clientPerRound: '1', numRounds: '2', numEpochs: '3' });
  const [lastStartRequestedAt, setLastStartRequestedAt] = useState(0);

  const rounds = useMemo(
    () => history?.data?.rounds || history?.data?.round_metrics || [],
    [history],
  );
  const summary = history?.data?.summary || {};
  const ready = getReadyFlag(status);
  const processRunning = getProcessRunningFlag(status);
  const recentStartRequested = lastStartRequestedAt > 0 && Date.now() - lastStartRequestedAt < 60000;
  const readySourceText = getReadySourceText(status);
  const currentRunFinished = isCurrentSbaFlRunFinished(summary, status, lastStartRequestedAt);
  const aggregationServerState = getAggregationServerState(
    ready,
    processRunning,
    recentStartRequested,
    summary,
    currentRunFinished,
  );
  const aggregationServerSourceText = currentRunFinished
    ? 'Flower run summary'
    : getAggregationServerSourceText(
      processRunning,
      recentStartRequested,
      readySourceText,
    );
  const chartData = useMemo(() => createSbaFlChartData(rounds), [rounds]);
  const sortedModels = useMemo(
    () => [...models].sort((a, b) => {
      const aTime = a.modifiedEpochMs || 0;
      const bTime = b.modifiedEpochMs || 0;
      if (aTime !== bTime) return bTime - aTime;
      if (a.artifactType === b.artifactType) return String(a.name).localeCompare(String(b.name));
      return a.artifactType === 'latest' ? -1 : 1;
    }),
    [models],
  );

  const refresh = async () => {
    if (!isAdmin || !isSbaFl) return;
    setLoading(true);
    setMessage('');
    try {
      const [statusResult, historyResult, modelsResult] = await Promise.all([
        serverControlAPI.getSbaFlStatus(title),
        serverControlAPI.getSbaFlHistory(title),
        serverControlAPI.getSbaFlModels(title),
      ]);
      setStatus(statusResult);
      setHistory(historyResult);
      setModels(modelsResult.models || []);
      setConfig({
        clientPerRound: String(statusResult.taskConfig?.clientPerRound || '1'),
        numRounds: String(statusResult.taskConfig?.numRounds || '2'),
        numEpochs: String(statusResult.taskConfig?.numEpochs || '3'),
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    dispatch(readTask(title));
  }, [dispatch, title]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isSbaFl, title]);

  const runAction = async (action) => {
    setLoading(true);
    setMessage('');
    try {
      if (action === 'start') {
        await serverControlAPI.startFLServer(title);
        setLastStartRequestedAt(Date.now());
        setMessage('SBA-FL aggregation server start command executed.');
      } else if (action === 'stop') {
        await serverControlAPI.stopFLServer(title);
        setLastStartRequestedAt(0);
        setMessage('SBA-FL aggregation server stop command executed.');
      } else if (action === 'config') {
        await serverControlAPI.updateSbaFlConfig(title, config);
        setMessage('SBA-FL server config updated.');
      }
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin || !isSbaFl) {
    return (
      <Alert severity="warning">
        SBA-FL Manage is available only for Admin users and SBA-FL tasks.
      </Alert>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">SBA-FL Manage</Typography>
        <Button variant="outlined" onClick={refresh} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      {loading && <CircularProgress size={24} sx={{ mb: 2 }} />}
      {message && <Alert severity={message.includes('failed') || message.includes('Failed') ? 'error' : 'info'} sx={{ mb: 2 }}>{message}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Aggregation Server</Typography>
              <Typography>
                <StatusDot state={aggregationServerState.key} />
                {aggregationServerState.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                기준: {aggregationServerState.helper} ({aggregationServerSourceText})
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Task: {title}
              </Typography>
              <Typography variant="body2">
                Target: {status?.taskConfig?.sbaFlTarget || '-'}
              </Typography>
              <Typography variant="body2">
                Address: {status?.connectionInfo?.server_address || '-'}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button variant="contained" onClick={() => runAction('start')} disabled={loading}>
                  Start
                </Button>
                <Button variant="outlined" color="error" onClick={() => runAction('stop')} disabled={loading}>
                  Stop
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Run Config</Typography>
              <Stack spacing={1}>
                <TextField
                  size="small"
                  label="Participating Clients"
                  value={config.clientPerRound}
                  onChange={(event) => setConfig({ ...config, clientPerRound: event.target.value })}
                />
                <TextField
                  size="small"
                  label="Rounds"
                  value={config.numRounds}
                  onChange={(event) => setConfig({ ...config, numRounds: event.target.value })}
                />
                <TextField
                  size="small"
                  label="Local Epochs"
                  value={config.numEpochs}
                  onChange={(event) => setConfig({ ...config, numEpochs: event.target.value })}
                />
                <Button variant="contained" onClick={() => runAction('config')} disabled={loading}>
                  Save Config
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Local epochs are sent through the server fit config and applied by the updated Android weight FL client.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Clients / History</Typography>
              <Typography variant="body2">
                Available clients: {status?.availableClients?.available_clients?.length || 0}
              </Typography>
              <Typography variant="body2">
                Finished: {summary.finished ? 'yes' : 'no'}
              </Typography>
              <Typography variant="body2">
                Duration: {summary.durationSeconds ?? '-'}s
              </Typography>
              <Typography variant="body2">
                Global model saved: {summary.globalModelSaved ? 'yes' : 'no'}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                {(status?.availableClients?.available_clients || []).map((client) => (
                  <Chip key={client.device_mac || client.Device_mac} label={client.device_mac || client.Device_mac || 'client'} size="small" />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Monitoring</Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Distributed Loss는 서버가 라운드별로 집계한 손실값, Fit Results는 해당 라운드에서
                수신한 클라이언트 학습 결과 수, Evaluate Results는 수신한 평가 결과 수를 의미합니다.
              </Alert>
              {rounds.length > 0 ? (
                <Chart data={chartData} options={sbaFlChartOptions} />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No SBA-FL round metrics yet. Start the aggregation server and let an on-device client participate.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>Global Models</Typography>
          <TableContainer component={Paper} sx={{ maxHeight: 360, overflowY: 'auto' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Created At</TableCell>
                  <TableCell>Artifact</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Run</TableCell>
                  <TableCell>Round</TableCell>
                  <TableCell>File</TableCell>
                  <TableCell>Model</TableCell>
                  <TableCell>Tensors</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Download</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedModels.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10}>No SBA-FL global model artifacts found.</TableCell>
                  </TableRow>
                )}
                {sortedModels.map((model) => (
                  <TableRow key={model.name}>
                    <TableCell>{formatDateTime(model.savedAtIso || model.modifiedEpochMs || model.modifiedIso)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={getArtifactColor(model)}
                        label={getArtifactLabel(model)}
                      />
                    </TableCell>
                    <TableCell>{model.globalModelVersion || '-'}</TableCell>
                    <TableCell>{model.runId || '-'}</TableCell>
                    <TableCell>{getRoundLabel(model)}</TableCell>
                    <TableCell>{model.name}</TableCell>
                    <TableCell>{model.modelType || '-'}</TableCell>
                    <TableCell>{model.tensorCount ?? '-'}</TableCell>
                    <TableCell>{model.sizeBytes} bytes</TableCell>
                    <TableCell>
                      <Button href={downloadUrl(model.url)} target="_blank" rel="noopener noreferrer">
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SbaFlManagePage;
