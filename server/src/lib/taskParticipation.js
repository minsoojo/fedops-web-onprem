const safeCount = (value) => {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

export const completedParticipationCount = (participation) => (
  safeCount(participation?.completedParticipationCount)
);

export const approvalParticipationBaseline = (participation) => (
  safeCount(participation?.approvalParticipationBaseline)
);

export const completedSinceApproval = (participation) => (
  completedParticipationCount(participation)
  > approvalParticipationBaseline(participation)
);

export const participantLeavePolicy = (participation) => {
  const status = participation?.status || null;
  if (status === 'requested') {
    return {
      canLeave: true,
      requiresCompletedRun: false,
      reason: null,
    };
  }
  if (status === 'approved') {
    const eligible = completedSinceApproval(participation);
    return {
      canLeave: eligible,
      requiresCompletedRun: !eligible,
      reason: eligible
        ? null
        : 'Complete at least one Federated Learning run after approval before leaving this task.',
    };
  }
  return {
    canLeave: false,
    requiresCompletedRun: false,
    reason: 'There is no active participation to leave.',
  };
};

export const participantReviewPolicy = (currentStatus, nextStatus) => {
  const allowed = (
    currentStatus === 'requested'
    && ['approved', 'rejected'].includes(nextStatus)
  ) || (
    currentStatus === 'approved'
    && nextStatus === 'revoked'
  );
  let reason = null;
  if (!allowed) {
    reason = currentStatus === 'left'
      ? 'The participant must request to join again before approval.'
      : `Participation cannot change from ${currentStatus || 'unknown'} to ${nextStatus}.`;
  }
  return {
    allowed,
    reason,
  };
};
