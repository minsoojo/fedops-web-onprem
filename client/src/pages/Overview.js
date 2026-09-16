import * as React from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Container from '@mui/material/Container';
import { Typography } from '@mui/material';

const item = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    px: 5,
};

const number = {
    fontSize: 24,
    fontFamily: 'default',
    color: 'secondary.main',
    fontWeight: 'medium',
};

const image = {
    height: 600,
    my: 8,
    cursor: 'pointer',
};

function Overview() {
    return (
        <Box component="section" sx={{ display: 'flex', overflow: 'hidden', px: { xs: 2, md: 4 } }}>
            <Container maxWidth="xl" sx={{ mt: 8, mb: 12, position: 'relative', px: { xs: 1, md: 3 } }}>
                <Box sx={{ pointerEvents: 'none', position: 'absolute', top: -180, opacity: 0.7 }} />

                <Grid container spacing={6} alignItems="flex-start">
                    {/* Left: Overview */}
                    <Grid item xs={12} md={6}>
                        <Typography variant="h2" marked="center" component="h2" sx={{ mb: 4 }}>
                            Overview
                        </Typography>

                        <Typography variant="h5" align="left" paragraph>
                            - FedOps was designed and implemented to enable FL lifecycle operations management by extending the existing MLOps concept.
                            <br />
                            <br />
                            - FedOps is to manage the entire FL process of creating a global model by deploying and training the local model created in the experimental environment.
                        </Typography>

                        <Box
                            component="img"
                            src="https://gachon-cclab.github.io/docs/img/FedOps_Overview.PNG"
                            alt="FedOps overview"
                            sx={{
                                width: { xs: '100%', md: '85%' },
                                maxWidth: { md: 560 },
                                height: 'auto',
                                my: 4,
                                display: 'block',
                                marginLeft: { md: 0 },
                            }}
                        />
                    </Grid>

                    {/* Right: FedOps Detail */}
                    <Grid item xs={12} md={6}>
                        <Typography variant="h3" marked="center" component="h3" sx={{ mb: 4 }}>
                            FedOps Detail
                        </Typography>

                        <Box sx={{ mb: 2 }}>
                            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>1. FLScalize</Typography>
                            <Typography variant="body1" color="textSecondary" paragraph sx={{ mb: 3 }}>
                                Simplifies the application of data and models in a FL environment.
                            </Typography>

                            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>2. Manager</Typography>
                            <Typography variant="body1" color="textSecondary" paragraph sx={{ mb: 3 }}>
                                Continuously check and manage FL Client/Server state.
                            </Typography>

                            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>3. Contribution Evaluation (CE/CS & BCFL)</Typography>
                            <Typography variant="body1" color="textSecondary" paragraph sx={{ mb: 3 }}>
                                Client selection and incentives based on contribution evaluation.
                            </Typography>

                            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>4. CI/CD/CFL</Typography>
                            <Typography variant="body1" color="textSecondary" paragraph sx={{ mb: 3 }}>
                                Easily deploy clients/servers and perform periodic FL rounds.
                            </Typography>

                            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>5. Monitoring</Typography>
                            <Typography variant="body1" color="textSecondary" paragraph sx={{ mb: 3 }}>
                                Dashboard for visualizing the FL lifecycle of clients and servers.
                            </Typography>
                        </Box>

                        <Box
                            component="img"
                            src="https://gachon-cclab.github.io/docs/img/architecture.PNG"
                            alt="architecture"
                            sx={{
                                width: '100%',
                                maxHeight: { xs: 420, md: 880 },
                                height: 'auto',
                                my: 2,
                                objectFit: 'contain',
                            }}
                        />
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
}

export default Overview;