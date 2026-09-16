import React from 'react';
import { Box } from '@mui/material';

const Base = ({children}) => {
    return (
        <Box display="flex">
            {children}
        </Box>
    );
};

export default Base;