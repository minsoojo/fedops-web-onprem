import Router from 'koa-router';
import * as tasksCtrl from './tasks.ctrl.js';
import checkLoggedIn from '../../lib/checkLoggedIn.js';

const tasks = new Router();

tasks.get('/', checkLoggedIn, tasksCtrl.list);
tasks.get('/me', checkLoggedIn, tasksCtrl.list);
tasks.get('/public', checkLoggedIn, tasksCtrl.listPublic);
tasks.get(
  '/public/:handle/:slug/activity',
  checkLoggedIn,
  tasksCtrl.readPublicActivity,
);
tasks.get('/public/:handle/:slug', checkLoggedIn, tasksCtrl.readPublic);
tasks.post('/newcreate', checkLoggedIn, tasksCtrl.newcreate);
tasks.post('/notify', tasksCtrl.notify);

// FedOps 1.3 clients use the immutable MongoDB Task ID. The title-based
// routes below remain available for FedOps 1.2 Legacy compatibility.
tasks.post(
  '/id/:taskId/participants',
  checkLoggedIn,
  tasksCtrl.getTaskById,
  tasksCtrl.requestParticipation,
);
tasks.delete(
  '/id/:taskId/participants/me',
  checkLoggedIn,
  tasksCtrl.getTaskById,
  tasksCtrl.leaveParticipation,
);
tasks.post(
  '/id/:taskId/participation-events',
  checkLoggedIn,
  tasksCtrl.getTaskById,
  tasksCtrl.recordParticipationEvent,
);

// /api/tasks/k8s/:title  → 쿠버네티스만 삭제
tasks.delete(
  '/k8s/:title',
  checkLoggedIn,
  tasksCtrl.getTaskByTitle,
  tasksCtrl.checkOwnTask,
  tasksCtrl.removek8s,
);

tasks.post(
  '/:title/participants',
  checkLoggedIn,
  tasksCtrl.getTaskByTitle,
  tasksCtrl.requestParticipation,
);
tasks.get(
  '/:title/participants',
  checkLoggedIn,
  tasksCtrl.getTaskByTitle,
  tasksCtrl.checkOwnTask,
  tasksCtrl.listParticipants,
);
tasks.patch(
  '/:title/participants/:participantId',
  checkLoggedIn,
  tasksCtrl.getTaskByTitle,
  tasksCtrl.checkOwnTask,
  tasksCtrl.reviewParticipant,
);
tasks.get(
  '/:title/activity',
  checkLoggedIn,
  tasksCtrl.getTaskByTitle,
  tasksCtrl.readActivity,
);
tasks.get(
  '/:title/monitoring',
  checkLoggedIn,
  tasksCtrl.getTaskByTitle,
  tasksCtrl.checkOwnTask,
  tasksCtrl.readMonitoring,
);
tasks.patch(
  '/:title/card',
  checkLoggedIn,
  tasksCtrl.getTaskByTitle,
  tasksCtrl.checkOwnTask,
  tasksCtrl.updateTaskCard,
);

// /api/tasks/:title → 전체 삭제(DB+k8s) - 직접 라우팅
tasks.delete('/:title', checkLoggedIn, tasksCtrl.getTaskByTitle, tasksCtrl.checkOwnTask, tasksCtrl.remove);

const task = new Router(); // /api/tasks/:id
task.get('/', checkLoggedIn, tasksCtrl.read);
task.patch('/', checkLoggedIn, tasksCtrl.checkOwnTask, tasksCtrl.update);

// GET과 PATCH만을 위한 nested routing
tasks.use('/:title', tasksCtrl.getTaskByTitle, task.routes());


export default tasks
