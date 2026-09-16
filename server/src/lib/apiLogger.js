const isHealthCheck = (url = '') => (
  ['/health', '/ping', '/fedops/api/health'].includes(url.split('?')[0])
);

// API 용도 매핑
const getApiPurpose = (method, url) => {
  // Tasks API
  if (url.includes('/api/tasks')) {
    if (method === 'POST' && url.includes('/newcreate')) return '📝 Task 생성';
    if (method === 'GET' && url.match(/\/api\/tasks\/[^/]+$/)) return '📖 Task 조회';
    if (method === 'GET' && url === '/fedops/api/tasks') return '📋 Task 목록';
    if (method === 'PATCH') return '✏️ Task 수정';
    if (method === 'DELETE' && url.includes('/k8s/')) return '🗑️ K8s 리소스 삭제';
    if (method === 'DELETE') return '🗑️ Task 전체 삭제';
    if (method === 'POST' && url.includes('/notify')) return '🔔 Task 알림';
  }
  
  // Auth API
  if (url.includes('/api/auth')) {
    if (url.includes('/register')) return '👤 회원가입';
    if (url.includes('/login')) return '🔐 로그인';
    if (url.includes('/logout')) return '🚪 로그아웃';
    if (url.includes('/check')) return '🔍 인증 확인';
  }
  
  // Monitoring API
  if (url.includes('/api/monitoring')) return '📊 모니터링';
  
  // User API
  if (url.includes('/api/users')) return '👥 사용자 관리';
  
  // Device/Client API
  if (url.includes('/api/devices') || url.includes('/api/clients')) return '📱 디바이스 관리';
  
  // Model API
  if (url.includes('/api/models')) return '🤖 모델 관리';
  
  // Statistics API
  if (url.includes('/api/stats') || url.includes('/api/statistics')) return '📈 통계';
  
  // Socket.IO
  if (url.includes('socket.io')) return '🔌 실시간 통신';
  
  // Static files
  if (method === 'GET') {
    if (url.includes('.js')) return '📄 JavaScript 파일';
    if (url.includes('.css')) return '🎨 CSS 파일';
    if (url.includes('.html')) return '📃 HTML 파일';
    if (url.includes('.png') || url.includes('.jpg') || url.includes('.svg')) return '�️ 이미지 파일';
  }
  
  // Health check
  if (isHealthCheck(url)) return '💗 헬스체크';
  
  // Default
  return '🌐 일반 요청';
};

// 로깅 제외 대상 확인
const shouldSkipLogging = (method, url) => {
  // 정적 파일 요청 제외
  if (method === 'GET' && (
    url.includes('.js') || 
    url.includes('.css') || 
    url.includes('.map') || 
    url.includes('.ico') ||
    url.includes('.png') || 
    url.includes('.jpg') || 
    url.includes('.svg') ||
    url.includes('.woff') ||
    url.includes('.ttf') ||
    url.includes('.json') ||
    url.includes('favicon')
  )) {
    return true;
  }
  
  // Socket.IO 요청 제외
  if (url.includes('socket.io')) {
    return true;
  }
  
  // Health check 간소화
  if (isHealthCheck(url)) {
    return true;
  }
  
  return false;
};

// 간소 로깅 대상 확인 (완전 제외는 아니지만 간단하게 로깅)
const shouldUseSimpleLogging = (method, url) => {
  // 단순 GET 요청들은 간소하게 로깅
  if (method === 'GET') {
    // API 조회 요청들
    if (url.match(/\/api\/tasks\/[^/]+$/) || // 개별 task 조회
        url === '/fedops/api/tasks' ||       // task 목록
        url.includes('/api/auth/check') ||   // 인증 체크
        url.includes('/api/users') ||        // 사용자 조회
        url.includes('/api/models')) {       // 모델 조회
      return true;
    }
  }
  
  return false;
};

