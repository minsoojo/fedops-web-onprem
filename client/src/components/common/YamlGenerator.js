export const generateYAMLConfig = (formData) => {
  const {
    modelType,
    dataType,
  } = formData;

  if (modelType === 'SBA-FL') {
    return generateSBAFLYAMLConfig(formData);
  }

  // Check if this is an LLM task
  if (dataType === 'LLM') {
    return generateLLMYAMLConfig(formData);
  }

  // Generate general (Image/Numeric) YAML
  return generateGeneralYAMLConfig(formData);
};

const generateSBAFLYAMLConfig = (formData) => {
  const {
    title,
    learningRate,
    numEpochs,
    batchSize,
    numRounds,
    clientPerRound,
    strategy,
    strategyParams,
    sbaFlTarget,
    sbaFlTaskId
  } = formData;

  const target = sbaFlTarget === 'steps' ? 'steps' : 'weight';
  const taskId = sbaFlTaskId || (target === 'steps' ? 'sbastepsfl' : 'sbaweightfl');
  const parameterLayout = target === 'steps' ? 'sba_steps_model_v1' : 'sba_weight_lstm_v1';
  const strategyTarget = strategy === 'FedAVG'
    ? 'flwr.server.strategy.FedAvg'
    : 'flwr.server.strategy.FedAvg';

  return `# Common
random_seed: 42

model_type: 'SBA-FL'
task_id: '${taskId || title}'
learning_rate: ${learningRate || '0.001'}
client_device: 'android'

sba_fl:
  target: '${target}'
  task_id_alias: '${taskId || title}'
  parameter_layout: '${parameterLayout}'
  client_type: 'android_flower'
  server_side_evaluation: false

# server
num_epochs: ${numEpochs || '3'}
batch_size: ${batchSize || '32'}
num_rounds: ${numRounds || '2'}
clients_per_round: ${clientPerRound || '1'}

server:
  strategy:
    _target_: ${strategyTarget}
    fraction_fit: ${strategyParams?.fractionFit || '1.0'}
    fraction_evaluate: ${strategyParams?.fractionEvaluate || '1.0'}
    min_fit_clients: \${clients_per_round}
    min_available_clients: \${clients_per_round}
    min_evaluate_clients: \${clients_per_round}`;
};

