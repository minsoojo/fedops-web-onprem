import React, { useMemo, useState } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip as ChartTooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  ChartTooltip,
);

const ChartBody = ({ data, options, height }) => (
  <Box sx={{ height }}>
    <Line data={data} options={options} />
  </Box>
);

const MetricPanel = ({
  title,
  description,
  value,
  data,
  options = {},
  emptyMessage = 'No metric data is available for this selection.',
  onExport,
  height = 270,
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasData = Boolean(data?.datasets?.some(
    (dataset) => dataset.data?.some((point) => point !== null && point !== undefined),
  ));
  const chartOptions = useMemo(() => ({
    ...options,
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    animation: {
      duration: 250,
    },
    plugins: {
      legend: {
        display: (data?.datasets?.length || 0) > 1,
        position: 'bottom',
        align: 'start',
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          padding: 16,
          color: '#6f6a66',
          font: { size: 11 },
        },
      },
      tooltip: {
        backgroundColor: '#181818',
        padding: 10,
        titleFont: { size: 12, weight: '500' },
        bodyFont: { size: 12 },
        displayColors: (data?.datasets?.length || 0) > 1,
      },
      ...options.plugins,
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: '#e8e6e5' },
        ticks: {
          color: '#78716c',
          maxTicksLimit: 10,
          font: { size: 11 },
        },
        title: {
          display: true,
          text: 'Communication round',
          color: '#78716c',
          font: { size: 11, weight: '400' },
        },
        ...options.scales?.x,
      },
      y: {
        beginAtZero: false,
        grid: { color: '#f0efee' },
        border: { display: false },
        ticks: {
          color: '#78716c',
          font: { size: 11 },
      },
      ...options.scales?.y,
      },
    },
  }), [data?.datasets?.length, options]);

  return (
    <>
      <Paper
        variant="outlined"
        sx={{
          height: '100%',
          p: 2.5,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={2}
          sx={{ minHeight: 52, mb: 1.5 }}
        >
          <Box>
            <Typography variant="h6">{title}</Typography>
            {description && (
              <Typography variant="caption" color="text.secondary">
                {description}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={0.25}>
            {hasData && onExport && (
              <Tooltip title="Export CSV">
                <IconButton size="small" onClick={onExport} aria-label={`Export ${title} as CSV`}>
                  <DownloadRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {hasData && (
              <Tooltip title="Expand chart">
                <IconButton
                  size="small"
                  onClick={() => setExpanded(true)}
                  aria-label={`Expand ${title}`}
                >
                  <OpenInFullRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>

        {value && (
          <Typography variant="h5" sx={{ mb: 1.5 }}>
            {value}
          </Typography>
        )}

        {hasData ? (
          <ChartBody data={data} options={chartOptions} height={height} />
        ) : (
          <Box
            sx={{
              height,
              display: 'grid',
              placeItems: 'center',
              px: 3,
              borderRadius: 1,
              backgroundColor: '#fafaf9',
            }}
          >
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {emptyMessage}
            </Typography>
          </Box>
        )}
      </Paper>

      <Dialog
        open={expanded}
        onClose={() => setExpanded(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h5">{title}</Typography>
              {description && (
                <Typography variant="body2" color="text.secondary">
                  {description}
                </Typography>
              )}
            </Box>
            <IconButton onClick={() => setExpanded(false)} aria-label="Close expanded chart">
              <CloseRoundedIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {hasData && (
            <ChartBody data={data} options={chartOptions} height="min(65vh, 620px)" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MetricPanel;
