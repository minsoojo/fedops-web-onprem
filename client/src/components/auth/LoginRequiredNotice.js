import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { loginPathFor } from '../../lib/authNavigation';

const LoginRequiredNotice = ({
  title = 'Sign in to continue',
  description = 'Please sign in to view this FedOps workspace.',
}) => {
  const location = useLocation();
  const returnPath = `${location.pathname}${location.search}${location.hash}`;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 4, md: 6 },
        textAlign: 'center',
        borderStyle: 'dashed',
        backgroundColor: 'background.paper',
      }}
    >
      <Stack spacing={2} alignItems="center">
        <Box
          sx={{
            width: 48,
            height: 48,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            color: 'primary.dark',
            backgroundColor: 'primary.light',
          }}
        >
          <LockOutlinedIcon />
        </Box>
        <Box>
          <Typography variant="h5" component="h2">{title}</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 560 }}>
            {description}
          </Typography>
        </Box>
        <Button
          component={Link}
          to={loginPathFor(returnPath)}
          variant="contained"
          startIcon={<LoginOutlinedIcon />}
        >
          Go to login
        </Button>
      </Stack>
    </Paper>
  );
};

export default LoginRequiredNotice;
