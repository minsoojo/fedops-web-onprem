import React from 'react';
import {
  Box,
  Grid,
  LinearProgress,
  Paper,
  Typography,
} from '@mui/material';

const SummaryCard = ({
  label,
  value,
  helper,
  progress,
  tone = 'default',
}) => {
  const toneColor = tone === 'success'
    ? '#166534'
    : tone === 'warning'
      ? '#854d0e'
      : 'text.primary';

  return (
    <Paper
      variant="outlined"
      sx={{
        height: '100%',
        minHeight: 116,
        p: 2,
        borderColor: 'divider',
        backgroundColor: 'background.paper',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="h5"
        sx={{
          mt: 0.75,
          color: toneColor,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
      {Number.isFinite(progress) && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 5,
            mt: 1.25,
            mb: 0.5,
            borderRadius: 99,
            backgroundColor: '#ecebea',
          }}
        />
      )}
      {helper && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: Number.isFinite(progress) ? 0 : 0.75 }}
        >
          {helper}
        </Typography>
      )}
    </Paper>
  );
};

const MonitoringSummary = ({ items }) => (
  <Box>
    <Grid container spacing={1.5} alignItems="stretch">
      {items.map((item) => (
        <Grid item xs={6} sm={4} lg={2} key={item.label}>
          <SummaryCard {...item} />
        </Grid>
      ))}
    </Grid>
  </Box>
);

export default MonitoringSummary;
