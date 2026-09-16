const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

export const slugify = (value = '', fallback = 'item') => {
  const slug = String(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return slug || fallback;
};

export const normalizeHandle = (value = '') => slugify(value, '');

export const isValidHandle = (value = '') => HANDLE_PATTERN.test(value);

export const defaultUserHandle = (user) => {
  const namePart = slugify(
    [user?.firstName, user?.lastName].filter(Boolean).join('-'),
    'user',
  ).slice(0, 20);
  return `${namePart}-legacy`;
};
