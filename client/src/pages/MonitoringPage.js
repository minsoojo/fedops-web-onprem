import EvaluationSummary from '../components/monitoring/EvaluationSummary';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import MetricPanel from '../components/monitoring/MetricPanel';
import MonitoringSummary from '../components/monitoring/MonitoringSummary';
import * as tasksAPI from '../lib/api/tasks';

const AUTO_REFRESH_INTERVAL_MS = 15_000;

const statusMeta = {
  not_started: { label: 'Not started', color: 'default' },
  preparing: { label: 'Preparing', color: 'info' },
  ready: { label: 'Ready', color: 'warning' },
  training: { label: 'Training', color: 'success' },
  paused: { label: 'Paused', color: 'warning' },
  completed: { label: 'Completed', color: 'primary' },
  failed: { label: 'Failed', color: 'error' },
};

const colors = {
  cyan: '#3ba6f1',
  cyanFill: 'rgba(59, 166, 241, 0.12)',
  green: '#2f855a',
  greenFill: 'rgba(47, 133, 90, 0.10)',
  orange: '#c26a17',
  orangeFill: 'rgba(194, 106, 23, 0.10)',
  violet: '#7c5ce5',
  violetFill: 'rgba(124, 92, 229, 0.10)',
  slate: '#64748b',
  slateFill: 'rgba(100, 116, 139, 0.10)',
};

const asNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDate = (value) => {
  if (!value) return 'Not observed yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const formatCount = (value) => (
  Number.isFinite(value) ? value.toLocaleString() : '—'
);

const formatAccuracy = (value) => {
  if (!Number.isFinite(value)) return '—';
  return value >= 0 && value <= 1
    ? `${(value * 100).toFixed(2)}%`
    : `${value.toFixed(2)}%`;
};

const formatLoss = (value) => (
  Number.isFinite(value) ? value.toFixed(4) : '—'
);

const formatDuration = (value) => (
  Number.isFinite(value) ? `${value.toFixed(1)}s` : '—'
);

const formatDelta = (value, type) => {
  if (!Number.isFinite(value)) return 'No previous round';
  const sign = value > 0 ? '+' : '';
  if (type === 'accuracy') {
    const percentagePoints = Math.abs(value) <= 1 ? value * 100 : value;
    return `${sign}${percentagePoints.toFixed(2)} pp vs previous`;
  }
  return `${sign}${value.toFixed(4)} vs previous`;
};

const metricTone = (value, positiveIsGood = true) => {
  if (!Number.isFinite(value) || value === 0) return 'default';
  const favorable = positiveIsGood ? value > 0 : value < 0;
  return favorable ? 'success' : 'warning';
};

const lineDataset = ({
  label,
  data,
  color,
  backgroundColor,
}) => ({
  label,
  data,
  borderColor: color,
  backgroundColor,
  borderWidth: 2,
  pointRadius: 2,
  pointHoverRadius: 5,
  pointBackgroundColor: color,
  tension: 0.18,
  fill: false,
  spanGaps: true,
});

const createRoundChart = (series, metrics) => ({
  labels: series.map((point) => point.round),
  datasets: metrics.map((metric) => lineDataset({
    label: metric.label,
    data: series.map((point) => point[metric.field]),
    color: metric.color,
    backgroundColor: metric.backgroundColor,
  })),
});

const createRuntimeChart = (series, metrics) => ({
  labels: series.map((point) => (
    Number.isFinite(point.runtimeSeconds)
      ? point.runtimeSeconds.toFixed(0)
      : '—'
  )),
  datasets: metrics.map((metric) => lineDataset({
    label: metric.label,
    data: series.map((point) => metric.transform
      ? metric.transform(point[metric.field])
      : point[metric.field]),
    color: metric.color,
    backgroundColor: metric.backgroundColor,
  })),
});

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  return /[",\n]/.test(stringValue)
    ? `"${stringValue.replaceAll('"', '""')}"`
    : stringValue;
};

