import { apiUrl } from '../runtimeConfig';
import axios from 'axios';

// Public runtime settings select the origin; the API paths stay the same.

const apiErrorMessage = (error, fallback) => {
  const detail = error.response?.data?.error
    ?? error.response?.data?.detail
    ?? error.response?.data?.message
    ?? error.message;
  if (Array.isArray(detail)) {
    return detail.map((issue) => {
      if (!issue || typeof issue !== 'object') return String(issue);
      const location = Array.isArray(issue.loc)
        ? issue.loc.filter((part) => part !== 'body').join('.')
        : '';
      return [location, issue.msg || issue.message].filter(Boolean).join(': ');
    }).filter(Boolean).join(' · ') || fallback;
  }
  if (detail && typeof detail === 'object') {
    return detail.message || JSON.stringify(detail);
  }
  return detail || fallback;
};

class ServerControlAPI {
  constructor() {
    this.client = axios.create({
      baseURL: apiUrl(`/fedops/api/server-control`),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // 인터셉터로 에러 처리
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // ============= 서버 라이프사이클 관리 =============

  async createScalableServer(taskId, serverRepoAddr = '') {
    try {
      const response = await this.client.post(`/create-scalable/${taskId}`, {
        serverRepoAddr
      });
      return response.data;
    } catch (error) {
      throw new Error(apiErrorMessage(error, 'Failed to create scalable server'));
    }
  }

  async createScalableServerWithConfig(taskId, flConfig) {
    try {
      const response = await this.client.post(`/create-scalable-with-config/${taskId}`, flConfig);
      return response.data;
    } catch (error) {
      throw new Error(apiErrorMessage(error, 'Failed to create scalable server with config'));
    }
  }

  async createScalableServerFromSaved(taskId, campaignConfig = null) {
    try {
      const response = await this.client.post(
        `/create-scalable-from-saved/${taskId}`,
        campaignConfig ? { campaignConfig } : {},
      );
      return response.data;
    } catch (error) {
      throw new Error(apiErrorMessage(error, 'Failed to create scalable server from saved config'));
    }
  }

  async getCampaign(taskId) {
    const response = await this.client.get(`/campaign/${taskId}`);
    return response.data;
  }

  async getValidationData(taskId) {
    const response = await this.client.get(`/validation-data/${encodeURIComponent(taskId)}`);
    return response.data;
  }

  async checkValidation(taskId, campaignConfig) {
    try {
      const response = await this.client.post(`/validation-check/${taskId}`, { campaignConfig });
      return response.data;
    } catch (error) {
      throw new Error(apiErrorMessage(error, 'Validation data check failed'));
    }
  }

  async saveCampaign(taskId, campaignConfig) {
    try {
      const response = await this.client.put(`/campaign/${taskId}`, { campaignConfig });
      return response.data;
    } catch (error) {
      throw new Error(apiErrorMessage(error, 'Failed to save Federated campaign'));
    }
  }

  async pauseServer(taskId) {
    try {
      const response = await this.client.post(`/pause/${taskId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to pause server');
    }
  }

  async resumeServer(taskId) {
    try {
      const response = await this.client.post(`/resume/${taskId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to resume server');
    }
  }

  // ============= 리소스 스케일링 =============

  async scaleResources(taskId, cpu, memory) {
    try {
      const response = await this.client.post(`/scale/${taskId}`, {
        cpu,
        memory
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to scale resources');
    }
  }

  // ============= 서버 상태 및 모니터링 =============

  async getServerStatus(taskId) {
    try {
      const response = await this.client.get(`/status/${taskId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get server status');
    }
  }

  async getLogs(taskId, lines = 100) {
    try {
      const response = await this.client.get(`/logs/${taskId}?lines=${lines}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get logs');
    }
  }

  // ============= 명령 실행 =============

  async executeCommand(taskId, command) {
    try {
      const response = await this.client.post(`/execute/${taskId}`, {
        command
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to execute command');
    }
  }

  async startFLServer(taskId) {
    try {
      const response = await this.client.post(`/start-fl-server/${taskId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to start FL server');
    }
  }

  async stopFLServer(taskId) {
    try {
      const response = await this.client.post(`/stop-fl-server/${taskId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to stop FL server');
    }
  }

  async getProcesses(taskId) {
    try {
      const response = await this.client.get(`/processes/${taskId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get processes');
    }
  }

  // ============= 파일 관리 =============

  async listFiles(taskId, path = '/app/data') {
    try {
      const response = await this.client.get(`/files/${taskId}?path=${encodeURIComponent(path)}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to list files');
    }
  }

  async getFileContent(taskId, filePath) {
    try {
      const response = await this.client.get(`/file-content/${taskId}?filePath=${encodeURIComponent(filePath)}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get file content');
    }
  }

  async saveFile(taskId, filePath, content) {
    try {
      const response = await this.client.post(`/save-file/${taskId}`, {
        filePath,
        content
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to save file');
    }
  }

  // ============= FL 서버 직접 API 호출 =============

  async callFLServerAPI(taskId, endpoint, method = 'GET', data = null) {
    try {
      const response = await this.client.post(`/fl-api/${taskId}`, {
        endpoint,
        method,
        data
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to call FL server API');
    }
  }

  // ============= 편의 메서드들 =============

  // 사전 정의된 명령어들
  async checkGPU(taskId) {
    return this.executeCommand(taskId, 'nvidia-smi');
  }

  async checkDiskSpace(taskId) {
    return this.executeCommand(taskId, 'df -h');
  }

  async checkMemoryUsage(taskId) {
    return this.executeCommand(taskId, 'free -h');
  }

  async installPackage(taskId, packageName) {
    return this.executeCommand(taskId, `pip install ${packageName}`);
  }

  async updateRequirements(taskId) {
    return this.executeCommand(taskId, 'cd /app/code && pip install -r requirements.txt');
  }

  async gitPull(taskId) {
    return this.executeCommand(taskId, 'cd /app/code && git pull origin main');
  }

  // FL 서버 상태 체크
  async checkFLServerHealth(taskId) {
    try {
      return await this.callFLServerAPI(taskId, '/health');
    } catch (error) {
      // FL 서버가 응답하지 않으면 프로세스 상태 확인
      return await this.getProcesses(taskId);
    }
  }

  // 모델 정보 가져오기
  async getModelInfo(taskId) {
    return this.callFLServerAPI(taskId, '/model/info');
  }

  // 훈련 상태 확인
  async getTrainingStatus(taskId) {
    return this.callFLServerAPI(taskId, '/training/status');
  }

  // 클라이언트 목록 확인
  async getConnectedClients(taskId) {
    return this.callFLServerAPI(taskId, '/clients');
  }

  // ============= 연합학습 관련 추가 메서드 =============

  // FL 서버 연결 정보 가져오기 (백엔드 프록시 사용)
  async getConnectionInfo(taskId) {
    try {
      const response = await this.client.get(`/connection-info/${taskId}`);
      return response.data.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get connection info');
    }
  }

  // 서버 준비 상태 확인 (scalable server 전용)
  async checkServerReady(taskId) {
    try {
      const response = await this.client.get(`/check-server-ready/${taskId}`);
      return response.data.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to check server ready status');
    }
  }

  // FL 서버 상태 직접 확인
  async getFLServerStatus(taskId) {
    try {
      const response = await this.client.get(`/fl-server-status/${taskId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get FL server status');
    }
  }

  // 연합학습 시작 (클라이언트용) - scalable server 대응 개선
  async startFederatedLearning(taskId, clientConfig) {
    try {
      // 먼저 서버 준비 상태 확인 (scalable server용)
      const readyStatus = await this.checkServerReady(taskId);
      
      if (!readyStatus.ready) {
        throw new Error(`FL Server is not ready. Status: ${readyStatus.status}`);
      }

      const connectionInfo = readyStatus.connection_info;
      
      if (!connectionInfo.external_ip || !connectionInfo.port) {
        throw new Error('FL Server connection information not available');
      }

      return {
        success: true,
        message: 'FL Server is ready for federated learning',
        connection: {
          server_address: connectionInfo.server_address,
          external_ip: connectionInfo.external_ip,
          port: connectionInfo.port,
          task_id: taskId,
          status: readyStatus.status,
          fl_ready: readyStatus.fl_ready
        }
      };
    } catch (error) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to start federated learning');
    }
  }

  // 라운드 상태 확인
  async getRoundStatus(taskId) {
    return this.callFLServerAPI(taskId, '/round/status');
  }

  // 모델 가중치 다운로드 URL 조회
  async getModelDownloadUrl(taskId, version = 'latest') {
    return this.callFLServerAPI(taskId, `/model/download?version=${version}`);
  }

  // ============= 기존 방식 호환 태스크 관리 =============

  // 사용 가능한 클라이언트 목록 조회
  async getAvailableClients(taskId) {
    try {
      const response = await this.client.get(`/clients/${taskId}`);
      return response.data.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get available clients');
    }
  }

  // 특정 태스크의 등록된 모든 클라이언트 조회
  async getTaskClients(taskId) {
    try {
      const response = await axios.get(`/fedops/api/fl-server-manager/FLSe/GetFLTask/${taskId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get task clients');
    }
  }

  // 선택된 클라이언트들과 연합학습 시작
  async startFLWithSelectedClients(taskId, selectedDevices, serverType = 'scalable', flConfig = {}) {
    try {
      const response = await this.client.post(`/start-fl-with-clients/${taskId}`, {
        selected_devices: selectedDevices,
        server_type: serverType,
        fl_config: flConfig
      });
      return response.data.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to start FL with selected clients');
    }
  }

  // 태스크 전체 상태 요약
  async getTaskSummary(taskId) {
    try {
      const response = await this.client.get(`/task-summary/${taskId}`);
      return response.data.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get task summary');
    }
  }

  // ============= SBA-FL 전용 관리 =============

  async getSbaFlStatus(taskId) {
    try {
      const response = await this.client.get(`/sba-fl/status/${taskId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get SBA-FL status');
    }
  }

  async getSbaFlHistory(taskId) {
    try {
      const response = await this.client.get(`/sba-fl/history/${taskId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get SBA-FL history');
    }
  }

  async getSbaFlModels(taskId) {
    try {
      const response = await this.client.get(`/sba-fl/models/${taskId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get SBA-FL models');
    }
  }

  async updateSbaFlConfig(taskId, config) {
    try {
      const response = await this.client.post(`/sba-fl/config/${taskId}`, config);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to update SBA-FL config');
    }
  }

  // 클러스터 할당 (단일)
  async assignCluster(taskId, deviceMac, clusterId) {
    try {
      const response = await this.client.put(`/assign-cluster/${taskId}`, {
        client_mac: deviceMac,
        cluster_id: clusterId
      });
      return response.data.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to assign cluster');
    }
  }

  // 클러스터 일괄 할당
  async bulkAssignCluster(taskId, assignments) {
    try {
      const response = await this.client.post(`/bulk-assign-cluster/${taskId}`, {
        assignments: assignments
      });
      return response.data.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to bulk assign clusters');
    }
  }

  // FL 클라이언트 등록 (일반적으로 클라이언트에서 직접 호출)
  async registerFLClient(taskId, deviceMac, deviceHostname, clusterId = null) {
    try {
      const response = await axios.put(`/fedops/api/fl-server-manager/FLSe/RegisterFLTask`, {
        FL_task_ID: taskId,
        Device_mac: deviceMac,
        Device_hostname: deviceHostname,
        Device_online: true,
        Device_training: false,
        cluster_id: clusterId
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to register FL client');
    }
  }

  // ============= 통합 워크플로우 메서드 =============

  // 전체 FL 워크플로우: 서버 생성 → 클라이언트 대기 → 시작
  async createFLTaskWorkflow(taskId, flConfig, serverType = 'scalable') {
    try {
      // 1. 서버 생성 (설정 포함)
      let serverResult;
      if (serverType === 'scalable') {
        serverResult = await this.createScalableServerWithConfig(taskId, flConfig);
      } else {
        // 기존 Job 방식은 별도 구현 필요
        throw new Error('Job server type not implemented in workflow');
      }

      return {
        success: true,
        message: 'FL task workflow initiated',
        server_result: serverResult,
        task_id: taskId,
        server_type: serverType,
        next_step: 'wait_for_server_ready'
      };
    } catch (error) {
      throw new Error(`FL workflow failed: ${error.message}`);
    }
  }

  // 서버 준비 상태 대기 (scalable server용)
  async waitForServerReady(taskId, timeout = 300000) { // 5분 타임아웃
    try {
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        const readyStatus = await this.checkServerReady(taskId);
        
        if (readyStatus.ready && readyStatus.fl_ready) {
          return {
            success: true,
            message: 'FL Server is ready',
            connection_info: readyStatus.connection_info,
            server_status: readyStatus.status
          };
        }
        
        // 서버가 에러 상태면 즉시 실패 반환
        if (readyStatus.status && readyStatus.status.includes('Error')) {
          throw new Error(`Server failed to start: ${readyStatus.status}`);
        }
        
        // 2초 대기 후 다시 확인
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      throw new Error(`Timeout: FL Server not ready within ${timeout/1000} seconds`);
    } catch (error) {
      throw new Error(`Failed to wait for server ready: ${error.message}`);
    }
  }

  // 클라이언트 대기 및 선택 후 시작
  async waitAndStartFL(taskId, minimumClients = 1, timeout = 300000) { // 5분 타임아웃
    try {
      const startTime = Date.now();
      
      // 클라이언트가 충분히 연결될 때까지 대기
      while (Date.now() - startTime < timeout) {
        const clients = await this.getAvailableClients(taskId);
        
        if (clients.available_clients.length >= minimumClients) {
          // 모든 온라인 클라이언트를 선택하여 시작
          const selectedDevices = clients.available_clients.map(c => c.device_mac);
          
          return await this.startFLWithSelectedClients(taskId, selectedDevices, 'scalable');
        }
        
        // 2초 대기 후 다시 확인
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      throw new Error(`Timeout: Not enough clients connected (minimum: ${minimumClients})`);
    } catch (error) {
      throw new Error(`Failed to wait and start FL: ${error.message}`);
    }
  }

  // ============= 실시간 로그 스트리밍 =============

  /**
   * 실시간 로그 스트리밍 연결 생성 (Server-Sent Events)
   * @param {string} taskId - Task ID
   * @param {string} filePath - 로그 파일 경로 (기본값: /app/data/logs/serverlog.txt)
   * @param {function} onMessage - 로그 메시지 수신 콜백
   * @param {function} onError - 에러 콜백
   * @returns {EventSource} EventSource 객체 (연결 종료 시 .close() 호출 필요)
   */
  streamLogs(taskId, filePath = '/app/data/logs/serverlog.txt', onMessage, onError) {
    const url = `/fedops/api/server-control/stream-logs/${taskId}?filePath=${encodeURIComponent(filePath)}`;
    
    console.log(`📡 Creating EventSource for log streaming: ${url}`);
    
    const eventSource = new EventSource(apiUrl(url), { withCredentials: true });
    
    eventSource.onopen = () => {
      console.log('✅ EventSource connection opened');
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Received log message:', data.type);
        if (onMessage) {
          onMessage(data);
        }
      } catch (error) {
        console.error('❌ Error parsing log message:', error);
        if (onError) {
          onError(error);
        }
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('❌ EventSource error:', error);
      if (error.target.readyState === EventSource.CLOSED) {
        console.log('🔌 EventSource connection closed');
      } else if (error.target.readyState === EventSource.CONNECTING) {
        console.log('🔄 EventSource reconnecting...');
      }
      if (onError) {
        onError(error);
      }
    };
    
    return eventSource;
  }
}

// 싱글톤 인스턴스 생성
const serverControlAPI = new ServerControlAPI();

export default serverControlAPI;
