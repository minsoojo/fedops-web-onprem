import React, { useEffect } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import Header from '../components/common/Header';
import ContentWrapper from '../components/common/ContentWrapper';
import NavTabs from '../components/task/NavTabs';
import MonitoringPage from './MonitoringPage';
import TaskDetailContent from '../components/task/TaskDetailContent';
import ProtectedRoute from '../components/route/ProtectedRoute';
import GlobalModelPage from './GlobalModelPage';
import ServerManagementPage from './ServerManagementPage';
import SbaFlManagePage from './SbaFlManagePage';
import { readTask } from '../modules/task';
import TaskParticipantsPage from './TaskParticipantsPage';
import { formatStrategyLabel } from '../lib/taskMetadata';
import TaskReleasePanel from '../components/task/TaskReleasePanel';

const taskStatus = {
  not_start: 'Not started',
  creating: 'Preparing',
  waiting: 'Ready',
  training: 'Training',
  completed: 'Completed',
};

const TaskDetailPage = () => {
  const { title } = useParams();
  const dispatch = useDispatch();
  const { task } = useSelector((state) => state.task);
  const { user } = useSelector((state) => state.user);
  const isAdmin = user?.isAdmin === true || user?.username === 'ccl@ccl.com';
  const showSbaFlManage = isAdmin && task?.title === title && task?.modelType === 'SBA-FL';
  const showRegistryRelease = task?.runtimeContract?.name === 'federated-task-v3';
  const isPublic = task?.visibility === 'public';
  const registryVisible = task?.registryStatus === 'published'
    || (isPublic && !task?.registryStatus);
  const publicTaskPath = registryVisible && task?.ownerHandle && task?.slug
    ? `/fedops/registry/${encodeURIComponent(task.ownerHandle)}/${encodeURIComponent(task.slug)}`
    : null;

  useEffect(() => {
    dispatch(readTask(title));
  }, [dispatch, title]);

  return (
    <>
      <Header />
      <ContentWrapper>
        <Box sx={{ pb: 8 }}>
          <Button
            component={Link}
            to="/fedops/task"
            variant="text"
            startIcon={<ArrowBackRoundedIcon />}
            sx={{ mb: 2, ml: -1 }}
          >
            Back to My Federated Tasks
          </Button>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'flex-end' }}
            spacing={3}
            sx={{ mb: 3 }}
          >
            <Box>
              <Typography
                variant="caption"
                color="primary.dark"
                sx={{
                  display: 'block',
                  mb: 1,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Federated Task management
              </Typography>
              <Typography variant="h3" component="h1" sx={{ mb: 1 }}>
                {task?.displayName || task?.title || title}
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ maxWidth: 700 }}
              >
                {task?.summary
                  || task?.description
                  || 'Configure clients, monitor training, and manage global model artifacts.'}
              </Typography>
            </Box>

            {publicTaskPath && (
              <Button
                component={Link}
                to={publicTaskPath}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                endIcon={<OpenInNewRoundedIcon />}
              >
                View in Registry
              </Button>
            )}
          </Stack>

          <Stack
            direction="row"
            spacing={0.75}
            useFlexGap
            flexWrap="wrap"
            sx={{ mb: 3 }}
          >
            <Chip
              size="small"
              icon={isPublic ? <PublicOutlinedIcon /> : <LockOutlinedIcon />}
              label={isPublic ? 'Public' : 'Private'}
              sx={isPublic ? {
                color: 'primary.dark',
                backgroundColor: 'primary.light',
                '& .MuiChip-icon': { color: 'primary.dark' },
              } : {
                backgroundColor: '#f3f3f3',
              }}
            />
            <Chip
              size="small"
              label={taskStatus[task?.status] || task?.status || 'Federated Task'}
              variant="outlined"
            />
            {task?.modelType && (
              <Chip size="small" label={task.modelType} variant="outlined" />
            )}
            {task?.strategy && (
              <Chip
                size="small"
                label={formatStrategyLabel(task.strategy)}
                variant="outlined"
              />
            )}
          </Stack>

          <Paper
            variant="outlined"
            sx={{
              overflow: 'hidden',
              borderColor: 'divider',
              backgroundColor: 'background.paper',
            }}
          >
            <NavTabs
              title={title}
              showRegistryRelease={showRegistryRelease}
              showSbaFlManage={showSbaFlManage}
            />
          </Paper>

          <Box sx={{ mt: 3 }}>
            <Routes>
              <Route path="/" element={<TaskDetailContent title={title} />} />
              {showRegistryRelease && (
                <Route
                  path="registry-release"
                  element={(
                    <TaskReleasePanel
                      task={task}
                      onChanged={() => dispatch(readTask(title))}
                    />
                  )}
                />
              )}
              <Route
                path="monitoring"
                element={
                  <ProtectedRoute component={MonitoringPage} title={title} />
                }
              />
              <Route
                path="global-model"
                element={
                  <ProtectedRoute component={GlobalModelPage} title={title} />
                }
              />
              <Route
                path="server-management"
                element={
                  <ProtectedRoute component={ServerManagementPage} title={title} />
                }
              />
              <Route
                path="participants"
                element={
                  <ProtectedRoute component={TaskParticipantsPage} title={title} />
                }
              />
              <Route
                path="sba-fl-manage"
                element={
                  <ProtectedRoute component={SbaFlManagePage} title={title} />
                }
              />
            </Routes>
          </Box>
        </Box>
      </ContentWrapper>
    </>
  );
};

export default TaskDetailPage;