// API 로깅 미들웨어
const apiLogger = async (ctx, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 15);
  const apiPurpose = getApiPurpose(ctx.method, ctx.url);
  
  // 로깅 제외 대상인지 확인
  const skipLogging = shouldSkipLogging(ctx.method, ctx.url);
  
  // 컨텍스트에 requestId 추가 (항상)
  ctx.state.requestId = requestId;
  
  // 간소 로깅 대상인지 확인
  const useSimpleLogging = shouldUseSimpleLogging(ctx.method, ctx.url);
  
  // 요청 정보 로깅 (제외 대상이 아닌 경우만)
  if (!skipLogging) {
    if (useSimpleLogging) {
      // 간소 로깅: 한 줄로만 표시
      console.log(`� [간소] [${requestId}] ${ctx.method} ${ctx.url} - ${apiPurpose}`);
    } else {
      // 상세 로깅
      console.log('\n' + '='.repeat(80));
      console.log(`� [${requestId}] ${apiPurpose}`);
      console.log('='.repeat(80));
      console.log(`� ${ctx.method} ${ctx.url}`);
      
      // 상세 정보 표시
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(ctx.method)) {
        // 중요한 요청들은 상세 로깅
        console.log(`🏠 Origin: ${ctx.origin}`);
        if (ctx.params && Object.keys(ctx.params).length > 0) {
          console.log(`🎯 Params: ${JSON.stringify(ctx.params, null, 2)}`);
        }
        if (ctx.query && Object.keys(ctx.query).length > 0) {
          console.log(`❓ Query: ${JSON.stringify(ctx.query, null, 2)}`);
        }
        
        // Request Body 로깅
        if (ctx.request.body && Object.keys(ctx.request.body).length > 0) {
          console.log(`📦 Body: ${JSON.stringify(ctx.request.body, null, 2)}`);
        }
      } else if (ctx.method === 'GET' && ctx.query && Object.keys(ctx.query).length > 0) {
        // GET 요청에서는 쿼리가 있을 때만 표시
        console.log(`❓ Query: ${JSON.stringify(ctx.query, null, 2)}`);
      }
      
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
      console.log('='.repeat(80));
    }
  }

  // 컨텍스트에 requestId 추가
  ctx.state.requestId = requestId;

  try {
    // 다음 미들웨어 실행
    await next();
    
    const duration = Date.now() - start;
    
    // 응답 정보 로깅 (제외 대상이 아닌 경우만)
    if (!skipLogging) {
      if (useSimpleLogging) {
        // 간소 로깅: 한 줄로 완료 표시
        console.log(`✅ [간소] [${requestId}] ${ctx.method} ${ctx.url} - ${ctx.status} (${duration}ms)`);
      } else {
        // 상세 로깅
        console.log('\n' + '='.repeat(80));
        console.log(`🟢 [${requestId}] ${apiPurpose} - 성공`);
        console.log('='.repeat(80));
        console.log(`📍 ${ctx.method} ${ctx.url}`);
        console.log(`📊 Status: ${ctx.status}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        
        // Response Body는 POST, PUT, PATCH 요청에만 표시 (GET은 너무 길어질 수 있음)
        if (['POST', 'PUT', 'PATCH'].includes(ctx.method) && ctx.body) {
          const bodyStr = JSON.stringify(ctx.body);
          if (bodyStr.length > 500) {
            console.log(`📤 Response Body: ${bodyStr.substring(0, 500)}... (truncated)`);
          } else {
            console.log(`📤 Response Body: ${bodyStr}`);
          }
        }
        
        console.log(`⏰ Completed: ${new Date().toISOString()}`);
        console.log('='.repeat(80));
      }
    } else if (duration > 1000) {
      // 제외 대상이라도 느린 요청은 간단히 로깅
      console.log(`⚠️ [${requestId}] 느린 요청: ${ctx.method} ${ctx.url} - ${duration}ms`);
    }
    
  } catch (error) {
    const duration = Date.now() - start;
    
    // 간소 로깅 대상인지 확인
    const useSimpleLogging = shouldUseSimpleLogging(ctx.method, ctx.url);
    
    if (useSimpleLogging) {
      // 간소 에러 로깅
      console.log(`❌ [간소] [${requestId}] ${ctx.method} ${ctx.url} - ERROR: ${error.message} (${duration}ms)`);
    } else {
      // 상세 에러 로깅
      console.log('\n' + '='.repeat(80));
      console.log(`🔴 [${requestId}] ${apiPurpose} - 실패`);
      console.log('='.repeat(80));
      console.log(`📍 ${ctx.method} ${ctx.url}`);
      console.log(`❌ Error: ${error.message}`);
      console.log(`📊 Status: ${ctx.status || 500}`);
      console.log(`⏱️  Duration: ${duration}ms`);
      
      // 에러 스택은 개발 환경에서만 표시
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📚 Stack: ${error.stack}`);
      }
      
      console.log(`⏰ Failed: ${new Date().toISOString()}`);
      console.log('='.repeat(80));
    }
    
    throw error;
  }
};

export default apiLogger;
