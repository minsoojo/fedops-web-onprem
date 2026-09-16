import Router from 'koa-router';
import { eventEmitter } from '../../lib/eventEmitter.js';

const realtime = new Router();

// 실시간 업데이트를 위한 SSE 엔드포인트
realtime.get('/status/:taskId', async (ctx) => {
  const { taskId } = ctx.params;
  
  // SSE 헤더 설정
  ctx.request.socket.setTimeout(0);
  ctx.req.socket.setNoDelay(true);
  ctx.req.socket.setKeepAlive(true);
  
  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
  
  // 초기 연결 확인
  ctx.body = `data: ${JSON.stringify({ type: 'connected', taskId })}\n\n`;
  
  // 이벤트 리스너 등록
  const statusUpdateListener = (data) => {
    if (data.taskId === taskId) {
      try {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        ctx.res.write(message);
      } catch (error) {
        console.error('Error writing SSE data:', error);
      }
    }
  };
  
  const heartbeatListener = () => {
    try {
      ctx.res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  };
  
  // 이벤트 리스너 등록
  eventEmitter.on('taskStatusUpdate', statusUpdateListener);
  eventEmitter.on('heartbeat', heartbeatListener);
  
  // 30초마다 heartbeat 전송
  const heartbeatInterval = setInterval(() => {
    eventEmitter.emit('heartbeat');
  }, 30000);
  
  // 연결 종료 처리
  ctx.req.on('close', () => {
    console.log(`SSE connection closed for task: ${taskId}`);
    eventEmitter.removeListener('taskStatusUpdate', statusUpdateListener);
    eventEmitter.removeListener('heartbeat', heartbeatListener);
    clearInterval(heartbeatInterval);
  });
  
  ctx.req.on('error', (error) => {
    console.error('SSE connection error:', error);
    eventEmitter.removeListener('taskStatusUpdate', statusUpdateListener);
    eventEmitter.removeListener('heartbeat', heartbeatListener);
    clearInterval(heartbeatInterval);
  });
});

// FedOps-Server에서 상태 업데이트를 받는 엔드포인트
realtime.post('/update/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const updateData = ctx.request.body;
    
    console.log('\n' + '📡'.repeat(50));
    console.log(`📡 실시간 업데이트 수신: Task ${taskId}`);
    console.log('📡'.repeat(50));
    console.log(`📊 업데이트 데이터: ${JSON.stringify(updateData, null, 2)}`);
    console.log(`⏰ 타임스탬프: ${new Date().toISOString()}`);
    console.log('📡'.repeat(50));
    
    // 이벤트 발생으로 SSE 클라이언트들에게 브로드캐스트
    eventEmitter.emit('taskStatusUpdate', {
      taskId,
      type: 'statusUpdate',
      data: updateData,
      timestamp: Date.now()
    });
    
    ctx.status = 200;
    ctx.body = {
      success: true,
      message: 'Status update received and broadcasted',
      taskId,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error processing real-time update:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message
    };
  }
});

// 전체 작업 상태 조회
realtime.get('/status', async (ctx) => {
  try {
    // 모든 활성 작업의 상태를 반환
    ctx.body = {
      success: true,
      message: 'Real-time status endpoint is active',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting status:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message
    };
  }
});

export default realtime;