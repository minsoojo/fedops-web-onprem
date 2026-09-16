describe('public deployment configuration', () => {
  afterEach(() => { delete window.__FEDOPS_CONFIG__; jest.resetModules(); });
  test('same built source reads A/B public origins and includes the existing API paths', () => {
    for (const name of ['a', 'b']) {
      jest.resetModules();
      window.__FEDOPS_CONFIG__ = { apiOrigin: `https://${name}.example.invalid`, socketUrl: `https://ws-${name}.example.invalid` };
      const config = require('./runtimeConfig');
      expect(config.apiUrl('/fedops/api/tasks')).toBe(`https://${name}.example.invalid/fedops/api/tasks`);
      expect(config.socketUrl).toBe(`https://ws-${name}.example.invalid`);
    }
  });
  test('empty settings use same origin; credentials and paths cannot be mistaken for origins', () => {
    expect(require('./runtimeConfig').apiOrigin).toBe(window.location.origin);
    jest.resetModules();
    window.__FEDOPS_CONFIG__ = { apiOrigin: 'https://user:secret@example.invalid' };
    expect(() => require('./runtimeConfig')).toThrow();
  });
});
