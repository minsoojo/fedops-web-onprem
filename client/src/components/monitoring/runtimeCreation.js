// Creation prepares Kubernetes resources, not a Campaign or an FL process.
// Never infer absence from a failed status request or a missing replica count.
export const runtimeCreationState = ({ serverStatus, busy, statusError, campaignMeta, isFLActive }) => {
  if (busy) return 'Checking or preparing the server. Please wait.';
  if (statusError || !serverStatus || !campaignMeta) return 'Refresh runtime status before creating a server.';
  if (campaignMeta.immutableReleaseRequired && !campaignMeta.releaseId) return 'Publish a Task Release before creating a server.';
  if (isFLActive) return 'An FL server is already active.';
  const deployment = serverStatus.deployment;
  const pods = serverStatus.pods;
  if (!deployment || !Array.isArray(pods)) return 'Refresh runtime status before creating a server.';
  if (!deployment.error && Object.keys(deployment).length) {
    return Number(deployment.replicas) === 0 && pods.length === 0
      ? 'A server already exists. Use Resume for a paused server.'
      : 'A server already exists. Check Runtime Overview; do not create it again.';
  }
  if (deployment.error !== 'Deployment not found') return 'Refresh runtime status before creating a server.';
  if (pods.length) return 'Server Pods still exist. Wait or inspect Runtime Overview.';
  return '';
};
