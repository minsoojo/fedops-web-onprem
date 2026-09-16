import React from 'react';
import { Container, Box } from '@mui/material';

const ContentWrapper = ({ children, maxWidth = 'lg' }) => {
  return (
    <Box
      component="main"
      sx={{
        minHeight: 'calc(100vh - 65px)',
        py: { xs: 4, md: 6 },
        backgroundColor: 'background.default',
      }}
    >
      <Container maxWidth={maxWidth}>
        {children}
      </Container>
    </Box>
  );
};

export default ContentWrapper;
