import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SwapVertRoundedIcon from '@mui/icons-material/SwapVertRounded';
import serverControlAPI from '../../lib/api/serverControlAPI';

const LogStreamer = ({
  taskId,
  filePath = '/app/data/logs/serverlog.txt',
  autoScroll = true,
}) => {
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [isAutoScroll, setIsAutoScroll] = useState(autoScroll);
  const [reconnectKey, setReconnectKey] = useState(0);
  const eventSourceRef = useRef(null);
  const logContainerRef = useRef(null);

  useEffect(() => {
    if (!taskId) return undefined;

    setIsConnected(false);
    const eventSource = serverControlAPI.streamLogs(
      taskId,
      filePath,
      (data) => {
        if (data.type === 'initial') {
          setLogs([{ type: 'initial', content: data.content, timestamp: Date.now() }]);
          setIsConnected(true);
          setError(null);
        } else if (data.type === 'update') {
          setLogs((currentLogs) => [
            ...currentLogs,
            { type: 'update', content: data.content, timestamp: Date.now() },
          ]);
        } else if (data.type === 'error') {
          setError(data.content);
        }
      },
      () => {
        setIsConnected(false);
        setError('The live log connection was interrupted. Reconnect to try again.');
      },
    );

    eventSourceRef.current = eventSource;
    eventSource.addEventListener('open', () => {
      setIsConnected(true);
      setError(null);
    });

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [taskId, filePath, reconnectKey]);

  useEffect(() => {
    if (isAutoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isAutoScroll]);

  const handleReconnect = () => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    setLogs([]);
    setError(null);
    setReconnectKey((current) => current + 1);
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderColor: 'divider' }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6">Live server log</Typography>
            <Chip
              size="small"
              label={isConnected ? 'Connected' : 'Disconnected'}
              color={isConnected ? 'success' : 'default'}
              variant="outlined"
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {filePath} · {logs.length} streamed entries
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Button
            size="small"
            variant="outlined"
            startIcon={<SwapVertRoundedIcon />}
            onClick={() => setIsAutoScroll((current) => !current)}
          >
            Auto-scroll {isAutoScroll ? 'on' : 'off'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DeleteSweepOutlinedIcon />}
            onClick={() => setLogs([])}
          >
            Clear
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={handleReconnect}
          >
            Reconnect
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        ref={logContainerRef}
        sx={{
          minHeight: 220,
          maxHeight: 500,
          p: 2,
          overflow: 'auto',
          color: '#d6d3d1',
          backgroundColor: '#1c1917',
          border: '1px solid #292524',
          borderRadius: 1,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '0.75rem',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {logs.length === 0 ? (
          <Box sx={{ py: 8, color: '#78716c', textAlign: 'center' }}>
            {isConnected ? 'Waiting for log output…' : 'Connecting to the live log stream…'}
          </Box>
        ) : (
          logs.map((log, index) => (
            <Box
              key={`${log.timestamp}-${index}`}
              sx={{
                mb: 0.5,
                color: log.type === 'update' ? '#5eead4' : '#7dd3fc',
              }}
            >
              <Box component="span" sx={{ mr: 1, color: '#78716c' }}>
                [{new Date(log.timestamp).toLocaleTimeString()}]
              </Box>
              {log.content}
            </Box>
          ))
        )}
      </Box>
    </Paper>
  );
};

export default LogStreamer;
