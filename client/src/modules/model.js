import { createAction, handleActions } from 'redux-actions';
import createRequestSaga, {
  createRequestActionTypes,
} from '../lib/createRequestSaga';
import * as modelAPI from '../lib/api/model';
import { takeLatest } from 'redux-saga/effects';

// Action Types
const [LIST_MODELS, LIST_MODELS_SUCCESS, LIST_MODELS_FAILURE] =
  createRequestActionTypes('model/LIST_MODELS');

const RESET_MODELS = 'model/RESET_MODELS';

const [XAI_MODELS, XAI_MODELS_SUCCESS, XAI_MODELS_FAILURE] =
  createRequestActionTypes('model/XAI_MODELS');

// Action Creators
export const listModels = createAction(LIST_MODELS, (title) => title);

export const resetModels = createAction(RESET_MODELS);

export const xaiModels = createAction(XAI_MODELS, (title) => title);

// Sagas
const listModelsSaga = createRequestSaga(LIST_MODELS, modelAPI.getModelList);
export function* modelSaga() {
  yield takeLatest(LIST_MODELS, listModelsSaga);
}
const xaiModelsSaga = createRequestSaga(XAI_MODELS, modelAPI.getXAIModel);
export function* xaiModelSaga() {
  yield takeLatest(XAI_MODELS, xaiModelsSaga);
}

// Initial State
const initialState = {
  models: null,
  error: null,
};

// Reducer
const model = handleActions(
  {
    [LIST_MODELS_SUCCESS]: (state, { payload: models }) => ({
      ...state,
      models,
      error: null,
    }),
    [LIST_MODELS_FAILURE]: (state, { payload: error }) => ({
      ...state,
      models: null,
      error,
    }),
    [RESET_MODELS]: (state) => ({
      ...state,
      models: null,
      error: null,
    }),

    [XAI_MODELS_SUCCESS]: (state, { payload: models }) => ({
      ...state,
      models,
      error: null,
    }),
    [XAI_MODELS_FAILURE]: (state, { payload: error }) => ({
      ...state,
      models: null,
      error,
    }),
  },
  initialState,
);

export default model;
