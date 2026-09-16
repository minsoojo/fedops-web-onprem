import {
  CLIENT_ONLINE_THRESHOLD_MS,
  CLIENT_STALE_THRESHOLD_MS,
  formatClientLastSeen,
  getClientPresence,
  parseClientLastSeen,
} from './clientPresence';

const NOW = new Date('2026-07-27T12:00:00Z').getTime();

describe('clientPresence', () => {
  test('parses the Server Manager timestamp format as UTC', () => {
    expect(parseClientLastSeen('2026-07-27 11:59:50'))
      .toBe(new Date('2026-07-27T11:59:50Z').getTime());
  });

  test('marks a recent heartbeat online', () => {
    const presence = getClientPresence({
      Device_online: true,
      last_request_time: '2026-07-27 11:59:50',
    }, NOW);

    expect(presence.state).toBe('online');
    expect(formatClientLastSeen(presence)).toBe('Last heartbeat 10s ago');
  });

  test('marks an aging heartbeat stale before it becomes offline', () => {
    const presence = getClientPresence({
      Device_online: true,
      last_request_time: new Date(NOW - CLIENT_ONLINE_THRESHOLD_MS - 1000),
    }, NOW);

    expect(presence.state).toBe('stale');
  });

  test('does not keep an expired heartbeat online', () => {
    const presence = getClientPresence({
      Device_online: true,
      last_request_time: new Date(NOW - CLIENT_STALE_THRESHOLD_MS - 1000),
    }, NOW);

    expect(presence.state).toBe('offline');
  });

  test('respects an explicit offline state', () => {
    const presence = getClientPresence({
      Device_online: false,
      last_request_time: '2026-07-27 11:59:59',
    }, NOW);

    expect(presence.state).toBe('offline');
  });
});
