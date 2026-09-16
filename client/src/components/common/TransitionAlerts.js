import React from 'react';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import Fade from '@mui/material/Fade';
import CloseIcon from '@mui/icons-material/Close';

const TransitionAlerts = ({ alert, setAlert, ...props }) => {
  const handleClose = () => {
    setAlert((prevState) => ({ ...prevState, open: false }));
  };

  return (
    <Box sx={{ width: '100%', ...props.sx }}>
      <Fade in={alert.open}>
        <Alert
          severity={alert.severity}
          TransitionComponent={Fade}
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => {
                setAlert({ open: false, message: '', severity: '' });
              }}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
        >
          {alert.message}
        </Alert>
      </Fade>
    </Box>
  );
};

export default TransitionAlerts;
