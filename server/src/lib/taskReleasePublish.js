export const taskReleasePublishPolicy = (task, requestBody = {}) => {
  if (task?.modelType === 'SBA-FL') {
    return {
      allowed: false,
      message: 'SBA-FL Tasks cannot be published to Registry.',
    };
  }

  const makePublic = requestBody?.makePublic === true;
  if (task?.visibility !== 'public' && !makePublic) {
    return {
      allowed: false,
      message: 'This Task is Private. Confirm making it Public when publishing the Release.',
    };
  }

  return {
    allowed: true,
    makePublic,
    visibility: makePublic ? 'public' : task?.visibility,
  };
};
