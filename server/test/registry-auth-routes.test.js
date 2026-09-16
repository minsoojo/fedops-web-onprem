import assert from 'node:assert/strict';
import test from 'node:test';
import modelRouter from '../src/api/model/index.js';
import tasksRouter from '../src/api/tasks/index.js';
import baselinesRouter from '../src/api/baselines/index.js';
import taskReleasesRouter from '../src/api/taskReleases/index.js';
import checkLoggedIn from '../src/lib/checkLoggedIn.js';
import { ownerHandleFilter } from '../src/lib/taskHandles.js';

const assertRouteRequiresLogin = (router, path, method = 'GET') => {
  const layer = router.stack.find(
    (candidate) => candidate.path === path && candidate.methods.includes(method),
  );
  assert.ok(layer, `${method} ${path} route must exist`);
  assert.ok(
    layer.stack.includes(checkLoggedIn),
    `${method} ${path} must use checkLoggedIn`,
  );
};

test('Registry Task routes require login', () => {
  assertRouteRequiresLogin(tasksRouter, '/public');
  assertRouteRequiresLogin(tasksRouter, '/public/:handle/:slug');
  assertRouteRequiresLogin(tasksRouter, '/public/:handle/:slug/activity');
  assertRouteRequiresLogin(tasksRouter, '/id/:taskId/participants', 'POST');
  assertRouteRequiresLogin(tasksRouter, '/id/:taskId/participants/me', 'DELETE');
  assertRouteRequiresLogin(tasksRouter, '/id/:taskId/participation-events', 'POST');
});

test('Registry model and file routes require login', () => {
  assertRouteRequiresLogin(modelRouter, '/public/:handle/:slug');
  assertRouteRequiresLogin(
    modelRouter,
    '/public/:handle/:slug/versions/:versionId/download',
  );
  assertRouteRequiresLogin(
    modelRouter,
    '/public/:handle/:slug/files/:fileId/download',
  );
  assertRouteRequiresLogin(
    modelRouter,
    '/public/:handle/:slug/files/:fileId/preview',
  );
});

test('Default Baseline release route requires login', () => {
  assertRouteRequiresLogin(baselinesRouter, '/default');
});

test('Participant runtime manifest requires login while signed Pod artifacts do not', () => {
  assertRouteRequiresLogin(
    taskReleasesRouter,
    '/tasks/:taskId/participation-manifest',
  );
  const runtimeRoute = taskReleasesRouter.stack.find(
    (candidate) => candidate.path === '/runtime-artifacts/:token/archive'
      && candidate.methods.includes('GET'),
  );
  assert.ok(runtimeRoute);
  assert.equal(runtimeRoute.stack.includes(checkLoggedIn), false);
});

test('Registry owner lookup accepts both canonical and legacy URL handles', () => {
  assert.deepEqual(ownerHandleFilter('fed-ops-508553'), {
    $or: [
      { ownerHandle: 'fed-ops-508553' },
      { ownerHandleAliases: 'fed-ops-508553' },
    ],
  });
});
