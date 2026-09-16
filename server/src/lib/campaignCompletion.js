// Older managers have no explicit campaign_status; retain their terminal signal.
export const canCompleteCampaign = (campaign, manager) => Boolean(
  campaign && manager
  && ['starting', 'running'].includes(campaign.status)
  && manager.campaign_run_id === campaign.runId
  && manager.campaign_ended_at
  && manager.ready === false
  && (!manager.campaign_status || manager.campaign_status === 'completed')
);
