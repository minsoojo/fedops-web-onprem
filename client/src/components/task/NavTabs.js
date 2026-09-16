import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import DevicesOutlinedIcon from '@mui/icons-material/DevicesOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';

export default function NavTabs({ title, showRegistryRelease = false, showSbaFlManage = false }) {
  const location = useLocation();
  const encodedTitle = encodeURIComponent(title);
  const basePath = `/fedops/task/${encodedTitle}`;
  const currentPath = location.pathname;
  let value = 'clients';

  if (currentPath.endsWith('/monitoring')) value = 'monitoring';
  else if (currentPath.endsWith('/registry-release')) value = 'registry-release';
  else if (currentPath.endsWith('/global-model')) value = 'global-model';
  else if (currentPath.endsWith('/server-management')) value = 'server-management';
  else if (currentPath.endsWith('/participants')) value = 'participants';
  else if (showSbaFlManage && currentPath.endsWith('/sba-fl-manage')) value = 'sba-fl-manage';

  return (
    <Box sx={{ width: '100%' }}>
      <Tabs
        value={value}
        aria-label="Federated Task management sections"
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          px: 1,
          minHeight: 52,
          '& .MuiTab-root': {
            minHeight: 52,
            px: 2,
            color: 'text.secondary',
          },
          '& .Mui-selected': {
            color: 'text.primary',
          },
        }}
      >
        <Tab
          value="clients"
          component={Link}
          icon={<DevicesOutlinedIcon />}
          iconPosition="start"
          label="Clients"
          to={basePath}
        />
        {showRegistryRelease && (
          <Tab
            value="registry-release"
            component={Link}
            icon={<CloudUploadOutlinedIcon />}
            iconPosition="start"
            label="Registry Release"
            to={`${basePath}/registry-release`}
          />
        )}
        <Tab
          value="monitoring"
          component={Link}
          icon={<QueryStatsOutlinedIcon />}
          iconPosition="start"
          label="Monitoring"
          to={`${basePath}/monitoring`}
        />
        <Tab
          value="global-model"
          component={Link}
          icon={<Inventory2OutlinedIcon />}
          iconPosition="start"
          label="Global Model"
          to={`${basePath}/global-model`}
        />
        <Tab
          value="server-management"
          component={Link}
          icon={<StorageOutlinedIcon />}
          iconPosition="start"
          label="Server Management"
          to={`${basePath}/server-management`}
        />
        <Tab
          value="participants"
          component={Link}
          icon={<GroupsOutlinedIcon />}
          iconPosition="start"
          label="Participants"
          to={`${basePath}/participants`}
        />
        {showSbaFlManage && (
          <Tab
            value="sba-fl-manage"
            component={Link}
            icon={<SettingsOutlinedIcon />}
            iconPosition="start"
            label="SBA-FL Manage"
            to={`${basePath}/sba-fl-manage`}
          />
        )}
      </Tabs>
    </Box>
  );
}
