// Sidebar.js
import React, { useEffect, useState } from 'react';
import { Drawer, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from '../../../node_modules/axios/index';

import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import ListItemButton from '@mui/material/ListItemButton';
import InboxIcon from '@mui/icons-material/MoveToInbox';
import MailIcon from '@mui/icons-material/Mail';
import BookIcon from '@mui/icons-material/Book';

const drawerWidth = 240;

const image = {
  height: 20,
  my: 2,
  cursor: 'pointer',
};

const Sidebar = () => {
  const { user } = useSelector(({ user }) => ({ user: user.user }));

  const [todayCount, setTodayCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  useEffect(() => {
    const fetchLoginCount = async () => {
      try {
        const response = await axios.get('/fedops/api/count/today_count');
        console.log('sidebar send api', response);
        const todayCountValue = response.data[0]?.todayCount || 0;
        const totalCountValue = response.data[1]?.totalCount || 0;
        setTodayCount(todayCountValue);
        setTotalCount(totalCountValue);
      } catch (error) {
        console.error('Error fetching count:', error);
      }
    };
    fetchLoginCount();
  }, []);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: drawerWidth,
          boxSizing: 'border-box',
        },
      }}
    >
      <Toolbar />
      <Box sx={{ overflow: 'auto' }}>
        <List>
          {['My Federated Tasks'].map((text, index) => (
            <Link
              key={text}
              // to={`/${text.toLowerCase()}/${user ? user._id : ''}`}
              to="/fedops/task"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <ListItem key={text} disablePadding>
                <ListItemButton>
                  <ListItemIcon>
                    {index % 2 === 0 ? <InboxIcon /> : <MailIcon />}
                  </ListItemIcon>
                  <ListItemText primary={text} />
                </ListItemButton>
              </ListItem>
            </Link>
          ))}
        </List>
        <List>
          {['Document'].map((text, index) => (
            <Link
              key={text}
              // to={`/${text.toLowerCase()}/${user ? user._id : ''}`}
              to={`https://gachon-cclab.github.io/`}
              target="_blank"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <ListItem key={text} disablePadding>
                <ListItemButton>
                  <ListItemIcon>
                    {index % 2 === 0 ? <BookIcon /> : <MailIcon />}
                  </ListItemIcon>
                  <ListItemText primary={text} />
                </ListItemButton>
              </ListItem>
            </Link>
          ))}
        </List>
        {/* <div  style={{ padding: '16px', borderTop: '1px solid rgba(0, 0, 0, 0.12)' }}> */}
        {/* <List>
          {['FedOps Silo'].map((text, index) => (
            <Link
              key={text}
              // to={`/${text.toLowerCase()}/${user ? user._id : ''}`}
              to={`https://github.com/gachon-CCLab/FedOps-Silo`}
              target="_blank"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <ListItem key={text} disablePadding>
                <ListItemButton>
                  <ListItemIcon>
                    {index % 2 === 0 ? <img className='ccl_logo' alt="ccl_logo" src="img/ccl_logo.png" width='25' height='25' /> : <MailIcon />}
                  </ListItemIcon>
                  <ListItemText primary={text} />
                </ListItemButton>
              </ListItem>
            </Link>
          ))}
        </List> */}
        {/* </div> */}

      </Box>
    </Drawer>
  );
};

export default Sidebar;
