import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import Header from '../components/common/Header';
import ContentWrapper from '../components/common/ContentWrapper';
import PageHeader from '../components/common/PageHeader';
import LoginRequiredNotice from '../components/auth/LoginRequiredNotice';
import useAuth from '../components/hooks/useAuth';
import * as tasksAPI from '../lib/api/tasks';
import { getTaskCardMetadata, getTaskModelKind } from '../lib/taskMetadata';

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

const PublicTasksPage = () => {
  const user = useAuth();
  const [tasks, setTasks] = useState([]);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [modelType, setModelType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    tasksAPI.listPublicTasks({
      q: submittedQuery || undefined,
      modelType: modelType || undefined,
    })
      .then((response) => {
        if (active) setTasks(response.data);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message
            || 'Failed to load the Federated Task Registry.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [submittedQuery, modelType, user]);

  const submitSearch = (event) => {
    event.preventDefault();
    setSubmittedQuery(query.trim());
  };

  if (!user) {
    return (
      <>
        <Header />
        <ContentWrapper>
          <PageHeader
            eyebrow="Federated learning"
            title="Registry"
            description="Discover published Federated Tasks and their global model resources."
          />
          <LoginRequiredNotice
            title="Sign in to browse the Registry"
            description={
              'Please sign in to explore Federated Tasks, inspect training details, '
              + 'use model resources, or request participation.'
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
          eyebrow="Federated learning"
          title="Registry"
          description="Explore published Federated Tasks, inspect their training context, use global models, or request to participate."
          meta={!loading && !error
            ? `${tasks.length} Federated Tasks in this view`
            : undefined}
        />

        <Paper
          component="form"
          variant="outlined"
          onSubmit={submitSearch}
          sx={{
            p: { xs: 2, md: 2.5 },
            mb: 4,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            alignItems={{ md: 'center' }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 108 }}>
              <TuneRoundedIcon sx={{ fontSize: 19, color: 'text.secondary' }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>Explore</Typography>
            </Stack>
            <TextField
              fullWidth
              size="small"
              placeholder="Search Federated Tasks, tags, or owners"
              aria-label="Search the Federated Task Registry"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ fontSize: 19, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 180 } }}>
              <InputLabel id="public-model-type-label">Model type</InputLabel>
              <Select
                labelId="public-model-type-label"
                value={modelType}
                label="Model type"
                onChange={(event) => setModelType(event.target.value)}
              >
                <MenuItem value="">All model types</MenuItem>
                <MenuItem value="AI">AI</MenuItem>
                <MenuItem value="LLM">LLM</MenuItem>
                <MenuItem value="Pytorch">Pytorch</MenuItem>
              </Select>
            </FormControl>
            <Button type="submit" variant="contained" sx={{ px: 3 }}>
              Search
            </Button>
          </Stack>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '38vh' }}>
            <CircularProgress size={28} />
          </Box>
        ) : tasks.length ? (
          <Grid container spacing={2.5}>
            {tasks.map((task) => {
              const ownerHandle = task.owner?.handle || 'unknown';
              const path = `/fedops/registry/${encodeURIComponent(ownerHandle)}/${encodeURIComponent(task.slug)}`;
              const modelKind = getTaskModelKind(task);
              const allMetadata = getTaskCardMetadata(task, 20).filter((item) => item.kind !== 'model');
              const metadata = allMetadata.slice(0, 3);
              const hiddenMetadata = allMetadata.length - metadata.length;
              return (
                <Grid
                  item
                  xs={12}
                  md={6}
                  lg={4}
                  key={task.id || `${ownerHandle}/${task.slug}`}
                >
                  <Card
                    sx={{
                      height: '100%',
                      backgroundColor: 'background.paper',
                      borderColor: 'divider',
                      boxShadow: '0 10px 30px rgba(24, 24, 24, 0.035)',
                      transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        backgroundColor: '#fff',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 16px 38px rgba(24, 24, 24, 0.08)',
                      },
                    }}
                  >
                    <CardActionArea
                      component={Link}
                      to={path}
                      sx={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'stretch',
                      }}
                    >
                      <CardContent
                        sx={{
                          width: '100%',
                          p: 3,
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          spacing={1}
                          sx={{ mb: 2.5 }}
                        >
                          <Stack direction="row" spacing={1}>
                            <Chip
                              label={modelKind}
                              size="small"
                              color={modelKind === 'LLM' ? 'secondary' : 'primary'}
                              variant="outlined"
                            />
                            <Chip
                              icon={<PublicOutlinedIcon />}
                              label="Public"
                              size="small"
                              sx={{
                                color: 'primary.dark',
                                backgroundColor: 'primary.light',
                                '& .MuiChip-icon': { color: 'primary.dark' },
                              }}
                            />
                            <Chip
                              label={
                                task.registryStatus === 'published'
                                  ? 'Published'
                                  : taskStatus[task.status] || task.status || 'Federated Task'
                              }
                              size="small"
                              variant="outlined"
                              sx={{ borderColor: 'divider' }}
                            />
                          </Stack>
                          <ArrowForwardRoundedIcon sx={{ fontSize: 19, color: 'text.secondary' }} />
                        </Stack>

                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mb: 0.75 }}
                        >
                          @{ownerHandle} / {task.slug || task.title}
                        </Typography>
                        <Typography variant="h5" component="h2" sx={{ mb: 1.25 }}>
                          {task.primaryModel?.displayName || task.primaryModel?.workingName || task.title}
                        </Typography>
                        {task.primaryModel && (
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                            Federated Task · {task.title}
                          </Typography>
                        )}
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mb: 3,
                            minHeight: 66,
                            display: '-webkit-box',
                            overflow: 'hidden',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 3,
                          }}
                        >
                          {task.summary || 'No summary provided.'}
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
                              label={item.label}
                              title={item.kind === 'model'
                                ? 'Model type'
                                : item.kind === 'strategy'
                                  ? 'Federated-learning strategy'
                                  : 'Federated Task tag'}
                              size="small"
                              variant="outlined"
                              sx={item.kind === 'tag' ? { backgroundColor: '#fafaf9' } : undefined}
                            />
                          ))}
                          {hiddenMetadata > 0 && (
                            <Chip label={`+${hiddenMetadata}`} size="small" variant="outlined" />
                          )}
                        </Stack>

                        <Box
                          sx={{
                            mt: 'auto',
                            pt: 2,
                            borderTop: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            spacing={1}
                          >
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <HubOutlinedIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {task.numRounds ? `${task.numRounds} rounds` : 'Rounds not set'}
                              </Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {formatDate(task.updatedAt || task.publishedAt)}
                            </Typography>
                          </Stack>
                        </Box>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        ) : (
          <Paper
            variant="outlined"
            sx={{ p: 5, textAlign: 'center', borderStyle: 'dashed' }}
          >
            <SearchRoundedIcon sx={{ color: 'text.secondary', mb: 1 }} />
            <Typography variant="h6">No matching Federated Tasks</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Try a different Federated Task name, owner, tag, or model type.
            </Typography>
          </Paper>
        )}
      </ContentWrapper>
    </>
  );
};

export default PublicTasksPage;
