// Resolve an uploaded dataset once when preparing/saving a Campaign. Running
// Campaign snapshots keep their exact dataPath even after another upload.
export const connectValidationDataset = (campaign, uploaded) => {
  if (!campaign?.serverEvaluation?.enabled || campaign.serverEvaluation.dataPath) return campaign;
  if (!/^validation-[a-f0-9]{64}$/.test(uploaded?.dataPath || '')) {
    throw new Error('Upload validation data from Agent Studio before enabling Server Validation.');
  }
  return { ...campaign, serverEvaluation: { enabled: true, dataPath: uploaded.dataPath } };
};
