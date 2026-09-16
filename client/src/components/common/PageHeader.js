import React from 'react';
import {
  Box,
  Stack,
  Typography,
} from '@mui/material';

const PageHeader = ({
  eyebrow,
  title,
  description,
  action,
  meta,
}) => (
  <Stack
    direction={{ xs: 'column', md: 'row' }}
    justifyContent="space-between"
    alignItems={{ xs: 'flex-start', md: 'flex-end' }}
    spacing={3}
    sx={{ mb: { xs: 4, md: 5 } }}
  >
    <Box sx={{ maxWidth: 760 }}>
      {eyebrow && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 1,
            color: 'primary.dark',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </Typography>
      )}
      <Typography variant="h3" component="h1">
        {title}
      </Typography>
      {description && (
        <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 720 }}>
          {description}
        </Typography>
      )}
      {meta && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {meta}
        </Typography>
      )}
    </Box>
    {action}
  </Stack>
);

export default PageHeader;