const downloadCsv = (filename, rows, columns) => {
  const csv = [
    columns.map((column) => escapeCsvValue(column.label)).join(','),
    ...rows.map((row) => columns
      .map((column) => escapeCsvValue(row[column.field]))
      .join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const SectionHeader = ({ icon, title, description, action }) => (
  <Stack
    direction={{ xs: 'column', sm: 'row' }}
    justifyContent="space-between"
    alignItems={{ xs: 'stretch', sm: 'flex-start' }}
    spacing={2}
    sx={{ mb: 2 }}
  >
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box
        sx={{
          width: 34,
          height: 34,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1,
          color: 'primary.dark',
          backgroundColor: 'primary.light',
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {description}
        </Typography>
      </Box>
    </Stack>
    {action}
  </Stack>
);

const MonitoringSkeleton = () => (
  <Stack spacing={3}>
    <Skeleton variant="rounded" height={170} />
    <Grid container spacing={1.5}>
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <Grid item xs={6} sm={4} lg={2} key={item}>
          <Skeleton variant="rounded" height={116} />
        </Grid>
      ))}
    </Grid>
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}><Skeleton variant="rounded" height={390} /></Grid>
      <Grid item xs={12} md={6}><Skeleton variant="rounded" height={390} /></Grid>
    </Grid>
  </Stack>
);

const ClientSummaryTable = ({
  clients,
  selectedClientId,
  onSelectClient,
}) => {
  if (!clients.length) {
    return (
      <Alert severity="info">
        No client training results are available for this model version yet.
      </Alert>
    );
  }

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ borderColor: 'divider' }}
    >
      <Table size="small" aria-label="Client performance summary">
        <TableHead>
          <TableRow>
            <TableCell>Client</TableCell>
            <TableCell align="right">Round</TableCell>
            <TableCell align="right">Train accuracy</TableCell>
            <TableCell align="right">Validation</TableCell>
            <TableCell align="right">Test accuracy</TableCell>
            <TableCell align="right">Train time</TableCell>
            <TableCell>Last reported</TableCell>
            <TableCell align="right" />
          </TableRow>
        </TableHead>
        <TableBody>
          {clients.map((client) => (
            <TableRow
              hover
              key={client.id}
              selected={selectedClientId === client.id}
              sx={{ '&:last-child td': { borderBottom: 0 } }}
            >
              <TableCell>
                <Typography variant="body2" fontWeight={500}>
                  {client.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {client.deviceLabel}
                </Typography>
              </TableCell>
              <TableCell align="right">{formatCount(client.lastRound)}</TableCell>
              <TableCell align="right">{formatAccuracy(client.trainAccuracy)}</TableCell>
              <TableCell align="right">{formatAccuracy(client.validationAccuracy)}</TableCell>
              <TableCell align="right">{formatAccuracy(client.testAccuracy)}</TableCell>
              <TableCell align="right">{formatDuration(client.trainTimeSeconds)}</TableCell>
              <TableCell>
                <Typography variant="caption">{formatDate(client.lastSeenAt)}</Typography>
              </TableCell>
              <TableCell align="right">
                <Button
                  size="small"
                  variant="text"
                  onClick={() => onSelectClient(client.id)}
                >
                  Inspect
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const MonitoringPage = ({ title: titleProp }) => {
  const params = useParams();
  const title = titleProp || params.title;
  const [searchParams, setSearchParams] = useSearchParams();
  const initialVersion = asNumber(searchParams.get('version'));
  const [selectedModelVersion, setSelectedModelVersion] = useState(initialVersion);
  const [selectedClientId, setSelectedClientId] = useState(
    searchParams.get('client') || 'all',
  );
  const [roundLimit, setRoundLimit] = useState(searchParams.get('rounds') || '25');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);
  const hasSnapshot = useRef(false);

  const loadMonitoring = useCallback(async ({ background = false } = {}) => {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    if (background || hasSnapshot.current) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await tasksAPI.readTaskMonitoring({
        title,
        modelVersion: selectedModelVersion,
        clientId: selectedClientId,
        rounds: roundLimit,
      });
      if (requestId !== requestSequence.current) return;
      const nextSnapshot = response.data;
      setSnapshot(nextSnapshot);
      hasSnapshot.current = true;
      setError('');

      const resolvedVersion = nextSnapshot.context?.selectedModelVersion;
      if (resolvedVersion !== selectedModelVersion) {
        setSelectedModelVersion(resolvedVersion);
      }
      const resolvedClient = nextSnapshot.context?.selectedClientId || 'all';
      if (resolvedClient !== selectedClientId) {
        setSelectedClientId(resolvedClient);
      }
    } catch (requestError) {
      if (requestId !== requestSequence.current) return;
      setError(
        requestError.response?.data?.message
        || 'Monitoring data could not be loaded.',
      );
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    roundLimit,
    selectedClientId,
    selectedModelVersion,
    title,
  ]);

  useEffect(() => {
    loadMonitoring();
  }, [loadMonitoring]);

  useEffect(() => {
    const nextParams = {};
    if (selectedModelVersion !== null) nextParams.version = String(selectedModelVersion);
    if (selectedClientId !== 'all') nextParams.client = selectedClientId;
    nextParams.rounds = String(roundLimit);
    setSearchParams(nextParams, { replace: true });
  }, [
    roundLimit,
    selectedClientId,
    selectedModelVersion,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const interval = window.setInterval(() => {
      loadMonitoring({ background: true });
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [autoRefresh, loadMonitoring]);

  const context = snapshot?.context || {};
  const run = snapshot?.run || {};
  const participants = snapshot?.participants || {};
  const summary = snapshot?.summary || {};
  const globalSeries = useMemo(
    () => snapshot?.globalSeries || [],
    [snapshot?.globalSeries],
  );
  const clientSummaries = useMemo(
    () => snapshot?.clientSummaries || [],
    [snapshot?.clientSummaries],
  );
  const selectedClientSeries = useMemo(
    () => snapshot?.selectedClientSeries || {
      train: [],
      test: [],
      system: [],
    },
    [snapshot?.selectedClientSeries],
  );
  const status = statusMeta[run.status] || {
    label: run.status || 'Unknown',
    color: 'default',
  };
  const selectedClient = context.clients?.find(
    (client) => client.id === selectedClientId,
  );
  const latestGlobal = summary.latestGlobal;
  const progress = Number.isFinite(run.progressPercent) ? run.progressPercent : null;
  const completed = participants.completedCurrentRound;
  const selected = participants.selectedThisRun;
  const latestTrain = selectedClientSeries.train.at(-1) || null;
  const latestTest = selectedClientSeries.test.at(-1) || null;

  const globalSummaryItems = [
    {
      label: 'Communication round',
      value: `${run.currentRound || 0} / ${run.totalRounds || '—'}`,
      helper: Number.isFinite(progress) ? `${progress}% complete` : 'Target round unavailable',
      progress,
    },
    {
      label: 'Global accuracy',
      value: formatAccuracy(latestGlobal?.accuracy),
      helper: formatDelta(summary.accuracyDelta, 'accuracy'),
      tone: metricTone(summary.accuracyDelta, true),
    },
    {
      label: 'Global loss',
      value: formatLoss(latestGlobal?.loss),
      helper: formatDelta(summary.lossDelta, 'loss'),
      tone: metricTone(summary.lossDelta, false),
    },
    {
      label: 'Clients completed',
      value: `${formatCount(completed)} / ${formatCount(selected)}`,
      helper: `${formatCount(participants.onlineDevices)} online now`,
    },
    {
      label: 'Round duration',
      value: formatDuration(latestGlobal?.roundTimeSeconds),
      helper: `${formatDuration(summary.averageRoundTimeSeconds)} average`,
    },
    {
      label: 'Global model',
      value: selectedModelVersion !== null ? `v${selectedModelVersion}` : '—',
      helper: run.latestModelVersion
        ? `Latest available v${run.latestModelVersion}`
        : 'No model version yet',
    },
  ];
  const clientSummaryItems = selectedClient ? [
    {
      label: 'Client round',
      value: formatCount(Math.max(latestTrain?.round || 0, latestTest?.round || 0)),
      helper: `${selectedClient.name} · ${selectedClient.deviceLabel}`,
    },
    {
      label: 'Train accuracy',
      value: formatAccuracy(latestTrain?.trainAccuracy),
      helper: 'Latest local training result',
    },
    {
      label: 'Validation accuracy',
      value: formatAccuracy(latestTrain?.validationAccuracy),
      helper: 'Latest local validation result',
    },
    {
      label: 'Test accuracy',
      value: formatAccuracy(latestTest?.testAccuracy),
      helper: 'Latest local test result',
    },
    {
      label: 'Train loss',
      value: formatLoss(latestTrain?.trainLoss),
      helper: `Validation ${formatLoss(latestTrain?.validationLoss)}`,
    },
    {
      label: 'Local train duration',
      value: formatDuration(latestTrain?.trainTimeSeconds),
      helper: selectedModelVersion !== null
        ? `Global Model v${selectedModelVersion} Campaign`
        : 'Model version unavailable',
    },
  ] : [];
  const summaryItems = selectedClient ? clientSummaryItems : globalSummaryItems;

  const globalAccuracyData = useMemo(() => createRoundChart(globalSeries, [{
    label: 'Global accuracy',
    field: 'accuracy',
    color: colors.green,
    backgroundColor: colors.greenFill,
  }]), [globalSeries]);
  const globalLossData = useMemo(() => createRoundChart(globalSeries, [{
    label: 'Global loss',
    field: 'loss',
    color: colors.violet,
    backgroundColor: colors.violetFill,
  }]), [globalSeries]);
  const roundDurationData = useMemo(() => createRoundChart(globalSeries, [{
    label: 'Round duration',
    field: 'roundTimeSeconds',
    color: colors.cyan,
    backgroundColor: colors.cyanFill,
  }]), [globalSeries]);

  const trainAccuracyData = useMemo(() => createRoundChart(
    selectedClientSeries.train,
    [
      {
        label: 'Train accuracy',
        field: 'trainAccuracy',
        color: colors.cyan,
        backgroundColor: colors.cyanFill,
      },
      {
        label: 'Validation accuracy',
        field: 'validationAccuracy',
        color: colors.green,
        backgroundColor: colors.greenFill,
      },
    ],
  ), [selectedClientSeries.train]);
  const trainLossData = useMemo(() => createRoundChart(
    selectedClientSeries.train,
    [
      {
        label: 'Train loss',
        field: 'trainLoss',
        color: colors.violet,
        backgroundColor: colors.violetFill,
      },
      {
        label: 'Validation loss',
        field: 'validationLoss',
        color: colors.orange,
        backgroundColor: colors.orangeFill,
      },
    ],
  ), [selectedClientSeries.train]);
  const testAccuracyData = useMemo(() => createRoundChart(
    selectedClientSeries.test,
    [{
      label: 'Test accuracy',
      field: 'testAccuracy',
      color: colors.green,
      backgroundColor: colors.greenFill,
    }],
  ), [selectedClientSeries.test]);
  const testLossData = useMemo(() => createRoundChart(
    selectedClientSeries.test,
    [{
      label: 'Test loss',
      field: 'testLoss',
      color: colors.orange,
      backgroundColor: colors.orangeFill,
    }],
  ), [selectedClientSeries.test]);
  const trainDurationData = useMemo(() => createRoundChart(
    selectedClientSeries.train,
    [{
      label: 'Train duration',
      field: 'trainTimeSeconds',
      color: colors.slate,
      backgroundColor: colors.slateFill,
    }],
  ), [selectedClientSeries.train]);

  const cpuData = useMemo(() => createRuntimeChart(
    selectedClientSeries.system,
    [{
      label: 'CPU utilization',
      field: 'cpuUtilization',
      color: colors.cyan,
      backgroundColor: colors.cyanFill,
    }],
  ), [selectedClientSeries.system]);
  const memoryData = useMemo(() => createRuntimeChart(
    selectedClientSeries.system,
    [
      {
        label: 'System memory',
        field: 'memoryUtilization',
        color: colors.violet,
        backgroundColor: colors.violetFill,
      },
      {
        label: 'Process memory',
        field: 'processMemoryPercent',
        color: colors.orange,
        backgroundColor: colors.orangeFill,
      },
    ],
  ), [selectedClientSeries.system]);
  const networkData = useMemo(() => createRuntimeChart(
    selectedClientSeries.system,
    [
      {
        label: 'Sent',
        field: 'networkSentBytes',
        transform: (value) => Number.isFinite(value) ? value / (1024 * 1024) : null,
        color: colors.cyan,
        backgroundColor: colors.cyanFill,
      },
      {
        label: 'Received',
        field: 'networkReceivedBytes',
        transform: (value) => Number.isFinite(value) ? value / (1024 * 1024) : null,
        color: colors.green,
        backgroundColor: colors.greenFill,
      },
    ],
  ), [selectedClientSeries.system]);
  const diskData = useMemo(() => createRuntimeChart(
    selectedClientSeries.system,
    [{
      label: 'Disk utilization',
      field: 'diskUtilization',
      color: colors.orange,
      backgroundColor: colors.orangeFill,
    }],
  ), [selectedClientSeries.system]);

  const accuracyOptions = {
    scales: {
      y: {
        ticks: {
          callback: (value) => (
            Math.abs(value) <= 1 ? `${(value * 100).toFixed(0)}%` : `${value}%`
          ),
        },
      },
    },
  };
  const percentOptions = {
    scales: {
      y: {
        suggestedMin: 0,
        suggestedMax: 100,
        ticks: { callback: (value) => `${value}%` },
      },
      x: {
        title: { display: true, text: 'Client runtime (seconds)' },
      },
    },
  };
  const runtimeOptions = {
    scales: {
      x: {
        title: { display: true, text: 'Client runtime (seconds)' },
      },
    },
  };

  if (loading && !snapshot) return <MonitoringSkeleton />;

  if (!snapshot && error) {
    return (
      <Alert
        severity="error"
        action={(
          <Button color="inherit" size="small" onClick={() => loadMonitoring()}>
            Retry
          </Button>
        )}
      >
        {error}
      </Alert>
    );
  }

  return (
    <Stack spacing={4}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, md: 3 },
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', lg: 'flex-start' }}
          spacing={3}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <QueryStatsOutlinedIcon color="primary" />
              <Typography variant="h5" component="h2">Monitoring</Typography>
              <Chip size="small" color={status.color} label={status.label} variant="outlined" />
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 720 }}>
              Federated training progress, client performance, and system health.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Metric data updated {formatDate(run.lastUpdatedAt)} · Snapshot observed{' '}
              {formatDate(context.observedAt)}
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              component={Link}
              to={`/fedops/task/${encodeURIComponent(title)}/global-model`}
              variant="outlined"
              startIcon={<Inventory2OutlinedIcon />}
            >
              Global models
            </Button>
            <Button
              component={Link}
              to={`/fedops/task/${encodeURIComponent(title)}/server-management`}
              variant="outlined"
              startIcon={<StorageOutlinedIcon />}
            >
              Server Management
            </Button>
          </Stack>
        </Stack>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', md: 'center' }}
          sx={{
            mt: 3,
            pt: 2.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Model version</InputLabel>
            <Select
              label="Model version"
              value={selectedModelVersion ?? ''}
              onChange={(event) => {
                setSelectedModelVersion(asNumber(event.target.value));
                setSelectedClientId('all');
              }}
            >
              {(context.availableModelVersions || []).map((version) => (
                <MenuItem value={version} key={version}>Model v{version}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Client</InputLabel>
            <Select
              label="Client"
              value={selectedClientId}
              onChange={(event) => setSelectedClientId(event.target.value)}
            >
              <MenuItem value="all">All clients</MenuItem>
              {(context.clients || []).map((client) => (
                <MenuItem value={client.id} key={client.id}>
                  {client.name} · {client.deviceLabel}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Round range</InputLabel>
            <Select
              label="Round range"
              value={String(roundLimit)}
              onChange={(event) => setRoundLimit(event.target.value)}
            >
              <MenuItem value="10">Last 10</MenuItem>
              <MenuItem value="25">Last 25</MenuItem>
              <MenuItem value="50">Last 50</MenuItem>
              <MenuItem value="all">All available</MenuItem>
            </Select>
          </FormControl>

          <Stack
            direction="row"
            alignItems="center"
            justifyContent={{ xs: 'space-between', md: 'flex-start' }}
            sx={{ ml: { md: 'auto' } }}
          >
            <Typography variant="body2" color="text.secondary">Auto refresh</Typography>
            <Switch
              size="small"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              inputProps={{ 'aria-label': 'Toggle automatic monitoring refresh' }}
            />
            <Button
              size="small"
              variant="text"
              disabled={refreshing}
              startIcon={refreshing
                ? <CircularProgress size={15} />
                : <RefreshRoundedIcon />}
              onClick={() => loadMonitoring({ background: true })}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error && snapshot && (
        <Alert severity="warning">
          The latest refresh failed. The last successful snapshot remains visible: {error}
        </Alert>
      )}

      <MonitoringSummary items={summaryItems} />
      {!selectedClient && <EvaluationSummary point={latestGlobal} />}

      {!selectedClient && <Box>
        <SectionHeader
          icon={<TimelineOutlinedIcon fontSize="small" />}
          title="Overview"
          description="Global model quality and communication-round duration for this model version."
        />
        <Grid container spacing={2} alignItems="stretch">
          <Grid item xs={12} md={6}>
            <MetricPanel
              title="Global accuracy"
              description="Aggregated model evaluation by communication round."
              value={formatAccuracy(latestGlobal?.accuracy)}
              data={globalAccuracyData}
              options={accuracyOptions}
              onExport={() => downloadCsv(
                `${title}-v${selectedModelVersion}-global-accuracy.csv`,
                globalSeries,
                [
                  { label: 'round', field: 'round' },
                  { label: 'model_version', field: 'modelVersion' },
                  { label: 'accuracy', field: 'accuracy' },
                  { label: 'observed_at', field: 'observedAt' },
                ],
              )}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <MetricPanel
              title="Global loss"
              description="Aggregated model loss by communication round."
              value={formatLoss(latestGlobal?.loss)}
              data={globalLossData}
              onExport={() => downloadCsv(
                `${title}-v${selectedModelVersion}-global-loss.csv`,
                globalSeries,
                [
                  { label: 'round', field: 'round' },
                  { label: 'model_version', field: 'modelVersion' },
                  { label: 'loss', field: 'loss' },
                  { label: 'observed_at', field: 'observedAt' },
                ],
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <MetricPanel
              title="Round duration"
              description="Elapsed server time for each completed communication round."
              value={formatDuration(latestGlobal?.roundTimeSeconds)}
              data={roundDurationData}
              onExport={() => downloadCsv(
                `${title}-v${selectedModelVersion}-round-duration.csv`,
                globalSeries,
                [
                  { label: 'round', field: 'round' },
                  { label: 'round_time_seconds', field: 'roundTimeSeconds' },
                  { label: 'observed_at', field: 'observedAt' },
                ],
              )}
            />
          </Grid>
        </Grid>
      </Box>}

      <Box>
        <SectionHeader
          icon={<GroupsOutlinedIcon fontSize="small" />}
          title="Client performance"
          description={selectedClient
            ? `Local training, validation, and test metrics reported by ${selectedClient.name}. Global metrics are available again under All clients.`
            : 'Compare the latest local result from every client, then inspect one client in detail.'}
          action={selectedClient && (
            <Button variant="text" onClick={() => setSelectedClientId('all')}>
              Back to all clients
            </Button>
          )}
        />

        {!selectedClient ? (
          <ClientSummaryTable
            clients={clientSummaries}
            selectedClientId={selectedClientId}
            onSelectClient={setSelectedClientId}
          />
        ) : (
          <Grid container spacing={2} alignItems="stretch">
            <Grid item xs={12} md={6}>
              <MetricPanel
                title="Train & validation accuracy"
                description="Local accuracy reported after each selected round."
                value={formatAccuracy(latestTrain?.trainAccuracy)}
                data={trainAccuracyData}
                options={accuracyOptions}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <MetricPanel
                title="Train & validation loss"
                description="Local optimization loss reported by the client."
                value={formatLoss(latestTrain?.trainLoss)}
                data={trainLossData}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <MetricPanel
                title="Test accuracy"
                description="Local test-set accuracy by communication round."
                value={formatAccuracy(latestTest?.testAccuracy)}
                data={testAccuracyData}
                options={accuracyOptions}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <MetricPanel
                title="Test loss"
                description="Local test-set loss by communication round."
                value={formatLoss(latestTest?.testLoss)}
                data={testLossData}
              />
            </Grid>
            <Grid item xs={12}>
              <MetricPanel
                title="Local train duration"
                description="Elapsed local training time for each selected round."
                value={formatDuration(latestTrain?.trainTimeSeconds)}
                data={trainDurationData}
              />
            </Grid>
          </Grid>
        )}
      </Box>

      <Box>
        <SectionHeader
          icon={<MemoryOutlinedIcon fontSize="small" />}
          title="Selected client system"
          description="Device telemetry is shown only for the selected client and is separate from FL server or Pod metrics."
        />
        {!selectedClient ? (
          <Alert severity="info">
            Select a client from the table or filter above to inspect CPU, memory, network,
            and disk telemetry.
          </Alert>
        ) : (
          <Grid container spacing={2} alignItems="stretch">
            <Grid item xs={12} md={6}>
              <MetricPanel
                title="CPU utilization"
                description="Process CPU usage over client runtime."
                data={cpuData}
                options={percentOptions}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <MetricPanel
                title="Memory utilization"
                description="System and FL process memory utilization."
                data={memoryData}
                options={percentOptions}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <MetricPanel
                title="Network traffic"
                description="Cumulative network traffic reported by the client (MiB)."
                data={networkData}
                options={runtimeOptions}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <MetricPanel
                title="Disk utilization"
                description="Client system disk utilization over runtime."
                data={diskData}
                options={percentOptions}
              />
            </Grid>
          </Grid>
        )}
      </Box>

      {snapshot.source?.estimated && (
        <Alert severity="info" variant="outlined">
          Current progress is derived from the legacy Task state, FL result logs, and
          available Server Manager aggregates. A persistent Training Run timeline will be
          added in the next monitoring phase.
        </Alert>
      )}
    </Stack>
  );
};

export default MonitoringPage;
