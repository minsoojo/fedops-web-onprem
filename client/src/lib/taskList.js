export const withoutTaskTitle = (tasks, title) => (
  Array.isArray(tasks)
    ? tasks.filter((taskItem) => taskItem.title !== title)
    : tasks
);
