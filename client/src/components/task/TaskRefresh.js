import React from 'react';
import { Button } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

export const TaskRefresh = ({ loading, onRequestData }) => (
  <Button
    variant="outlined"
    startIcon={<RefreshRoundedIcon />}
    onClick={onRequestData}
    disabled={loading}
  >
    Refresh
  </Button>
);
