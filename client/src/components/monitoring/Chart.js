// Chart.js
import { Box } from '@mui/material';
import { Line } from 'react-chartjs-2';

const Chart = ({ data, options }) => (
  <Box sx={{ height: 300 }}>
    {data && <Line data={data} options={options} />}
  </Box>
);

export default Chart;
