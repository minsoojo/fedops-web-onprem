import { createAction, handleActions } from 'redux-actions';
import createRequestSaga, {
  createRequestActionTypes,
} from '../lib/createRequestSaga';
import * as tasksAPI from '../lib/api/tasks';
import { takeLatest } from 'redux-saga/effects';

const [READ_TASK, READ_TASK_SUCCESS, READ_TASK_FAILURE] =
  createRequestActionTypes('task/READ_TASK');
const [REMOVE_TASK, REMOVE_TASK_SUCCESS, REMOVE_TASK_FAILURE] =
  createRequestActionTypes('task/REMOVE_TASK');
const [REMOVE_K8S, REMOVE_K8S_SUCCESS, REMOVE_K8S_FAILURE] =
  createRequestActionTypes('task/REMOVE_K8S');

const UNLOAD_TASK = 'task/UNLOAD_TASK'; // Task 페이지에서 벗어날 때 데이터 비우기

export const readTask = createAction(READ_TASK, (title) => title);
export const unloadTask = createAction(UNLOAD_TASK);
export const removeTask = createAction(REMOVE_TASK, (title) => title);
export const removeK8s = createAction(REMOVE_K8S, (title) => title);

const readTaskSaga = createRequestSaga(READ_TASK, tasksAPI.readTask);
const removeTaskSaga = createRequestSaga(REMOVE_TASK, tasksAPI.removeTask);
const removeK8sSaga = createRequestSaga(REMOVE_K8S, tasksAPI.removeK8s);

export function* taskSaga() {
  yield takeLatest(READ_TASK, readTaskSaga);
  yield takeLatest(REMOVE_TASK, removeTaskSaga);
  yield takeLatest(REMOVE_K8S, removeK8sSaga);
}

const initialState = {
  user: null,
  task: null,
  error: null,
};

const task = handleActions(
  {
    [READ_TASK_SUCCESS]: (state, { payload: task }) => ({
      ...state,
      task,
    }),
    [READ_TASK_FAILURE]: (state, { payload: error }) => ({
      ...state,
      error,
    }),
    [UNLOAD_TASK]: () => initialState,

    [REMOVE_TASK_SUCCESS]: (state, { payload: task }) => ({
      ...state,
      task,
    }),
    [REMOVE_TASK_FAILURE]: (state, { payload: error }) => ({
      ...state,
      error,
    }),
    [REMOVE_K8S_SUCCESS]: (state, { payload: task }) => ({
      ...state,
      task,
    }),
    [REMOVE_K8S_FAILURE]: (state, { payload: error }) => ({
      ...state,
      error,
    }),
  },
  initialState,
);

export default task;
