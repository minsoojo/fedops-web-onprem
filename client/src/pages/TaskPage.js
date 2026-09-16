import React, { useEffect, useState } from 'react';
import qs from 'qs';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import Header from '../components/common/Header';
import ContentWrapper from '../components/common/ContentWrapper';
import PageHeader from '../components/common/PageHeader';
import LoginRequiredNotice from '../components/auth/LoginRequiredNotice';
import useAuth from '../components/hooks/useAuth';
import { listTasks, removeTaskFromList } from '../modules/tasks';
import { setOriginalTask } from '../modules/create';
import * as tasksAPI from '../lib/api/tasks';
import { getTaskCardMetadata } from '../lib/taskMetadata';

const taskStatus = {
  not_start: 'Not started',
  creating: 'Preparing',
  waiting: 'Ready',
  training: 'Training',
  completed: 'Completed',
};

const formatDate = (value) => {
  if (!value) return 'No update time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently updated';
  return `Updated ${date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })}`;
};

const TaskItem = ({ task, onDeleted }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const date = task.updatedAt || task.createdAt || task.publishedDate;
  const isOwner = task.membership?.role === 'owner' || task.permissions?.isOwner;
  const canManage = Boolean(task.permissions?.canManage || isOwner);
  const isAdminAccess = canManage && !isOwner;
  const metadata = getTaskCardMetadata(task);
  const isV3Task = task?.runtimeContract?.name === 'federated-task-v3';
  const joinedRegistryHandle = task.owner?.handle || task.ownerHandle;
  const detailPath = canManage
    ? `/fedops/task/${encodeURIComponent(task.title)}`
    : joinedRegistryHandle && task.slug
      ? `/fedops/registry/${encodeURIComponent(joinedRegistryHandle)}/${encodeURIComponent(task.slug)}`
      : `/fedops/shared/${encodeURIComponent(task.runtimeKey || task.title)}`;

  const handleDelete = async () => {
    setAnchorEl(null);
    if (!window.confirm(
      `Delete Federated Task "${task.title}" and its Kubernetes resources?`,
    )) return;
    try {
      await tasksAPI.removeTask(task.title);
      dispatch(removeTaskFromList(task.title));
      onDeleted();
    } catch (error) {
      window.alert(
        error.response?.data?.message || 'Failed to delete the Federated Task.',
      );
    }
  };

  const handleEdit = () => {
    setAnchorEl(null);
    dispatch(setOriginalTask(task));
    navigate('/fedops/task/create', {
      state: { isEdit: true, editId: task.title, task },
    });
  };

  return (
    <Grid item xs={12} md={6}>
      <Card
        sx={{
          height: '100%',
          position: 'relative',
          backgroundColor: 'background.paper',
          '&:hover': { borderColor: 'primary.main' },
        }}
      >
        <CardActionArea
          component={Link}
          to={detailPath}
          sx={{ height: '100%', display: 'flex', alignItems: 'stretch' }}
        >
          <CardContent
            sx={{
              width: '100%',
              p: 3,
              pr: canManage ? 7 : 3,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Stack
              direction="row"
              spacing={0.75}
              useFlexGap
              flexWrap="wrap"
              sx={{ mb: 2.5 }}
            >
              <Chip
                size="small"
                icon={task.visibility === 'public' ? <PublicOutlinedIcon /> : undefined}
                label={task.visibility === 'public' ? 'Public' : 'Private'}
                sx={task.visibility === 'public' ? {
                  color: 'primary.dark',
                  backgroundColor: 'primary.light',
                  '& .MuiChip-icon': { color: 'primary.dark' },
                } : {
                  backgroundColor: '#f3f3f3',
                }}
              />
              <Chip
                size="small"
                icon={canManage ? <SettingsOutlinedIcon /> : <GroupsOutlinedIcon />}
                label={isOwner ? 'Owner' : isAdminAccess ? 'Admin access' : 'Joined'}
                variant="outlined"
                sx={{ borderColor: 'divider' }}
              />
              <Chip
                size="small"
                label={taskStatus[task.status] || task.status || 'Federated Task'}
                variant="outlined"
                sx={{ borderColor: 'divider' }}
              />
            </Stack>

            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-start"
              spacing={2}
            >
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 0.75 }}
                >
                  {isOwner
                    ? 'Owned by you'
                    : isAdminAccess
                      ? 'Administrative management access'
                      : 'Approved participation'}
                </Typography>
                <Typography variant="h5" component="h2">
                  {task.displayName || task.title}
                </Typography>
              </Box>
              {!canManage && (
                <ArrowForwardRoundedIcon sx={{ mt: 0.5, color: 'text.secondary' }} />
              )}
            </Stack>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                my: 2,
                minHeight: 46,
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
              }}
            >
              {task.summary || task.description || 'No summary provided.'}
            </Typography>

            <Stack
              direction="row"
              spacing={0.75}
              useFlexGap
              flexWrap="wrap"
              sx={{ mb: 3 }}
            >
              {metadata.map((item) => (
                <Chip
                  key={`${item.kind}-${item.label}`}
                  size="small"
                  label={item.label}
                  title={item.kind === 'model'
                    ? 'Model type'
                    : item.kind === 'strategy'
                      ? 'Federated-learning strategy'
                      : 'Federated Task tag'}
                  variant="outlined"
                  sx={item.kind === 'tag' ? { backgroundColor: '#fafaf9' } : undefined}
                />
              ))}
            </Stack>

            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={1}
              sx={{
                mt: 'auto',
                pt: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" spacing={0.75} alignItems="center">
                <HubOutlinedIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  {task.numRounds ? `${task.numRounds} rounds` : 'Rounds not set'}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" noWrap>
                {formatDate(date)}
              </Typography>
            </Stack>
          </CardContent>
        </CardActionArea>

        {canManage && (
          <>
            <IconButton
              aria-label={`Manage ${task.displayName || task.title}`}
              aria-controls={anchorEl ? `task-menu-${task.title}` : undefined}
              aria-expanded={Boolean(anchorEl)}
              onClick={(event) => setAnchorEl(event.currentTarget)}
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 34,
                height: 34,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                backgroundColor: 'background.paper',
              }}
            >
              <MoreHorizRoundedIcon fontSize="small" />
            </IconButton>
            <Menu
              id={`task-menu-${task.title}`}
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
            >
              <MenuItem onClick={handleEdit}>
                {isV3Task ? 'Modify metadata' : 'Modify Legacy settings'}
              </MenuItem>
              <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                Delete
              </MenuItem>
            </Menu>
          </>
        )}
      </Card>
    </Grid>
  );
};

