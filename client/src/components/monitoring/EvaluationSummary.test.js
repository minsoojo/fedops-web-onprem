import { render, screen } from '@testing-library/react';
import EvaluationSummary from './EvaluationSummary';

test('shows partial client evaluation with counts', () => {
  render(<EvaluationSummary point={{ evaluationSource: 'client_aggregated', evaluationStatus: 'partial', evaluationClients: 2, evaluationSamples: 40, accuracySamples: 10, evaluationFailures: 1 }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Client Evaluation (Aggregated)');
  expect(screen.getByRole('alert')).toHaveTextContent('Partial results');
  expect(screen.getByRole('alert')).toHaveTextContent('10 accuracy samples');
});

test('missing evaluation is shown explicitly', () => {
  render(<EvaluationSummary point={{ evaluationSource: 'client_aggregated', evaluationStatus: 'not_evaluated' }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Not Evaluated');
});
