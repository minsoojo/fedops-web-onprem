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
    height: 200,
    my: 8,
    cursor: 'pointer',
};

function whyfedops() {
    return (
        <Box
            component="section"
            sx={{ display: 'flex', overflow: 'hidden' }}
        >
            <Container
                sx={{
                    mt: 10,
                    mb: 15,
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Box
                    sx={{
                        pointerEvents: 'none',
                        position: 'absolute',
                        top: -180,
                        opacity: 0.7,
                    }}
                />
                <Typography
                    variant="h3"
                    align="center"
                    sx={{ fontWeight: 600, mb: 3 }}
                >
                    Why FedOps?
                </Typography>
                <div>
                    <Grid container spacing={5}>
                        <Grid item xs={12} md={4}>
                            <Box sx={item}>
                                <Box sx={number}>1.</Box>
                                <Typography variant="h5" align="center">
                                    FLScalize: Simplifies the application of data and models in a FL environment
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Box sx={item}>
                                <Box sx={number}>2.</Box>
                                <Typography variant="h5" align="center">
                                    The manager oversees and manages the real-time FL progress of both clients and server

                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Box sx={item}>
                                <Box sx={number}>3.</Box>
                                <Typography variant="h5" align="center">
                                    Contribution Evaluation and Client Selection processes incentivize individual clients through a BCFL based on their performance.
                                </Typography>
                            </Box>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Box sx={item}>
                                <Box sx={number}>4.</Box>
                                <Typography variant="h5" align="center">
                                    {'The CI/CD/CFL system integrates with a Code Repo,'}
                                    {'enabling code deployment to multiple clients and servers for continuous or periodic federated learning'}

                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Box sx={item}>
                                <Box sx={number}>5.</Box>
                                <Typography variant="h5" align="center">
                                    The FL dashboard is available for monitoring and observing the lifecycle of FL clients and server
                                </Typography>
                            </Box>
                        </Grid>
                    </Grid>
                </div>
                          <Typography
                            variant="h3"
                            align="center"
                            sx={{ fontWeight: 600, mt : 14, mb: 5 }}
                          >
                    DESIGN PARTNER
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                    <img className='gachon_logo' alt="Gachon_logo" src="/fedops/img/gachon.jpeg" style={{ display: 'block', margin: '0 10px' }} />
                    <img className='flower_logo' alt="Flower_logo" src="/fedops/img/flower.png" style={{ display: 'block', margin: '0 10px' }} />
                    <img className='camb_logo' alt="Cambridge_logo" src="/fedops/img/cambridge.png" style={{ display: 'block', margin: '0 10px' }} />
                </Box>
                <div>
                    <Grid container spacing={5}>
                        <Grid item xs={12}>
                            <Box sx={item}>
                                <br></br><br></br>
                                <Typography variant="h5" align="center">
                                    A unified approach to federated learning, analytics, and evaluation. Federate any workload, any ML framework, and any programming language.
                                </Typography>
                            </Box>
                        </Grid>
                    </Grid>
                </div>
            </Container>
        </Box>
    );
}

export default whyfedops;