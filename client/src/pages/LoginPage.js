import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/common/Header';
import { changeField, initializeForm, login } from '../modules/auth';
import { check } from '../modules/user';
import { returnPathFromSearch } from '../lib/authNavigation';

function Copyright(props) {
  return (
    <Typography variant="body2" color="text.secondary" align="center" {...props}>
      {'Copyright © '}
      <Link color="inherit" href="https://sites.google.com/view/keylee/">
        Cognitive Computing Lab in Gachon Univ.
      </Link>{' '}
      {new Date().getFullYear()}
      {'.'}
    </Typography>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath = returnPathFromSearch(location.search);
  const destinationLabel = returnPath.startsWith('/fedops/registry')
    || returnPath.startsWith('/fedops/tasks')
    ? 'Registry'
    : returnPath.startsWith('/fedops/task')
      ? 'My Federated Tasks'
      : 'FedOps';
  const registerPath = returnPath === '/fedops'
    ? '/fedops/register'
    : `/fedops/register?next=${encodeURIComponent(returnPath)}`;
  const [error, setError] = useState(null);
  const dispatch = useDispatch();
  const {
    form,
    auth,
    authError,
    user,
    loginLoading,
  } = useSelector(({ auth, user, loading }) => ({
    form: auth.login,
    auth: auth.auth,
    authError: auth.authError,
    user: user.user,
    loginLoading: loading['auth/LOGIN'],
  }));

  const onChange = (event) => {
    const { value, name } = event.target;
    dispatch(changeField({
      form: 'login',
      key: name,
      value,
    }));
  };

  const onSubmit = (event) => {
    event.preventDefault();
    setError(null);
    const { username, password } = form;
    dispatch(login({ username, password }));
  };

  useEffect(() => {
    dispatch(initializeForm('login'));
  }, [dispatch]);

  useEffect(() => {
    if (authError) {
      setError(
        authError.response?.data?.message
        || 'The email or password is incorrect.',
      );
      return;
    }
    if (auth) dispatch(check());
  }, [auth, authError, dispatch]);

  useEffect(() => {
    if (!user) return;
    navigate(returnPath, { replace: true });
    try {
      localStorage.setItem('user', JSON.stringify(user));
    } catch (storageError) {
      // Authentication remains cookie-backed when localStorage is unavailable.
    }
  }, [navigate, returnPath, user]);

  return (
    <>
      <Header />
      <Box
        component="main"
        sx={{
          minHeight: 'calc(100vh - 70px)',
          py: { xs: 5, md: 9 },
          backgroundColor: '#f7f7f5',
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
              gap: { xs: 5, md: 10 },
              alignItems: 'center',
            }}
          >
            <Box>
              <Typography
                variant="overline"
                color="primary.dark"
                sx={{ fontWeight: 700, letterSpacing: '0.11em' }}
              >
                Federated operations workspace
              </Typography>
              <Typography
                component="h1"
                sx={{
                  mt: 1.5,
                  maxWidth: 560,
                  fontSize: { xs: 38, md: 54 },
                  fontWeight: 700,
                  lineHeight: 1.06,
                  letterSpacing: '-0.045em',
                }}
              >
                Continue to FedOps.
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ mt: 2.5, maxWidth: 540, fontSize: 17, lineHeight: 1.7 }}
              >
                Sign in to discover Federated Tasks, manage your workspace,
                and participate in privacy-preserving federated learning.
              </Typography>

              <Stack spacing={2} sx={{ mt: 4, maxWidth: 520 }}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <HubOutlinedIcon color="primary" sx={{ mt: 0.25 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>Registry</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Explore Federated Tasks, training progress, files, and model resources.
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <AccountTreeOutlinedIcon color="primary" sx={{ mt: 0.25 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>My Federated Tasks</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Operate tasks you own and follow approved participation.
                    </Typography>
                  </Box>
                </Stack>
              </Stack>
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Paper
                variant="outlined"
                sx={{
                  width: '100%',
                  maxWidth: 460,
                  ml: { md: 'auto' },
                  p: { xs: 3, sm: 4.5 },
                  borderColor: 'divider',
                  borderRadius: 2,
                  boxShadow: '0 24px 70px rgba(17, 24, 39, 0.08)',
                  backgroundColor: 'background.paper',
                }}
              >
                <Stack spacing={3}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 1.5,
                        color: 'primary.dark',
                        backgroundColor: 'primary.light',
                      }}
                    >
                      <LockOutlinedIcon fontSize="small" />
                    </Box>
                    <Box>
                      <Typography variant="h5" component="h2">Sign in</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Use your FedOps account
                      </Typography>
                    </Box>
                  </Stack>

                  {returnPath !== '/fedops' && (
                    <Alert severity="info">
                      Sign in to continue to {destinationLabel}.
                    </Alert>
                  )}
                  {error && <Alert severity="error">{error}</Alert>}

                  <Box component="form" onSubmit={onSubmit} noValidate>
                    <Stack spacing={2}>
                      <TextField
                        required
                        fullWidth
                        id="username"
                        label="Email"
                        name="username"
                        autoComplete="email"
                        autoFocus
                        value={form.username}
                        onChange={onChange}
                      />
                      <TextField
                        required
                        fullWidth
                        name="password"
                        label="Password"
                        type="password"
                        id="password"
                        autoComplete="current-password"
                        value={form.password}
                        onChange={onChange}
                      />
                      <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        size="large"
                        endIcon={<ArrowForwardRoundedIcon />}
                        disabled={Boolean(loginLoading)}
                        sx={{ minHeight: 48 }}
                      >
                        {loginLoading ? 'Signing in…' : 'Sign in'}
                      </Button>
                    </Stack>
                  </Box>

                  <Divider />
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      New to FedOps?
                    </Typography>
                    <Button
                      component={RouterLink}
                      to={registerPath}
                      variant="outlined"
                      size="small"
                    >
                      Create account
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            </Box>
          </Box>
          <Copyright sx={{ mt: { xs: 6, md: 10 } }} />
        </Container>
      </Box>
    </>
  );
}
