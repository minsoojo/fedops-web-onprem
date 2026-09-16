import React from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip, 
  CircularProgress, 
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import { 
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';

/**
 * 실시간 상태 표시 컴포넌트
 * @param {object} props
 * @param {boolean} props.isConnected - 실시간 연결 상태
 * @param {object} props.lastUpdate - 마지막 업데이트 데이터
 * @param {string} props.error - 연결 오류 메시지
 * @param {function} props.onReconnect - 재연결 함수
 */
export const RealtimeStatus = ({ 
  isConnected, 
  lastUpdate, 
  error, 
  onReconnect 
}) => {
  // 상태에 따른 색상 및 아이콘 결정
  const getStatusInfo = (status) => {
    switch (status?.toLowerCase()) {
      case 'running':
        return {
          color: 'success',
          icon: <PlayArrowIcon />,
          label: '실행 중'
        };
      case 'completed':
        return {
          color: 'success',
          icon: <CheckCircleIcon />,
          label: '완료'
        };
      case 'failed':
      case 'error':
        return {
          color: 'error',
          icon: <ErrorIcon />,
          label: '실패'
        };
      case 'stopped':
        return {
          color: 'default',
          icon: <StopIcon />,
          label: '중지됨'
        };
      case 'pending':
      case 'waiting':
        return {
          color: 'warning',
          icon: <ScheduleIcon />,
          label: '대기 중'
        };
      default:
        return {
          color: 'default',
          icon: <WarningIcon />,
          label: status || '알 수 없음'
        };
    }
  };

  const statusInfo = getStatusInfo(lastUpdate?.status);

  // 연결 상태 표시
  const getConnectionStatus = () => {
    if (error) {
      return (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          action={
            <Tooltip title="재연결 시도">
              <IconButton 
                size="small" 
                onClick={onReconnect}
                color="inherit"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          }
        >
          {error}
        </Alert>
      );
    }

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: isConnected ? '#4caf50' : '#f44336',
            mr: 1,
            animation: isConnected ? 'pulse 2s infinite' : 'none',
            '@keyframes pulse': {
              '0%': { opacity: 1 },
              '50%': { opacity: 0.5 },
              '100%': { opacity: 1 }
            }
          }}
        />
        <Typography variant="caption" color="textSecondary">
          {isConnected ? '실시간 연결됨' : '연결 끊어짐'}
        </Typography>
        {!isConnected && (
          <Tooltip title="재연결 시도">
            <IconButton 
              size="small" 
              onClick={onReconnect}
              sx={{ ml: 1 }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  };

  // 진행률 계산 (라운드 기반)
  const getProgress = () => {
    if (!lastUpdate) return 0;
    
    const { current_round, total_rounds } = lastUpdate;
    if (total_rounds && total_rounds > 0) {
      return Math.round((current_round / total_rounds) * 100);
    }
    return 0;
  };

  const progress = getProgress();

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          실시간 상태 모니터링
        </Typography>
        
        {getConnectionStatus()}
        
        {lastUpdate ? (
          <Box>
            {/* 메인 상태 */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Chip
                icon={statusInfo.icon}
                label={statusInfo.label}
                color={statusInfo.color}
                variant="filled"
                sx={{ mr: 2 }}
              />
              <Typography variant="body2" color="textSecondary">
                마지막 업데이트: {new Date(lastUpdate.timestamp).toLocaleTimeString()}
              </Typography>
            </Box>

            {/* 진행률 표시 */}
            {lastUpdate.total_rounds && lastUpdate.total_rounds > 0 && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ mr: 2 }}>
                    라운드 진행률
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {lastUpdate.current_round || 0} / {lastUpdate.total_rounds}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ width: '100%', mr: 1 }}>
                    <Box
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#e0e0e0',
                        overflow: 'hidden'
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          backgroundColor: statusInfo.color === 'success' ? '#4caf50' : '#2196f3',
                          width: `${progress}%`,
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </Box>
                  </Box>
                  <Typography variant="body2" color="textSecondary" sx={{ minWidth: 35 }}>
                    {progress}%
                  </Typography>
                </Box>
              </Box>
            )}

            {/* 상세 정보 */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1 }}>
              {lastUpdate.message && (
                <Typography variant="caption" color="textSecondary">
                  <strong>메시지:</strong> {lastUpdate.message}
                </Typography>
              )}
              {lastUpdate.server_name && (
                <Typography variant="caption" color="textSecondary">
                  <strong>서버:</strong> {lastUpdate.server_name}
                </Typography>
              )}
              {lastUpdate.pod_name && (
                <Typography variant="caption" color="textSecondary">
                  <strong>Pod:</strong> {lastUpdate.pod_name}
                </Typography>
              )}
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} sx={{ mr: 2 }} />
            <Typography variant="body2" color="textSecondary">
              상태 정보를 기다리는 중...
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default RealtimeStatus;