export const CLIENT_ONLINE_THRESHOLD_MS = 30 * 1000;
export const CLIENT_STALE_THRESHOLD_MS = 90 * 1000;

export const parseClientLastSeen = (value) => {
  if (!value) return null;

  const rawValue = typeof value === 'string' ? value.trim() : value;
  const normalizedValue = typeof rawValue === 'string'
    && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rawValue)
    ? `${rawValue.replace(' ', 'T')}Z`
    : rawValue;
  const timestamp = new Date(normalizedValue).getTime();

  return Number.isNaN(timestamp) ? null : timestamp;
};

export const getClientPresence = (device, now = Date.now()) => {
  const lastSeenAt = parseClientLastSeen(device?.last_request_time);
  const explicitlyOffline = device?.Device_online === false;

  if (explicitlyOffline) {
    return {
      state: 'offline',
      label: 'Offline',
      color: 'default',
      lastSeenAt,
      ageMs: lastSeenAt === null ? null : Math.max(0, now - lastSeenAt),
    };
  }

  if (lastSeenAt === null) {
    return {
      state: device?.Device_online ? 'online' : 'offline',
      label: device?.Device_online ? 'Online' : 'Offline',
      color: device?.Device_online ? 'success' : 'default',
      lastSeenAt: null,
      ageMs: null,
    };
  }

  const ageMs = Math.max(0, now - lastSeenAt);

  if (ageMs <= CLIENT_ONLINE_THRESHOLD_MS) {
    return {
      state: 'online',
      label: 'Online',
      color: 'success',
      lastSeenAt,
      ageMs,
    };
  }

  if (ageMs <= CLIENT_STALE_THRESHOLD_MS) {
    return {
      state: 'stale',
      label: 'Stale',
      color: 'warning',
      lastSeenAt,
      ageMs,
    };
  }

  return {
    state: 'offline',
    label: 'Offline',
    color: 'default',
    lastSeenAt,
    ageMs,
  };
};

export const formatClientLastSeen = (presence) => {
  if (!presence || presence.lastSeenAt === null || presence.ageMs === null) {
    return 'Last heartbeat unavailable';
  }

  const seconds = Math.floor(presence.ageMs / 1000);
  if (seconds < 5) return 'Heartbeat just now';
  if (seconds < 60) return `Last heartbeat ${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Last heartbeat ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last heartbeat ${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `Last heartbeat ${days}d ago`;
};
