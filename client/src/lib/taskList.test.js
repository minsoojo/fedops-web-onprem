import { withoutTaskTitle } from './taskList';

describe('withoutTaskTitle', () => {
  it('removes only the deleted Federated Task', () => {
    expect(withoutTaskTitle([
      { title: 'keep-task' },
      { title: 'delete-task' },
    ], 'delete-task')).toEqual([{ title: 'keep-task' }]);
  });

  it('preserves an unloaded task collection', () => {
    expect(withoutTaskTitle(null, 'delete-task')).toBeNull();
  });
});
