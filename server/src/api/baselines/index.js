import Router from 'koa-router';
import checkLoggedIn from '../../lib/checkLoggedIn.js';
import * as baselinesCtrl from './baselines.ctrl.js';

const baselines = new Router();

baselines.get('/default', checkLoggedIn, baselinesCtrl.readDefault);
baselines.get(
  '/default/artifacts/:artifactId',
  checkLoggedIn,
  baselinesCtrl.readBundledArtifact,
);

export default baselines;
