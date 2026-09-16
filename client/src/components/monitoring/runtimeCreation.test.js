import { runtimeCreationState } from './runtimeCreation';

const empty = { deployment: { error: 'Deployment not found' }, pods: [] };
const base = { serverStatus: empty, campaignMeta: { immutableReleaseRequired: true, releaseId: 'r1' } };

test('only confirmed absence permits creation; retained PVC does not block it', () => {
  expect(runtimeCreationState(base)).toBe('');
  expect(runtimeCreationState({ ...base, serverStatus: { ...empty, pvc: { phase: 'Bound' } } })).toBe('');
});

test.each([
  ['initial load', { busy: true }],
  ['status fetch failure', { statusError: 'network error' }],
  ['missing status', { serverStatus: null }],
  ['unknown deployment', { serverStatus: { deployment: {}, pods: [] } }],
  ['permission error', { serverStatus: { deployment: { error: 'Forbidden' }, pods: [] } }],
  ['no Release', { campaignMeta: { immutableReleaseRequired: true } }],
  ['active FL', { isFLActive: true }],
  ['pending Pod', { serverStatus: { ...empty, pods: [{ phase: 'Pending' }] } }],
  ['terminating Pod', { serverStatus: { ...empty, pods: [{ phase: 'Running', ready: false }] } }],
  ['healthy', { serverStatus: { deployment: { replicas: 1, ready_replicas: 1 }, pods: [{ phase: 'Running' }] } }],
  ['paused', { serverStatus: { deployment: { replicas: 0 }, pods: [] } }],
  ['unhealthy', { serverStatus: { deployment: { replicas: 1, ready_replicas: 0 }, pods: [{ phase: 'Failed' }] } }],
  ['scaling', { serverStatus: { deployment: { replicas: 0 }, pods: [{ phase: 'Pending' }] } }],
])('%s blocks creating another runtime', (_, override) => {
  expect(runtimeCreationState({ ...base, ...override })).not.toBe('');
});

test('legacy Tasks do not require a 1.3 Release', () => {
  expect(runtimeCreationState({ ...base, campaignMeta: { immutableReleaseRequired: false } })).toBe('');
});
