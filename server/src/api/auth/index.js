import Router from 'koa-router';
import * as authCtrl from './auth.ctrl.js';

const auth = new Router();

auth.post('/register', authCtrl.register);
auth.post('/login', authCtrl.login);
auth.get('/check', authCtrl.check);
auth.post('/logout', authCtrl.logout);

// 이메일 인증
auth.post('/email/send-verification', authCtrl.sendEmailVerification);
auth.post('/email/verify', authCtrl.verifyEmailCode);

export default auth;