const TaskPage = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const user = useAuth();
  const [scope, setScope] = useState('owned');
  const [visibility, setVisibility] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const { tasks, error, loading } = useSelector(({ tasks: taskState, loading: loadingState }) => ({
    tasks: taskState.tasks,
    error: taskState.error,
    loading: loadingState['tasks/LIST_TASKS'],
  }));

  useEffect(() => {
    if (!user) return;
    const { tag, page } = qs.parse(location.search, { ignoreQueryPrefix: true });
    dispatch(listTasks({
      tag,
      page,
      scope,
      visibility: visibility === 'all' ? undefined : visibility,
    }));
  }, [dispatch, location.search, scope, user, visibility, refreshKey]);

  const description = scope === 'owned'
    ? 'Create, configure, and operate the Federated Tasks you own.'
    : 'Follow joined Federated Tasks, training progress, and global model artifacts.';

  if (!user) {
    return (
      <>
        <Header />
        <ContentWrapper>
          <PageHeader
            eyebrow="Workspace"
            title="My Federated Tasks"
            description="Manage the Federated Tasks you own and follow the ones you have joined."
          />
          <LoginRequiredNotice
            title="Sign in to view My Federated Tasks"
            description={
              'Please sign in to view, create, or manage your Federated Tasks '
              + 'and approved participation.'
            }
          />
        </ContentWrapper>
      </>
    );
  }

  return (
    <>
      <Header />
      <ContentWrapper>
        <PageHeader
          eyebrow="Workspace"
          title={scope === 'owned' ? 'My Federated Tasks' : 'Joined Federated Tasks'}
          description={description}
          meta={!loading && !error
            ? `${tasks?.length || 0} Federated Tasks in this view`
            : undefined}
          action={(
            <Button
              component={Link}
              to="/fedops/task/create"
              variant="contained"
              startIcon={<AddRoundedIcon />}
            >
              Create Federated Task
            </Button>
          )}
        />

        <Paper
          variant="outlined"
          sx={{
            p: 1,
            mb: 2,
            display: 'inline-flex',
            borderColor: 'divider',
            borderRadius: 9999,
            backgroundColor: 'background.paper',
          }}
        >
          <Tabs
            value={scope}
            onChange={(_, value) => setScope(value)}
            aria-label="Federated Task membership"
            TabIndicatorProps={{ sx: { display: 'none' } }}
            sx={{
              minHeight: 40,
              '& .MuiTabs-flexContainer': { gap: 0.5 },
              '& .MuiTab-root': {
                minHeight: 40,
                px: 2.5,
                borderRadius: 9999,
                color: 'text.secondary',
              },
              '& .Mui-selected': {
                color: '#fff !important',
                backgroundColor: '#181818',
              },
            }}
          >
            <Tab value="owned" label="My Federated Tasks" />
            <Tab value="joined" label="Joined Federated Tasks" />
          </Tabs>
        </Paper>

        <Tabs
          value={visibility}
          onChange={(_, value) => setVisibility(value)}
          aria-label="Federated Task visibility"
          TabIndicatorProps={{ sx: { display: 'none' } }}
          sx={{
            minHeight: 36,
            mb: 4,
            '& .MuiTabs-flexContainer': { gap: 0.75 },
            '& .MuiTab-root': {
              minWidth: 0,
              minHeight: 36,
              px: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 9999,
              color: 'text.secondary',
              backgroundColor: 'background.paper',
            },
            '& .Mui-selected': {
              color: 'primary.dark !important',
              borderColor: 'primary.main',
              backgroundColor: 'primary.light',
            },
          }}
        >
          <Tab value="all" label="All" />
          <Tab value="public" label="Public" />
          <Tab value="private" label="Private" />
        </Tabs>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Failed to load your Federated Tasks.
          </Alert>
        )}
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '38vh' }}>
            <CircularProgress size={28} />
          </Box>
        ) : tasks?.length ? (
          <Grid container spacing={2.5}>
            {tasks.map((task) => (
              <TaskItem
                key={task._id || task.id}
                task={task}
                onDeleted={() => setRefreshKey((value) => value + 1)}
              />
            ))}
          </Grid>
        ) : (
          <Paper
            variant="outlined"
            sx={{ p: 5, textAlign: 'center', borderStyle: 'dashed' }}
          >
            <Typography variant="h6">No Federated Tasks in this view</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {scope === 'owned'
                ? 'Create a Federated Task or change the visibility filter.'
                : 'Approved Federated Task participation will appear here.'}
            </Typography>
          </Paper>
        )}
      </ContentWrapper>
    </>
  );
};

export default TaskPage;
