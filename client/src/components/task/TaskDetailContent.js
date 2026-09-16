import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Typography,
  Box,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Chip,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DevicesOutlinedIcon from '@mui/icons-material/DevicesOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import { useTaskData } from '../../components/hooks/useTaskData';
import { TaskDevice } from '../../components/task/TaskDevice';
import { TaskRefresh } from '../../components/task/TaskRefresh';
import { getClientPresence } from '../../lib/clientPresence';
import { readTask, removeK8s, unloadTask } from '../../modules/task';
import { removeTaskFromList } from '../../modules/tasks';
import { setOriginalTask } from '../../modules/create';
import * as tasksAPI from '../../lib/api/tasks';

const TaskDetailContent = ({ title }) => {
  const { task } = useSelector(({ task }) => ({ task: task.task }));
  const { data, loading, requestData, status } = useTaskData(title);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [presenceNow, setPresenceNow] = useState(Date.now());
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const statusMessage = typeof status === 'string' ? status : status?.status;
  const isV3Task = task?.runtimeContract?.name === 'federated-task-v3';

  useEffect(() => {
    dispatch(readTask(title));
  }, [dispatch, title]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPresenceNow(Date.now());
    }, 5000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const clients = useMemo(() => (
    Array.isArray(data)
      ? data.map((device) => ({
        device,
        presence: getClientPresence(device, presenceNow),
      }))
      : []
  ), [data, presenceNow]);

  const clientSummary = useMemo(() => clients.reduce((summary, client) => {
    summary[client.presence.state] += 1;
    if (
      client.device?.Device_training
      && client.presence.state !== 'offline'
    ) summary.training += 1;
    return summary;
  }, {
    online: 0,
    stale: 0,
    offline: 0,
    training: 0,
  }), [clients]);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await tasksAPI.removeTask(title);
      dispatch(removeTaskFromList(title));
      dispatch(unloadTask());
      navigate('/fedops/task', {
        replace: true,
        state: { deletedTaskTitle: title },
      });
    } catch (error) {
      setDeleteError(
        error.response?.data?.message || 'Failed to delete the Federated Task.',
      );
      setDeleting(false);
    }
  };

  const handleEdit = () => {
    dispatch(setOriginalTask(task));
    navigate('/fedops/task/create', {
      state: { isEdit: true, editId: title, task },
    });
  };

  const handleK8sDelete = () => {
    console.log('=== HANDLE K8S DELETE ===');
    console.log('Title:', title);
    console.log('About to dispatch removeK8s');
    console.log('=========================');
    dispatch(removeK8s(title));
  };

  return (
    <Stack spacing={3}>
      {deleteError && (
        <Alert severity="error">
          {deleteError}
        </Alert>
      )}
      {task?.serverRepoAddr && (
        <Paper
          variant="outlined"
          sx={{ p: 2.5, borderColor: 'divider' }}
        >
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <StorageOutlinedIcon sx={{ mt: 0.25, color: 'text.secondary' }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={500}>
                FL server repository
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, overflowWrap: 'anywhere' }}
              >
                {task.serverRepoAddr}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, sm: 3 },
          borderColor: 'divider',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          spacing={2}
          sx={{ mb: 2.5 }}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <DevicesOutlinedIcon color="primary" />
              <Typography variant="h5" component="h2">
                Connected clients
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              Live launcher registrations for this task. Start and control the FL server
              from Server Management.
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
                mt: 0.75,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                overflowWrap: 'anywhere',
              }}
            >
              Task ID · {task?.title || title}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
            <Chip size="small" label={`${clientSummary.online} online`} color="success" variant="outlined" />
            <Chip size="small" label={`${clientSummary.stale} stale`} color="warning" variant="outlined" />
            <Chip size="small" label={`${clientSummary.offline} offline`} variant="outlined" />
            {clientSummary.training > 0 && (
              <Chip
                size="small"
                label={`${clientSummary.training} training`}
                color="info"
                variant="outlined"
              />
            )}
            <TaskRefresh loading={loading} onRequestData={requestData} />
          </Stack>
        </Stack>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: statusMessage && !loading ? 1.25 : 2.5 }}
        >
          Heartbeat status: Online within 30s · Stale from 31–90s · Offline after 90s
        </Typography>

        {statusMessage && !loading && (
          <Alert severity="info" variant="outlined" sx={{ mb: 2.5 }}>
            {statusMessage}
          </Alert>
        )}

        {loading ? (
          <Box
            sx={{
              minHeight: 240,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <CircularProgress size={32} />
          </Box>
        ) : clients.length > 0 ? (
          <Grid container spacing={1.5}>
            {clients.map(({ device, presence }, index) => {
              const clusterIdRaw = device?.clusterId ?? device?.cluster_id;
              const hasCluster =
                clusterIdRaw !== null
                && clusterIdRaw !== undefined
                && clusterIdRaw !== ''
                && clusterIdRaw !== 'None';

              return (
                <Grid item xs={12} lg={6} key={device?.Device_mac || index}>
                  <TaskDevice
                    device={device}
                    {...(hasCluster ? { clusterId: clusterIdRaw } : {})}
                    index={index}
                    presence={presence}
                  />
                </Grid>
              );
            })}
          </Grid>
        ) : (
          <Alert severity="info">
            No clients are connected yet. Start the launcher on a client and refresh this list.
          </Alert>
        )}
      </Paper>

      <Alert
        severity="info"
        icon={<StorageOutlinedIcon fontSize="inherit" />}
        action={(
          <Button
            component={Link}
            to={`/fedops/task/${encodeURIComponent(title)}/server-management`}
            color="inherit"
            size="small"
          >
            Open server management
          </Button>
        )}
      >
        Server lifecycle, resources, commands, files, and logs are managed in a dedicated tab.
      </Alert>

      <Paper
        variant="outlined"
        sx={{ p: { xs: 2, sm: 3 }, borderColor: 'divider' }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography variant="h6">Task actions</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {isV3Task
                ? 'Modify Registry metadata and participation policy. Code and model changes use a new Agent Studio Release.'
                : 'Modify FedOps 1.2 Legacy training settings or clean up task and Kubernetes resources.'}
            </Typography>
          </Box>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            useFlexGap
            flexWrap="wrap"
          >
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineRoundedIcon />}
              onClick={handleK8sDelete}
            >
              Delete K8s resources
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={deleting
                ? <CircularProgress size={16} color="inherit" />
                : <DeleteOutlineRoundedIcon />}
              disabled={deleting}
              onClick={() => {
                const confirmed = window.confirm(
                  'Are you sure you want to delete?\n'
                  + 'This action is irreversible.\n'
                  + 'All contents of this Federated Task will be lost.',
                );
                if (confirmed) {
                  handleDelete();
                }
              }}
            >
              {deleting ? 'Deleting…' : 'Delete task'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<EditOutlinedIcon />}
              onClick={handleEdit}
            >
              {isV3Task ? 'Modify metadata' : 'Modify Legacy settings'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
};

export default TaskDetailContent;
