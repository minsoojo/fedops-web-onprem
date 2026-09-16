import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Task from '../models/task.js';
import { canManageTask } from './taskAccess.js';

const readCookie = (cookieHeader = '', name) => {
  const pair = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!pair) return null;
  return decodeURIComponent(pair.slice(name.length + 1));
};

export const authenticateSocket = (socket, next) => {
  try {
    const cookieToken = readCookie(
      socket.handshake.headers.cookie,
      'access_token',
    );
    const token = socket.handshake.auth?.token || cookieToken;
    if (!token) return next(new Error('Authentication required.'));
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return next(new Error('Invalid or expired authentication.'));
  }
};

export const canManageSocketTask = async (socket, taskIdentifier) => {
  if (!socket.user || !taskIdentifier) return false;
  const identifier = String(taskIdentifier);
  const task = mongoose.isValidObjectId(identifier)
    ? await Task.findById(identifier)
    : await Task.findBytitle(identifier);
  return Boolean(task && canManageTask(socket.user, task));
};

export const rejectSocketTaskAccess = (socket) => {
  socket.emit('taskAccessDenied', {
    message: 'Only the task owner can access task management data.',
  });
};
