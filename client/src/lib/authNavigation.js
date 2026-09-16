const FEDOPS_ROOT = '/fedops';
const LOGIN_PATH = '/fedops/login';

export const safeFedOpsReturnPath = (value) => {
  if (typeof value !== 'string' || !value) return FEDOPS_ROOT;
  if (value.startsWith('//')) return FEDOPS_ROOT;

  try {
    const parsed = new URL(value, 'https://fedops.local');
    const isInternal = parsed.origin === 'https://fedops.local'
      && (
        parsed.pathname === FEDOPS_ROOT
        || parsed.pathname.startsWith(`${FEDOPS_ROOT}/`)
      );
    if (!isInternal || parsed.pathname === LOGIN_PATH) return FEDOPS_ROOT;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (error) {
    return FEDOPS_ROOT;
  }
};

export const loginPathFor = (value) => {
  const returnPath = safeFedOpsReturnPath(value);
  return returnPath === FEDOPS_ROOT
    ? LOGIN_PATH
    : `${LOGIN_PATH}?next=${encodeURIComponent(returnPath)}`;
};

export const returnPathFromSearch = (search) => {
  const next = new URLSearchParams(search || '').get('next');
  return safeFedOpsReturnPath(next);
};

