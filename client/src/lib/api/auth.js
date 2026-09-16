import client from './client';

// 로그인
export const login = ({ username, password }) =>
    client.post('/fedops/api/auth/login', { username, password });

// 회원가입
export const register = ({ firstName, lastName, username, password, organization, handle }) =>
    client.post('/fedops/api/auth/register', {
        firstName,
        lastName,
        username,
        password,
        organization,
        handle,
    });

// 로그인 상태 확인
export const check = () => client.get('/fedops/api/auth/check');

// 로그아웃
export const logout = () => client.post('/fedops/api/auth/logout');

// 이메일 인증 코드 전송
export const sendEmailVerification = (email) =>
    client.post('/fedops/api/auth/email/send-verification', { email });

// 이메일 인증 코드 확인
export const verifyEmailCode = (email, code) =>
    client.post('/fedops/api/auth/email/verify', { email, code });
