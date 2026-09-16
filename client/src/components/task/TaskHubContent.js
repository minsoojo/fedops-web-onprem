import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ModelTrainingOutlinedIcon from '@mui/icons-material/ModelTrainingOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip as ChartTooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { loginPathFor } from '../../lib/authNavigation';
import { getTaskModelKind } from '../../lib/taskMetadata';

ChartJS.register(
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  ChartTooltip,
);

const formatBytes = (size) => {
  if (!Number.isFinite(size)) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const formatCount = (value) => (
  Number.isFinite(value) ? value.toLocaleString() : '—'
);

const formatMetric = (value, type) => {
  if (!Number.isFinite(value)) return '—';
  if (type === 'accuracy' && value >= 0 && value <= 1) {
    return `${(value * 100).toFixed(2)}%`;
  }
  return value.toFixed(4);
};

const statusMeta = {
  not_started: { label: 'Not started', color: 'default' },
  preparing: { label: 'Preparing', color: 'info' },
  ready: { label: 'Ready', color: 'warning' },
  training: { label: 'Training', color: 'success' },
  paused: { label: 'Paused', color: 'warning' },
  completed: { label: 'Completed', color: 'primary' },
  failed: { label: 'Failed', color: 'error' },
};

const taskHubPaperSx = {
  minWidth: 0,
  borderColor: 'divider',
  borderRadius: 2.5,
  backgroundColor: 'background.paper',
  boxShadow: '0 10px 30px rgba(24, 24, 24, 0.035)',
};

const MetricCard = ({ label, value, helper }) => (
  <Paper variant="outlined" sx={{ ...taskHubPaperSx, p: 2, height: '100%' }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="h5" sx={{ mt: 0.5 }}>{value}</Typography>
    {helper && (
      <Typography variant="caption" color="text.secondary">{helper}</Typography>
    )}
  </Paper>
);

const TaskFact = ({ label, value, mono = false }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography
        variant="body2"
        sx={{ mt: 0.35, fontFamily: mono ? 'monospace' : 'inherit', overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Box>
  );
};

const TaskCardPanel = ({ task, usage, activity, models, files, onUpdateTaskCard }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.cardMarkdown || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setDraft(task.cardMarkdown || '');
  }, [task.cardMarkdown]);

  const save = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await onUpdateTaskCard(draft);
      setEditing(false);
    } catch (error) {
      setSaveError(
        error.response?.data?.message
        || 'The Federated Task Card could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 3fr) minmax(260px, 1fr)' },
          gap: { xs: 2, lg: 2.5 },
          alignItems: 'start',
          width: '100%',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Paper
            variant="outlined"
            sx={{
              overflow: 'hidden',
              borderColor: 'divider',
              borderRadius: 2.5,
              backgroundColor: 'background.paper',
              boxShadow: '0 14px 40px rgba(24, 24, 24, 0.045)',
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              spacing={2}
              sx={{
                px: { xs: 2.25, md: 3.25 },
                py: { xs: 2, md: 2.25 },
                borderBottom: '1px solid',
                borderColor: 'divider',
                background: 'linear-gradient(120deg, rgba(59, 166, 241, 0.10), rgba(232, 245, 253, 0.42) 38%, rgba(255, 255, 255, 0) 76%)',
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    borderRadius: 1.5,
                    color: 'primary.main',
                    backgroundColor: 'rgba(59, 166, 241, 0.12)',
                    border: '1px solid rgba(59, 166, 241, 0.20)',
                  }}
                >
                  <ArticleOutlinedIcon sx={{ fontSize: 21 }} />
                </Box>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mb: 0.25 }}>
                    <Typography component="h2" sx={{ fontSize: 18, lineHeight: 1.3, fontWeight: 700 }}>
                      Federated Task Card
                    </Typography>
                    <Chip
                      label={task.registryStatus === 'published' ? 'Release README' : 'Draft Markdown'}
                      size="small"
                      variant="outlined"
                      color={task.registryStatus === 'published' ? 'success' : 'default'}
                      sx={{ height: 23, fontSize: 11.5 }}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
                    Intended use, training contract, and privacy guidance from the owner.
                  </Typography>
                </Box>
              </Stack>
              {task.registryStatus !== 'published'
                && task.permissions?.canManage
                && onUpdateTaskCard && (
                <Button
                  variant="outlined"
                  startIcon={<EditOutlinedIcon />}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
              )}
            </Stack>
            <Box
              className="fedops-markdown"
              sx={{
                px: { xs: 2.25, md: 3.25, xl: 4 },
                py: { xs: 2.25, md: 3 },
                fontSize: { xs: '0.9rem', md: '0.94rem' },
                lineHeight: 1.68,
                '& > :first-of-type': { mt: 0 },
                '& h1': { mt: 3, mb: 1, fontSize: { xs: '1.45rem', md: '1.65rem' }, fontWeight: 650 },
                '& h2': { mt: 3, mb: 1, fontSize: { xs: '1.18rem', md: '1.28rem' }, fontWeight: 650 },
                '& h3': { mt: 2.25, mb: 0.75, fontSize: { xs: '1rem', md: '1.06rem' }, fontWeight: 650 },
                '& p, & li': { lineHeight: 1.68 },
                '& ul, & ol': { pl: 3 },
                '& pre': {
                  overflowX: 'auto',
                  p: 1.75,
                  borderRadius: 1.5,
                  backgroundColor: 'grey.100',
                },
                '& code': { wordBreak: 'break-word' },
                '& table': { fontSize: '0.88rem' },
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {task.cardMarkdown
                  || `# ${task.title}\n\n${task.description || task.summary || 'No description provided.'}`}
              </ReactMarkdown>
            </Box>
          </Paper>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: { lg: 24 } }}>
            <Paper variant="outlined" sx={{ ...taskHubPaperSx, p: 2.5 }}>
              <Typography variant="overline" color="primary.main" sx={{ fontSize: 10.5, letterSpacing: '0.1em' }}>Model identity</Typography>
              <Typography sx={{ mb: 1.5, fontSize: 17, fontWeight: 700 }}>At a glance</Typography>
              <Stack direction="row" spacing={0.65} useFlexGap flexWrap="wrap" sx={{ mb: 2.25 }}>
                <Chip label={getTaskModelKind(task)} size="small" color={getTaskModelKind(task) === 'LLM' ? 'secondary' : 'primary'} />
                {task.taskCategory && <Chip label={task.taskCategory} size="small" variant="outlined" />}
                {task.dataModality && <Chip label={task.dataModality} size="small" variant="outlined" />}
              </Stack>
              <Stack spacing={1.5} divider={<Divider flexItem />}>
                <TaskFact label="Primary model" value={task.primaryModel?.displayName || task.primaryModel?.workingName || task.title} />
                <TaskFact label="Framework · format" value={[task.primaryModel?.framework, task.primaryModel?.format].filter(Boolean).join(' · ')} />
                <TaskFact label="Owner" value={`@${task.owner?.handle || task.ownerHandle || 'unknown'}`} mono />
                <TaskFact label="Published release" value={task.currentPublishedReleaseId || (task.registryStatus === 'published' ? 'Published' : 'Not published')} mono={Boolean(task.currentPublishedReleaseId)} />
                <TaskFact label="Published" value={formatDate(task.publishedAt)} />
                <TaskFact label="Join policy" value={(task.participationPolicy || 'approval_required').replaceAll('_', ' ')} />
                <TaskFact label="Files & model access" value="Owner and approved FL participants" />
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ ...taskHubPaperSx, p: 2.5 }}>
              <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10.5, letterSpacing: '0.1em' }}>Community & release</Typography>
              <Grid container spacing={1.5} sx={{ mt: 0.25 }}>
                <Grid item xs={6}>
                  <Typography sx={{ fontSize: 20, fontWeight: 650 }}>{formatCount(usage?.approvedParticipants ?? activity?.participants?.approved)}</Typography>
                  <Typography variant="caption" color="text.secondary">FL participants</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography sx={{ fontSize: 20, fontWeight: 650 }}>{formatCount(usage?.modelDownloads)}</Typography>
                  <Typography variant="caption" color="text.secondary">Model downloads</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography sx={{ fontSize: 20, fontWeight: 650 }}>{models.length}</Typography>
                  <Typography variant="caption" color="text.secondary">Model versions</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography sx={{ fontSize: 20, fontWeight: 650 }}>{files.length}</Typography>
                  <Typography variant="caption" color="text.secondary">Task files</Typography>
                </Grid>
              </Grid>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary">
                Updated {formatDate(task.updatedAt)}
              </Typography>
            </Paper>
          </Stack>
        </Box>
      </Box>

      <Dialog
        open={editing}
        onClose={() => !saving && setEditing(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>Edit Federated Task Card</DialogTitle>
        <DialogContent dividers data-color-mode="light">
          <Alert severity="info" sx={{ mb: 2 }}>
            Describe input features, expected preprocessing, intended use, limitations,
            and privacy boundaries. The card is rendered as Markdown.
          </Alert>
          {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
          <MDEditor
            value={draft}
            onChange={(value) => setDraft(value || '')}
            height={520}
            preview="live"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={saving || !draft.trim()}
          >
            {saving ? 'Saving…' : 'Save Federated Task Card'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const TrainingPanel = ({ activity, activityError }) => {
  if (activityError) return <Alert severity="warning">{activityError}</Alert>;
  if (!activity) return <Alert severity="info">Training activity is not available yet.</Alert>;

  const { run, participants, metrics, source } = activity;
  return (
    <Stack spacing={2.5} sx={{ width: '100%', minWidth: 0 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(6, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        <MetricCard
          label="Status"
          value={statusMeta[run.status]?.label || run.status || 'Unknown'}
        />
        <MetricCard
          label="Round"
          value={`${run.currentRound || 0} / ${run.totalRounds || '—'}`}
        />
        <MetricCard label="Approved" value={formatCount(participants.approved)} />
        <MetricCard label="Online" value={formatCount(participants.onlineDevices)} />
        <MetricCard
          label="Completed"
          value={formatCount(participants.completedCurrentRound)}
          helper="Current observed round"
        />
        <MetricCard
          label="Global model"
          value={run.latestModelVersion ? `v${run.latestModelVersion}` : '—'}
        />
      </Box>

      <Paper variant="outlined" sx={{ ...taskHubPaperSx, p: 3 }}>
        <Typography variant="h6" gutterBottom>Participant activity</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">Contributed</Typography>
            <Typography variant="h6">{formatCount(participants.contributed)}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">Registered devices</Typography>
            <Typography variant="h6">{formatCount(participants.registeredDevices)}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">Training now</Typography>
            <Typography variant="h6">{formatCount(participants.trainingDevices)}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">Selected</Typography>
            <Typography variant="h6">{formatCount(participants.selectedThisRun)}</Typography>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ ...taskHubPaperSx, p: 3 }}>
        <Typography variant="h6" gutterBottom>Global metrics by round</Typography>
        {metrics.history.length ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Round</TableCell>
                  <TableCell>Model</TableCell>
                  <TableCell align="right">Loss</TableCell>
                  <TableCell align="right">Accuracy</TableCell>
                  <TableCell align="right">Round time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {metrics.history.map((metric, index) => (
                  <TableRow key={`${metric.round}-${metric.modelVersion || index}`}>
                    <TableCell>{metric.round}</TableCell>
                    <TableCell>{metric.modelVersion ? `v${metric.modelVersion}` : '—'}</TableCell>
                    <TableCell align="right">{formatMetric(metric.loss, 'loss')}</TableCell>
                    <TableCell align="right">{formatMetric(metric.accuracy, 'accuracy')}</TableCell>
                    <TableCell align="right">
                      {Number.isFinite(metric.roundTimeSeconds)
                        ? `${metric.roundTimeSeconds.toFixed(1)}s`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">No global evaluation metrics have been published yet.</Alert>
        )}
      </Paper>

      {source.estimated && (
        <Alert severity="info">
          This dashboard is currently estimated from the legacy task status and
          completed FL logs. Last observed: {formatDate(source.observedAt)}.
          {source.managerAvailable
            ? ' Live server aggregates are connected.'
            : ' Live server aggregates are temporarily unavailable.'}
        </Alert>
      )}
    </Stack>
  );
};

const fileKindLabel = {
  documentation: 'Documentation',
  model_code: 'Model code',
  data_preparation: 'Data preparation',
  config: 'Configuration',
  other: 'File',
};

const buildParticipationFileTree = (files) => {
  const root = { name: '', path: '', type: 'directory', children: [] };
  files.forEach((file) => {
    const parts = String(file.path || file.name || '').split('/').filter(Boolean);
    let directory = root;
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join('/');
      const leaf = index === parts.length - 1;
      let child = directory.children.find((item) => item.name === part);
      if (!child) {
        child = leaf
          ? { name: part, path, type: 'file', file }
          : { name: part, path, type: 'directory', children: [] };
        directory.children.push(child);
      }
      if (!leaf) directory = child;
    });
  });
  const sort = (node) => {
    if (!node.children) return node;
    node.children.sort((left, right) => (
      left.type === right.type
        ? left.name.localeCompare(right.name)
        : left.type === 'directory' ? -1 : 1
    ));
    node.children.forEach(sort);
    return node;
  };
  return sort(root);
};

const descendantFiles = (node) => (
  node.type === 'file'
    ? [node.file]
    : (node.children || []).flatMap(descendantFiles)
);

const ParticipationFileTree = ({ files, downloading, onDownload, onPreview }) => {
  const tree = useMemo(() => buildParticipationFileTree(files), [files]);
  const initialDirectories = useMemo(
    () => new Set(tree.children.filter((node) => node.type === 'directory').map((node) => node.path)),
    [tree],
  );
  const [expanded, setExpanded] = useState(initialDirectories);

  useEffect(() => setExpanded(initialDirectories), [initialDirectories]);

  const toggle = (path) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(path)) next.delete(path); else next.add(path);
    return next;
  });

  const renderNode = (node, depth = 0) => {
    if (node.type === 'directory') {
      const open = expanded.has(node.path);
      const children = descendantFiles(node);
      const editableCount = children.filter((file) => file.editable).length;
      return (
        <React.Fragment key={node.path}>
          <Box
            component="button"
            type="button"
            onClick={() => toggle(node.path)}
            sx={{
              width: '100%', minHeight: 40, px: 1.5, pl: 1.5 + depth * 2.25,
              display: 'flex', alignItems: 'center', gap: 1, border: 0,
              borderBottom: '1px solid', borderColor: 'divider', color: 'text.primary',
              backgroundColor: 'rgba(248, 250, 252, 0.82)', cursor: 'pointer', textAlign: 'left',
              '&:hover': { backgroundColor: 'rgba(59, 166, 241, 0.08)' },
            }}
          >
            {open ? <ExpandMoreRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} /> : <ChevronRightRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
            <FolderOutlinedIcon sx={{ fontSize: 19, color: 'primary.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 650, fontFamily: 'monospace' }}>{node.name}</Typography>
            <Typography variant="caption" color="text.secondary">{children.length} files</Typography>
            {editableCount > 0 && <Chip size="small" label={`${editableCount} editable`} sx={{ ml: 'auto', height: 22, color: 'primary.dark', backgroundColor: 'primary.light' }} />}
          </Box>
          {open && node.children.map((child) => renderNode(child, depth + 1))}
        </React.Fragment>
      );
    }
    const { file } = node;
    const canPreview = file.previewable && onPreview;
    return (
      <Box
        key={node.path}
        sx={{
          minHeight: 46, px: 1.5, pl: 4.75 + depth * 2.25, py: 0.65,
          display: 'flex', alignItems: 'center', gap: 1.1, borderBottom: '1px solid',
          borderColor: 'divider', '&:hover': { backgroundColor: 'rgba(59, 166, 241, 0.055)' },
        }}
      >
        <ArticleOutlinedIcon sx={{ fontSize: 18, color: file.editable ? 'primary.main' : 'text.disabled', flexShrink: 0 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Button
            variant="text" color="inherit" disabled={!canPreview}
            onClick={() => canPreview && onPreview(file)}
            sx={{ minWidth: 0, p: 0, justifyContent: 'flex-start', textTransform: 'none', fontWeight: 600, fontFamily: 'monospace', fontSize: 13, '&.Mui-disabled': { color: 'text.primary' } }}
          >
            {node.name}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {fileKindLabel[file.kind] || 'File'} · {formatBytes(file.size) || '—'} · v{file.version || 1}
          </Typography>
        </Box>
        <Chip
          size="small"
          icon={file.editable ? <EditOutlinedIcon /> : <LockOutlinedIcon />}
          label={file.editable ? 'Editable' : 'FedOps managed'}
          variant={file.editable ? 'filled' : 'outlined'}
          sx={file.editable ? { color: 'primary.dark', backgroundColor: 'primary.light' } : { color: 'text.secondary', borderColor: 'divider' }}
        />
        <Button
          size="small" startIcon={<DownloadIcon />}
          onClick={() => onDownload(file)}
          disabled={downloading === `file-${file.id}`}
        >
          {downloading === `file-${file.id}` ? 'Preparing…' : 'Download'}
        </Button>
      </Box>
    );
  };

  return <Box>{tree.children.map((node) => renderNode(node))}</Box>;
};

const FilePreviewBody = ({ preview }) => {
  if (preview.language === 'markdown') {
    return (
      <Box
        className="fedops-markdown"
        sx={{
          p: { xs: 2, md: 3 },
          '& > :first-of-type': { mt: 0 },
          '& p, & li': { lineHeight: 1.75 },
          '& pre': {
            overflowX: 'auto',
            p: 2,
            borderRadius: 1,
            backgroundColor: 'grey.100',
          },
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            img: ({ alt }) => <span>[Image omitted: {alt || 'image'}]</span>,
          }}
        >
          {preview.content}
        </ReactMarkdown>
      </Box>
    );
  }

  const lines = String(preview.content || '').split('\n');
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        py: 2,
        overflow: 'auto',
        backgroundColor: '#fafaf9',
        color: '#292524',
        fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
        fontSize: 13,
        lineHeight: 1.65,
      }}
    >
      {lines.map((line, index) => (
        <Box
          component="span"
          key={`${index + 1}-${line.slice(0, 24)}`}
          sx={{ display: 'flex', minWidth: 'max-content' }}
        >
          <Box
            component="span"
            aria-hidden="true"
            sx={{
              width: 56,
              pr: 2,
              mr: 2,
              flex: '0 0 auto',
              textAlign: 'right',
              color: 'text.disabled',
              borderRight: '1px solid',
              borderColor: 'divider',
              userSelect: 'none',
            }}
          >
            {index + 1}
          </Box>
          <Box component="code" sx={{ pr: 3 }}>{line || ' '}</Box>
        </Box>
      ))}
    </Box>
  );
};

const FilesPanel = ({
  models,
  files,
  modelError,
  onDownloadModel,
  onDownloadFile,
  onPreviewFile,
}) => {
  const [downloading, setDownloading] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const download = async (kind, item) => {
    const key = `${kind}-${item.id}`;
    setDownloading(key);
    setDownloadError('');
    try {
      if (kind === 'model') {
        await onDownloadModel(item);
      } else {
        await onDownloadFile(item);
      }
    } catch (error) {
      setDownloadError(
        error.response?.data?.message || 'A short-lived download link could not be created.',
      );
    } finally {
      setDownloading('');
    }
  };

  const openPreview = async (file) => {
    if (!file.previewable || !onPreviewFile) return;
    setPreviewFile(file);
    setPreview(null);
    setPreviewError('');
    setPreviewLoading(true);
    try {
      setPreview(await onPreviewFile(file));
    } catch (error) {
      setPreviewError(
        error.response?.data?.message || 'The file preview could not be loaded.',
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <>
      <Stack spacing={2.5} sx={{ width: '100%', minWidth: 0 }}>
      <Paper variant="outlined" sx={{ ...taskHubPaperSx, overflow: 'hidden' }}>
        <Box sx={{ p: 3 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ModelTrainingOutlinedIcon color="primary" />
            <Box>
              <Typography variant="h5">Global model versions</Typography>
              <Typography color="text.secondary">
                Download and compare the global model versions published by the Task owner.
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Divider />
        {modelError && <Alert severity="warning" sx={{ m: 2 }}>{modelError}</Alert>}
        {!modelError && models.length ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Model file</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Published</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {models.map((model) => (
                  <TableRow key={model.id || model.name} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <ModelTrainingOutlinedIcon fontSize="small" color="action" />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {model.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {model.modelName || 'Global model'}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Typography variant="body2">v{model.version || 1}</Typography>
                        {model.aliases?.latest && <Chip size="small" label="latest" />}
                      </Stack>
                    </TableCell>
                    <TableCell>{formatBytes(model.size) || '—'}</TableCell>
                    <TableCell>{formatDate(model.createdAt)}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => download('model', model)}
                        disabled={
                          !onDownloadModel
                          || downloading === `model-${model.id}`
                        }
                      >
                        {downloading === `model-${model.id}` ? 'Preparing…' : 'Download'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : !modelError && (
          <Alert severity="info" sx={{ m: 2 }}>
            No published global model versions yet.
          </Alert>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ ...taskHubPaperSx, overflow: 'hidden' }}>
        <Box sx={{ p: 3 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <FolderOutlinedIcon color="primary" />
            <Box>
              <Typography variant="h5">Participation files</Typography>
              <Typography color="text.secondary">
                The same Federated Task release structure used by Agent Studio.
                Open folders to inspect editable Task files and FedOps-managed runtime files.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
            <Chip size="small" icon={<EditOutlinedIcon />} label="Editable in Agent Studio" sx={{ color: 'primary.dark', backgroundColor: 'primary.light' }} />
            <Chip size="small" icon={<LockOutlinedIcon />} label="FedOps managed · read only" variant="outlined" sx={{ color: 'text.secondary', borderColor: 'divider' }} />
          </Stack>
        </Box>
        <Divider />
        {files.length ? (
          <ParticipationFileTree
            files={files}
            downloading={downloading}
            onDownload={(file) => download('file', file)}
            onPreview={onPreviewFile ? openPreview : null}
          />
        ) : (
          <Alert severity="info" sx={{ m: 2 }}>
            Participation files are being prepared.
          </Alert>
        )}
      </Paper>
      {downloadError && <Alert severity="error">{downloadError}</Alert>}
      </Stack>

      <Dialog
        open={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          <Typography variant="h6" component="div" sx={{ fontFamily: 'monospace' }}>
            {previewFile?.path}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Chip size="small" label={`v${previewFile?.version || 1}`} />
            <Chip
              size="small"
              variant="outlined"
              label={fileKindLabel[previewFile?.kind] || 'File'}
            />
            {preview?.language && (
              <Chip size="small" variant="outlined" label={preview.language} />
            )}
            {previewFile?.templateVersion && (
              <Chip
                size="small"
                variant="outlined"
                label={`${previewFile.templateName}@${previewFile.templateVersion}`}
              />
            )}
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, minHeight: 320 }}>
          {previewLoading ? (
            <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          ) : previewError ? (
            <Alert severity="error" sx={{ m: 2 }}>{previewError}</Alert>
          ) : preview ? (
            <>
              {preview.truncated && (
                <Alert severity="warning" sx={{ borderRadius: 0 }}>
                  This preview shows only the first 512 KB. Download the file to
                  inspect the complete content.
                </Alert>
              )}
              <FilePreviewBody preview={preview} />
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<DownloadIcon />}
            onClick={() => download('file', previewFile)}
            disabled={!previewFile || downloading === `file-${previewFile?.id}`}
          >
            Download
          </Button>
          <Button variant="contained" onClick={() => setPreviewFile(null)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const FilesAccessNotice = ({
  task,
  isAuthenticated,
  membershipStatus,
  onRequestParticipation,
  onLeaveParticipation,
  participationBusy,
  joinStatus,
  loginPath,
}) => (
  <Paper variant="outlined" sx={{ ...taskHubPaperSx, p: { xs: 3, md: 5 } }}>
    <Stack spacing={2.5} alignItems="flex-start" sx={{ maxWidth: 720 }}>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: 'action.hover',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <LockOutlinedIcon />
      </Box>
      <Box>
        <Typography variant="h4" gutterBottom>Files &amp; versions requires participation</Typography>
        <Typography color="text.secondary">
          Join this Federated Task and receive owner approval to view its Released
          global model, model code, data preparation contract, and version history.
        </Typography>
      </Box>
      {membershipStatus && (
        <Chip
          label={`FL participation: ${membershipStatus.replaceAll('_', ' ')}`}
          color={membershipStatus === 'approved' || membershipStatus === 'owner' ? 'success' : 'warning'}
        />
      )}
      {joinStatus && <Alert severity="info">{joinStatus}</Alert>}
      {!isAuthenticated ? (
        <Button component={Link} to={loginPath} variant="contained">
          Sign in to join Federated Learning
        </Button>
      ) : task.permissions?.canRequestParticipation && onRequestParticipation ? (
        <Button
          variant="contained"
          startIcon={<GroupAddIcon />}
          onClick={onRequestParticipation}
          disabled={
            task.participationPolicy === 'closed'
            || !task.permissions?.canRequestParticipation
            || participationBusy
          }
        >
          Join Federated Learning
        </Button>
      ) : null}
      {isAuthenticated
        && ['requested', 'approved'].includes(membershipStatus)
        && onLeaveParticipation && (
        <Button
          color="warning"
          variant="outlined"
          onClick={onLeaveParticipation}
          disabled={
            participationBusy
            || (
              membershipStatus === 'approved'
              && !task.permissions?.canLeaveParticipation
            )
          }
        >
          {membershipStatus === 'requested' ? 'Withdraw request' : 'Leave Federated Task'}
        </Button>
      )}
      {membershipStatus === 'approved'
        && task.permissions?.leaveRequiresCompletedRun && (
        <Alert severity="info">
          Complete at least one Federated Learning run in Agent Studio after
          approval before leaving this task.
        </Alert>
      )}
      {task.participationPolicy === 'closed' && !membershipStatus && (
        <Alert severity="warning">The owner has closed new participation requests.</Alert>
      )}
    </Stack>
  </Paper>
);

const UsagePanel = ({ usage }) => {
  const daily = useMemo(() => usage?.daily || [], [usage?.daily]);
  const chartData = useMemo(() => ({
    labels: daily.map((point) => point.date.slice(5)),
    datasets: [
      {
        label: 'Model downloads',
        data: daily.map((point) => point.downloads),
        borderColor: '#0f766e',
        backgroundColor: 'rgba(15, 118, 110, 0.10)',
        fill: true,
        tension: 0.3,
        pointRadius: 1.5,
      },
      {
        label: 'Approved FL joins',
        data: daily.map((point) => point.approvedJoins),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.08)',
        tension: 0.3,
        pointRadius: 1.5,
      },
    ],
  }), [daily]);
  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        align: 'start',
        labels: { usePointStyle: true, boxWidth: 8 },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 8 },
      },
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
      },
    },
  }), []);

  return (
    <Stack spacing={2.5} sx={{ width: '100%', minWidth: 0 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
        <MetricCard
          label="Approved FL participants"
          value={formatCount(usage?.approvedParticipants)}
          helper="Current approved memberships"
        />
        <MetricCard
          label="Global model downloads"
          value={formatCount(usage?.modelDownloads)}
          helper="Explicit model download requests"
        />
      </Box>
      <Paper variant="outlined" sx={{ ...taskHubPaperSx, p: 3 }}>
        <Typography variant="h5">Community activity</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Daily model downloads and newly approved federated-learning participants
          for the last {usage?.windowDays || 30} days.
        </Typography>
        {daily.length ? (
          <Box sx={{ height: 320 }}>
            <Line data={chartData} options={options} />
          </Box>
        ) : (
          <Alert severity="info">Usage activity is not available yet.</Alert>
        )}
      </Paper>
      <Alert severity="info">
        Download statistics count requests for a global model link. FedOps does not
        collect IP addresses, raw user-agent strings, or device fingerprints for this chart.
      </Alert>
    </Stack>
  );
};

const DataSetupPanel = ({ task }) => {
  const requirements = [
    ['Data modality', task.dataType],
    ['Model framework/type', task.modelType],
    ['FL strategy', task.strategy],
    ['Total rounds', task.numRounds],
    ['Local epochs', task.numEpochs],
    ['Batch size', task.batchSize],
    ['Clients per round', task.clientPerRound],
    ['Learning rate', task.learningRate],
  ];
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(0, 5fr)' },
        gap: 3,
        width: '100%',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Paper variant="outlined" sx={{ ...taskHubPaperSx, p: 3 }}>
          <Typography variant="h5" gutterBottom>Training requirements</Typography>
          <Grid container spacing={2}>
            {requirements.map(([label, value]) => (
              <Grid item xs={12} sm={6} key={label}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography>{value || 'Not specified'}</Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Stack spacing={2}>
          <Alert severity="info">
            A versioned Data Contract and Launcher preflight will be published
            in the next integration phase. Raw participant data must remain local.
          </Alert>
          <Paper variant="outlined" sx={{ ...taskHubPaperSx, p: 3 }}>
            <Typography variant="h6" gutterBottom>Privacy boundary</Typography>
            <Typography color="text.secondary">
              This page never exposes another participant&apos;s raw data, device
              identity, MAC address, hostname, Kubernetes resources, or internal
              Federated Task runtime configuration.
            </Typography>
          </Paper>
        </Stack>
      </Box>
    </Box>
  );
};

const ParticipationPanel = ({
  activity,
  isAuthenticated,
  onRequestParticipation,
  onLeaveParticipation,
  participationBusy,
  joinStatus,
  task,
  loginPath,
}) => {
  const membership = activity?.membership;
  const status = membership?.status || task.permissions?.participationStatus;
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(0, 5fr)' },
        gap: 3,
        width: '100%',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Paper variant="outlined" sx={{ ...taskHubPaperSx, p: 3 }}>
          <Typography variant="h5" gutterBottom>My Participation</Typography>
          {status ? (
            <Stack spacing={2}>
              <Chip
                label={status.replaceAll('_', ' ')}
                color={status === 'approved' || status === 'owner' ? 'success' : 'warning'}
                sx={{ alignSelf: 'flex-start' }}
              />
              <Box>
                <Typography variant="caption" color="text.secondary">Requested</Typography>
                <Typography>{formatDate(membership?.requestedAt)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Reviewed</Typography>
                <Typography>{formatDate(membership?.reviewedAt)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Completed FL runs</Typography>
                <Typography>
                  {formatCount(
                    membership?.completedParticipationCount
                    ?? task.permissions?.completedParticipationCount,
                  )}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Last participation</Typography>
                <Typography>
                  {formatDate(
                    membership?.lastParticipatedAt
                    ?? task.permissions?.lastParticipatedAt,
                  )}
                </Typography>
              </Box>
            </Stack>
          ) : (
            <Typography color="text.secondary">
              Join this Federated Task to access its Files &amp; versions and
              contribute local training updates to a federated run.
            </Typography>
          )}
          {joinStatus && <Alert severity="info" sx={{ mt: 2 }}>{joinStatus}</Alert>}
          {isAuthenticated
            && task.permissions?.canRequestParticipation
            && onRequestParticipation && (
            <Button
              variant="contained"
              startIcon={<GroupAddIcon />}
              onClick={onRequestParticipation}
              disabled={
                task.participationPolicy === 'closed'
                || !task.permissions?.canRequestParticipation
                || participationBusy
              }
              sx={{ mt: 3 }}
            >
              Join Federated Learning
            </Button>
          )}
          {isAuthenticated
            && ['requested', 'approved'].includes(status)
            && onLeaveParticipation && (
            <Button
              color="warning"
              variant="outlined"
              onClick={onLeaveParticipation}
              disabled={participationBusy || (status === 'approved' && !task.permissions?.canLeaveParticipation)}
              sx={{ mt: 2, ml: status ? 0 : 1 }}
            >
              {status === 'requested' ? 'Withdraw request' : 'Leave Federated Task'}
            </Button>
          )}
          {status === 'approved' && task.permissions?.leaveRequiresCompletedRun && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Complete at least one Federated Learning run in Agent Studio after
              this approval before leaving. This prevents joining only to copy
              the Released Task code.
            </Alert>
          )}
          {!isAuthenticated && (
            <Button component={Link} to={loginPath} variant="contained" sx={{ mt: 3 }}>
              Sign in to participate
            </Button>
          )}
        </Paper>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Paper variant="outlined" sx={{ ...taskHubPaperSx, p: 3 }}>
          <Typography variant="h6" gutterBottom>Agent Studio integration</Typography>
          <Typography color="text.secondary">
            After owner approval, participants can open this Federated Task in
            FedOps Agent Studio, synchronize its Published Release, validate
            their local input schema, and obtain a short-lived Run credential.
            Internal YAML and permanent server credentials will not be distributed.
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};

const TaskHubContent = ({
  task,
  models = [],
  files = [],
  usage,
  activity,
  activityError = '',
  modelError = '',
  isAuthenticated = false,
  onRequestParticipation,
  onLeaveParticipation,
  participationBusy = false,
  onDownloadModel,
  onDownloadFile,
  onPreviewFile,
  onUpdateTaskCard,
  joinStatus = '',
}) => {
  const location = useLocation();
  const [tab, setTab] = useState(0);
  const loginPath = loginPathFor(
    `${location.pathname}${location.search}${location.hash}`,
  );
  const run = activity?.run;
  const status = statusMeta[run?.status] || {
    label: run?.status || 'Unknown',
    color: 'default',
  };
  const membershipStatus = activity?.membership?.status
    || task.permissions?.participationStatus;
  const filesRequireParticipation = task.registryStatus === 'published'
    && Boolean(task.currentPublishedReleaseId);
  const canAccessFiles = !filesRequireParticipation
    || Boolean(task.permissions?.canDownloadModels);

  return (
    <Stack spacing={2.5} sx={{ width: '100%', minWidth: 0 }}>
      <Box>
        <Typography color="text.secondary" sx={{ mb: 1 }}>
          @{task.owner?.handle || 'unknown'} / {task.slug || task.title}
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
          <Chip
            label={getTaskModelKind(task)}
            color={getTaskModelKind(task) === 'LLM' ? 'secondary' : 'primary'}
            variant="outlined"
          />
          <Chip
            label={task.visibility === 'public' ? 'Public' : 'Private'}
            color={task.visibility === 'public' ? 'success' : 'default'}
          />
          {task.dataType && <Chip label={task.dataType} variant="outlined" />}
          {task.strategy && <Chip label={task.strategy} variant="outlined" />}
          <Chip
            label={(task.participationPolicy || 'approval_required').replaceAll('_', ' ')}
            variant="outlined"
          />
        </Stack>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'flex-start' }}
          spacing={2}
        >
          <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
            <Typography
              component="h1"
              sx={{ mb: 1, fontSize: { xs: '1.8rem', md: '2.15rem' }, lineHeight: 1.18, fontWeight: 650 }}
            >
              {task.primaryModel?.displayName || task.primaryModel?.workingName || task.title}
            </Typography>
            {task.primaryModel && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                Federated Task · {task.displayName || task.title}
              </Typography>
            )}
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              {task.summary || 'No summary provided.'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {formatCount(usage?.approvedParticipants ?? activity?.participants?.approved)}
              {' '}approved FL participants
              {' · '}{formatCount(usage?.modelDownloads)} model downloads
              {' · '}{canAccessFiles
                ? `${models.length + files.length} files and versions`
                : 'Files & versions locked'}
              {' · '}updated {formatDate(task.updatedAt)}
            </Typography>
          </Box>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            sx={{ alignSelf: { md: 'flex-start' }, flex: '0 1 auto' }}
          >
            <Button variant="outlined" onClick={() => setTab(2)}>
              {canAccessFiles ? 'Use Model' : 'Files & versions'}
            </Button>
            {task.permissions?.canManage && (
              <Button
                component={Link}
                to={`/fedops/task/${encodeURIComponent(task.title)}`}
                variant="contained"
                startIcon={<SettingsIcon />}
              >
                Manage Federated Task
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
          width: '100%',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Paper variant="outlined" sx={{ ...taskHubPaperSx, p: 3, height: '100%' }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <ModelTrainingOutlinedIcon color="primary" />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">
                  {canAccessFiles ? 'Use the global model' : 'Access model and Task files'}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                  {canAccessFiles
                    ? 'Browse the Released global model, Task code, and version history.'
                    : 'Join Federated Learning and receive owner approval to access Files & versions.'}
                </Typography>
                <Button variant="outlined" onClick={() => setTab(2)}>
                  {canAccessFiles ? 'Browse files & versions' : 'View access requirements'}
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Paper variant="outlined" sx={{ ...taskHubPaperSx, p: 3, height: '100%' }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <HubOutlinedIcon color="primary" />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">Join Federated Learning</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                  Contribute local training updates without uploading raw data.
                  The owner may need to approve your participation.
                </Typography>
                {membershipStatus && !task.permissions?.canRequestParticipation ? (
                  <Chip
                    label={`FL participation: ${membershipStatus.replaceAll('_', ' ')}`}
                    color={
                      membershipStatus === 'approved' || membershipStatus === 'owner'
                        ? 'success'
                        : 'warning'
                    }
                  />
                ) : isAuthenticated
                  && task.permissions?.canRequestParticipation
                  && onRequestParticipation ? (
                  <Button
                    variant="contained"
                    startIcon={<GroupAddIcon />}
                    onClick={onRequestParticipation}
                    disabled={
                      task.participationPolicy === 'closed'
                      || !task.permissions?.canRequestParticipation
                      || participationBusy
                    }
                  >
                    Join Federated Learning
                  </Button>
                ) : (
                  <Button component={Link} to={loginPath} variant="contained">
                    Sign in to join FL
                  </Button>
                )}
                {joinStatus && (
                  <Alert severity="info" sx={{ mt: 2 }}>{joinStatus}</Alert>
                )}
              </Box>
            </Stack>
          </Paper>
        </Box>
      </Box>

      <Paper variant="outlined" sx={{ ...taskHubPaperSx, p: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6">Current training</Typography>
              <Chip size="small" label={status.label} color={status.color} />
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Round {run?.currentRound || 0} / {run?.totalRounds || '—'}
              {' · '}{formatCount(activity?.participants?.completedCurrentRound)} completed
              {' · '}observed {formatDate(run?.lastUpdatedAt)}
            </Typography>
          </Box>
          <Typography variant="h5">
            {Number.isFinite(run?.progressPercent) ? `${run.progressPercent}%` : '—'}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={run?.progressPercent || 0}
          sx={{ mt: 2, height: 8, borderRadius: 4 }}
        />
      </Paper>

      <Paper variant="outlined" sx={{ ...taskHubPaperSx, overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Federated Task Registry sections"
        >
          <Tab label="Federated Task Card" />
          <Tab label="Training" />
          <Tab label="Files & versions" />
          <Tab label="Data & Setup" />
          <Tab label="Community & usage" />
          <Tab label="My Participation" />
        </Tabs>
      </Paper>

      {tab === 0 && (
        <TaskCardPanel
          task={task}
          usage={usage}
          activity={activity}
          models={models}
          files={files}
          onUpdateTaskCard={onUpdateTaskCard}
        />
      )}
      {tab === 1 && <TrainingPanel activity={activity} activityError={activityError} />}
      {tab === 2 && (
        canAccessFiles ? (
          <FilesPanel
            models={models}
            files={files}
            modelError={modelError}
            onDownloadModel={onDownloadModel}
            onDownloadFile={onDownloadFile}
            onPreviewFile={onPreviewFile}
          />
        ) : (
          <FilesAccessNotice
            task={task}
            isAuthenticated={isAuthenticated}
            membershipStatus={membershipStatus}
            onRequestParticipation={onRequestParticipation}
            onLeaveParticipation={onLeaveParticipation}
            participationBusy={participationBusy}
            joinStatus={joinStatus}
            loginPath={loginPath}
          />
        )
      )}
      {tab === 3 && <DataSetupPanel task={task} />}
      {tab === 4 && <UsagePanel usage={usage} />}
      {tab === 5 && (
        <ParticipationPanel
          activity={activity}
          isAuthenticated={isAuthenticated}
          onRequestParticipation={onRequestParticipation}
          onLeaveParticipation={onLeaveParticipation}
          participationBusy={participationBusy}
          joinStatus={joinStatus}
          task={task}
          loginPath={loginPath}
        />
      )}
    </Stack>
  );
};

export default TaskHubContent;
