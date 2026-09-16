import React from 'react';
import { Typography } from '@mui/material';
import Header from '../components/common/Header';
import ContentWrapper from '../components/common/ContentWrapper';
import { Box, Card, Fade } from '../../node_modules/@mui/material/index';
import Lottie from 'lottie-react';
// import { ReactMarkdown } from '../../node_modules/react-markdown/lib/react-markdown';
import remarkGfm from '../../node_modules/remark-gfm/index';
import Why_FedOps from './Why_FedOps'
import JoinCommunity from './JoinCommunity'
import Overview from './Overview';
import { Container, Button, Paper, Grid } from '@mui/material';
import FedOps1_2 from './FedOps1.2';
import Footer from '../components/common/Footer';
import HowToUseFedOpsSection from './HowtouseFedOps';
import FedOpsTutorialsSection from './FedOpsTutorialsSection';
import FedOps_with_Flower from '../img/FedOps_with_Flower.png';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const legacyMainTheme = createTheme();

// import * as animationData from 'https://assets4.lottiefiles.com/packages/lf20_3ziDZbeGax.json';

// const defaultOptions = {
//   loop: true,
//   autoplay: true,
//   animationData: animationData,
//   rendererSettings: {
//     preserveAspectRatio: 'xMidYMid slice',
//   },
// };

const image = {
  height: 200,
  my: 8,
  cursor: 'pointer',
};

const MainPage = () => {
  const openInNewTab = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCardKeyDown = (event, url) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openInNewTab(url);
    }
  };

  const HeroBanner = ({ title, subtitle, ctas, imageSrc, children }) => (
    <Box sx={{ py: 6, background: 'linear-gradient(180deg, #80d8ff 0%, #ffffff 100%)' }}>
      <Container maxWidth="lg">
        {children ? (
          children
        ) : (
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography color="#0d47a1" variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
                {title}
              </Typography>
              <Typography variant="h6" color="textSecondary" paragraph>
                {subtitle}
              </Typography>
              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {ctas?.map((c) => (
                  <Button
                    key={c.label}
                    variant={c.primary ? 'contained' : 'outlined'}
                    color="primary"
                    href={c.href}
                  >
                    {c.label}
                  </Button>
                ))}
              </Box>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                {imageSrc ? (
                  <img src={imageSrc} alt="FedOps process" style={{ maxWidth: '100%', height: 'auto' }} />
                ) : (
                  <div style={{ width: 220, height: 140, background: '#e3f2fd', borderRadius: 8 }} />
                )}
              </Box>
            </Grid>
          </Grid>
        )}
      </Container>
    </Box>
  );

  return (
    <React.Fragment>
      <Header />
      <ThemeProvider theme={legacyMainTheme}>
      {/* <ContentWrapper> */}
      <HeroBanner>
        <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography color="#2196f3" variant="h2" component="h1" gutterBottom align="left" marginTop="5px" style={{ lineHeight: '1.2' }}>
                FedOps:
              </Typography>
              <Typography variant="h2" component="h1" gutterBottom align="left" marginTop="5px" style={{ lineHeight: '1.2' }}>
                Federated Learning
              </Typography>
              <Typography color="#2196f3" variant="h2" component="h1" gutterBottom align="left" marginTop="5px" style={{ lineHeight: '1.2' }}>
                Life Cycle
              </Typography>
              <Typography variant="h2" component="h1" gutterBottom align="left" marginTop="5px" style={{ lineHeight: '1.2' }}>
                Management Platform
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                <img className='FedOps_logo' alt="FedOps logo" src="/fedops/img/fedops_logo_with_letter.png" style={{ maxWidth: '100%', height: 'auto' }} />
              </Box>
            </Grid>
          </Grid>
        </Container>
        <Grid item xs={12} md={8}>
          <Box my={4}>
            <Typography variant="h5" component="h2" gutterBottom>
              <span>
                <strong>FedOps</strong> is a unified operations platform for federated learning that enables model training across <strong>distributed, heterogeneous silos and devices while preserving data privacy and security</strong>. Built to work seamlessly with the <strong>Flower framework</strong>, it simplifies coordination, monitoring, and lifecycle management—from <strong>experiment to deployment</strong>—while enforcing robust security and data-residency guarantees.
              </span>
            </Typography>
            {/* <Typography variant="h5" component="h2" gutterBottom>
                Key Features
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper elevation={3} sx={{ padding: '16px' }}>
                    <Typography variant="h6" gutterBottom>
                      Heterogeneity Management
                    </Typography>
                    <Typography>
                      Efficiently manages the diverse computational and data resources in federated learning environments.
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper elevation={3} sx={{ padding: '16px' }}>
                    <Typography variant="h6" gutterBottom>
                      Scalable Deployment
                    </Typography>
                    <Typography>
                      Supports scalable and flexible deployment options to meet the demands of various project sizes.
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper elevation={3} sx={{ padding: '16px' }}>
                    <Typography variant="h6" gutterBottom>
                      Real-time Monitoring
                    </Typography>
                    <Typography>
                      Offers real-time monitoring tools for tracking the performance and progress of federated learning models.
                    </Typography>
                  </Paper>
                </Grid>
              </Grid> */}
          </Box>
        </Grid>
      </HeroBanner>
      {/* </ContentWrapper> */}
      {/* For FedOps Launcher START*/}
      {/* <Container maxWidth="lg" sx={{ mt: 2, mb: { xs: 8, md: 12 } }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
          FedOps Launcher
        </Typography>

        <Grid container spacing={2} alignItems="stretch">
          <Grid item xs={12} md={6}>
            <Paper
              elevation={3}
              role="link"
              tabIndex={0}
              onClick={() => openInNewTab('https://gachon-cclab.github.io/docs/FedOps-Launcher/FedOps%20Launcher%20Overview/')}
              onKeyDown={(event) =>
                handleCardKeyDown(
                  event,
                  'https://gachon-cclab.github.io/docs/FedOps-Launcher/FedOps%20Launcher%20Overview/',
                )
              }
              sx={{
                p: 2.5,
                borderRadius: 3,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                },
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 0, textAlign: 'center' }}>
                What is FedOps Launcher?
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper
              elevation={3}
              role="link"
              tabIndex={0}
              onClick={() => openInNewTab('https://gachon-cclab.github.io/docs/FedOps-Launcher/How-to-use-FedOps-Launcher/')}
              onKeyDown={(event) =>
                handleCardKeyDown(
                  event,
                  'https://gachon-cclab.github.io/docs/FedOps-Launcher/How-to-use-FedOps-Launcher/',
                )
              }
              sx={{
                p: 2.5,
                borderRadius: 3,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                },
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 0, textAlign: 'center' }}>
                How to use FedOps Launcher?
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container> */}
      {/* For FedOps Launcher END*/}
      <FedOps1_2 />
      {/* <Overview /> */}
      <HowToUseFedOpsSection />
      <FedOpsTutorialsSection />
      <Why_FedOps />
      <JoinCommunity />
      <Footer />
      </ThemeProvider>
    </React.Fragment>
  );
};

export default MainPage;
