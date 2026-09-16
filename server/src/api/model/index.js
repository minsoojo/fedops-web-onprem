// server/src/api/model/index.js
import Router from 'koa-router';
import * as modelCtrl from './model.ctrl.js';
import checkLoggedIn from '../../lib/checkLoggedIn.js';

const model = new Router();

model.get('/xai/:title', checkLoggedIn, modelCtrl.listimg); // XAI
model.get('/public/:handle/:slug', checkLoggedIn, modelCtrl.listPublic);
model.get(
  '/public/:handle/:slug/versions/:versionId/download',
  checkLoggedIn,
  modelCtrl.downloadVersion,
);
model.get(
  '/public/:handle/:slug/files/:fileId/download',
  checkLoggedIn,
  modelCtrl.downloadPublicFile,
);
model.get(
  '/public/:handle/:slug/files/:fileId/preview',
  checkLoggedIn,
  modelCtrl.previewPublicFile,
);
model.get('/:title/hub', checkLoggedIn, modelCtrl.readHub);
model.get(
  '/:title/versions/:versionId/download',
  checkLoggedIn,
  modelCtrl.downloadAuthorizedVersion,
);
model.get(
  '/:title/files/:fileId/download',
  checkLoggedIn,
  modelCtrl.downloadAuthorizedFile,
);
model.get(
  '/:title/files/:fileId/preview',
  checkLoggedIn,
  modelCtrl.previewAuthorizedFile,
);
model.get('/:title', checkLoggedIn, modelCtrl.list);
export default model;
