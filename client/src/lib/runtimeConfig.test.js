jest.mock('axios', () => ({ defaults: {} }));

describe('public deployment configuration', () => {
  test('shared Web/storage origin leaves ordinary API downloads unchanged', () => {
    window.__FEDOPS_CONFIG__ = { objectStorageOrigin: window.location.origin };
    const { downloadUrl } = require('./runtimeConfig');
    const api = `${window.location.origin}/fedops/api/task-releases/123/artifact`;
    expect(downloadUrl(api)).toBe(api);
    expect(downloadUrl('/fedops/api/tasks')).toBe('/fedops/api/tasks');
    expect(downloadUrl(`${window.location.origin}/global-model/m?X-Amz-Signature=abc`))
      .toBe('/fedops/objects/global-model/m?X-Amz-Signature=abc');
  });
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
  test('forwarded UI keeps API/socket local and bridges only configured signed downloads', () => {
    window.__FEDOPS_CONFIG__ = { objectStorageOrigin: 'http://objects.example.invalid' };
    const config = require('./runtimeConfig');
    expect(config.apiOrigin).toBe(window.location.origin);
    expect(config.socketUrl).toBe(window.location.origin);
    const path = '/global-model/a%20b.bin?X-Amz-Signature=abc&response-content-disposition=attachment%3B%20filename%3Dx.bin';
    expect(config.downloadUrl(`http://objects.example.invalid${path}`)).toBe(`/fedops/objects${path}`);
    expect(config.downloadUrl(`http://objects.example.invalid.evil.test${path}`)).toBe(`http://objects.example.invalid.evil.test${path}`);
    expect(config.downloadUrl('https://example.com/model')).toBe('https://example.com/model');
    expect(config.downloadUrl(undefined)).toBeUndefined();
  });
});
