import React, { useCallback, useEffect, useRef, useState } from 'react';
import isEqual from 'lodash/isEqual';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import MemoryOutlinedIcon from '@mui/icons-material/MemoryOutlined';
import PauseCircleOutlineRoundedIcon from '@mui/icons-material/PauseCircleOutlineRounded';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded';
import serverControlAPI from '../../lib/api/serverControlAPI';
import LogStreamer from './LogStreamer';
import { runtimeCreationState } from './runtimeCreation';

const formatOutput = (value, fallback = '') => {
  if (value === null || value === undefined || value === '') return fallback;
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
};

const firstAvailable = (...values) => values.find(
  (value) => value !== null && value !== undefined && value !== '',
);

const ALLOCATION_POLL_INTERVAL_MS = 2500;
const ALLOCATION_POLL_TIMEOUT_MS = 3 * 60 * 1000;
const RUNTIME_POLL_INTERVAL_MS = 5000;
const VALIDATION_UPLOAD_GUIDANCE = 'In Agent Studio, open this Task’s Server Validation Data and upload a validation dataset. Then refresh and select it here.';

const validationErrorMessage = (message) => {
  const text = String(message || 'Evaluation check failed.');
  const missingData = /validation directory is empty|validation loader contains no evaluation batches|requires a connected server data directory|dataset not found/i.test(text)
    || (/no such file or directory|not found/i.test(text) && /server-validation|validation data/i.test(text));
  return missingData ? `Validation data is missing or empty. ${VALIDATION_UPLOAD_GUIDANCE}` : text;
};

const validationDatasetLabel = ({ dataPath, fileCount }) => {
  const id = String(dataPath || '').replace(/^validation-/, '');
  const shortId = id.length > 12 ? `${id.slice(0, 8)}…` : id;
  return `Dataset ${shortId}${fileCount != null ? ` · ${fileCount} files` : ''}`;
};

const allocationState = ({ serverStatus, connectionInfo, readyStatus } = {}) => {
  const deployment = serverStatus?.deployment || {};
  const pvc = serverStatus?.pvc || {};
  const runtime = serverStatus?.fl_server_status || {};
  const port = firstAvailable(connectionInfo?.port, runtime.port);
  const externalIp = firstAvailable(connectionInfo?.external_ip, runtime.external_ip);
  const status = String(firstAvailable(
    readyStatus?.status,
    connectionInfo?.status,
    runtime.status,
    '',
  )).toLowerCase();
  const complete = Boolean(
    !deployment.error
    && Number(deployment.replicas) > 0
    && Number(deployment.ready_replicas) >= Number(deployment.replicas)
    && (serverStatus?.pods || []).some(pod => pod.phase === 'Running' && pod.ready === true)
    && port
    && externalIp
    && firstAvailable(connectionInfo?.service_name, runtime.service_name)
    && firstAvailable(connectionInfo?.deployment, runtime.deployment)
    && firstAvailable(runtime.pvc, pvc.name)
    && firstAvailable(runtime.cpu)
    && firstAvailable(runtime.memory),
  );
  const failed = status.includes('error') || status.includes('failed');
  const started = Boolean(
    complete
    || failed
    || status.includes('creating')
    || status.includes('initializing')
    || (!deployment.error && Object.keys(deployment).length > 0),
  );
  return { complete, failed, started, status };
};

const SectionHeader = ({
  icon,
  title,
  description,
  action,
  sx,
}) => (
  <Stack
    direction={{ xs: 'column', sm: 'row' }}
    justifyContent="space-between"
    alignItems={{ xs: 'stretch', sm: 'flex-start' }}
    spacing={2}
    sx={{ mb: 2.5, ...sx }}
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
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {description}
          </Typography>
        )}
      </Box>
    </Stack>
    {action}
  </Stack>
);

