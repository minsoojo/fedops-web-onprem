import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { Alert, Button, TextField, Grid, Box, Typography, Select, MenuItem, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import FormControl from '@mui/material/FormControl';
import Header from '../components/common/Header';
import ContentWrapper from '../components/common/ContentWrapper';
import TaskConfigForm from '../components/task/TaskConfigForm';
import ConfigDebugPanel from '../components/debug/ConfigDebugPanel';
import { generateYAMLConfig } from '../components/common/YamlGenerator';
import {
  createTask,
  changeField,
  initialize,
  setOriginalTask,
  updateTask,
} from '../modules/create';

const SBA_FL_TASK_IDS = {
  weight: 'sbaweightfl',
  steps: 'sbastepsfl',
};

const registrySlug = (value = '') => String(value)
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .replace(/-{2,}/g, '-')
  .slice(0, 64)
  .replace(/-+$/g, '');

const CreatePage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { state } = useLocation();
  const editId = state?.editId;
  const isEdit = state?.isEdit ?? false;
  const [error, setError] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [taskSlug, setTaskSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [primaryModelName, setPrimaryModelName] = useState('');
  const [taskCategory, setTaskCategory] = useState('classification');
  const [dataModality, setDataModality] = useState('undecided');
  const [creationMode, setCreationMode] = useState('standard');
  const [xaiEnabled, setXaiEnabled] = useState('disabled');
  const [xaiParams, setXaiParams] = useState({
    runLocation: 'client',
    targetLayerIndex: '-1',
    outputDir: 'outputs/gradcam',
    layer: 'conv2'
  });
  const [learningRate, setLearningRate] = useState('0.001');
  const [modelType, setModelType] = useState('AI');
  const [dataType, setDataType] = useState('Image');
  const [numEpochs, setNumEpochs] = useState('10');
  const [batchSize, setBatchSize] = useState('32');
  const [numRounds, setNumRounds] = useState('10');
  const [clientPerRound, setClientPerRound] = useState('5');
  const [strategy, setStrategy] = useState('FedAVG');
  const [strategyParams, setStrategyParams] = useState({
    // FedAVG parameters
    fractionFit: '1.0',
    fractionEvaluate: '1.0',
    // FedAdam parameters
    beta1: '0.9',
    beta2: '0.99',
    epsilon: '1e-8',
    // FedAdagrad parameters
    initialAccumulator: '0.1',
    // FedYogi parameters
    beta2Yogi: '0.99',
    epsilonYogi: '1e-8',
    // FedProx parameters
    mu: '0.1',
    // SCAFFOLD parameters
    serverLearningRate: '1.0',
  });
  // LLM Fine-tuning parameters - 기본값 설정
  const [llmParams, setLlmParams] = useState({
    loraR: '16',
    loraAlpha: '32',
    loraDropout: '0.1',
    learningRate: '5e-5',
    perDeviceTrainBatchSize: '4',
    gradientAccumulationSteps: '4',
    loggingSteps: '10',
    maxSteps: '100',
    saveSteps: '50',
    saveTotalLimit: '2',
    gradientCheckpointing: 'true',
    lrSchedulerType: 'linear'
  });
  // Dataset parameters - 기본값 설정
  const [datasetParams, setDatasetParams] = useState({
    AIdataName: 'MNIST',
    LLMdataName: 'medalpaca/medical_meadow_medical_flashcards',
    llmTask: 'medical',
    validationSplit: '0.1',
    AImodelName: 'models.MNISTClassifier',
    LLMmodelName: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B',
    outputSize: '10'
  });
  // Clustering/HPO parameters - 기본값 설정
  const [clusteringEnabled, setClusteringEnabled] = useState('disabled');
  const [clusteringParams, setClusteringParams] = useState({
    warmupRounds: '1',
    reclusterEvery: '1',
    eps: '0.2',
    minSamples: '2',
    objective: 'maximize_f1',
    searchLrLogMin: '-5.0',
    searchLrLogMax: '-2.0',
    searchBsExpMin: '3',
    searchBsExpMax: '7',
    searchLocalEpochsMin: '1',
    searchLocalEpochsMax: '3'
  });
  const [sbaFlTarget, setSbaFlTarget] = useState('weight');
  const [yamlModalOpen, setYamlModalOpen] = useState(false);
  const [generatedYaml, setGeneratedYaml] = useState('');
  const {
    title,
    tags,
    serverRepoAddr,
    summary,
    visibility,
    participationPolicy,
    task: selectedTask,
    user,
  } = useSelector(({ create, task, user }) => ({
    title: create.title,
    tags: create.tags,
    serverRepoAddr: create.serverRepoAddr,
    summary: create.summary,
    visibility: create.visibility,
    participationPolicy: create.participationPolicy,
    task: task.task,
    user: user?.user,
  }));
  const originalTask = state?.task || selectedTask;
  const runtimeContractName = originalTask?.runtimeContract?.name
    || (originalTask?.creationMode === 'federated-task-v3' ? 'federated-task-v3' : 'legacy-v1');
  const isV3Edit = Boolean(isEdit && runtimeContractName === 'federated-task-v3');
  const isLegacyEdit = Boolean(isEdit && !isV3Edit);
  const isAdmin = user?.isAdmin === true || user?.username === 'ccl@ccl.com';


  // This effect handles initializing the form when the component mounts
  useEffect(() => {
    if (!isEdit) {
      dispatch(initialize());
    }
  }, [dispatch, isEdit]);

  // This effect handles setting the original task when in edit mode
  useEffect(() => {
    if (isEdit && originalTask) {
      dispatch(setOriginalTask(originalTask));
      setDisplayName(originalTask.displayName || originalTask.title || '');
      setTaskSlug(originalTask.slug || '');
      setPrimaryModelName(
        originalTask.primaryModel?.displayName
        || originalTask.primaryModel?.workingName
        || '',
      );
      setTaskCategory(originalTask.taskCategory || 'other');
      setDataModality(originalTask.dataModality || 'undecided');
      setModelType(originalTask.modelType || 'AI');
      setDataType(originalTask.dataType || 'Image');
      setLearningRate(originalTask.learningRate || '0.001');
      setNumEpochs(originalTask.numEpochs || '10');
      setBatchSize(originalTask.batchSize || '32');
      setNumRounds(originalTask.numRounds || '10');
      setClientPerRound(originalTask.clientPerRound || '5');
      setStrategy(originalTask.strategy || 'FedAVG');
      setStrategyParams((current) => originalTask.strategyParams || current);
      setXaiEnabled(originalTask.xaiEnabled || 'disabled');
      setXaiParams((current) => originalTask.xaiParams || current);
      setLlmParams((current) => originalTask.llmParams || current);
      setDatasetParams((current) => originalTask.datasetParams || current);
      setClusteringEnabled(originalTask.clusteringEnabled || 'disabled');
      setClusteringParams((current) => originalTask.clusteringParams || current);
      setSbaFlTarget(originalTask.sbaFlTarget || 'weight');
    }
  }, [dispatch, isEdit, originalTask]);

  const onChange = (e) => {
    const { value, name } = e.target;
    if (name === 'displayName') {
      setDisplayName(value);
      if (!isV3Edit && !slugEdited) setTaskSlug(registrySlug(value));
    } else if (name === 'registrySlug') {
      setSlugEdited(true);
      setTaskSlug(registrySlug(value));
    } else if (name === 'primaryModelName') {
      setPrimaryModelName(value);
    } else if (name === 'taskCategory') {
      setTaskCategory(value);
    } else if (name === 'dataModality') {
      setDataModality(value);
    } else if (name === 'creationMode') {
      if (value === 'sba-fl' && !isAdmin) {
        setError('SBA-FL Federated Task creation is only allowed for admin.');
        return;
      }
      setError(null);
      setCreationMode(value);
      if (value === 'sba-fl') {
        setModelType('SBA-FL');
        setDataType('Numeric');
        setXaiEnabled('disabled');
        setClusteringEnabled('disabled');
        setStrategy('FedAVG');
        setNumRounds('2');
        setNumEpochs('3');
        setBatchSize('32');
        setClientPerRound('1');
        dispatch(changeField({
          key: 'title',
          value: SBA_FL_TASK_IDS[sbaFlTarget] || SBA_FL_TASK_IDS.weight,
        }));
      } else {
        setModelType('AI');
        setDataType('Image');
      }
    } else if (name === 'ModelType') {
      if (value === 'SBA-FL') {
        if (!isAdmin) {
          setError('SBA-FL Federated Task creation is only allowed for admin.');
          return;
        }
        setCreationMode('sba-fl');
        const taskId = SBA_FL_TASK_IDS[sbaFlTarget] || SBA_FL_TASK_IDS.weight;
        setModelType('SBA-FL');
        setDataType('Numeric');
        setXaiEnabled('disabled');
        setClusteringEnabled('disabled');
        setStrategy('FedAVG');
        setNumRounds('2');
        setNumEpochs('3');
        setBatchSize('32');
        setClientPerRound('1');
        dispatch(changeField({ key: 'title', value: taskId }));
        return;
      }
      if (creationMode === 'sba-fl') setCreationMode('legacy');
      setModelType(value);
      // ModelType에 따라 dataType 설정
      if (value === 'LLM') {
        setDataType('LLM');
        setXaiEnabled('disabled'); // LLM에서는 XAI 비활성화
      } else {
        setDataType('Image'); // AI 모델은 기본적으로 Image로 설정
      }
    } else if (name === 'sbaFlTarget') {
      setSbaFlTarget(value);
      if (modelType === 'SBA-FL') {
        dispatch(changeField({
          key: 'title',
          value: SBA_FL_TASK_IDS[value] || SBA_FL_TASK_IDS.weight,
        }));
      }
    } else if (name === 'title' && modelType === 'SBA-FL') {
      dispatch(changeField({
        key: 'title',
        value: SBA_FL_TASK_IDS[sbaFlTarget] || SBA_FL_TASK_IDS.weight,
      }));
    } else if (name === 'xaiEnabled') {
      setXaiEnabled(value === 'enabled' ? 'enabled' : 'disabled');
    } else if (name === 'clusteringEnabled') {
      if (modelType === 'SBA-FL') {
        setClusteringEnabled('disabled');
        return;
      }
      setClusteringEnabled(value === 'enabled' ? 'enabled' : 'disabled');
    } else if (name === 'learningRate') {
      setLearningRate(value);
    } else if (name === 'modelType') {
      setModelType(value);
    } else if (name === 'numEpochs') {
      setNumEpochs(value);
    } else if (name === 'batchSize') {
      setBatchSize(value);
    } else if (name === 'numRounds') {
      setNumRounds(value);
    } else if (name === 'clientPerRound') {
      setClientPerRound(value);
    } else if (name === 'strategy') {
      if (modelType === 'SBA-FL') {
        setStrategy('FedAVG');
        return;
      }
      setStrategy(value);
      // Strategy 변경 시 파라미터를 해당 전략의 기본값으로 초기화
      if (value === 'FedAVG') {
        setStrategyParams({
          fractionFit: '1.0',
          fractionEvaluate: '1.0',
          beta1: '0.9',
          beta2: '0.99',
          epsilon: '1e-8',
          initialAccumulator: '0.1',
          beta2Yogi: '0.99',
          epsilonYogi: '1e-8',
          mu: '0.1',
          serverLearningRate: '1.0',
        });
      } else if (value === 'FedAdam') {
        setStrategyParams({
          fractionFit: '1.0',
          fractionEvaluate: '1.0',
          beta1: '0.9',
          beta2: '0.99',
          epsilon: '1e-8',
          initialAccumulator: '0.1',
          beta2Yogi: '0.99',
          epsilonYogi: '1e-8',
          mu: '0.1',
          serverLearningRate: '1.0',
        });
      } else {
        // 다른 전략들도 기본값으로 설정
        setStrategyParams({
          fractionFit: '1.0',
          fractionEvaluate: '1.0',
          beta1: '0.9',
          beta2: '0.99',
          epsilon: '1e-8',
          initialAccumulator: '0.1',
          beta2Yogi: '0.99',
          epsilonYogi: '1e-8',
          mu: '0.1',
          serverLearningRate: '1.0',
        });
      }
    } else if (name.startsWith('strategyParam_')) {
      const paramName = name.replace('strategyParam_', '');
      setStrategyParams(prev => ({
        ...prev,
        [paramName]: value
      }));
    } else if (name.startsWith('llmParam_')) {
      const paramName = name.replace('llmParam_', '');
      setLlmParams(prev => ({
        ...prev,
        [paramName]: value
      }));
    } else if (name.startsWith('datasetParam_')) {
      const paramName = name.replace('datasetParam_', '');
      
      // 특별 처리: name과 modelName은 modelType에 따라 다른 필드에 저장
      if (paramName === 'name') {
        if (modelType === 'LLM') {
          setDatasetParams(prev => ({
            ...prev,
            LLMdataName: value
          }));
        } else {
          setDatasetParams(prev => ({
            ...prev,
            AIdataName: value
          }));
        }
      } else if (paramName === 'modelName') {
        if (modelType === 'LLM') {
          setDatasetParams(prev => ({
            ...prev,
            LLMmodelName: value
          }));
        } else {
          setDatasetParams(prev => ({
            ...prev,
            AImodelName: value
          }));
        }
      } else {
        // 다른 파라미터들은 기존대로 처리
        setDatasetParams(prev => ({
          ...prev,
          [paramName]: value
        }));
      }
    } else if (name.startsWith('xaiParam_')) {
      const paramName = name.replace('xaiParam_', '');
      setXaiParams(prev => ({
        ...prev,
        [paramName]: value
      }));
    } else if (name.startsWith('clusteringParam_')) {
      const paramName = name.replace('clusteringParam_', '');
      setClusteringParams(prev => ({
        ...prev,
        [paramName]: value
      }));
    } else {
      dispatch(
        changeField({
          key: name,
          value,
        })
      );
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (isV3Edit) {
      if (!displayName.trim()) {
        setError('Federated Task name is required.');
        return;
      }
      dispatch(updateTask({
        id: editId,
        modificationMode: 'federated-task-v3',
        displayName: displayName.trim(),
        summary,
        tags,
        visibility,
        participationPolicy,
      }));
      return;
    }
    const modernDraft = !isEdit && creationMode === 'standard';
    if (modernDraft && (!displayName.trim() || !taskSlug.trim())) {
      setError('Federated Task name and Registry ID are required.');
      return;
    }
    const sbaFixedTaskId = SBA_FL_TASK_IDS[sbaFlTarget] || SBA_FL_TASK_IDS.weight;
    const effectiveTitle = modelType === 'SBA-FL'
      ? sbaFixedTaskId
      : modernDraft ? taskSlug : title;
    const effectiveStrategy = modelType === 'SBA-FL' ? 'FedAVG' : strategy;
    const effectiveXaiEnabled = modelType === 'SBA-FL' ? 'disabled' : xaiEnabled;
    const effectiveClusteringEnabled = modelType === 'SBA-FL' ? 'disabled' : clusteringEnabled;
    const effectiveDatasetParams = {
      ...datasetParams,
      // modelType에 따라 적절한 name과 modelName 설정
      name: modelType === 'LLM' ? datasetParams.LLMdataName : datasetParams.AIdataName,
      modelName: modelType === 'LLM' ? datasetParams.LLMmodelName : datasetParams.AImodelName,
      sbaFlTarget,
      sbaFlTaskId: sbaFixedTaskId,
    };
    
    // Prepare form data for YAML generation
    const formData = {
      title: effectiveTitle,
      learningRate,
      modelType,
      dataType,
      numEpochs,
      batchSize,
      numRounds,
      clientPerRound,
      strategy: effectiveStrategy,
      strategyParams,
      serverRepoAddr,
      xaiEnabled: effectiveXaiEnabled,
      xaiParams,
      llmParams,
      datasetParams: effectiveDatasetParams,
      clusteringEnabled: effectiveClusteringEnabled,
      clusteringParams,
      sbaFlTarget,
      sbaFlTaskId: sbaFixedTaskId,
    };

    // Generate YAML configuration using the external function
    const yamlConfig = modernDraft ? '' : generateYAMLConfig(formData);
    
    // 디버깅을 위한 로그 추가
    console.log('=== YAML CONFIG DEBUG ===');
    console.log('Generated YAML Config:', yamlConfig);
    console.log('YAML Config type:', typeof yamlConfig);
    console.log('YAML Config length:', yamlConfig ? yamlConfig.length : 'N/A');
    console.log('Form data used for YAML generation:', formData);
    console.log('========================');
    
    // Display the YAML configuration in a modal
    setGeneratedYaml(yamlConfig);
    if (!modernDraft) setYamlModalOpen(true);
    
    // Original task creation logic
    if (isEdit) {
      const updateData = {
        id: editId,
        modificationMode: 'legacy-v1',
        title: effectiveTitle,
        description: summary || 'Auto-generated Federated Task from FedOps platform',
        summary,
        tags,
        visibility,
        participationPolicy,
        serverRepoAddr: '',
        dataType,
        modelType,
        learningRate,
        numEpochs,
        batchSize,
        numRounds,
        clientPerRound,
        strategy: effectiveStrategy,
        strategyParams,
        xaiEnabled: effectiveXaiEnabled,
        xaiParams,
        llmParams,
        datasetParams: effectiveDatasetParams,
        clusteringEnabled: effectiveClusteringEnabled,
        clusteringParams,
        sbaFlTarget,
        yamlConfig, // Include the generated YAML
      };
      
      console.log('=== UPDATE TASK DATA ===');
      console.log('Update data being dispatched:', updateData);
      console.log('========================');
      
      dispatch(updateTask(updateData));
    } else {
      const createData = {
        creationMode: modernDraft ? 'federated-task-v3' : 'legacy',
        displayName: modernDraft ? displayName.trim() : effectiveTitle,
        registrySlug: modernDraft ? taskSlug : effectiveTitle,
        primaryModelName: modernDraft ? primaryModelName.trim() : '',
        taskCategory: modernDraft ? taskCategory : '',
        dataModality: modernDraft ? dataModality : '',
        title: effectiveTitle,
        description: summary || 'Auto-generated Federated Task from FedOps platform',
        summary,
        tags,
        visibility,
        participationPolicy,
        serverRepoAddr: '',
        dataType,
        modelType,
        learningRate,
        numEpochs,
        batchSize,
        numRounds,
        clientPerRound,
        strategy: effectiveStrategy,
        strategyParams,
        xaiEnabled: effectiveXaiEnabled,
        xaiParams,
        llmParams,
        datasetParams: effectiveDatasetParams,
        clusteringEnabled: effectiveClusteringEnabled,
        clusteringParams,
        sbaFlTarget,
        yamlConfig, // Include the generated YAML
      };
      
      console.log('=== CREATE TASK DATA ===');
      console.log('Create data being dispatched:', createData);
      console.log('yamlConfig in createData:', createData.yamlConfig);
      console.log('========================');
      
      dispatch(createTask(createData));
    }
  };

  const task = useSelector(({ create }) => create.task);
  const taskError = useSelector(({ create }) => create.taskError);

  // task 생성 성공/실패 처리
  useEffect(() => {
    if (task) { // task 생성 성공
      const { title } = task;
      navigate(`/fedops/task/${title}`);
    }
    if (taskError) { // task 생성 실패
      const responseError = taskError.response?.data;
      setError(
        typeof responseError === 'string'
          ? responseError
          : responseError?.message || 'Failed to save the Federated Task.',
      );
      console.log(Array(taskError));
      return;
    }
  }, [navigate, task, taskError]);

  useEffect(() => {
    // This function runs when the component unmounts
    return () => {
      dispatch(initialize());
    };
  }, [dispatch]);

return (
  <div>
    <Header />
    <ContentWrapper>
      <Box
        sx={{
          marginTop: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Grid item xs={12} sm={6}>
          <Typography gutterBottom variant="h5" component="div">
            {isV3Edit
              ? 'Modify FedOps 1.3 Federated Task'
              : isLegacyEdit
                ? 'Modify FedOps 1.2 Legacy Task'
                : 'Create Federated Task'}
          </Typography>
        </Grid>
        {!isEdit || editId ? (
          <Box component="form" onSubmit={onSubmit} noValidate sx={{ mt: 1 }}>
            <Grid item xs={12}>
              {error && <Typography color="error">{error}</Typography>}
            </Grid>
            {isV3Edit && (
              <Alert severity="info" sx={{ my: 2 }}>
                This screen updates Registry metadata and participation policy immediately.
                To change code, model artifacts, Tool AI contracts, or Task files, create a new
                Release in Agent Studio. The current Published Release remains immutable.
              </Alert>
            )}
            {isLegacyEdit && (
              <Alert severity="warning" sx={{ my: 2 }}>
                This is a FedOps 1.2 Legacy Task. Its existing training and YAML settings remain
                editable for compatibility; it is not converted to the FedOps 1.3 Release contract.
              </Alert>
            )}
            {!isEdit && (
              <FormControl fullWidth margin="normal">
                <InputLabel id="creation-mode-label">Creation Mode</InputLabel>
                <Select
                  labelId="creation-mode-label"
                  name="creationMode"
                  value={creationMode}
                  label="Creation Mode"
                  onChange={onChange}
                >
                  <MenuItem value="standard">Federated Task (FedOps 1.3)</MenuItem>
                  <MenuItem value="legacy">Legacy Task (FedOps 1.2)</MenuItem>
                  {isAdmin && <MenuItem value="sba-fl">SBA-FL Legacy Task</MenuItem>}
                </Select>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, ml: 1.75 }}>
                  FedOps 1.3 is the default. Choose Legacy only for the existing FedOps 1.2 workflow.
                </Typography>
              </FormControl>
            )}

            {(!isEdit && creationMode === 'standard') || isV3Edit ? (
              <>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="displayName"
                  label="Federated Task name"
                  name="displayName"
                  autoFocus
                  value={displayName}
                  onChange={onChange}
                  helperText={isV3Edit
                    ? 'This name is reflected in My Federated Tasks and the Registry.'
                    : 'A human-readable Draft name. Model and training details are finalized in Agent Studio.'}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="registrySlug"
                  label="Registry ID"
                  name="registrySlug"
                  value={taskSlug}
                  onChange={onChange}
                  InputProps={{ readOnly: isV3Edit }}
                  placeholder="mnist-digits"
                  helperText={isV3Edit
                    ? 'Registry ID is permanent because Releases, participants, and FL runtime use this identity.'
                    : `Public identity: @${user?.handle || 'your-handle'}/${taskSlug || 'task-id'}`}
                />
                {!isV3Edit && <TextField
                  margin="normal"
                  fullWidth
                  id="primaryModelName"
                  label="Primary Model working name"
                  name="primaryModelName"
                  value={primaryModelName}
                  onChange={onChange}
                  placeholder={displayName || 'Finalized before Release Readiness'}
                  helperText="Optional working name. Agent Studio requires the final Registry model name before release."
                />}
                <Grid container spacing={2} sx={{ mt: 0.25 }}>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel id="federated-task-model-type-label">Model role</InputLabel>
                      <Select
                        labelId="federated-task-model-type-label"
                        name="ModelType"
                        value={modelType}
                        label="Model role"
                        onChange={onChange}
                        disabled={isV3Edit}
                      >
                        <MenuItem value="AI">AI · Tool AI</MenuItem>
                        <MenuItem value="LLM">LLM · Base LLM</MenuItem>
                      </Select>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75 }}>
                        This Registry role determines whether Agent Builder offers the released model as a Base LLM or Tool AI.
                      </Typography>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel id="task-category-label">Task category</InputLabel>
                      <Select labelId="task-category-label" name="taskCategory" value={taskCategory} label="Task category" onChange={onChange} disabled={isV3Edit}>
                        <MenuItem value="classification">Classification</MenuItem>
                        <MenuItem value="regression">Regression</MenuItem>
                        <MenuItem value="generation">Generation</MenuItem>
                        <MenuItem value="representation-learning">Representation learning</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel id="data-modality-label">Data modality</InputLabel>
                      <Select labelId="data-modality-label" name="dataModality" value={dataModality} label="Data modality" onChange={onChange} disabled={isV3Edit}>
                        <MenuItem value="undecided">Undecided</MenuItem>
                        <MenuItem value="image">Image</MenuItem>
                        <MenuItem value="tabular">Tabular</MenuItem>
                        <MenuItem value="timeseries">Time series</MenuItem>
                        <MenuItem value="text">Text</MenuItem>
                        <MenuItem value="multimodal">Multimodal</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </>
            ) : <TextField
              margin="normal"
              required
              fullWidth
              id="title"
              label="Title"
              name="title"
              autoFocus
              value={title}
              onChange={onChange}
              InputProps={{
                readOnly: isEdit || modelType === 'SBA-FL',
              }}
              helperText={
                isEdit
                  ? 'Task ID is permanent because existing runtime resources use it.'
                  : modelType === 'SBA-FL'
                  ? 'SBA-FL Federated Task ID is fixed by the selected target.'
                  : ''
              }
            />}

            <TextField
              margin="normal"
              fullWidth
              id="summary"
              label="Public summary"
              name="summary"
              value={summary}
              onChange={onChange}
              inputProps={{ maxLength: 280 }}
              helperText={`${summary.length}/280 · Private tasks keep this visible only to authorized users.`}
            />

            <TextField
              margin="normal"
              fullWidth
              id="tags"
              label="Federated Task tags"
              name="tags"
              value={tags}
              onChange={onChange}
              placeholder="health, wearable, edge"
              helperText="Optional, comma-separated discovery tags. Runtime settings such as Image are not treated as tags."
            />

            <Grid container spacing={2} sx={{ mt: 0.5, mb: 2 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="task-visibility-label">Visibility</InputLabel>
                  <Select
                    labelId="task-visibility-label"
                    name="visibility"
                    value={visibility}
                    label="Visibility"
                    onChange={onChange}
                  >
                    <MenuItem value="private">Private</MenuItem>
                    <MenuItem value="public">Public</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="participation-policy-label">Participation</InputLabel>
                  <Select
                    labelId="participation-policy-label"
                    name="participationPolicy"
                    value={participationPolicy}
                    label="Participation"
                    onChange={onChange}
                  >
                    <MenuItem value="approval_required">Owner approval required</MenuItem>
                    <MenuItem value="open">Open (automatic approval)</MenuItem>
                    <MenuItem value="closed">Closed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {visibility === 'public' && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Public exposes task metadata and registered global-model downloads.
                Runtime controls, YAML, logs, and owner actions remain private.
              </Typography>
            )}

            {/* Legacy configuration remains isolated from a new v3 Draft. */}
            {(isLegacyEdit || (!isEdit && creationMode !== 'standard')) && <TaskConfigForm
              xaiEnabled={xaiEnabled}
              xaiParams={xaiParams}
              modelType={modelType}
              learningRate={learningRate}
              numEpochs={numEpochs}
              batchSize={batchSize}
              numRounds={numRounds}
              clientPerRound={clientPerRound}
              strategy={strategy}
              strategyParams={strategyParams}
              llmParams={llmParams}
              datasetParams={datasetParams}
              clusteringEnabled={clusteringEnabled}
              clusteringParams={clusteringParams}
              isAdmin={isAdmin}
              sbaFlTarget={sbaFlTarget}
              onChange={onChange}
            />}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              {isV3Edit ? 'Save Registry metadata' : isLegacyEdit ? 'Save Legacy settings' : 'Create'}
            </Button>
          </Box>
        ) : null}
      </Box>
      
      {/* YAML Configuration Modal */}
      <Dialog 
        open={yamlModalOpen} 
        onClose={() => setYamlModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Generated YAML Configuration</DialogTitle>
        <DialogContent>
          <Box
            component="pre"
            sx={{
              backgroundColor: '#f5f5f5',
              padding: 2,
              borderRadius: 1,
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              overflow: 'auto',
              maxHeight: '500px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {generatedYaml}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setYamlModalOpen(false)} color="primary">
            Close
          </Button>
          <Button 
            onClick={() => {
              navigator.clipboard.writeText(generatedYaml);
              alert('YAML configuration copied to clipboard!');
            }} 
            color="primary" 
            variant="contained"
          >
            Copy to Clipboard
          </Button>
        </DialogActions>
      </Dialog>

      {/* Debug Panel - 개발 환경에서만 표시되며 쉽게 제거 가능 */}
      {(isLegacyEdit || (!isEdit && creationMode !== 'standard')) && <ConfigDebugPanel
        title={title}
        modelType={modelType}
        dataType={dataType}
        learningRate={learningRate}
        numEpochs={numEpochs}
        batchSize={batchSize}
        numRounds={numRounds}
        clientPerRound={clientPerRound}
        strategy={strategy}
        strategyParams={strategyParams}
        xaiEnabled={xaiEnabled}
        llmParams={llmParams}
        datasetParams={datasetParams}
        sbaFlTarget={sbaFlTarget}
        yamlConfig={generatedYaml}
      />}
    </ContentWrapper>
  </div>
);
};

export default CreatePage;
