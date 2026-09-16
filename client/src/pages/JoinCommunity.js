import * as React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Container from '@mui/material/Container';
import { Typography } from '@mui/material';
import { Button } from '@mui/material';
import { Link } from 'react-router-dom'

function ProductCTA() {
  const [open, setOpen] = React.useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <Container component="section" sx={{ mt: 10, display: 'flex' }}>
      <Grid container>
        <Grid item xs={12}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              py: 8,
              px: 3,
            }}
          >
            <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 400 }}>
              <Typography variant="h2" component="h2" gutterBottom>
                Join our
                Community!
              </Typography>
              <Typography variant="h5">
                Join us on our journey to make federated approaches available to everyone.
              </Typography>
              <Button
                color="secondary"
                variant="contained"
                component="a"
                href="https://join.slack.com/t/fedopshq/shared_invite/zt-3h73abys7-ms07FlAVG7EP2108BzevcA"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ width: '100%' }}
              >
                Join our slack
              </Button>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}

export default ProductCTA;
