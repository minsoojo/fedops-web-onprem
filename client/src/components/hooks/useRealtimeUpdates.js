import { apiUrl } from '../../lib/runtimeConfig';
import { useState, useEffect, useRef } from 'react';

/**
 * Server-Sent Events를 사용한 실시간 업데이트 훅
 * @param {string} taskId - 모니터링할 작업 ID
 * @param {function} onUpdate - 업데이트 수신 시 호출될 콜백 함수
 * @returns {object} { isConnected, lastUpdate, error, reconnect }
 */
export const useRealtimeUpdates = (taskId, onUpdate) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectCountRef = useRef(0);

  const connect = () => {
    if (!taskId) {
      console.warn('TaskId가 제공되지 않았습니다.');
      return;
    }

    // 기존 연결 정리
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      console.log(`📡 실시간 업데이트 연결 시작: ${taskId}`);
      const eventSource = new EventSource(
        apiUrl(`/fedops/api/realtime/status/${taskId}`),
        { withCredentials: true }
      );

      eventSource.onopen = () => {
        console.log(`✅ 실시간 업데이트 연결 성공: ${taskId}`);
        setIsConnected(true);
        setError(null);
        reconnectCountRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📡 실시간 업데이트 수신:', data);
          
          setLastUpdate({
            ...data,
            timestamp: Date.now()
          });

          // 콜백 함수 호출
          if (onUpdate && typeof onUpdate === 'function') {
            onUpdate(data);
          }
        } catch (parseError) {
          console.error('실시간 데이터 파싱 오류:', parseError);
        }
      };

      eventSource.onerror = (event) => {
        console.error(`❌ 실시간 업데이트 연결 오류: ${taskId}`, event);
        setIsConnected(false);
        
        // 연결 상태에 따른 재연결 로직
        if (eventSource.readyState === EventSource.CLOSED) {
          setError('연결이 종료되었습니다.');
          scheduleReconnect();
        } else if (eventSource.readyState === EventSource.CONNECTING) {
          setError('연결 시도 중...');
        } else {
          setError('연결 오류가 발생했습니다.');
          scheduleReconnect();
        }
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      console.error('EventSource 생성 오류:', err);
      setError(`연결 생성 실패: ${err.message}`);
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    // 재연결 횟수 제한 (최대 10회)
    if (reconnectCountRef.current >= 10) {
      console.error('최대 재연결 시도 횟수에 도달했습니다.');
      setError('연결을 재시도할 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    // 기존 재연결 타이머 취소
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // 지수적 백오프: 2^n * 1000ms (최대 30초)
    const delay = Math.min(Math.pow(2, reconnectCountRef.current) * 1000, 30000);
    reconnectCountRef.current += 1;

    console.log(`🔄 ${delay}ms 후 재연결 시도 (${reconnectCountRef.current}/10)`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(`🔄 재연결 시도 중... (${reconnectCountRef.current}/10)`);
      connect();
    }, delay);
  };

  const disconnect = () => {
    console.log(`📡 실시간 업데이트 연결 종료: ${taskId}`);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
    setError(null);
    reconnectCountRef.current = 0;
  };

  const reconnect = () => {
    console.log(`🔄 수동 재연결 시도: ${taskId}`);
    disconnect();
    setTimeout(() => {
      connect();
    }, 1000);
  };

  // taskId가 변경될 때 연결 재설정
  useEffect(() => {
    if (taskId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [taskId]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    lastUpdate,
    error,
    reconnect
  };
};

export default useRealtimeUpdates;