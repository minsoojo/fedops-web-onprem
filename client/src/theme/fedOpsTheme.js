import { createTheme } from '@mui/material/styles';

const fedOpsTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#3ba6f1',
      dark: '#3398e1',
      light: '#e8f5fd',
      contrastText: '#0c0a09',
    },
    secondary: {
      main: '#181818',
      contrastText: '#ffffff',
    },
    background: {
      default: '#fafaf9',
      paper: '#ffffff',
    },
    text: {
      primary: '#181818',
      secondary: '#6f6a66',
    },
    divider: '#e8e6e5',
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: [
      'Inter',
      'ui-sans-serif',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: 'clamp(2rem, 4vw, 3.25rem)',
      fontWeight: 500,
      lineHeight: 1.12,
      letterSpacing: '-0.025em',
    },
    h2: {
      fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
      fontWeight: 500,
      lineHeight: 1.18,
      letterSpacing: '-0.022em',
    },
    h3: {
      fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
      fontWeight: 500,
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
    h4: {
      fontSize: '1.75rem',
      fontWeight: 500,
      lineHeight: 1.25,
      letterSpacing: '-0.018em',
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 500,
      lineHeight: 1.4,
      letterSpacing: '-0.01em',
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.45,
      letterSpacing: '-0.008em',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.65,
      letterSpacing: '-0.004em',
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      letterSpacing: '-0.002em',
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      letterSpacing: '-0.004em',
      textTransform: 'none',
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
      letterSpacing: '0.002em',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#fafaf9',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      defaultProps: {
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          borderColor: '#e8e6e5',
          boxShadow: 'none',
          transition: 'border-color 160ms ease, background-color 160ms ease',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          minHeight: 38,
          borderRadius: 9999,
          paddingLeft: 16,
          paddingRight: 16,
        },
        outlined: {
          borderColor: '#d6d3d1',
          color: '#181818',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 9999,
          fontWeight: 500,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: '#ffffff',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#d6d3d1',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#a8a29e',
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 2,
          borderRadius: 2,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          textTransform: 'none',
          fontSize: '0.875rem',
          fontWeight: 500,
        },
      },
    },
  },
});

export default fedOpsTheme;