const StatusCard = ({
  label,
  value,
  detail,
  tone = 'default',
}) => {
  const toneStyles = tone === 'success'
    ? { color: '#166534', backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }
    : tone === 'warning'
      ? { color: '#854d0e', backgroundColor: '#fefce8', borderColor: '#fef08a' }
      : { color: 'text.primary', backgroundColor: '#fafaf9', borderColor: 'divider' };

  return (
    <Box
      sx={{
        height: '100%',
        p: 2,
        border: '1px solid',
        borderRadius: 1,
        ...toneStyles,
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={600} sx={{ mt: 0.75 }}>
        {value}
      </Typography>
      <Typography
        variant="caption"
        sx={{ display: 'block', mt: 0.25, color: 'text.secondary' }}
      >
        {detail}
      </Typography>
    </Box>
  );
};

const DetailItem = ({
  label,
  value,
  monospace = false,
}) => (
  <Box
    sx={{
      height: '100%',
      p: 1.75,
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 1,
      backgroundColor: 'background.paper',
    }}
  >
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography
      variant="body2"
      fontWeight={600}
      sx={{
        mt: 0.5,
        overflowWrap: 'anywhere',
        ...(monospace && {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '0.78rem',
        }),
      }}
    >
      {formatOutput(value, 'Not allocated')}
    </Typography>
  </Box>
);

const TerminalOutput = ({ value, emptyMessage }) => (
  <Box
    component="pre"
    sx={{
      minHeight: 112,
      maxHeight: 360,
      m: 0,
      p: 2,
      overflow: 'auto',
      color: value ? '#e7e5e4' : '#78716c',
      backgroundColor: '#1c1917',
      border: '1px solid #292524',
      borderRadius: 1,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '0.75rem',
      lineHeight: 1.65,
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
    }}
  >
    {formatOutput(value, emptyMessage)}
  </Box>
);

const ServerControl = ({ taskId }) => {
  const [serverStatus, setServerStatus] = useState(null);
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [readyStatus, setReadyStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [statusTaskId, setStatusTaskId] = useState(null);
  const createInFlight = useRef(false);
  const [logs, setLogs] = useState('');
  const [command, setCommand] = useState('');
  const [commandOutput, setCommandOutput] = useState('');
  const [files, setFiles] = useState('');
  const [currentPath, setCurrentPath] = useState('/app/data');
  const [selectedFile, setSelectedFile] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [cpu, setCpu] = useState('1');
  const [memory, setMemory] = useState('2Gi');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showLogStreamer, setShowLogStreamer] = useState(false);
  const [campaign, setCampaign] = useState({
    schemaVersion: 1,
    rounds: 2,
    clientsPerRound: 1,
    strategy: { name: 'FedAvg', parameters: {} },
  });
  const [campaignMeta, setCampaignMeta] = useState({ supportedStrategies: ['FedAvg'] });
  const [campaignDirty, setCampaignDirty] = useState(false);
  const [validationDatasets, setValidationDatasets] = useState([]);
  const [validationDataError, setValidationDataError] = useState('');
  const [validationDataLoading, setValidationDataLoading] = useState(false);
  const validationTaskRef = useRef(taskId);
  validationTaskRef.current = taskId;
  const refreshValidationDatasets = async () => {
    setValidationDataLoading(true);
    setValidationDataError('');
    try {
      const result = await serverControlAPI.getValidationData(taskId);
      if (validationTaskRef.current === taskId) {
        const items = result.items || [];
        setValidationDatasets(items);
        const preferred = result.latestValidationData?.dataPath
          || (items.length === 1 ? items[0].dataPath : '');
        if (preferred && items.some(item => item.dataPath === preferred)) {
          setCampaign(current => {
            if (!current.serverEvaluation?.enabled || current.serverEvaluation.dataPath) return current;
            return { ...current, serverEvaluation: { enabled: true, dataPath: preferred } };
          });
        }
      }
    }
    catch (_) { if (validationTaskRef.current === taskId) { setValidationDatasets([]); setValidationDataError('Prepare the Task server and refresh. Validation data is uploaded from Agent Studio.'); } }
    finally { if (validationTaskRef.current === taskId) setValidationDataLoading(false); }
  };
  const [evaluationCheck, setValidationCheck] = useState(null);
  const [pendingEvaluationCheck, setPendingEvaluationCheck] = useState(null);
  const [evaluationElapsedSeconds, setEvaluationElapsedSeconds] = useState(0);
  const evaluationRequestRef = useRef(0);
  const evaluationInFlightRef = useRef(false);
  const checkingEvaluation = pendingEvaluationCheck?.taskId === taskId;
  useEffect(() => {
    if (!checkingEvaluation) return undefined;
    const updateElapsed = () => setEvaluationElapsedSeconds(
      Math.max(0, Math.floor((Date.now() - pendingEvaluationCheck.startedAt) / 1000)),
    );
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [checkingEvaluation, pendingEvaluationCheck]);
  // A late response for another Task or edited Campaign must never unlock Save/Start.
  const validationCheck = evaluationCheck?.taskId === taskId && isEqual(evaluationCheck.campaign, campaign)
    ? evaluationCheck.result : null;
  const validationSaveBlocked = Boolean(campaign.serverEvaluation?.enabled
    && (!campaign.serverEvaluation.dataPath || !validationCheck?.success));
  useEffect(() => {
    if (campaign.serverEvaluation?.enabled) void refreshValidationDatasets();
    // Load on entering ON mode only; do not replace a selected or running dataset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, campaign.serverEvaluation?.enabled]);
  const campaignDirtyRef = useRef(false);
  const [allocationTracking, setAllocationTracking] = useState(false);
  const [allocationDeadline, setAllocationDeadline] = useState(0);
  const mountedRef = useRef(true);

  const showMessage = (message, type = 'success') => {
    if (type === 'success') {
      setSuccess(message || 'Operation completed.');
      setError('');
      window.setTimeout(() => setSuccess(''), 5000);
    } else {
      setError(message || 'The operation failed.');
      setSuccess('');
      window.setTimeout(() => setError(''), 5000);
    }
  };

  const fetchServerStatus = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setStatusLoading(true);
    setStatusError('');
    const results = await Promise.allSettled([
      serverControlAPI.getServerStatus(taskId),
      serverControlAPI.getConnectionInfo(taskId),
      serverControlAPI.checkServerReady(taskId),
      serverControlAPI.getCampaign(taskId),
    ]);
    const [statusResult, connectionResult, readyResult, campaignResult] = results;
    if (validationTaskRef.current !== taskId) return {};

    const nextServerStatus = statusResult.status === 'fulfilled'
      ? statusResult.value.data
      : null;
    const nextConnectionInfo = connectionResult.status === 'fulfilled'
      ? connectionResult.value
      : null;
    const nextReadyStatus = readyResult.status === 'fulfilled'
      ? readyResult.value
      : null;
    setServerStatus(nextServerStatus);
    setConnectionInfo(nextConnectionInfo);
    setReadyStatus(nextReadyStatus);
    setStatusTaskId(taskId);
    if (campaignResult.status === 'fulfilled') {
      if (!campaignDirtyRef.current) {
        const incoming = campaignResult.value;
        const defaults = incoming.evaluationDefaults;
        if (incoming.campaign.serverEvaluation === undefined && defaults?.supported
          && typeof defaults.enabled === 'boolean') {
          setCampaign({ ...incoming.campaign, serverEvaluation: defaults.enabled
            ? { enabled: true, dataPath: incoming.latestValidationData?.dataPath || '' }
            : { enabled: false } });
          // Display the actual Release default as an explicit editable draft.
          // Persist only when the user saves; ON still requires a successful check.
          campaignDirtyRef.current = true;
          setCampaignDirty(true);
        } else {
          setCampaign(incoming.campaign);
        }
      }
      setCampaignMeta(campaignResult.value);
    }

    const failedRequests = results
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason?.message || 'Unknown status error');

    if (failedRequests.length > 0) {
      setStatusError(`Some runtime details are unavailable: ${failedRequests.join(' · ')}`);
    }

    if (showLoading) setStatusLoading(false);
    return {
      serverStatus: nextServerStatus,
      connectionInfo: nextConnectionInfo,
      readyStatus: nextReadyStatus,
      failedRequests,
    };
  }, [taskId]);

  const updateCampaign = (nextCampaign) => {
    setValidationCheck(null);
    campaignDirtyRef.current = true;
    setCampaignDirty(true);
    setCampaign(nextCampaign);
  };

  const saveCampaign = async () => {
    if (validationSaveBlocked) {
      showMessage('Check evaluation setup successfully before saving Validation ON.', 'error');
      return;
    }
    setLoading(true);
    try {
      const response = await serverControlAPI.saveCampaign(taskId, campaign);
      setCampaign(response.campaign);
      setCampaignMeta((current) => ({
        ...current,
        persisted: true,
        savedAt: response.savedAt,
      }));
      campaignDirtyRef.current = false;
      setCampaignDirty(false);
      showMessage(response.message);
    } catch (requestError) {
      showMessage(requestError.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkValidation = async () => {
    if (evaluationInFlightRef.current) return;
    evaluationInFlightRef.current = true;
    const requestId = ++evaluationRequestRef.current;
    setEvaluationElapsedSeconds(0);
    setPendingEvaluationCheck({ taskId, enabled: campaign.serverEvaluation?.enabled, startedAt: Date.now() });
    setLoading(true);
    setValidationCheck(null);
    try {
      const result = await serverControlAPI.checkValidation(taskId, campaign);
      if (evaluationRequestRef.current === requestId && validationTaskRef.current === taskId) {
        setValidationCheck({ taskId, campaign, result });
      }
    } catch (requestError) {
      if (evaluationRequestRef.current === requestId && validationTaskRef.current === taskId) {
        setValidationCheck({ taskId, campaign, result: { success: false, error: requestError.message } });
      }
    } finally {
      if (evaluationRequestRef.current === requestId && validationTaskRef.current === taskId) {
        evaluationInFlightRef.current = false;
        setPendingEvaluationCheck(null);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    evaluationRequestRef.current += 1;
    evaluationInFlightRef.current = false;
    setPendingEvaluationCheck(null);
    setLoading(false);
    campaignDirtyRef.current = false;
    setAllocationTracking(false);
    setValidationDatasets([]);
    setValidationDataError('');
    setValidationDataLoading(false);
    setValidationCheck(null);
    setCampaignDirty(false);
    return () => { evaluationRequestRef.current += 1; };
  }, [taskId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchServerStatus().then((snapshot) => {
      if (!mountedRef.current) return;
      const allocation = allocationState(snapshot);
      if (allocation.started && !allocation.complete && !allocation.failed) {
        setAllocationDeadline(Date.now() + ALLOCATION_POLL_TIMEOUT_MS);
        setAllocationTracking(true);
      }
    });
    return () => {
      mountedRef.current = false;
    };
  }, [fetchServerStatus]);

  useEffect(() => {
    if (!allocationTracking) return undefined;
    let cancelled = false;
    let timer = null;

    const poll = async () => {
      const snapshot = await fetchServerStatus({ showLoading: false });
      if (cancelled || !mountedRef.current) return;
      const allocation = allocationState(snapshot);
      if (allocation.complete) {
        setAllocationTracking(false);
        setError('');
        setSuccess('Server allocation completed. Connection and Kubernetes resources are ready.');
        window.setTimeout(() => setSuccess(''), 5000);
        return;
      }
      if (allocation.failed) {
        setAllocationTracking(false);
        setError('Server allocation failed. Review the runtime status and retry after resolving the reported error.');
        return;
      }
      if (Date.now() >= allocationDeadline) {
        setAllocationTracking(false);
        setError('Server allocation is taking longer than expected. Kubernetes resources may still be creating; refresh the status or review the Server Manager logs.');
        return;
      }
      timer = window.setTimeout(poll, ALLOCATION_POLL_INTERVAL_MS);
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [allocationDeadline, allocationTracking, fetchServerStatus]);

  // Allocation polling stops when the Pod is ready, but FL runs may finish
  // minutes later. Keep the visible runtime state fresh without page reloads.
  useEffect(() => {
    if (allocationTracking) return undefined;
    let cancelled = false;
    let timer;
    const poll = async () => {
      await fetchServerStatus({ showLoading: false });
      if (!cancelled) timer = window.setTimeout(poll, RUNTIME_POLL_INTERVAL_MS);
    };
    timer = window.setTimeout(poll, RUNTIME_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [allocationTracking, fetchServerStatus]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await serverControlAPI.getLogs(taskId, 100);
      setLogs(response.data?.logs || '');
    } catch (requestError) {
      showMessage(requestError.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async (path = currentPath) => {
    setLoading(true);
    try {
      const response = await serverControlAPI.listFiles(taskId, path);
      setFiles(response.data?.files || '');
      setCurrentPath(path);
    } catch (requestError) {
      showMessage(requestError.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchFileContent = async (filePath) => {
    if (!filePath.trim()) return;
    setLoading(true);
    try {
      const response = await serverControlAPI.getFileContent(taskId, filePath);
      setFileContent(response.data?.content || '');
      setSelectedFile(filePath);
    } catch (requestError) {
      showMessage(requestError.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const createScalableServer = async () => {
    if (createInFlight.current || runtimePreparationReason) {
      if (runtimePreparationReason) showMessage(runtimePreparationReason, 'error');
      return;
    }
    createInFlight.current = true;
    setLoading(true);
    try {
      const response = await serverControlAPI.createScalableServerFromSaved(taskId);
      showMessage(response.message);
      setAllocationDeadline(Date.now() + ALLOCATION_POLL_TIMEOUT_MS);
      setAllocationTracking(true);
    } catch (requestError) {
      showMessage(requestError.message, 'error');
    } finally {
      createInFlight.current = false;
      setLoading(false);
    }
  };

  const scaleResources = async () => {
    setLoading(true);
    try {
      const response = await serverControlAPI.scaleResources(taskId, cpu, memory);
      showMessage(response.message);
      await fetchServerStatus();
    } catch (requestError) {
      showMessage(requestError.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const pauseServer = async () => {
    setLoading(true);
    try {
      const response = await serverControlAPI.pauseServer(taskId);
      showMessage(response.message);
      await fetchServerStatus();
    } catch (requestError) {
      showMessage(requestError.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const resumeServer = async () => {
    setLoading(true);
    try {
      const response = await serverControlAPI.resumeServer(taskId);
      showMessage(response.message);
      await fetchServerStatus();
    } catch (requestError) {
      showMessage(requestError.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const executeCommand = async () => {
    if (!command.trim()) return;
    setLoading(true);
    try {
      const response = await serverControlAPI.executeCommand(taskId, command);
      setCommandOutput(response.data?.output || '');
    } catch (requestError) {
      setCommandOutput(`Error: ${requestError.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startFLServer = async () => {
    if (campaignMeta.immutableReleaseRequired && (campaignDirty || !campaignMeta.persisted)) {
      showMessage('Save the Federated campaign before starting the FL server.', 'error');
      return;
    }
    setLoading(true);
    try {
      const response = await serverControlAPI.startFLServer(taskId);
      showMessage(response.message);
      setCommandOutput(response.data?.output || '');
      await fetchServerStatus();
    } catch (requestError) {
      showMessage(requestError.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const stopFLServer = async () => {
    if (!window.confirm('Stop the running FL server process?')) return;
    setLoading(true);
    try {
      const response = await serverControlAPI.stopFLServer(taskId);
      showMessage(response.message);
      setCommandOutput(response.data?.output || '');
      await fetchServerStatus();
    } catch (requestError) {
      showMessage(requestError.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkProcesses = async () => {
    setLoading(true);
    try {
      const response = await serverControlAPI.getProcesses(taskId);
      setCommandOutput(response.data?.output || '');
    } catch (requestError) {
      setCommandOutput(`Error: ${requestError.message}`);
    } finally {
      setLoading(false);
    }
  };

  const checkGPU = async () => {
    setLoading(true);
    try {
      const response = await serverControlAPI.checkGPU(taskId);
      setCommandOutput(response.data?.output || '');
    } catch (requestError) {
      setCommandOutput(`Error: ${requestError.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveFile = async () => {
    if (!selectedFile.trim()) return;
    setLoading(true);
    try {
      const response = await serverControlAPI.saveFile(taskId, selectedFile, fileContent);
      showMessage(response.data?.message || response.message);
    } catch (requestError) {
      showMessage(requestError.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const deployment = serverStatus?.deployment || {};
  const deploymentMissing = !serverStatus || Boolean(deployment.error);
  const desiredReplicas = deploymentMissing ? 0 : Number(deployment.replicas || 0);
  const readyReplicas = deploymentMissing ? 0 : Number(deployment.ready_replicas || 0);
  const availableReplicas = deploymentMissing
    ? 0
    : Number(deployment.available_replicas || 0);
  const deploymentReady = desiredReplicas > 0 && readyReplicas >= desiredReplicas;

  const pods = Array.isArray(serverStatus?.pods) ? serverStatus.pods : [];
  const podCount = pods.length;
  const runningPodCount = pods.filter((pod) => pod.phase === 'Running').length;
  const readyPodCount = pods.filter((pod) => pod.ready === true).length;

  const pvc = serverStatus?.pvc || {};
  const pvcMissing = !serverStatus || Boolean(pvc.error);
  const flRuntime = serverStatus?.fl_server_status || {};
  const flStatus = firstAvailable(
    readyStatus?.status,
    connectionInfo?.status,
    flRuntime.status,
    'Status unavailable',
  );
  const yamlSaved = flRuntime.yaml_saved === true;
  const terminalFL = /finished|stopped|failed|closed/i.test(flStatus);
  const isFLReady = !terminalFL && (readyStatus?.ready === true || readyStatus?.fl_ready === true);
  const isFLActive = !terminalFL && (isFLReady || /running|starting|stopping/i.test(flStatus));
  // ON and OFF share the same creation policy, including unsaved drafts.
  // Existing Deployments (even paused/unhealthy ones) must not be recreated.
  const runtimePreparationReason = runtimeCreationState({
    serverStatus,
    campaignMeta,
    isFLActive,
    statusError,
    busy: loading || statusLoading || allocationTracking || statusTaskId !== taskId,
  });

  const allocatedPort = firstAvailable(connectionInfo?.port, flRuntime.port);
  const externalIp = firstAvailable(connectionInfo?.external_ip, flRuntime.external_ip);
  const serverAddress = firstAvailable(
    connectionInfo?.server_address,
    externalIp && allocatedPort ? `${externalIp}:${allocatedPort}` : null,
  );
  const serverType = firstAvailable(connectionInfo?.server_type, flRuntime.server_type);
  const serviceName = firstAvailable(connectionInfo?.service_name, flRuntime.service_name);
  const deploymentName = firstAvailable(connectionInfo?.deployment, flRuntime.deployment);
  const pvcName = firstAvailable(flRuntime.pvc, pvc.name);
  const cpuRequest = firstAvailable(flRuntime.cpu);
  const memoryRequest = firstAvailable(flRuntime.memory);

  return (
    <Stack spacing={2.5}>
      {success && <Alert severity="success">{success}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      {allocationTracking && (
        <Alert severity="info">
          Creating Kubernetes resources and assigning the Task network route. This view updates automatically.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderColor: 'divider' }}>
        <SectionHeader
          icon={<DnsOutlinedIcon fontSize="small" />}
          title="Runtime overview"
          description="Live Kubernetes and federated-learning server state."
          action={(
            <Button
              variant="outlined"
              startIcon={statusLoading
                ? <CircularProgress size={16} color="inherit" />
                : <RefreshRoundedIcon />}
              onClick={() => fetchServerStatus()}
              disabled={statusLoading || loading}
            >
              Refresh status
            </Button>
          )}
        />

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
          <Typography variant="caption" color="text.secondary">
            Task ID
          </Typography>
          <Chip size="small" label={taskId} variant="outlined" />
        </Stack>

        {statusError && (
          <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
            {statusError}
          </Alert>
        )}

        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6} lg={3}>
            <StatusCard
              label="Deployment"
              value={statusLoading
                ? 'Checking…'
                : deploymentMissing
                  ? 'Not created'
                  : desiredReplicas === 0
                    ? 'Paused'
                    : `${readyReplicas} / ${desiredReplicas} ready`}
              detail={deploymentMissing
                ? 'Create the runtime when ready.'
                : `${availableReplicas} available replica${availableReplicas === 1 ? '' : 's'}.`}
              tone={deploymentReady ? 'success' : 'warning'}
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <StatusCard
              label="Pods"
              value={statusLoading ? 'Checking…' : `${readyPodCount} / ${podCount} ready`}
              detail={podCount ? `${runningPodCount} Running` : 'No runtime pods found.'}
              tone={podCount > 0 && readyPodCount === podCount ? 'success' : 'warning'}
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <StatusCard
              label="Persistent storage"
              value={statusLoading
                ? 'Checking…'
                : pvcMissing
                  ? 'Not created'
                  : pvc.phase || 'Available'}
              detail={pvcMissing
                ? 'PVC will be created with the server.'
                : `${pvc.capacity || 'Capacity unknown'} allocated`}
              tone={!pvcMissing && pvc.phase === 'Bound' ? 'success' : 'warning'}
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <StatusCard
              label="FL server"
              value={statusLoading ? 'Checking…' : isFLReady ? 'Ready' : flStatus}
              detail={
                yamlSaved
                  ? 'Federated Task configuration saved'
                  : 'Waiting for runtime readiness'
              }
              tone={isFLReady ? 'success' : 'warning'}
            />
          </Grid>
        </Grid>

        <Box
          sx={{
            mt: 1.5,
            p: { xs: 1.5, sm: 2 },
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: '#fafaf9',
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={1}
            sx={{ mb: 1.5 }}
          >
            <Box>
              <Typography variant="body2" fontWeight={600}>
                Connection &amp; resources
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Allocated network endpoint and Kubernetes runtime identifiers.
              </Typography>
            </Box>
            <Chip
              size="small"
              label={statusLoading ? 'Checking…' : flStatus}
              color={isFLReady ? 'success' : 'default'}
              variant="outlined"
            />
          </Stack>

          <Grid container spacing={1}>
            {[
              ['Server address', serverAddress, true],
              ['Allocated gateway port', allocatedPort, true],
              ['External IP', externalIp, true],
              ['Server type', serverType, false],
              ['CPU request', cpuRequest, false],
              ['Memory request', memoryRequest, false],
              ['Service', serviceName, true],
              ['Deployment', deploymentName, true],
              ['Persistent volume claim', pvcName, true],
            ].map(([label, value, monospace]) => (
              <Grid item xs={12} sm={6} lg={4} key={label}>
                <DetailItem
                  label={label}
                  value={statusLoading ? 'Checking…' : value}
                  monospace={monospace}
                />
              </Grid>
            ))}
          </Grid>

          {pods.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary">
                Runtime pods
              </Typography>
              <Stack spacing={1} sx={{ mt: 1 }}>
                {pods.map((pod) => (
                  <Stack
                    key={pod.name}
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={1}
                    sx={{
                      p: 1.25,
                      borderRadius: 1,
                      backgroundColor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {pod.name}
                    </Typography>
                    <Stack direction="row" spacing={0.75}>
                      <Chip size="small" label={pod.phase || 'Unknown'} variant="outlined" />
                      <Chip
                        size="small"
                        label={pod.ready ? 'Ready' : 'Not ready'}
                        color={pod.ready ? 'success' : 'warning'}
                        variant="outlined"
                      />
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </>
          )}
        </Box>
      </Paper>

      {campaignMeta.immutableReleaseRequired && (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderColor: 'divider' }}>
          <SectionHeader
            icon={<DnsOutlinedIcon fontSize="small" />}
            title="Federated campaign"
            description="Set training and evaluation for this campaign."
          />
          {!campaignMeta.releaseId && (
            <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
              Publish a Ready Release before creating this v3 aggregation server.
            </Alert>
          )}
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Rounds"
                value={campaign.rounds}
                inputProps={{ min: 1, step: 1 }}
                onChange={(event) => updateCampaign({ ...campaign, rounds: Number(event.target.value) })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Clients per round"
                value={campaign.clientsPerRound}
                inputProps={{ min: 1, step: 1 }}
                onChange={(event) => updateCampaign({ ...campaign, clientsPerRound: Number(event.target.value) })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel id="campaign-strategy-label">Aggregation strategy</InputLabel>
                <Select
                  labelId="campaign-strategy-label"
                  label="Aggregation strategy"
                  value={campaign.strategy?.name || 'FedAvg'}
                  onChange={(event) => updateCampaign({
                    ...campaign,
                    strategy: { name: event.target.value, parameters: {} },
                  })}
                >
                  {(campaignMeta.supportedStrategies || ['FedAvg']).map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="server-validation-mode-label" shrink>Global model evaluation</InputLabel>
              <Select
                labelId="server-validation-mode-label"
                label="Global model evaluation"
                displayEmpty
                disabled={!campaignMeta.evaluationDefaults?.supported}
                value={campaign.serverEvaluation === undefined ? '' : campaign.serverEvaluation.enabled ? 'server' : 'clients'}
                renderValue={value => value === 'server' ? 'Validation ON · Server evaluation'
                  : value === 'clients' ? 'Validation OFF · Client metrics' : 'Evaluation mode unavailable'}
                onChange={(event) => {
                  const next = { ...campaign };
                  next.serverEvaluation = event.target.value === 'server'
                    ? { enabled: true, dataPath: campaignMeta.latestValidationData?.dataPath || '' } : { enabled: false };
                  updateCampaign(next);
                }}
              >
                <MenuItem value="clients">Validation OFF · Client metrics</MenuItem>
                <MenuItem value="server">Validation ON · Server evaluation</MenuItem>
              </Select>
            </FormControl>
            {campaignMeta.evaluationDefaults?.supported === false && campaign.serverEvaluation !== undefined && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {campaignMeta.evaluationDefaults.reason || 'Publish a compatible Release to change Validation ON/OFF.'}
              </Alert>
            )}
            {campaign.serverEvaluation?.enabled && (
              <Box sx={{ mt: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FormControl fullWidth size="small" sx={{ minWidth: 0 }}>
                    <InputLabel id="validation-dataset-label" shrink>Validation dataset</InputLabel>
                    <Select labelId="validation-dataset-label" label="Validation dataset" displayEmpty
                      value={campaign.serverEvaluation.dataPath || ''}
                      sx={{ '& .MuiSelect-select': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                      onChange={event => updateCampaign({ ...campaign, serverEvaluation: { enabled: true, dataPath: event.target.value } })}>
                      <MenuItem value="" disabled>{validationDataLoading ? 'Loading datasets…' : 'Upload a dataset in Agent Studio'}</MenuItem>
                      {campaign.serverEvaluation.dataPath && !validationDatasets.some(item => item.dataPath === campaign.serverEvaluation.dataPath) && (
                        <MenuItem value={campaign.serverEvaluation.dataPath}>Current server dataset</MenuItem>
                      )}
                      {validationDatasets.map(item => (
                        <MenuItem key={item.dataPath} value={item.dataPath} title={item.dataPath}>
                          {validationDatasetLabel(item)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Tooltip title="Refresh datasets">
                    <span>
                      <IconButton aria-label="Refresh datasets" disabled={validationDataLoading} onClick={refreshValidationDatasets}>
                        {validationDataLoading ? <CircularProgress size={20} /> : <RefreshRoundedIcon />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
                {validationDataError && <Alert severity="warning" sx={{ mt: 1 }}>{validationDataError}</Alert>}
                {!validationDataLoading && !campaign.serverEvaluation.dataPath && (
                  <Alert severity="info" sx={{ mt: 1 }}>{VALIDATION_UPLOAD_GUIDANCE}</Alert>
                )}
              </Box>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
              {campaign.serverEvaluation === undefined
                ? campaignMeta.evaluationDefaults?.reason || 'Could not determine evaluation mode. Check the published Release and refresh.'
                : campaign.serverEvaluation.enabled
                  ? 'Upload validation data in Agent Studio. It is stored on the FL server to evaluate the global model.'
                  : 'Global model metrics are aggregated from client evaluations, weighted by sample count.'}
            </Typography>
            {campaign.serverEvaluation !== undefined && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button variant="outlined" onClick={checkValidation}
                  aria-busy={checkingEvaluation}
                  startIcon={checkingEvaluation ? <CircularProgress size={16} color="inherit" aria-hidden="true" /> : undefined}
                  disabled={loading || (campaign.serverEvaluation.enabled && !campaign.serverEvaluation.dataPath)}>
                  {checkingEvaluation ? 'Checking…' : 'Check evaluation setup'}
                </Button>
                {!validationCheck && !checkingEvaluation && <Typography variant="caption" color="text.secondary">
                  {campaign.serverEvaluation.enabled ? 'Check required before saving' : 'Check required before start'}
                </Typography>}
              </Stack>
            )}
            {checkingEvaluation && (
              <Box sx={{ mt: 1 }}>
                <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" role="status">
                    {pendingEvaluationCheck.enabled
                      ? 'Checking server data and evaluating one batch…'
                      : 'Checking client evaluation setup…'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" aria-hidden="true" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {evaluationElapsedSeconds}s elapsed
                  </Typography>
                </Stack>
                <LinearProgress aria-label="Evaluation setup check in progress" sx={{ borderRadius: 1 }} />
              </Box>
            )}
            {validationCheck && (
              <Alert sx={{ mt: 1 }} severity={validationCheck.success ? 'success' : 'error'}>
                {validationCheck.success
                  ? `Evaluation setup ready${campaign.serverEvaluation?.enabled ? ' · 1 batch checked' : ''}`
                  : campaign.serverEvaluation?.enabled ? validationErrorMessage(validationCheck.error) : validationCheck.error}
              </Alert>
            )}
          </Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            spacing={1.5}
            sx={{ mt: 1.5 }}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Chip
                  size="small"
                  color={campaignDirty || !campaignMeta.persisted ? 'warning' : 'success'}
                  variant="outlined"
                  label={campaignDirty ? 'Unsaved changes' : campaignMeta.persisted ? 'Saved' : 'Save required'}
                />
                {campaignMeta.savedAt && (
                  <Typography variant="caption" color="text.secondary">
                    Last saved {new Date(campaignMeta.savedAt).toLocaleString()}
                  </Typography>
                )}
              </Stack>
            </Box>
            <Button
              variant="contained"
              startIcon={<SaveOutlinedIcon />}
              onClick={saveCampaign}
              disabled={loading || validationSaveBlocked || (!campaignDirty && campaignMeta.persisted) || !campaignMeta.releaseId}
              sx={{ minWidth: 170 }}
            >
              Save campaign
            </Button>
          </Stack>
        </Paper>
      )}

      <Box
        sx={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
          alignItems: 'stretch',
        }}
      >
          <Paper
            variant="outlined"
            sx={{
              width: '100%',
              height: '100%',
              p: { xs: 2, sm: 3 },
              display: 'flex',
              flexDirection: 'column',
              borderColor: 'divider',
            }}
          >
            <SectionHeader
              icon={<PlayCircleOutlineRoundedIcon fontSize="small" />}
              title="Server lifecycle"
              description="Create, pause, or resume the task runtime."
              sx={{ minHeight: { sm: 58 } }}
            />
            <Stack spacing={1.5} sx={{ flexGrow: 1, justifyContent: 'space-between' }}>
              <Box sx={{ minHeight: 40 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<AddCircleOutlineRoundedIcon />}
                  onClick={createScalableServer}
                  disabled={Boolean(runtimePreparationReason)}
                  sx={{ minHeight: 40 }}
                >
                  Create scalable server
                </Button>
                <Typography variant="caption" color="text.secondary" role="status">
                  {runtimePreparationReason || 'Prepare the server without saving Campaign edits or starting training.'}
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ minHeight: 40 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<PauseCircleOutlineRoundedIcon />}
                  onClick={pauseServer}
                  disabled={loading}
                >
                  Pause
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<PlayCircleOutlineRoundedIcon />}
                  onClick={resumeServer}
                  disabled={loading}
                >
                  Resume
                </Button>
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minHeight: { lg: 36 }, pt: 0.5 }}
              >
                Pausing releases compute resources while keeping persistent data.
              </Typography>
            </Stack>
          </Paper>
          <Paper
            variant="outlined"
            sx={{
              width: '100%',
              height: '100%',
              p: { xs: 2, sm: 3 },
              display: 'flex',
              flexDirection: 'column',
              borderColor: 'divider',
            }}
          >
            <SectionHeader
              icon={<MemoryOutlinedIcon fontSize="small" />}
              title="Compute resources"
              description="Set Kubernetes CPU and memory requests for this runtime."
              sx={{ minHeight: { sm: 58 } }}
            />
            <Stack spacing={1.5} sx={{ flexGrow: 1, justifyContent: 'space-between' }}>
              <Grid container spacing={1.5} sx={{ minHeight: 40 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="CPU"
                    value={cpu}
                    onChange={(event) => setCpu(event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Memory"
                    value={memory}
                    onChange={(event) => setMemory(event.target.value)}
                  />
                </Grid>
              </Grid>
              <Button
                fullWidth
                variant="contained"
                onClick={scaleResources}
                disabled={loading}
                sx={{ minHeight: 40 }}
              >
                Apply resource settings
              </Button>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minHeight: { lg: 36 }, pt: 0.5 }}
              >
                CPU uses cores; memory uses Kubernetes units such as Gi.
              </Typography>
            </Stack>
          </Paper>
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderColor: 'divider' }}>
        <SectionHeader
          icon={<TerminalRoundedIcon fontSize="small" />}
          title="Command console"
          description="Start or inspect the FL process, or execute a custom command."
        />

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          sx={{ mb: 2 }}
        >
          <Button
            variant="contained"
            startIcon={<PlayCircleOutlineRoundedIcon />}
            onClick={startFLServer}
            disabled={loading || isFLActive || (campaignMeta.immutableReleaseRequired && (campaignDirty || !campaignMeta.persisted
              || (campaign.serverEvaluation !== undefined && !validationCheck?.success)))}
          >
            Start FL server
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<StopCircleOutlinedIcon />}
            onClick={stopFLServer}
            disabled={loading}
          >
            Stop server
          </Button>
          <Button variant="outlined" onClick={checkProcesses} disabled={loading}>
            Check processes
          </Button>
          <Button variant="outlined" onClick={checkGPU} disabled={loading}>
            Check GPU
          </Button>
          <Button
            variant="outlined"
            onClick={() => setShowLogStreamer((current) => !current)}
          >
            {showLogStreamer ? 'Hide live log' : 'Show live log'}
          </Button>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Custom command"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="Enter a command to run inside the server pod"
            onKeyDown={(event) => {
              if (event.key === 'Enter') executeCommand();
            }}
          />
          <Button
            variant="contained"
            startIcon={<CodeRoundedIcon />}
            onClick={executeCommand}
            disabled={loading || !command.trim()}
            sx={{ flexShrink: 0 }}
          >
            Run command
          </Button>
        </Stack>

        <Button
          size="small"
          variant="text"
          onClick={() => setCommand(
            'cd /app/code && python3 server_main.py > /app/data/logs/serverlog.txt 2>&1 &',
          )}
          sx={{ mb: 1.5 }}
        >
          Use default start command
        </Button>

        <TerminalOutput
          value={commandOutput}
          emptyMessage="Command output will appear here."
        />
      </Paper>

      {showLogStreamer && (
        <LogStreamer
          taskId={taskId}
          filePath="/app/data/logs/serverlog.txt"
          autoScroll
        />
      )}

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderColor: 'divider' }}>
        <SectionHeader
          icon={<FolderOpenOutlinedIcon fontSize="small" />}
          title="Persistent files"
          description="Browse and edit files stored in the task PVC."
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Directory path"
            value={currentPath}
            onChange={(event) => setCurrentPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') fetchFiles(currentPath);
            }}
          />
          <Button
            variant="outlined"
            startIcon={<FolderOpenOutlinedIcon />}
            onClick={() => fetchFiles(currentPath)}
            disabled={loading}
            sx={{ flexShrink: 0 }}
          >
            Browse
          </Button>
        </Stack>

        <Grid container spacing={2}>
          <Grid item xs={12} lg={5}>
            <Typography variant="caption" color="text.secondary">
              Directory contents
            </Typography>
            <Box
              component="pre"
              sx={{
                minHeight: 300,
                maxHeight: 460,
                m: 0,
                mt: 0.75,
                p: 2,
                overflow: 'auto',
                color: files ? 'text.primary' : 'text.secondary',
                backgroundColor: '#fafaf9',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '0.75rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              {formatOutput(files, 'Browse a directory to view its files.')}
            </Box>
          </Grid>

          <Grid item xs={12} lg={7}>
            <Typography variant="caption" color="text.secondary">
              File editor
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.75, mb: 1 }}>
              <TextField
                fullWidth
                size="small"
                label="File path"
                value={selectedFile}
                onChange={(event) => setSelectedFile(event.target.value)}
                placeholder="/app/data/status.log"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') fetchFileContent(selectedFile);
                }}
              />
              <Button
                variant="outlined"
                onClick={() => fetchFileContent(selectedFile)}
                disabled={loading || !selectedFile.trim()}
                sx={{ flexShrink: 0 }}
              >
                Load
              </Button>
            </Stack>
            <TextField
              fullWidth
              multiline
              minRows={10}
              maxRows={17}
              value={fileContent}
              onChange={(event) => setFileContent(event.target.value)}
              placeholder="Select a file to view or edit its content."
              inputProps={{
                sx: {
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.75rem',
                  lineHeight: 1.6,
                },
              }}
            />
            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
              <Button
                variant="contained"
                startIcon={<SaveOutlinedIcon />}
                onClick={saveFile}
                disabled={loading || !selectedFile.trim()}
              >
                Save file
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderColor: 'divider' }}>
        <SectionHeader
          icon={<CodeRoundedIcon fontSize="small" />}
          title="Server logs"
          description="Load the latest 100 log lines from the FL server."
          action={(
            <Button
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={fetchLogs}
              disabled={loading}
            >
              Refresh logs
            </Button>
          )}
        />
        <TerminalOutput value={logs} emptyMessage="No logs loaded yet." />
      </Paper>
    </Stack>
  );
};

export default ServerControl;
