import { EventEmitter } from 'events';

// 전역 이벤트 에미터 생성
export const eventEmitter = new EventEmitter();

// 최대 리스너 수 설정 (메모리 누수 방지)
eventEmitter.setMaxListeners(100);

console.log('Event Emitter initialized for real-time updates');