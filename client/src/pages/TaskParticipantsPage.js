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
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import * as tasksAPI from '../lib/api/tasks';

const statusColor = {
  requested: 'warning',
  approved: 'success',
  rejected: 'error',
  revoked: 'default',
  left: 'default',
};

const TaskParticipantsPage = ({ title }) => {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadParticipants = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await tasksAPI.listParticipants(title);
      setParticipants(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load participants.');
    } finally {
      setLoading(false);
    }
  }, [title]);

  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

  const review = async (participantId, status) => {
    try {
      await tasksAPI.reviewParticipant({ title, participantId, status });
      await loadParticipants();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to update participation.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <GroupsOutlinedIcon color="primary" />
          <Typography variant="h5" component="h2">
            Participants
          </Typography>
        </Stack>
        <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
          Review join requests and manage approved access to this task.
        </Typography>
      </Box>

      <Alert severity="info" variant="outlined">
        Approval grants task and model read access. Participants cannot change task settings or
        operate server resources.
      </Alert>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {participants.length ? (
        <Stack spacing={1.5}>
          {participants.map((participant) => (
            <Paper
              variant="outlined"
              key={participant._id}
              sx={{ p: 2.5, borderColor: 'divider' }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', sm: 'center' }}
                spacing={2}
              >
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body1" fontWeight={600}>
                      @{participant.userHandle || 'unknown'}
                    </Typography>
                    <Chip
                      size="small"
                      label={participant.status}
                      color={statusColor[participant.status] || 'default'}
                      variant={participant.status === 'approved' ? 'filled' : 'outlined'}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {participant.requestedAt
                      ? `Requested ${new Date(participant.requestedAt).toLocaleString()}`
                      : 'Request date unavailable'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {`${participant.completedParticipationCount || 0} completed FL runs`}
                    {participant.lastParticipatedAt
                      ? ` · Last ${new Date(participant.lastParticipatedAt).toLocaleString()}`
                      : ''}
                  </Typography>
                </Box>

                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  flexWrap="wrap"
                  justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
                >
                  {participant.status === 'requested' && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => review(participant._id, 'approved')}
                    >
                      Approve
                    </Button>
                  )}
                  {participant.status === 'requested' && (
                    <Button
                      size="small"
                      color="error"
                      onClick={() => review(participant._id, 'rejected')}
                    >
                      Reject
                    </Button>
                  )}
                  {participant.status === 'approved' && (
                    <Button
                      size="small"
                      color="warning"
                      onClick={() => review(participant._id, 'revoked')}
                    >
                      Revoke
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Alert severity="info">No participation requests yet.</Alert>
      )}
    </Stack>
  );
};

export default TaskParticipantsPage;
