import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Accordion, 
  AccordionSummary, 
  AccordionDetails,
  Paper,
  TextField
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const ConfigDebugPanel = ({ 
  title,
  modelType,
  dataType,
  learningRate,
  numEpochs,
  batchSize,
  numRounds,
  clientPerRound,
  strategy,
  strategyParams,
  xaiEnabled,
  llmParams,
  datasetParams,
  yamlConfig 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // 개발 환경에서만 표시
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const formatObject = (obj) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return String(obj);
    }
  };

  const configData = {
    'Basic Info': {
      title: title || '(empty)',
      modelType: modelType || '(empty)',
      dataType: dataType || '(empty)',
    },
    'Training Parameters': {
      learningRate: learningRate || '(empty)',
      numEpochs: numEpochs || '(empty)',
      batchSize: batchSize || '(empty)',
      numRounds: numRounds || '(empty)',
      clientPerRound: clientPerRound || '(empty)',
      strategy: strategy || '(empty)',
      xaiEnabled: xaiEnabled || '(empty)',
    },
    'Strategy Parameters': strategyParams,
    'LLM Parameters': llmParams,
    'Dataset Parameters': datasetParams,
    'Generated YAML': yamlConfig ? yamlConfig.substring(0, 500) + '...' : '(empty)'
  };

  const handleCopyToClipboard = () => {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      configData
    };
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    alert('Debug info copied to clipboard!');
  };

  const handleLogToConsole = () => {
    console.group('🔍 CONFIG DEBUG INFO');
    console.log('Timestamp:', new Date().toISOString());
    Object.entries(configData).forEach(([section, data]) => {
      console.group(`📋 ${section}`);
      console.log(data);
      console.groupEnd();
    });
    console.groupEnd();
  };

  if (!isVisible) {
    return (
      <Box sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => setIsVisible(true)}
          sx={{ backgroundColor: '#ff9800', '&:hover': { backgroundColor: '#f57c00' } }}
        >
          🔍 Debug Panel
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      position: 'fixed', 
      bottom: 20, 
      right: 20, 
      width: '400px', 
      maxHeight: '80vh',
      zIndex: 1000,
      border: '2px solid #ff9800',
      borderRadius: 2,
      backgroundColor: 'background.paper',
      boxShadow: 3
    }}>
      <Paper sx={{ p: 2, maxHeight: '80vh', overflow: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: '#ff9800', fontWeight: 'bold' }}>
            🔍 Config Debug Panel
          </Typography>
          <Button 
            size="small" 
            onClick={() => setIsVisible(false)}
            sx={{ minWidth: 'auto', p: 0.5 }}
          >
            ✕
          </Button>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Button 
            variant="outlined" 
            size="small" 
            onClick={handleLogToConsole}
            sx={{ mr: 1, fontSize: '0.75rem' }}
          >
            📝 Log to Console
          </Button>
          <Button 
            variant="outlined" 
            size="small" 
            onClick={handleCopyToClipboard}
            sx={{ fontSize: '0.75rem' }}
          >
            📋 Copy Debug Info
          </Button>
        </Box>

        {Object.entries(configData).map(([section, data]) => (
          <Accordion key={section} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                {section}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TextField
                multiline
                fullWidth
                variant="outlined"
                value={formatObject(data)}
                InputProps={{
                  readOnly: true,
                  style: { 
                    fontSize: '0.75rem', 
                    fontFamily: 'monospace',
                    backgroundColor: '#f5f5f5'
                  }
                }}
                maxRows={10}
              />
            </AccordionDetails>
          </Accordion>
        ))}

        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
          💡 This panel is only visible in development mode
        </Typography>
      </Paper>
    </Box>
  );
};

export default ConfigDebugPanel;