const generateLLMYAMLConfig = (formData) => {
  const {
    title,
    learningRate,
    modelType,
    numEpochs,
    batchSize,
    numRounds,
    clientPerRound,
    strategy,
    strategyParams,
    llmParams,
    datasetParams
  } = formData;

  let strategyConfig = '';
  let strategyParamsString = '';
  
  // Strategy-specific parameters
  if (strategy === 'FedAVG') {
    strategyConfig = 'flwr.server.strategy.FedAvg';
    strategyParamsString = `
    fraction_fit: ${strategyParams.fractionFit || '1.0'}
    fraction_evaluate: ${strategyParams.fractionEvaluate || '1.0'}`;
  } else if (strategy === 'FedAdam') {
    strategyConfig = 'flwr.server.strategy.FedAdam';
    strategyParamsString = `
    beta_1: ${strategyParams.beta1 || '0.9'}
    beta_2: ${strategyParams.beta2 || '0.999'}
    epsilon: ${strategyParams.epsilon || '1e-8'}`;
  } else if (strategy === 'FedAdagrad') {
    strategyConfig = 'flwr.server.strategy.FedAdagrad';
    strategyParamsString = `
    initial_accumulator_value: ${strategyParams.initialAccumulator || '0.0'}
    epsilon: ${strategyParams.epsilon || '1e-8'}`;
  } else if (strategy === 'FedYogi') {
    strategyConfig = 'flwr.server.strategy.FedYogi';
    strategyParamsString = `
    beta_1: ${strategyParams.beta1 || '0.9'}
    beta_2: ${strategyParams.beta2Yogi || '0.999'}
    epsilon: ${strategyParams.epsilonYogi || '1e-8'}`;
  } else if (strategy === 'FedProx') {
    strategyConfig = 'flwr.server.strategy.FedProx';
    strategyParamsString = `
    proximal_mu: ${strategyParams.mu || '0.01'}`;
  } else if (strategy === 'SCAFFOLD') {
    strategyConfig = 'flwr.server.strategy.SCAFFOLD';
    strategyParamsString = `
    server_learning_rate: ${strategyParams.serverLearningRate || '1.0'}`;
  } else if (strategy === 'ModalityAwareAggregation') {
    strategyConfig = 'fedops.server.fedmap.strategy.ModalityAwareAggregation';
    strategyParamsString = `
    aggregator_path: "aggregator_mlp.pth"
    input_dim: ${strategyParams.inputDim || '10'}
    hidden_dim: ${strategyParams.hiddenDim || '16'}
    aggregator_lr: ${strategyParams.aggregatorLr || '0.001'}
    entropy_coeff: ${strategyParams.entropyCoeff || '0.01'}
    n_trials_per_round: ${strategyParams.nTrialsPerRound || '4'}
    perf_mix_lambda: ${strategyParams.perfMixLambda || '0.7'}
    z_clip: ${strategyParams.zClip || '3.0'}`;
  }

  return `# Common
random_seed: 42

learning_rate: ${learningRate || '0.0001'} # Input model's learning rate

model_type: 'Huggingface' # This value should be maintained
model:
  name: ${datasetParams.modelName || 'model name'} # Input your Huggingface model name (e.g., gpt2, bert-base-uncased)
  output_size: 512
dataset:
    name: '${datasetParams.name || 'dataset name'}' # Input your data name
    llm_task: '${datasetParams.llmTask || 'medical'}' # LLM task type (medical, text-generation, text-classification, etc.)
    validation_split: ${datasetParams.validationSplit || '0.2'}

# client
task_id: '${title || 'podname'}' # Input your Task Name that you register in FedOps Website

wandb: 
  use: false # Whether to use wandb
  key: 'your wandb api key' # Input your wandb api key
  account: 'your wandb account' # Input your wandb account
  project: '\${dataset.name}_\${task_id}'

# server
num_epochs: ${numEpochs || '3'} # number of local epochs
batch_size: ${batchSize || '4'} # smaller batch size for LLM
num_rounds: ${numRounds || '2'} # Number of rounds to perform
clients_per_round: ${clientPerRound || '1'} # Number of clients participating in the round

server:
  strategy:
    _target_: ${strategyConfig} # aggregation algorithm${strategyParamsString}
    min_fit_clients: \${clients_per_round} # Minimum number of clients to participate in training
    min_available_clients: \${clients_per_round} # Minimum number of clients to participate in a round
    min_evaluate_clients: \${clients_per_round} # Minimum number of clients to participate in evaluation

# LLM Fine-tuning specific parameters
finetune:
  lora_r: ${llmParams.loraR || '8'}
  lora_alpha: ${llmParams.loraAlpha || '16'}
  lora_dropout: ${llmParams.loraDropout || '0.075'}
  learning_rate: ${llmParams.learningRate || '0.001'}
  per_device_train_batch_size: ${llmParams.perDeviceTrainBatchSize || '16'}
  gradient_accumulation_steps: ${llmParams.gradientAccumulationSteps || '1'}
  logging_steps: ${llmParams.loggingSteps || '1'}
  max_steps: ${llmParams.maxSteps || '10'}
  save_steps: ${llmParams.saveSteps || '1000'}
  save_total_limit: ${llmParams.saveTotalLimit || '5'}
  gradient_checkpointing: ${llmParams.gradientCheckpointing || 'True'}
  lr_scheduler_type: "${llmParams.lrSchedulerType || 'constant'}"`;
};

