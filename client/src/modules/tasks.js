import { createAction, handleActions } from 'redux-actions';
import createRequestSaga, {
  createRequestActionTypes,
} from '../lib/createRequestSaga';
import * as tasksAPI from '../lib/api/tasks';
import { takeLatest } from 'redux-saga/effects';
import { withoutTaskTitle } from '../lib/taskList';

const [LIST_TASKS, LIST_TASKS_SUCCESS, LIST_TASKS_FAILURE] =
  createRequestActionTypes('tasks/LIST_TASKS');
const REMOVE_TASK_FROM_LIST = 'tasks/REMOVE_TASK_FROM_LIST';

export const listTasks = createAction(
  LIST_TASKS,
  ({ tag, page, visibility, scope }) => ({ tag, page, visibility, scope }),
);
export const removeTaskFromList = createAction(
  REMOVE_TASK_FROM_LIST,
  (title) => title,
);

const listTasksSaga = createRequestSaga(LIST_TASKS, tasksAPI.listTasks);
export function* tasksSaga() {
  yield takeLatest(LIST_TASKS, listTasksSaga);
}

const initialState = {
  task: null,
  tasks: null,
  error: null,
  lastPage: 1,
};

const tasks = handleActions(
  {
    [LIST_TASKS_SUCCESS]: (state, { payload: tasks, meta: response }) => ({
      ...state,
      tasks,
      lastPage: parseInt(response.headers['last-page'], 10), // 문자열을 숫자로 변환
    }),
    [LIST_TASKS_FAILURE]: (state, { payload: error }) => ({
      ...state,
      error,
    }),
    [REMOVE_TASK_FROM_LIST]: (state, { payload: title }) => ({
      ...state,
      tasks: withoutTaskTitle(state.tasks, title),
    }),
  },
  initialState,
);

export default tasks;
