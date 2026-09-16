// Recheck Kubernetes at the write boundary, not only in the browser.
export const runtimeCreationConflict = (snapshot) => {
  const deployment = snapshot?.deployment;
  if (!deployment || !Array.isArray(snapshot?.pods)) return 'Runtime status unavailable. Refresh before creating a server.';
  if (!deployment.error && Object.keys(deployment).length) return 'A server already exists. Use its lifecycle controls instead of Create.';
  if (deployment.error !== 'Deployment not found') return 'Runtime status unavailable. Refresh before creating a server.';
  if (snapshot.pods.length) return 'Server Pods still exist. Wait or inspect the runtime before creating a server.';
  const runtime = snapshot.fl_server_status || {};
  if (runtime.Ready === true || runtime.ready === true || /running|starting|stopping|creating|initializing/i.test(runtime.status || '')) {
    return 'Server creation or an FL process is already active.';
  }
  return null;
};

export const createRuntimeCreationGuard = ({ getStatus, now = Date.now, holdMs = 180000 }) => {
  // Covers concurrent requests and the gap before a background job creates its
  // Deployment. The live Kubernetes check also protects across browser sessions.
  const pending = new Map();
  return async (ctx, next) => {
    const taskId = ctx.params.taskId;
    const time = now();
    for (const [key, deadline] of pending) if (deadline <= time) pending.delete(key);
    const reject = (status, error) => { ctx.status = status; ctx.body = { success: false, error }; };
    if (pending.has(taskId)) return reject(409, 'Server creation is already in progress. Refresh runtime status.');
    pending.set(taskId, time + holdMs);
    let accepted = false;
    try {
      let snapshot;
      try { snapshot = await getStatus(taskId); }
      catch { return reject(503, 'Cannot confirm runtime status. Refresh before creating a server.'); }
      const conflict = runtimeCreationConflict(snapshot);
      if (conflict) return reject(409, conflict);
      await next();
      accepted = ctx.status >= 200 && ctx.status < 300 && ctx.body?.success === true;
    } finally {
      if (!accepted) pending.delete(taskId);
    }
  };
};
