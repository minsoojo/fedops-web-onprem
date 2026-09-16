import {
  loginPathFor,
  returnPathFromSearch,
  safeFedOpsReturnPath,
} from './authNavigation';

describe('authNavigation', () => {
  test('keeps FedOps routes and their query string', () => {
    expect(safeFedOpsReturnPath('/fedops/task?scope=joined'))
      .toBe('/fedops/task?scope=joined');
  });

  test('rejects external and lookalike paths', () => {
    expect(safeFedOpsReturnPath('https://example.com/fedops/task')).toBe('/fedops');
    expect(safeFedOpsReturnPath('//example.com/fedops/task')).toBe('/fedops');
    expect(safeFedOpsReturnPath('/fedops.example/task')).toBe('/fedops');
  });

  test('does not create a login redirect loop', () => {
    expect(loginPathFor('/fedops/login')).toBe('/fedops/login');
  });

  test('round-trips an encoded internal return path', () => {
    const loginPath = loginPathFor('/fedops/registry/owner/example?tab=files');
    expect(returnPathFromSearch(loginPath.split('?')[1]))
      .toBe('/fedops/registry/owner/example?tab=files');
  });
});

