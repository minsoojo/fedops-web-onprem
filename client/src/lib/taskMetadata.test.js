import {
  formatStrategyLabel,
  getTaskCardMetadata,
  getTaskModelKind,
  parseTaskTags,
} from './taskMetadata';

describe('taskMetadata', () => {
  test('uses the explicit model role before data modality inference', () => {
    expect(getTaskModelKind({ modelType: 'LLM', dataModality: 'image' })).toBe('LLM');
    expect(getTaskModelKind({ modelType: 'AI', dataType: 'LLM' })).toBe('AI');
    expect(getTaskModelKind({ dataType: 'LLM' })).toBe('LLM');
    expect(getTaskModelKind({ dataModality: 'image' })).toBe('AI');
  });
  test('formats the FedAVG implementation value for display', () => {
    expect(formatStrategyLabel('FedAVG')).toBe('FedAvg');
  });

  test('parses and normalizes comma-separated task tags', () => {
    expect(parseTaskTags('health, #wearable, federated learning'))
      .toEqual(['health', 'wearable', 'federated learning']);
  });

  test('shows semantic metadata and user tags without the automatic Image data type', () => {
    expect(getTaskCardMetadata({
      modelType: 'AI',
      dataType: 'Image',
      strategy: 'FedAVG',
      tags: 'health, edge',
    })).toEqual([
      { label: 'AI', kind: 'model' },
      { label: 'FedAvg', kind: 'strategy' },
      { label: 'health', kind: 'tag' },
      { label: 'edge', kind: 'tag' },
    ]);
  });

  test('shows explicit task category and data modality before free-form tags', () => {
    expect(getTaskCardMetadata({
      modelType: 'AI',
      taskCategory: 'classification',
      dataModality: 'image',
      tags: 'health, edge',
    })).toEqual([
      { label: 'AI', kind: 'model' },
      { label: 'classification', kind: 'task' },
      { label: 'image', kind: 'data' },
      { label: 'health', kind: 'tag' },
      { label: 'edge', kind: 'tag' },
    ]);
  });

  test('removes duplicate labels', () => {
    expect(getTaskCardMetadata({
      modelType: 'LLM',
      strategy: 'FedAVG',
      tags: 'llm, FedAvg',
    })).toHaveLength(2);
  });
});
