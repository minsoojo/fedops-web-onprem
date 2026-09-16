import React from 'react';
import { Alert } from '@mui/material';

export default function EvaluationSummary({ point }) {
  if (!point) return null;
  const source = point.evaluationSource === 'client_aggregated'
    ? 'Client Evaluation (Aggregated)'
    : point.evaluationSource === 'server_validation'
      ? 'Server Validation' : 'Evaluation source not recorded (legacy)';
  const unavailable = point.evaluationStatus === 'not_evaluated';
  const partial = point.evaluationStatus === 'partial';
  return (
    <Alert severity={unavailable || partial ? 'warning' : 'info'} sx={{ mb: 2 }}>
      {source}{unavailable ? ' · Not Evaluated' : partial ? ' · Partial results' : ''}
      {point.evaluationClients != null && ` · ${point.evaluationClients} clients`}
      {point.evaluationSamples != null && ` · ${point.evaluationSamples} evaluation samples`}
      {point.accuracySamples != null && point.accuracySamples !== point.evaluationSamples
        && ` · ${point.accuracySamples} accuracy samples`}
      {point.evaluationFailures > 0 && ` · ${point.evaluationFailures} failed or invalid evaluations`}
    </Alert>
  );
}