const generateGeneralYAMLConfig = (formData) => {
  const {
    title,
    learningRate,
    modelType,
    numEpochs,
    batchSize,
    numRounds,
    clientPerRound,
    strategy,
    strategyParams,
    dataType,
    tagInput,
    serverRepoAddr,
    xaiEnabled,
    xaiParams,
    datasetParams,
    clusteringEnabled,
    clusteringParams
  } = formData;

  let strategyConfig = '';
  let strategyParamsString = '';
  
  // Clustering/HPO가 활성화된 경우 strategy를 ClusterOptunaFedAvg로 변경
  if (clusteringEnabled === 'enabled') {
    strategyConfig = 'fedops.server.strategy_cluster_optuna.ClusterOptunaFedAvg';
    strategyParamsString = `
    fraction_fit: 0.00001
    fraction_evaluate: 0.000001`;
  } else {
    // Strategy-specific parameters (기존 로직)
    if (strategy === 'FedAVG') {
      strategyConfig = 'flwr.server.strategy.FedAvg';
      strategyParamsString = `
    fraction_fit: ${strategyParams.fractionFit || '1.0'}
    fraction_evaluate: ${strategyParams.fractionEvaluate || '1.0'}`;
    } else if (strategy === 'FedAdam') {
      strategyConfig = 'flwr.server.strategy.FedAdam';
      strategyParamsString = `
    eta: ${strategyParams.eta1 || '0.9'}
    eta_1: ${strategyParams.eta2 || '0.999'}
    beta_1: ${strategyParams.beta1 || '0.9'}
    beta_2: ${strategyParams.beta2 || '0.999'}
    tau: ${strategyParams.tau || '1e-8'}`;
    } else if (strategy === 'FedAdagrad') {
      strategyConfig = 'flwr.server.strategy.FedAdagrad';
      strategyParamsString = `
    initial_accumulator_value: ${strategyParams.initialAccumulator || '0.0'}
    epsilon: ${strategyParams.epsilon || '1e-8'}`;
    } else if (strategy === 'FedYogi') {
      strategyConfig = 'flwr.server.strategy.FedYogi';
      strategyParamsString = `
    eta: ${strategyParams.eta1 || '0.9'}
    eta_1: ${strategyParams.eta2 || '0.999'}
    beta_1: ${strategyParams.beta1 || '0.9'}
    beta_2: ${strategyParams.beta2 || '0.999'}
    tau: ${strategyParams.tau || '1e-8'}`;
    } else if (strategy === 'FedProx') {
      strategyConfig = 'flwr.server.strategy.FedProx';
      strategyParamsString = `
    proximal_mu: ${strategyParams.mu || '0.01'}`;
    } else if (strategy === 'SCAFFOLD') {
      strategyConfig = 'flwr.server.strategy.SCAFFOLD';
      strategyParamsString = `
    server_learning_rate: ${strategyParams.serverLearningRate || '1.0'}`;
    } else if (strategy === 'ModalityAwareAggregation') {
      strategyConfig = 'fedops.server.fedmap.strategy.ModalityAwareAggregation';
      strategyParamsString = `
    aggregator_path: "aggregator_mlp.pth"
    input_dim: ${strategyParams.inputDim || '10'}
    hidden_dim: ${strategyParams.hiddenDim || '16'}
    aggregator_lr: ${strategyParams.aggregatorLr || '0.001'}
    entropy_coeff: ${strategyParams.entropyCoeff || '0.01'}
    n_trials_per_round: ${strategyParams.nTrialsPerRound || '4'}
    perf_mix_lambda: ${strategyParams.perfMixLambda || '0.7'}
    z_clip: ${strategyParams.zClip || '3.0'}`;
    }
  }

  // Clustering/HPO 파라미터 생성
  let clusteringSection = '';
  if (clusteringEnabled === 'enabled' && clusteringParams) {
    // hyperparams 배열 생성 (learning_rate, batch_size 조합)
    const lrMin = parseFloat(clusteringParams.searchLrLogMin || '-5.0');
    const lrMax = parseFloat(clusteringParams.searchLrLogMax || '-2.0');
    const bsExpMin = parseInt(clusteringParams.searchBsExpMin || '3');
    const bsExpMax = parseInt(clusteringParams.searchBsExpMax || '7');
    
    // 샘플 hyperparams 생성 (최소, 중간, 최대 값)
    const lrMid = Math.pow(10, (lrMin + lrMax) / 2);
    const lrMinVal = Math.pow(10, lrMin);
    const lrMaxVal = Math.pow(10, lrMax);
    const bsMid = Math.pow(2, Math.floor((bsExpMin + bsExpMax) / 2));
    const bsMinVal = Math.pow(2, bsExpMin);
    const bsMaxVal = Math.pow(2, bsExpMax);
    
    clusteringSection = `
# clustering/HPO Options
hyperparams:
- [${lrMinVal.toExponential(3)}, ${bsMaxVal}]
- [${lrMid.toExponential(3)}, ${bsMid}]
- [${lrMaxVal.toExponential(3)}, ${bsMinVal}]
`;
    
    // Strategy 파라미터에 clustering/HPO 옵션 추가
    strategyParamsString += `
    min_fit_clients: \${clients_per_round}
    min_available_clients: \${clients_per_round}
    min_evaluate_clients: \${clients_per_round}

    # clustering/HPO Options
    warmup_rounds: ${clusteringParams.warmupRounds || '1'}        # Number of warmup rounds before clustering
    recluster_every: ${clusteringParams.reclusterEvery || '1'}      # Re-cluster frequency (in rounds)
    eps: ${clusteringParams.eps || '0.2'}                # DBSCAN epsilon parameter
    min_samples: ${clusteringParams.minSamples || '2'}          # DBSCAN min_samples parameter
    objective: "${clusteringParams.objective || 'maximize_f1'}"        # Other options: "maximize_acc" / "minimize_loss"
    search_lr_log: [${clusteringParams.searchLrLogMin || '-5.0'}, ${clusteringParams.searchLrLogMax || '-2.0'}]     # Search space for log10(lr), e.g. 1e-5 to 1e-2
    search_bs_exp: [${clusteringParams.searchBsExpMin || '3'}, ${clusteringParams.searchBsExpMax || '7'}]           # Search space for batch size as 2^exp (8~128)
    search_local_epochs: [${clusteringParams.searchLocalEpochsMin || '1'}, ${clusteringParams.searchLocalEpochsMax || '3'}]     # Range of local epochs`;
  } else {
    strategyParamsString += `
    min_fit_clients: \${clients_per_round} # Minimum number of clients to participate in training
    min_available_clients: \${clients_per_round} # Minimum number of clients to participate in a round
    min_evaluate_clients: \${clients_per_round} # Minimum number of clients to participate in evaluation`;
  }

  // XAI 설정 생성
  let xaiSection = '';
  if (xaiEnabled === 'enabled' && xaiParams) {
    xaiSection = `
xai:
  enabled: true                  # Whether to enable Grad-CAM
  run_location: "${xaiParams.runLocation || 'client'}"        # Options: client / server / both
  target_layer_index: ${xaiParams.targetLayerIndex || '-1'}        # Index of the target convolution layer (e.g., -1 for the last one)
  output_dir: "${xaiParams.outputDir || 'outputs/gradcam'}" # Directory to save Grad-CAM visualizations
  layer: "${xaiParams.layer || 'conv2'}" # Name of the target layer for Grad-CAM (e.g., 'conv2' for the second convolutional layer)
`;
  }

  return `# Common
random_seed: 42

learning_rate: ${learningRate || '0.001'} # Input model's learning rate
${clusteringSection}
model_type: '${modelType === 'LLM' ? 'Huggingface' : 'Pytorch'}' # This value should be maintained
model:
  _target_: ${datasetParams.modelName || 'model name'} # Input your custom model
  output_size: ${datasetParams.outputSize || '10'} # Input your model's output size (only classification)
${xaiSection}
dataset:
    name: '${datasetParams.name || 'dataset name'}' # Input your data name
    validation_split: ${datasetParams.validationSplit || '0.2'} # Ratio of dividing train data by validation

# client
task_id: '${title || 'podname'}' # Input your Task Name that you register in FedOps Website

wandb: 
  use: false # Whether to use wandb
  key: 'your wandb api key' # Input your wandb api key
  account: 'your wandb account' # Input your wandb account
  project: '\${dataset.name}_\${task_id}'

# server
num_epochs: ${numEpochs || '1'} # number of local epochs
batch_size: ${batchSize || '128'}
num_rounds: ${numRounds || '2'} # Number of rounds to perform
clients_per_round: ${clientPerRound || '1'} # Number of clients participating in the round

server:
  strategy:
    _target_: ${strategyConfig} # aggregation algorithm${strategyParamsString}`;
};
