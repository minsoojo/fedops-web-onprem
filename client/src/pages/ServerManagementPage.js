import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import ServerControl from '../components/monitoring/ServerControl';

const ServerManagementPage = ({ title }) => {
  const params = useParams();
  const [taskId, setTaskId] = useState(title || params.title || '');
  const [activeTaskId, setActiveTaskId] = useState(title || params.title || '');

  const handleSetTaskId = () => {
    if (taskId.trim()) {
      setActiveTaskId(taskId.trim());
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <StorageOutlinedIcon color="primary" />
          <Typography variant="h5" component="h2">
            FL Server Management
          </Typography>
        </Stack>
        <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
          Manage server lifecycle, compute resources, commands, persistent files, and logs.
        </Typography>
      </Box>

      <Alert severity="warning" variant="outlined">
        Server operations can change live Kubernetes resources. Check the current task ID and
        server status before running an action.
      </Alert>

      {!title && (
        <Paper variant="outlined" sx={{ p: 2.5, borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Load task
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              fullWidth
              size="small"
              label="Task ID"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              placeholder="e.g. task123"
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSetTaskId();
              }}
            />
            <Button variant="contained" onClick={handleSetTaskId}>
              Load Server Control
            </Button>
          </Stack>
          {activeTaskId && (
            <Typography variant="body2" color="success.main" sx={{ mt: 1.5 }}>
              Current Task ID: <strong>{activeTaskId}</strong>
            </Typography>
          )}
        </Paper>
      )}

      {activeTaskId && <ServerControl taskId={activeTaskId} />}
    </Stack>
  );
};

export default ServerManagementPage;
