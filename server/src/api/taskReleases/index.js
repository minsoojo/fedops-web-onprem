import Router from 'koa-router';

import checkLoggedIn from '../../lib/checkLoggedIn.js';
import * as controller from './taskReleases.ctrl.js';


const releases = new Router();

releases.get('/runtime-artifacts/:token/archive', controller.downloadRuntimeArchive);
releases.get('/runtime-artifacts/:token/model', controller.downloadRuntimeModel);
releases.post('/tasks/:taskId/models', checkLoggedIn, controller.uploadInitialModel);
releases.post('/tasks/:taskId/releases', checkLoggedIn, controller.uploadRelease);
releases.get('/tasks/:taskId/context', checkLoggedIn, controller.readTaskContext);
releases.get('/tasks/:taskId/releases', checkLoggedIn, controller.listReleases);
releases.get('/tasks/:taskId/releases/:releaseId', checkLoggedIn, controller.readRelease);
releases.post('/tasks/:taskId/releases/:releaseId/publish', checkLoggedIn, controller.publishRelease);
releases.post('/tasks/:taskId/releases/:releaseId/withdraw', checkLoggedIn, controller.withdrawRelease);
releases.get('/tasks/:taskId/published', checkLoggedIn, controller.readPublishedRelease);
releases.get(
  '/tasks/:taskId/participation-manifest',
  checkLoggedIn,
  controller.readParticipationManifest,
);
releases.get('/tasks/:taskId/published/archive', checkLoggedIn, controller.downloadPublishedArchive);
releases.get(
  '/tasks/:taskId/published/files/:fileId/preview',
  checkLoggedIn,
  controller.previewPublishedFile,
);
releases.get(
  '/tasks/:taskId/published/files/:fileId/artifact',
  checkLoggedIn,
  controller.downloadPublishedFile,
);
releases.get(
  '/tasks/:taskId/models/:modelVersionId/artifact',
  checkLoggedIn,
  controller.downloadModelArtifact,
);

export default releases;
