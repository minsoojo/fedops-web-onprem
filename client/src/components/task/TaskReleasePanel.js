import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import {
  listTaskReleases,
  publishTaskRelease,
  withdrawTaskRelease,
} from '../../lib/api/taskReleases';

const date = (value) => (value ? new Date(value).toLocaleString() : '—');
const checksum = (value) => (value ? `${value.slice(0, 12)}…${value.slice(-8)}` : '—');

const TaskReleasePanel = ({ task, onChanged }) => {
  const taskId = task?.taskId || task?._id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!taskId) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await listTaskReleases(taskId);
      setItems(response.data.items || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Task Releases could not be loaded.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  const hasReadyRelease = items.some((release) => (
    release.status === 'ready' || release.status === 'published'
  ));

  useEffect(() => {
    if (!taskId || hasReadyRelease) return undefined;
    const refresh = () => {
      if (document.visibilityState === 'visible') load({ silent: true });
    };
    const timer = window.setInterval(refresh, 4000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [hasReadyRelease, load, taskId]);

  const change = async (release, action) => {
    setBusy(release.releaseId);
    setError('');
    try {
      if (action === 'publish') {
        await publishTaskRelease({
          taskId,
          releaseId: release.releaseId,
          makePublic: task?.visibility !== 'public',
        });
      } else {
        await withdrawTaskRelease({ taskId, releaseId: release.releaseId });
      }
      await load();
      if (onChanged) await onChanged();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'The Release state could not be changed.');
    } finally {
      setBusy('');
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderColor: 'divider' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <CloudUploadOutlinedIcon color="primary" />
            <Typography variant="h5">Registry Release</Typography>
            <Chip
              size="small"
              label={task?.registryStatus || 'draft'}
              color={task?.registryStatus === 'published' ? 'success' : 'default'}
              variant="outlined"
            />
          </Stack>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.75 }}>
            Develop and verify this Draft in FedOps Agent Studio. A Ready immutable
            Release appears here, and only Owner Publish makes it visible in Registry.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => load()} disabled={loading}>Refresh Releases</Button>
      </Stack>

      {task?.visibility !== 'public' && (
        <Alert severity="info" sx={{ mt: 2 }}>
          This Task is Private. Publishing the Ready Release will also make the
          Task Public in Registry.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={26} /></Box>
      ) : items.length ? (
        <Stack spacing={1.25} sx={{ mt: 2 }}>
          {items.map((release) => (
            <Paper key={release.releaseId} variant="outlined" sx={{ p: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                    <Typography fontWeight={600}>Revision {release.revision}</Typography>
                    <Chip size="small" label={release.status} color={release.status === 'published' ? 'success' : 'default'} />
                    <Chip size="small" variant="outlined" label={`${release.files?.length || 0} files`} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontFamily: 'monospace' }}>
                    {release.releaseId} · {checksum(release.bundleSha256)} · ready {date(release.readyAt)}
                  </Typography>
                </Box>
                {release.status === 'ready' && (
                  <Button
                    variant="contained"
                    startIcon={<PublicOutlinedIcon />}
                    disabled={busy === release.releaseId}
                    onClick={() => change(release, 'publish')}
                  >
                    {task?.visibility === 'public'
                      ? 'Owner Publish'
                      : 'Make Public & Owner Publish'}
                  </Button>
                )}
                {release.status === 'published' && (
                  <Button
                    variant="outlined"
                    color="warning"
                    disabled={busy === release.releaseId}
                    onClick={() => change(release, 'withdraw')}
                  >
                    Withdraw
                  </Button>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Alert severity="info" sx={{ mt: 2 }}>
          No Release Candidate has been submitted from FedOps Agent Studio yet.
        </Alert>
      )}
    </Paper>
  );
};

export default TaskReleasePanel;
