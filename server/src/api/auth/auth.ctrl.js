import Joi from 'joi';
import User from '../../models/user.js';
import Count from '../../models/login_count.js';
import axios from 'axios';
import {
  isValidHandle,
  normalizeHandle,
} from '../../lib/slugs.js';

import { emailVerificationBaseUrl } from '../../config/deployment.js';

/*
  POST /api/auth/email/send-verification
  {
    email: 'user@example.com'
  }
*/
export const sendEmailVerification = async (ctx) => {
  const schema = Joi.object().keys({
    email: Joi.string().email().required(),
  });
  
  const result = schema.validate(ctx.request.body);
  if (result.error) {
    ctx.status = 400;
    ctx.body = { message: 'Please enter a valid email address.' };
    return;
  }

  const { email } = ctx.request.body;

  try {
    // FedOps Gateway에 이메일 인증 요청
    await axios.post(`${emailVerificationBaseUrl()}/members/emails/verification-requests`, null, {
      params: { email }
    });
    
    ctx.status = 200;
    ctx.body = { message: 'Verification code has been sent to your email.' };
  } catch (e) {
    console.error('Email verification request failed:', e);
    ctx.status = 500;
    ctx.body = { message: 'Failed to send email.' };
  }
};

/*
  POST /api/auth/email/verify
  {
    email: 'user@example.com',
    code: '148662'
  }
*/
export const verifyEmailCode = async (ctx) => {
  const schema = Joi.object().keys({
    email: Joi.string().email().required(),
    code: Joi.string().required(),
  });
  
  const result = schema.validate(ctx.request.body);
  if (result.error) {
    ctx.status = 400;
    ctx.body = { message: 'Please enter your email and verification code.' };
    return;
  }

  const { email, code } = ctx.request.body;

  try {
    // FedOps Gateway에 인증 코드 검증 요청
    const response = await axios.get(`${emailVerificationBaseUrl()}/members/emails/verifications`, {
      params: { email, code }
    });
    
    const verified = response.data?.data?.verified || false;
    
    if (verified) {
      ctx.status = 200;
      ctx.body = { verified: true, message: 'Email verification completed successfully.' };
    } else {
      ctx.status = 400;
      ctx.body = { verified: false, message: 'Invalid verification code.' };
    }
  } catch (e) {
    console.error('Email verification failed:', e);
    ctx.status = 500;
    ctx.body = { verified: false, message: 'Failed to verify email.' };
  }
};

/*
  POST /api/auth/register
  {
    username: 'ccl@ccl.com',
    password: '<REDACTED>'
  }
*/
export const register = async (ctx) => {
  // 회원가입
  // Request Body 검증하기
  const schema = Joi.object().keys({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    username: Joi.string().email().required(),
    password: Joi.string().required(),
    organization: Joi.string().required(),
    handle: Joi.string().min(3).max(30).required(),
    displayName: Joi.string().allow('').max(80),
  });
  const result = schema.validate(ctx.request.body);
  if (result.error) {
    ctx.status = 400;
    ctx.body = result.error;
    return;
  }

  const {
    firstName,
    lastName,
    username,
    password,
    organization,
    handle,
    displayName,
  } = ctx.request.body;
  try {
    // username이 이미 존재하는지 확인
    const exists = await User.findByUsername(username);
    if (exists) {
      ctx.status = 409; // Conflict
      return;
    }

    const normalizedHandle = handle ? normalizeHandle(handle) : '';
    if (handle && !isValidHandle(normalizedHandle)) {
      ctx.status = 400;
      ctx.body = {
        message: 'Registry ID must be 3-30 characters using lowercase letters, numbers, and hyphens.',
      };
      return;
    }
    if (normalizedHandle && await User.exists({ handle: normalizedHandle })) {
      ctx.status = 409;
      ctx.body = { message: 'Registry ID is already in use.' };
      return;
    }

    const user = new User({
      firstName,
      lastName,
      username,
      organization,
      displayName: displayName
        || [firstName, lastName].filter(Boolean).join(' '),
    });
    user.handle = normalizedHandle;
    await user.setPassword(password); // 비밀번호 설정
    await user.save(); // 데이터베이스에 저장

    // 응답할 데이터에서 hashedPassword 필드 제거
    ctx.body = user.serialize();

    const token = user.generateToken();
    ctx.cookies.set('access_token', token, {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7일
      httpOnly: true,
    });
  } catch (e) {
    ctx.throw(500, e);
  }
};

/*
  POST /api/auth/login
  {
    usernmae: 'ccl',
    password: '<REDACTED>'
  }
*/
export const login = async (ctx) => {
  // 로그인
  const { username, password } = ctx.request.body;

  // username, password가 없으면 에러 처리
  if (!username || !password) {
    ctx.status = 401; // Unauthorized
    return;
  }

  try {
    const user = await User.findByUsername(username);
    // 계정이 존재하지 않으면 에러 처리
    if (!user) {
      ctx.status = 401;
      return;
    }
    const valid = await user.checkPassword(password);
    // 잘못된 비밀번호
    if (!valid) {
      ctx.status = 401;
      return;
    }

    // 로그인 카운트 기록
    const today = new Date();
    const date = today.toLocaleDateString();
    const logintime = today.toLocaleString();

    const count = new Count({
      date,
      username,
      login_time: logintime,
    })
    await count.save();

    await user.setLogintime(logintime); // 비밀번호 설정
    await user.save(); // 데이터베이스에 저장

    ctx.body = user.serialize();

    const token = user.generateToken();
    ctx.cookies.set('access_token', token, {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7일
      httpOnly: true,
    });

  } catch (e) {
    ctx.throw(500, e);
  }
};

export const check = async (ctx) => {
  // 로그인 상태 확인
  const { user } = ctx.state;
  if (!user) {
    ctx.status = 401; // Unauthorized
    return;
  }

  try {
    const userinfo = await User.findByUsername(user.username);
    if (!userinfo) {
      ctx.status = 404; // Not Found
      return;
    }

    // 사용자 권한 확인
    const isAdmin = user.username === 'ccl@ccl.com';

    ctx.body = {
      ...userinfo.serialize(),
      isAdmin, // 권한 정보 추가
    };
  } catch (e) {
    ctx.throw(500, e);
  }
};


/*
  POST /api/auth/logout
*/
export const logout = async (ctx) => {
  // 로그아웃
  ctx.cookies.set('access_token', null, {
    maxAge: 0,
    httpOnly: true,
    overwrite: true,
    path: '/',
  });
  ctx.status = 204; // No Content
};
