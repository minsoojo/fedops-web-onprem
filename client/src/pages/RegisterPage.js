import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/common/Header';
import { changeField, initializeForm, register } from '../modules/auth';
import { check } from '../modules/user';
import {
  loginPathFor,
  returnPathFromSearch,
} from '../lib/authNavigation';
import * as authAPI from '../lib/api/auth';

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

const StepItem = ({ number, title, description, icon }) => (
  <Stack direction="row" spacing={1.5} alignItems="flex-start">
    <Box
      sx={{
        width: 34,
        height: 34,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.25,
        color: 'primary.dark',
        backgroundColor: 'background.paper',
      }}
    >
      {icon || (
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {number}
        </Typography>
      )}
    </Box>
    <Box>
      <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
        {description}
      </Typography>
    </Box>
  </Stack>
);

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath = returnPathFromSearch(location.search);
  const [error, setError] = useState(null);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');

  const dispatch = useDispatch();
  const {
    form,
    auth,
    authError,
    user,
    registerLoading,
  } = useSelector(({ auth, user, loading }) => ({
    form: auth.register,
    auth: auth.auth,
    authError: auth.authError,
    user: user.user,
    registerLoading: loading['auth/REGISTER'],
  }));

  const onChange = (event) => {
    const { value, name } = event.target;
    dispatch(changeField({
      form: 'register',
      key: name,
      value,
    }));
    setError(null);

    if (name === 'username') {
      setEmailVerificationSent(false);
      setEmailVerified(false);
      setVerificationCode('');
      setEmailError('');
      setVerificationMessage('');
    }
  };

  const handleSendVerification = async () => {
    const email = form.username.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setSendingEmail(true);
    setEmailError('');
    setVerificationMessage('');
    try {
      await authAPI.sendEmailVerification(email);
      setEmailVerificationSent(true);
      setVerificationMessage('A verification code was sent to your email.');
    } catch (requestError) {
      setEmailError(
        requestError.response?.data?.message
        || 'The verification email could not be sent.',
      );
    } finally {
      setSendingEmail(false);
    }
  };

  const handleVerifyCode = async () => {
    const email = form.username.trim();
    const code = verificationCode.trim();
    if (!code) {
      setEmailError('Please enter the verification code.');
      return;
    }

    setVerifyingCode(true);
    setEmailError('');
    try {
      const response = await authAPI.verifyEmailCode(email, code);
      if (response.data.verified) {
        setEmailVerified(true);
        setVerificationMessage('Email verification completed.');
      } else {
        setEmailError(response.data.message || 'Invalid verification code.');
      }
    } catch (requestError) {
      setEmailError(
        requestError.response?.data?.message
        || 'The verification code could not be confirmed.',
      );
    } finally {
      setVerifyingCode(false);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    setError(null);
    const {
      firstName,
      lastName,
      username,
      password,
      passwordConfirm,
      organization,
      handle,
    } = form;

    if (!emailVerified) {
      setError('Please complete email verification.');
      return;
    }
    if (
      [firstName, lastName, username, password, passwordConfirm, organization, handle]
        .some((value) => !value.trim())
    ) {
      setError('Please complete every required field.');
      return;
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(handle)) {
      setError('Registry ID must be 3-30 lowercase letters, numbers, or hyphens.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('The passwords do not match.');
      dispatch(changeField({ form: 'register', key: 'password', value: '' }));
      dispatch(changeField({ form: 'register', key: 'passwordConfirm', value: '' }));
      return;
    }

    dispatch(register({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.trim(),
      password,
      organization: organization.trim(),
      handle,
    }));
  };

  useEffect(() => {
    dispatch(initializeForm('register'));
  }, [dispatch]);

  useEffect(() => {
    if (authError) {
      if (authError.response?.status === 409) {
        setError(
          authError.response?.data?.message
          || 'This email address or Registry ID is already in use.',
        );
        return;
      }
      setError(
        authError.response?.data?.message
        || 'The account could not be created.',
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
          py: { xs: 5, md: 8 },
          backgroundColor: '#f7f7f5',
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                md: 'minmax(0, 0.78fr) minmax(0, 1.22fr)',
              },
              gap: { xs: 5, md: 9 },
              alignItems: 'start',
            }}
          >
            <Box sx={{ pt: { md: 4 } }}>
              <Typography
                variant="overline"
                color="primary.dark"
                sx={{ fontWeight: 700, letterSpacing: '0.11em' }}
              >
                Create your FedOps account
              </Typography>
              <Typography
                component="h1"
                sx={{
                  mt: 1.5,
                  maxWidth: 500,
                  fontSize: { xs: 36, md: 50 },
                  fontWeight: 700,
                  lineHeight: 1.08,
                  letterSpacing: '-0.042em',
                }}
              >
                Build and join Federated Tasks.
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ mt: 2.5, maxWidth: 500, fontSize: 16, lineHeight: 1.7 }}
              >
                Create one account for the Registry, task participation,
                and your private federated operations workspace.
              </Typography>

              <Stack spacing={2.25} sx={{ mt: 4, maxWidth: 500 }}>
                <StepItem
                  number="1"
                  title="Create your identity"
                  description="Choose the public username used in Registry URLs and owner labels."
                  icon={<BadgeOutlinedIcon fontSize="small" />}
                />
                <StepItem
                  number="2"
                  title="Verify your email"
                  description="Confirm that the account belongs to you."
                  icon={<MarkEmailReadOutlinedIcon fontSize="small" />}
                />
                <StepItem
                  number="3"
                  title="Enter your workspace"
                  description="Discover or operate Federated Tasks after sign-in."
                  icon={<HubOutlinedIcon fontSize="small" />}
                />
              </Stack>

              <Alert
                icon={<ShieldOutlinedIcon fontSize="inherit" />}
                severity="info"
                sx={{ mt: 4, maxWidth: 500 }}
              >
                Participant data remains local. FedOps stores account and
                Federated Task metadata, not your raw training data.
              </Alert>
            </Box>

            <Paper
              variant="outlined"
              sx={{
                width: '100%',
                minWidth: 0,
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
                    <PersonAddAltOutlinedIcon fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="h5" component="h2">Create account</Typography>
                    <Typography variant="body2" color="text.secondary">
                      All fields are required
                    </Typography>
                  </Box>
                </Stack>

                {error && <Alert severity="error">{error}</Alert>}

                <Box component="form" noValidate onSubmit={onSubmit}>
                  <Stack spacing={3}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                        Profile
                      </Typography>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                          gap: 2,
                        }}
                      >
                        <TextField
                          autoComplete="given-name"
                          name="firstName"
                          required
                          fullWidth
                          id="firstName"
                          label="First name"
                          autoFocus
                          onChange={onChange}
                          value={form.firstName}
                        />
                        <TextField
                          required
                          fullWidth
                          id="lastName"
                          label="Last name"
                          name="lastName"
                          autoComplete="family-name"
                          onChange={onChange}
                          value={form.lastName}
                        />
                        <TextField
                          required
                          fullWidth
                          id="handle"
                          label="Registry ID (Public username)"
                          name="handle"
                          autoComplete="username"
                          onChange={onChange}
                          value={form.handle}
                          helperText="Your unique public ID. Use 3-30 lowercase letters, numbers, or hyphens."
                          inputProps={{ maxLength: 30 }}
                          sx={{ gridColumn: { sm: '1 / -1' } }}
                        />
                        <TextField
                          required
                          fullWidth
                          name="organization"
                          label="Organization"
                          id="organization"
                          autoComplete="organization"
                          onChange={onChange}
                          value={form.organization}
                          sx={{ gridColumn: { sm: '1 / -1' } }}
                        />
                      </Box>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                        Verified email
                      </Typography>
                      <Stack spacing={1.5}>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                            gap: 1.5,
                          }}
                        >
                          <TextField
                            required
                            fullWidth
                            id="username"
                            label="Email"
                            name="username"
                            autoComplete="email"
                            onChange={onChange}
                            value={form.username}
                            disabled={emailVerified}
                          />
                          {!emailVerified && (
                            <Button
                              variant="outlined"
                              onClick={handleSendVerification}
                              disabled={sendingEmail || !form.username}
                              sx={{ minHeight: 56, whiteSpace: 'nowrap' }}
                            >
                              {sendingEmail
                                ? <CircularProgress size={20} />
                                : emailVerificationSent
                                  ? 'Resend code'
                                  : 'Send code'}
                            </Button>
                          )}
                        </Box>

                        {emailVerificationSent && !emailVerified && (
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                              gap: 1.5,
                            }}
                          >
                            <TextField
                              fullWidth
                              label="Verification code"
                              value={verificationCode}
                              onChange={(event) => {
                                setVerificationCode(event.target.value);
                                setEmailError('');
                              }}
                              placeholder="Enter the code from your email"
                              inputProps={{ inputMode: 'numeric' }}
                            />
                            <Button
                              variant="contained"
                              onClick={handleVerifyCode}
                              disabled={verifyingCode || !verificationCode.trim()}
                              sx={{ minHeight: 56, whiteSpace: 'nowrap' }}
                            >
                              {verifyingCode ? <CircularProgress size={20} /> : 'Verify code'}
                            </Button>
                          </Box>
                        )}

                        {emailVerified && (
                          <Alert severity="success" icon={<MarkEmailReadOutlinedIcon />}>
                            Email verified. You can now create the account.
                          </Alert>
                        )}
                        {verificationMessage && !emailVerified && (
                          <Alert severity="info">{verificationMessage}</Alert>
                        )}
                        {emailError && <Alert severity="error">{emailError}</Alert>}
                      </Stack>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                        Password
                      </Typography>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                          gap: 2,
                        }}
                      >
                        <TextField
                          required
                          fullWidth
                          name="password"
                          label="Password"
                          type="password"
                          id="password"
                          autoComplete="new-password"
                          onChange={onChange}
                          value={form.password}
                        />
                        <TextField
                          required
                          fullWidth
                          name="passwordConfirm"
                          label="Confirm password"
                          type="password"
                          id="passwordConfirm"
                          autoComplete="new-password"
                          onChange={onChange}
                          value={form.passwordConfirm}
                        />
                      </Box>
                    </Box>

                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      size="large"
                      endIcon={<ArrowForwardRoundedIcon />}
                      disabled={Boolean(registerLoading)}
                      sx={{ minHeight: 50 }}
                    >
                      {registerLoading ? 'Creating account…' : 'Create account'}
                    </Button>
                  </Stack>
                </Box>

                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Already have an account?
                  </Typography>
                  <Button
                    component={RouterLink}
                    to={loginPathFor(returnPath)}
                    variant="outlined"
                    size="small"
                    startIcon={<LockOutlinedIcon />}
                  >
                    Sign in
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Box>
          <Copyright sx={{ mt: { xs: 6, md: 9 } }} />
        </Container>
      </Box>
    </>
  );
}
