import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { logout } from '../../modules/user';
import { loginPathFor } from '../../lib/authNavigation';
import logo from '../../img/FedOps_logo_without_letter.png';

const pages = [
  {
    name: 'Document',
    path: 'https://gachon-cclab.github.io/',
    external: true,
    icon: DescriptionOutlinedIcon,
  },
  {
    name: 'Registry',
    path: '/fedops/registry',
    aliases: ['/fedops/tasks'],
    icon: PublicOutlinedIcon,
  },
  {
    name: 'My Federated Tasks',
    path: '/fedops/task',
    icon: AccountTreeOutlinedIcon,
  },
  {
    name: 'News',
    path: '/fedops/news',
    icon: CampaignOutlinedIcon,
  },
  {
    name: 'Blog',
    path: '/fedops/blog',
    icon: ArticleOutlinedIcon,
  },
];

const Header = () => {
  const user = useSelector((state) => state.user.user);
  const dispatch = useDispatch();
  const location = useLocation();
  const [anchorElNav, setAnchorElNav] = useState(null);
  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const loginPath = loginPathFor(currentPath);

  const isActive = (page) => (
    !page.external
    && (
      location.pathname === page.path
      || location.pathname.startsWith(`${page.path}/`)
      || page.aliases?.some((alias) => (
        location.pathname === alias
        || location.pathname.startsWith(`${alias}/`)
      ))
    )
  );

  const closeMenu = () => setAnchorElNav(null);
  const accountLabel = user?.handle
    ? `@${user.handle}`
    : user?.organization || user?.username;

  return (
    <AppBar
      position="sticky"
      color="transparent"
      elevation={0}
      sx={{
        top: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        color: 'text.primary',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        backdropFilter: 'blur(12px)',
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 70 } }}>
          <Stack
            component={Link}
            to="/fedops"
            direction="row"
            spacing={1.25}
            alignItems="center"
            sx={{
              mr: { xs: 1, md: 3 },
              color: 'inherit',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                width: 38,
                height: 38,
                display: 'grid',
                placeItems: 'center',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
                backgroundColor: 'background.paper',
              }}
            >
              <Box component="img" src={logo} alt="FedOps" sx={{ width: 28, height: 28 }} />
            </Box>
            <Stack
              direction="row"
              spacing={{ xs: 0.65, md: 0.85 }}
              alignItems="baseline"
              sx={{ whiteSpace: 'nowrap' }}
            >
              <Typography
                sx={{
                  fontSize: { xs: 21, md: 25 },
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: '-0.035em',
                }}
              >
                FedOps
              </Typography>
              <Typography
                component="span"
                color="text.secondary"
                sx={{
                  fontSize: { xs: 11, md: 13 },
                  fontWeight: 600,
                  lineHeight: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                ver 1.3 Beta
              </Typography>
            </Stack>
          </Stack>

          <Box sx={{ display: { xs: 'block', lg: 'none' }, ml: 'auto' }}>
            <IconButton
              aria-label="Open navigation"
              aria-controls={anchorElNav ? 'fedops-mobile-navigation' : undefined}
              aria-expanded={Boolean(anchorElNav)}
              onClick={(event) => setAnchorElNav(event.currentTarget)}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <MenuRoundedIcon />
            </IconButton>
            <Menu
              id="fedops-mobile-navigation"
              anchorEl={anchorElNav}
              open={Boolean(anchorElNav)}
              onClose={closeMenu}
              slotProps={{
                paper: {
                  sx: {
                    mt: 1,
                    minWidth: 240,
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: '0 12px 32px rgba(17, 12, 46, 0.12)',
                  },
                },
              }}
            >
              {pages.map((page) => {
                const Icon = page.icon;
                return (
                  <MenuItem
                    key={page.name}
                    component={page.external ? 'a' : Link}
                    href={page.external ? page.path : undefined}
                    to={page.external ? undefined : page.path}
                    target={page.external ? '_blank' : undefined}
                    rel={page.external ? 'noopener noreferrer' : undefined}
                    selected={isActive(page)}
                    onClick={closeMenu}
                    sx={{ gap: 1.5, mx: 0.75, my: 0.25, borderRadius: 1 }}
                  >
                    <Icon fontSize="small" />
                    <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 500 }}>
                      {page.name}
                    </Typography>
                    {page.external && <OpenInNewRoundedIcon sx={{ fontSize: 15 }} />}
                  </MenuItem>
                );
              })}
              <Divider sx={{ my: 1 }} />
              {user ? (
                <Box sx={{ px: 1.5, pb: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1, py: 1 }}>
                    <PersonOutlineRoundedIcon fontSize="small" />
                    <Typography variant="body2" noWrap>{accountLabel}</Typography>
                  </Stack>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<LogoutOutlinedIcon />}
                    onClick={() => {
                      closeMenu();
                      dispatch(logout());
                    }}
                  >
                    Logout
                  </Button>
                </Box>
              ) : (
                <Box sx={{ px: 1.5, pb: 1 }}>
                  <Button
                    fullWidth
                    component={Link}
                    to={loginPath}
                    variant="contained"
                    startIcon={<LoginOutlinedIcon />}
                    onClick={closeMenu}
                  >
                    Login
                  </Button>
                </Box>
              )}
            </Menu>
          </Box>

          <Stack
            component="nav"
            aria-label="Primary navigation"
            direction="row"
            spacing={0.5}
            sx={{ display: { xs: 'none', lg: 'flex' }, flexGrow: 1 }}
          >
            {pages.map((page) => {
              const Icon = page.icon;
              const active = isActive(page);
              return (
                <Button
                  key={page.name}
                  component={page.external ? 'a' : Link}
                  href={page.external ? page.path : undefined}
                  to={page.external ? undefined : page.path}
                  target={page.external ? '_blank' : undefined}
                  rel={page.external ? 'noopener noreferrer' : undefined}
                  startIcon={<Icon sx={{ fontSize: '18px !important' }} />}
                  endIcon={page.external
                    ? <OpenInNewRoundedIcon sx={{ fontSize: '14px !important' }} />
                    : undefined}
                  aria-current={active ? 'page' : undefined}
                  sx={{
                    minHeight: 38,
                    px: 1.25,
                    borderRadius: 1,
                    color: active ? 'text.primary' : 'text.secondary',
                    backgroundColor: active ? '#f3f3f3' : 'transparent',
                    '&:hover': {
                      color: 'text.primary',
                      backgroundColor: '#f3f3f3',
                    },
                    '&::after': active ? {
                      content: '""',
                      position: 'absolute',
                      left: 12,
                      right: 12,
                      bottom: 2,
                      height: 2,
                      borderRadius: 2,
                      backgroundColor: 'primary.main',
                    } : undefined,
                  }}
                >
                  {page.name}
                </Button>
              );
            })}
          </Stack>

          <Box sx={{ display: { xs: 'none', lg: 'block' }, ml: 2, flexShrink: 0 }}>
            {user ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <PersonOutlineRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Box>
                    <Typography variant="body2" sx={{ lineHeight: 1.2, fontWeight: 500 }}>
                      {accountLabel}
                    </Typography>
                    {user.organization && user.handle && (
                      <Typography variant="caption" color="text.secondary">
                        {user.organization}
                      </Typography>
                    )}
                  </Box>
                </Stack>
                <Button
                  variant="outlined"
                  startIcon={<LogoutOutlinedIcon />}
                  onClick={() => dispatch(logout())}
                >
                  Logout
                </Button>
              </Stack>
            ) : (
              <Button
                component={Link}
                to={loginPath}
                variant="contained"
                startIcon={<LoginOutlinedIcon />}
              >
                Login
              </Button>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Header;
