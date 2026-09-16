import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { listModels, resetModels } from '../modules/model.js';
import { readTask } from '../modules/task';
import serverControlAPI from '../lib/api/serverControlAPI';
import {
  Alert,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  CircularProgress,
  Stack,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';

const ModelHeader = ({ title, description }) => (
  <Box sx={{ mb: 3 }}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Inventory2OutlinedIcon color="primary" />
      <Typography variant="h5" component="h2">
        {title}
      </Typography>
    </Stack>
    <Typography color="text.secondary" sx={{ mt: 0.75 }}>
      {description}
    </Typography>
  </Box>
);

const GlobalModelPage = () => {
  const { title } = useParams();
  const dispatch = useDispatch();
  const { models } = useSelector((state) => state.model);
  const { task } = useSelector((state) => state.task);
  const { user } = useSelector((state) => state.user);
  const [sbaModels, setSbaModels] = React.useState(null);
  const [sbaError, setSbaError] = React.useState('');
  const isAdmin = user?.isAdmin === true || user?.username === 'ccl@ccl.com';
  const isSbaFl = isAdmin && task?.title === title && task?.modelType === 'SBA-FL';

  useEffect(() => {
    dispatch(readTask(title));
  }, [dispatch, title]);

  useEffect(() => {
    if (!isSbaFl) return;
    setSbaError('');
    serverControlAPI.getSbaFlModels(title)
      .then((result) => setSbaModels(result.models || []))
      .catch((error) => setSbaError(error.message));
  }, [isSbaFl, title]);

  useEffect(() => {
    if (!isSbaFl) {
      dispatch(listModels(title));
    }
    // Cleanup function
    return () => {
      dispatch(resetModels());
    };
  }, [dispatch, title, isSbaFl]);

  if (isSbaFl) {
    if (!sbaModels && !sbaError) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (sbaError) {
      return <Typography color="error">{sbaError}</Typography>;
    }

    return (
      <>
        <ModelHeader
          title="SBA-FL Global Models"
          description="Download global model artifacts produced by this SBA-FL task."
        />
        <TableContainer component={Paper} variant="outlined" sx={{ borderColor: 'divider' }}>
          <Table sx={{ minWidth: 650 }} aria-label="sba fl global models table">
            <TableHead>
              <TableRow>
                <TableCell>Model Name</TableCell>
                <TableCell>Size</TableCell>
                <TableCell align="right"> </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sbaModels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>No SBA-FL global model artifacts found.</TableCell>
                </TableRow>
              )}
              {sbaModels.map((model) => (
                <TableRow key={model.name}>
                  <TableCell component="th" scope="row">
                    {model.name}
                  </TableCell>
                  <TableCell>{model.sizeBytes} bytes</TableCell>
                  <TableCell align="right">
                    <Button
                      variant="contained"
                      color="primary"
                      href={model.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      startIcon={<DownloadRoundedIcon />}
                    >
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </>
    );
  }

  if (!models) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (models.length === 0) {
    return (
      <>
        <ModelHeader
          title="Global Models"
          description="Download global model artifacts produced by this Federated Task."
        />
        <Alert severity="info">No global model artifacts are available yet.</Alert>
      </>
    );
  }

  return (
    <>
      <ModelHeader
        title="Global Models"
        description="Download global model artifacts produced by this Federated Task."
      />
      <TableContainer component={Paper} variant="outlined" sx={{ borderColor: 'divider' }}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Model Name</TableCell>
              <TableCell align="right"> </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.name}>
                <TableCell component="th" scope="row">
                  {model.name}
                </TableCell>
                <TableCell align="right">
                  <Button
                    variant="contained"
                    color="primary"
                    href={model.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<DownloadRoundedIcon />}
                  >
                    Download
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};

export default GlobalModelPage;
