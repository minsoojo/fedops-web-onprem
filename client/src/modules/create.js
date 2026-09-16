import { createAction, handleActions } from 'redux-actions';
import createRequestSaga, {
  createRequestActionTypes,
} from '../lib/createRequestSaga';
import * as tasksAPI from '../lib/api/tasks';
import { takeLatest } from 'redux-saga/effects';


const INITIALIZE = 'create/INITIALIZE'; // 모든 내용 초기화
const CHANGE_FIELD = 'create/CHANGE_FIELD'; // 특정 key 값 바꾸기
const [CREATE_TASK, CREATE_TASK_SUCCESS, CREATE_TASK_FAILURE] =
  createRequestActionTypes('create/CREATE_TASK'); // Task 작성
const SET_ORIGINAL_TASK = 'create/SET_ORIGINAL_TASK';

const [UPDATE_TASK, UPDATE_TASK_SUCCESS, UPDATE_TASK_FAILURE] =
  createRequestActionTypes('create/UPDATE_TASK'); // Task 수정

export const initialize = createAction(INITIALIZE);
export const changeField = createAction(CHANGE_FIELD, ({ key, value }) => ({
  key,
  value,
}));
export const createTask = createAction(CREATE_TASK, ({ 
  creationMode,
  displayName,
  registrySlug,
  primaryModelName,
  taskCategory,
  dataModality,
  title, 
  description, 
  tags, 
  serverRepoAddr,
  dataType,
  modelType,
  learningRate,
  numEpochs,
  batchSize,
  numRounds,
  clientPerRound,
  strategy,
  strategyParams,
  xaiEnabled,
  xaiParams,
  llmParams,
  datasetParams,
  clusteringEnabled,
  clusteringParams,
  sbaFlTarget,
  yamlConfig,
  summary,
  visibility,
  participationPolicy,
}) => ({
  creationMode,
  displayName,
  registrySlug,
  primaryModelName,
  taskCategory,
  dataModality,
  title,
  description,
  tags,
  serverRepoAddr,
  dataType,
  modelType,
  learningRate,
  numEpochs,
  batchSize,
  numRounds,
  clientPerRound,
  strategy,
  strategyParams,
  xaiEnabled,
  xaiParams,
  llmParams,
  datasetParams,
  clusteringEnabled,
  clusteringParams,
  sbaFlTarget,
  yamlConfig,
  summary,
  visibility,
  participationPolicy,
}));
export const setOriginalTask = createAction(SET_ORIGINAL_TASK, (task) => task);

export const updateTask = createAction(
  UPDATE_TASK,
  ({ 
    id, 
    modificationMode,
    displayName,
    title, 
    description, 
    tags, 
    serverRepoAddr,
    dataType,
    modelType,
    learningRate,
    numEpochs,
    batchSize,
    numRounds,
    clientPerRound,
    strategy,
    strategyParams,
    xaiEnabled,
    xaiParams,
    llmParams,
    datasetParams,
    clusteringEnabled,
    clusteringParams,
    sbaFlTarget,
    yamlConfig,
    summary,
    visibility,
    participationPolicy,
  }) => ({
    id,
    modificationMode,
    displayName,
    title,
    description,
    tags,
    serverRepoAddr,
    dataType,
    modelType,
    learningRate,
    numEpochs,
    batchSize,
    numRounds,
    clientPerRound,
    strategy,
    strategyParams,
    xaiEnabled,
    xaiParams,
    llmParams,
    datasetParams,
    clusteringEnabled,
    clusteringParams,
    sbaFlTarget,
    yamlConfig,
    summary,
    visibility,
    participationPolicy,
  }),
);

// 사가 생성
const createTaskSaga = createRequestSaga(CREATE_TASK, tasksAPI.createTask);
const updateTaskSaga = createRequestSaga(UPDATE_TASK, tasksAPI.updateTask);



export function* createSaga() {
  yield takeLatest(CREATE_TASK, createTaskSaga);
  yield takeLatest(UPDATE_TASK, updateTaskSaga);
}

const initialState = {
  title: '',
  description: '',
  tags: '',
  serverRepoAddr: '',
  summary: '',
  visibility: 'private',
  participationPolicy: 'approval_required',
  task: null,
  taskError: null,
  originalTaskId: null,
};

const create = handleActions(
  {
    [INITIALIZE]: (state) => initialState, // initialState를 넣으면 초기 상태로 바뀜
    [CHANGE_FIELD]: (state, { payload: { key, value } }) => ({
      ...state,
      [key]: value, // 특정 key 값으로 업데이트
    }),
    [CREATE_TASK]: (state) => ({
      ...state,
      // task와 taskError를 초기화
      task: null,
      taskError: null,
    }),
    // Task 작성 성공
    [CREATE_TASK_SUCCESS]: (state, { payload: task }) => ({
      ...state,
      task,
    }),
    // Task 작성 실패
    [CREATE_TASK_FAILURE]: (state, { payload: taskError }) => ({
      ...state,
      taskError,
    }),
    [SET_ORIGINAL_TASK]: (state, { payload: task }) => ({
      ...state,
      title: task.title,
      description: task.description,
      tags: task.tags,
      serverRepoAddr: task.serverRepoAddr,
      summary: task.summary || '',
      visibility: task.visibility || 'private',
      participationPolicy: task.participationPolicy || 'approval_required',
      originalTaskId: task._id,
    }),
    [UPDATE_TASK_SUCCESS]: (state, { payload: task }) => ({
      ...state,
      task,
    }),
    [UPDATE_TASK_FAILURE]: (state, { payload: taskError }) => ({
      ...state,
      taskError,
    }),
  },
  initialState,
);

export default create;
