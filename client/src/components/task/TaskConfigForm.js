import React from 'react';
import { TextField, Grid, Box, Typography, Select, MenuItem, InputLabel } from '@mui/material';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';

const TaskConfigForm = ({
  xaiEnabled,
  xaiParams,
  modelType,
  learningRate,
  numEpochs,
  batchSize,
  numRounds,
  clientPerRound,
  strategy,
  strategyParams,
  llmParams,
  datasetParams,
  clusteringEnabled,
  clusteringParams,
  isAdmin,
  sbaFlTarget,
  onChange
}) => {
  return (
    <>
      {/* Model Type Selection */}
      <Box sx={{ mt: 2 }}>
        <FormControl>
          <FormLabel id="model-type-radio-buttons-group-label">Model Type</FormLabel>
          <RadioGroup
            row
            aria-labelledby="model-type-radio-buttons-group-label"
            name="ModelType"
            value={modelType || "AI"}
            onChange={onChange}
          >
            <FormControlLabel value="AI" control={<Radio />} label="AI" />
            <FormControlLabel value="LLM" control={<Radio />} label="LLM" />
            {isAdmin && (
              <FormControlLabel value="SBA-FL" control={<Radio />} label="SBA-FL" />
            )}
          </RadioGroup>
        </FormControl>
      </Box>

      {modelType === 'SBA-FL' && (
        <Box sx={{ mt: 2 }}>
          <FormControl>
            <FormLabel id="sba-fl-target-radio-buttons-group-label">SBA-FL Target</FormLabel>
            <RadioGroup
              row
              aria-labelledby="sba-fl-target-radio-buttons-group-label"
              name="sbaFlTarget"
              value={sbaFlTarget || "weight"}
              onChange={onChange}
            >
              <FormControlLabel value="weight" control={<Radio />} label="체중 예측 모델" />
              <FormControlLabel value="steps" control={<Radio />} label="걸음수 예측 모델" />
            </RadioGroup>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              체중 예측 모델은 task id `sbaweightfl`, 걸음수 예측 모델은 task id `sbastepsfl`로 생성됩니다.
            </Typography>
          </FormControl>
        </Box>
      )}

      {/* XAI 라디오 버튼 - AI가 선택된 경우에만 선택할 수 있고 LLM인 경우 Disabled로 값을 고정한다. */}
      <Box sx={{ mt: 2 }}>
        <FormControl>
          <FormLabel id="xai-radio-buttons-group-label">FL XAI</FormLabel>
          <RadioGroup
            row
            aria-labelledby="xai-radio-buttons-group-label"
            name="xaiEnabled"
            value={(modelType === 'LLM' || modelType === 'SBA-FL') ? "disabled" : (xaiEnabled || "disabled")}
            onChange={onChange}
          >
            <FormControlLabel
              value="enabled"
              control={<Radio />}
              label="Enabled"
              disabled={modelType === 'LLM' || modelType === 'SBA-FL'}
            />
            <FormControlLabel
              value="disabled"
              control={<Radio />}
              label="Disabled"
              disabled={modelType === 'LLM' || modelType === 'SBA-FL'}
            />
          </RadioGroup>
        </FormControl>
      </Box>

      {/* XAI Parameters - xaiEnabled가 enabled인 경우에만 표시 */}
      {xaiEnabled === 'enabled' && modelType !== 'LLM' && modelType !== 'SBA-FL' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            XAI Parameters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="xai-run-location-select-label">Run Location</InputLabel>
                <Select
                  labelId="xai-run-location-select-label"
                  id="runLocation"
                  name="xaiParam_runLocation"
                  value={xaiParams?.runLocation || "client"}
                  label="Run Location"
                  onChange={onChange}
                >
                  <MenuItem value="client">Client</MenuItem>
                  <MenuItem value="server">Server</MenuItem>
                  <MenuItem value="both">Both</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="targetLayerIndex"
                label="Target Layer Index"
                name="xaiParam_targetLayerIndex"
                type="number"
                value={xaiParams?.targetLayerIndex || "-1"}
                onChange={onChange}
                helperText="Index of the target convolution layer (e.g., -1 for the last one)"
                inputProps={{ step: "1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="outputDir"
                label="Output Directory"
                name="xaiParam_outputDir"
                value={xaiParams?.outputDir || "outputs/gradcam"}
                onChange={onChange}
                helperText="Directory to save Grad-CAM visualizations"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="layer"
                label="Target Layer Name"
                name="xaiParam_layer"
                value={xaiParams?.layer || "conv2"}
                onChange={onChange}
                helperText="Name of the target layer for Grad-CAM (e.g., 'conv2')"
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Basic Training Parameters */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          Basic Training Parameters
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="learningRate"
              label="Learning Rate"
              name="learningRate"
              type="number"
              placeholder="0.001"
              value={learningRate || "0.001"}
              onChange={onChange}
              inputProps={{
                step: "0.001",
                min: "0",
                max: "1"
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="numEpochs"
              label="Number of Epochs"
              name="numEpochs"
              type="number"
              placeholder="10"
              value={numEpochs || "10"}
              onChange={onChange}
              inputProps={{
                min: "1",
                step: "1"
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="batchSize"
              label="Batch Size"
              name="batchSize"
              type="number"
              placeholder="32"
              value={batchSize || "32"}
              onChange={onChange}
              inputProps={{
                min: "1",
                step: "1"
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="numRounds"
              label="Number of Rounds"
              name="numRounds"
              type="number"
              placeholder="10"
              value={numRounds || "10"}
              onChange={onChange}
              inputProps={{
                min: "1",
                step: "1"
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="clientPerRound"
              label="Clients Per Round"
              name="clientPerRound"
              type="number"
              placeholder="5"
              value={clientPerRound || "5"}
              onChange={onChange}
              inputProps={{
                min: "1",
                step: "1"
              }}
            />
          </Grid>
        </Grid>
      </Box>

      {/* Clustering/HPO Option */}
      <Box sx={{ mt: 2 }}>
        <FormControl>
          <FormLabel id="clustering-radio-buttons-group-label">Clustering/HPO (Hyperparameter Optimization)</FormLabel>
          <RadioGroup
            row
            aria-labelledby="clustering-radio-buttons-group-label"
            name="clusteringEnabled"
            value={modelType === 'SBA-FL' ? "disabled" : (clusteringEnabled || "disabled")}
            onChange={onChange}
          >
            <FormControlLabel
              value="enabled"
              control={<Radio />}
              label="Enabled"
              disabled={modelType === 'SBA-FL'}
            />
            <FormControlLabel
              value="disabled"
              control={<Radio />}
              label="Disabled"
              disabled={modelType === 'SBA-FL'}
            />
          </RadioGroup>
        </FormControl>
      </Box>

      {/* Clustering/HPO Parameters - clusteringEnabled가 enabled인 경우에만 표시 */}
      {clusteringEnabled === 'enabled' && modelType !== 'SBA-FL' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Clustering/HPO Parameters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="warmupRounds"
                label="Warmup Rounds"
                name="clusteringParam_warmupRounds"
                type="number"
                value={clusteringParams?.warmupRounds || "1"}
                onChange={onChange}
                helperText="Number of warmup rounds before clustering"
                inputProps={{ min: "0", step: "1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="reclusterEvery"
                label="Recluster Every"
                name="clusteringParam_reclusterEvery"
                type="number"
                value={clusteringParams?.reclusterEvery || "1"}
                onChange={onChange}
                helperText="Re-cluster frequency (in rounds)"
                inputProps={{ min: "1", step: "1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="eps"
                label="DBSCAN Epsilon"
                name="clusteringParam_eps"
                type="number"
                value={clusteringParams?.eps || "0.2"}
                onChange={onChange}
                helperText="DBSCAN epsilon parameter"
                inputProps={{ min: "0", step: "0.01" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="minSamples"
                label="DBSCAN Min Samples"
                name="clusteringParam_minSamples"
                type="number"
                value={clusteringParams?.minSamples || "2"}
                onChange={onChange}
                helperText="DBSCAN min_samples parameter"
                inputProps={{ min: "1", step: "1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="objective-select-label">Optimization Objective</InputLabel>
                <Select
                  labelId="objective-select-label"
                  id="objective"
                  name="clusteringParam_objective"
                  value={clusteringParams?.objective || "maximize_f1"}
                  label="Optimization Objective"
                  onChange={onChange}
                >
                  <MenuItem value="maximize_f1">Maximize F1</MenuItem>
                  <MenuItem value="maximize_acc">Maximize Accuracy</MenuItem>
                  <MenuItem value="minimize_loss">Minimize Loss</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="searchLrLogMin"
                label="LR Search Min (log10)"
                name="clusteringParam_searchLrLogMin"
                type="number"
                value={clusteringParams?.searchLrLogMin || "-5.0"}
                onChange={onChange}
                helperText="Min value for log10(learning_rate)"
                inputProps={{ step: "0.1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="searchLrLogMax"
                label="LR Search Max (log10)"
                name="clusteringParam_searchLrLogMax"
                type="number"
                value={clusteringParams?.searchLrLogMax || "-2.0"}
                onChange={onChange}
                helperText="Max value for log10(learning_rate)"
                inputProps={{ step: "0.1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="searchBsExpMin"
                label="Batch Size Search Min (2^exp)"
                name="clusteringParam_searchBsExpMin"
                type="number"
                value={clusteringParams?.searchBsExpMin || "3"}
                onChange={onChange}
                helperText="Min exponent for batch size (2^3 = 8)"
                inputProps={{ min: "0", step: "1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="searchBsExpMax"
                label="Batch Size Search Max (2^exp)"
                name="clusteringParam_searchBsExpMax"
                type="number"
                value={clusteringParams?.searchBsExpMax || "7"}
                onChange={onChange}
                helperText="Max exponent for batch size (2^7 = 128)"
                inputProps={{ min: "0", step: "1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="searchLocalEpochsMin"
                label="Local Epochs Search Min"
                name="clusteringParam_searchLocalEpochsMin"
                type="number"
                value={clusteringParams?.searchLocalEpochsMin || "1"}
                onChange={onChange}
                helperText="Minimum local epochs"
                inputProps={{ min: "1", step: "1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="searchLocalEpochsMax"
                label="Local Epochs Search Max"
                name="clusteringParam_searchLocalEpochsMax"
                type="number"
                value={clusteringParams?.searchLocalEpochsMax || "3"}
                onChange={onChange}
                helperText="Maximum local epochs"
                inputProps={{ min: "1", step: "1" }}
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Strategy Selection */}
      <FormControl fullWidth margin="normal" required>
        <InputLabel id="strategy-select-label">Strategy</InputLabel>
        <Select
          labelId="strategy-select-label"
          id="strategy"
          name="strategy"
          value={strategy}
          label="Strategy"
          onChange={onChange}
          disabled={modelType === 'SBA-FL'}
        >
          <MenuItem value="FedAVG">FedAVG</MenuItem>
          <MenuItem value="FedAdam">FedAdam</MenuItem>
          <MenuItem value="FedAdagrad">FedAdagrad</MenuItem>
          <MenuItem value="FedYogi">FedYogi</MenuItem>
          <MenuItem value="FedProx">FedProx</MenuItem>
          <MenuItem value="SCAFFOLD">SCAFFOLD</MenuItem>
          <MenuItem value="ModalityAwareAggregation">ModalityAwareAggregation</MenuItem>
        </Select>
      </FormControl>

{/* Strategy별 파라미터 입력 필드 */}
      {strategy === 'FedAVG' && modelType !== 'SBA-FL' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            FedAVG Parameters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="fractionFit"
                label="Fraction Fit"
                name="strategyParam_fractionFit"
                type="number"
                placeholder="1.0"
                value={strategyParams.fractionFit || "1.0"}
                onChange={onChange}
                inputProps={{
                  step: "0.1",
                  min: "0",
                  max: "1"
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="fractionEvaluate"
                label="Fraction Evaluate"
                name="strategyParam_fractionEvaluate"
                type="number"
                placeholder="1.0"
                value={strategyParams.fractionEvaluate || "1.0"}
                onChange={onChange}
                inputProps={{
                  step: "0.1",
                  min: "0",
                  max: "1"
                }}
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {strategy === 'FedAdam' && modelType !== 'SBA-FL' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            FedAdam Parameters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="eta1"
                label="Eta1"
                name="strategyParam_eta1"
                type="number"
                placeholder="0.9"
                value={strategyParams.eta1 || "0.9"}
                onChange={onChange}
                inputProps={{
                  step: "0.01",
                  min: "0",
                  max: "1"
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="eta2"
                label="Eta2"
                name="strategyParam_eta2"
                type="number"
                placeholder="0.9"
                value={strategyParams.eta2 || "0.9"}
                onChange={onChange}
                inputProps={{
                  step: "0.01",
                  min: "0",
                  max: "1"
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="beta1"
                label="Beta1"
                name="strategyParam_beta1"
                type="number"
                placeholder="0.9"
                value={strategyParams.beta1 || "0.9"}
                onChange={onChange}
                inputProps={{
                  step: "0.01",
                  min: "0",
                  max: "1"
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="beta2"
                label="Beta2"
                name="strategyParam_beta2"
                type="number"
                placeholder="0.999"
                value={strategyParams.beta2 || "0.999"}
                onChange={onChange}
                inputProps={{
                  step: "0.001",
                  min: "0",
                  max: "1"
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="tau"
                label="Tau"
                name="strategyParam_tau"
                type="number"
                placeholder="1e-8"
                value={strategyParams.tau || "1e-8"}
                onChange={onChange}
                inputProps={{
                  step: "1e-9",
                  min: "0"
                }}
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {strategy === 'FedAdagrad' && modelType !== 'SBA-FL' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            FedAdagrad Parameters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="initialAccumulator"
                label="Initial Accumulator Value"
                name="strategyParam_initialAccumulator"
                type="number"
                placeholder="0.0"
                value={strategyParams.initialAccumulator || "0.0"}
                onChange={onChange}
                inputProps={{
                  step: "0.01",
                  min: "0"
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="epsilonAdagrad"
                label="Epsilon"
                name="strategyParam_epsilon"
                type="number"
                placeholder="1e-8"
                value={strategyParams.epsilon || "1e-8"}
                onChange={onChange}
                inputProps={{
                  step: "1e-8",
                  min: "0"
                }}
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {strategy === 'FedYogi' && modelType !== 'SBA-FL' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            FedYogi Parameters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="beta1Yogi"
                label="Beta1"
                name="strategyParam_beta1"
                type="number"
                placeholder="0.9"
                value={strategyParams.beta1 || "0.9"}
                onChange={onChange}
                inputProps={{
                  step: "0.01",
                  min: "0",
                  max: "1"
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="beta2Yogi"
                label="Beta2"
                name="strategyParam_beta2Yogi"
                type="number"
                placeholder="0.999"
                value={strategyParams.beta2Yogi || "0.999"}
                onChange={onChange}
                inputProps={{
                  step: "0.001",
                  min: "0",
                  max: "1"
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="epsilonYogi"
                label="Epsilon"
                name="strategyParam_epsilonYogi"
                type="number"
                placeholder="1e-8"
                value={strategyParams.epsilonYogi || "1e-8"}
                onChange={onChange}
                inputProps={{
                  step: "1e-8",
                  min: "0"
                }}
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {strategy === 'FedProx' && modelType !== 'SBA-FL' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            FedProx Parameters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="mu"
                label="Mu (Proximal Term)"
                name="strategyParam_mu"
                type="number"
                placeholder="0.01"
                value={strategyParams.mu || "0.01"}
                onChange={onChange}
                inputProps={{
                  step: "0.01",
                  min: "0"
                }}
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {strategy === 'SCAFFOLD' && modelType !== 'SBA-FL' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            SCAFFOLD Parameters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="serverLearningRate"
                label="Server Learning Rate"
                name="strategyParam_serverLearningRate"
                type="number"
                placeholder="1.0"
                value={strategyParams.serverLearningRate || "1.0"}
                onChange={onChange}
                inputProps={{
                  step: "0.1",
                  min: "0"
                }}
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {strategy === 'ModalityAwareAggregation' && modelType !== 'SBA-FL' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            ModalityAwareAggregation Parameters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="aggregatorLr"
                label="Aggregator Learning Rate"
                name="strategyParam_aggregatorLr"
                type="number"
                placeholder="0.001"
                value={strategyParams.aggregatorLr || "0.001"}
                onChange={onChange}
                inputProps={{
                  step: "0.0001",
                  min: "0"
                }}
                helperText="Learning rate for the aggregator optimizer"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="entropyCoeff"
                label="Entropy Coefficient"
                name="strategyParam_entropyCoeff"
                type="number"
                placeholder="0.01"
                value={strategyParams.entropyCoeff || "0.01"}
                onChange={onChange}
                inputProps={{
                  step: "0.001",
                  min: "0"
                }}
                helperText="Weight for the entropy regularization"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="nTrialsPerRound"
                label="Trials Per Round"
                name="strategyParam_nTrialsPerRound"
                type="number"
                placeholder="4"
                value={strategyParams.nTrialsPerRound || "4"}
                onChange={onChange}
                inputProps={{
                  step: "1",
                  min: "1"
                }}
                helperText="Number of Optuna trials per round"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="perfMixLambda"
                label="Performance Mix Lambda"
                name="strategyParam_perfMixLambda"
                type="number"
                placeholder="0.7"
                value={strategyParams.perfMixLambda || "0.7"}
                onChange={onChange}
                inputProps={{
                  step: "0.1",
                  min: "0",
                  max: "1"
                }}
                helperText="Lambda for mixing performance metrics"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="zClip"
                label="Z-Score Clip"
                name="strategyParam_zClip"
                type="number"
                placeholder="3.0"
                value={strategyParams.zClip || "3.0"}
                onChange={onChange}
                inputProps={{
                  step: "0.1",
                  min: "0"
                }}
                helperText="Z-score clipping threshold"
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Dataset Parameters */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          Dataset Parameters
        </Typography>
        <Grid container spacing={2}>
          {modelType === 'LLM' && (
            <>
              <Grid item xs={12} sm={6}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="datasetName"
                  label="Dataset Name"
                  name="datasetParam_name"
                  value={datasetParams.LLMdataName || "medalpaca/medical_meadow_medical_flashcards"}
                  onChange={onChange}
                  helperText="Enter your dataset name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="modelName"
                  label="Model Name"
                  name="datasetParam_modelName"
                  value={datasetParams.LLMmodelName || "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B"}
                  onChange={onChange}
                  helperText="Enter your Huggingface model name (e.g., gpt2, bert-base-uncased)"
                />
              </Grid>
            </>
          )}
          {modelType !== 'LLM' && (
            <>
              <Grid item xs={12} sm={6}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="datasetName"
                  label="Dataset Name"
                  name="datasetParam_name"
                  value={datasetParams.AIdataName || "MNIST"}
                  onChange={onChange}
                  helperText="Enter your dataset name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="modelName"
                  label="Model Name"
                  name="datasetParam_modelName"
                  value={datasetParams.AImodelName || "models.MNISTClassifier"}
                  onChange={onChange}
                  helperText="Enter your custom model name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="outputSize"
                  label="Output Size"
                  name="datasetParam_outputSize"
                  type="number"
                  value={datasetParams.outputSize || "10"}
                  onChange={onChange}
                  helperText="Model's output size (only for classification)"
                  inputProps={{ min: "1", step: "1" }}
                />
              </Grid>
            </>
          )}
          <Grid item xs={12} sm={6}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="validationSplit"
              label="Validation Split"
              name="datasetParam_validationSplit"
              type="number"
              value={datasetParams.validationSplit || "0.1"}
              onChange={onChange}
              helperText="Ratio of dividing train data by validation"
              inputProps={{ min: "0", max: "1", step: "0.1" }}
            />
          </Grid>
        </Grid>
      </Box>

      {/* LLM Fine-tuning Parameters - LLM 모델 타입이 선택된 경우에만 표시 */}
      {modelType === 'LLM' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            LLM Fine-tuning Parameters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="loraR"
                label="LoRA R"
                name="llmParam_loraR"
                type="number"
                value={llmParams.loraR || "16"}
                onChange={onChange}
                inputProps={{ min: "1", step: "1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="loraAlpha"
                label="LoRA Alpha"
                name="llmParam_loraAlpha"
                type="number"
                value={llmParams.loraAlpha || "32"}
                onChange={onChange}
                inputProps={{ min: "1", step: "1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="loraDropout"
                label="LoRA Dropout"
                name="llmParam_loraDropout"
                type="number"
                value={llmParams.loraDropout || "0.1"}
                onChange={onChange}
                inputProps={{ min: "0", max: "1", step: "0.001" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="learningRate"
                label="Learning Rate"
                name="llmParam_learningRate"
                type="number"
                value={llmParams.learningRate || "5e-5"}
                onChange={onChange}
                inputProps={{ min: "0", step: "0.001" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="perDeviceTrainBatchSize"
                label="Per Device Train Batch Size"
                name="llmParam_perDeviceTrainBatchSize"
                type="number"
                value={llmParams.perDeviceTrainBatchSize || "4"}
                onChange={onChange}
                inputProps={{ min: "1", step: "1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="gradientAccumulationSteps"
                label="Gradient Accumulation Steps"
                name="llmParam_gradientAccumulationSteps"
                type="number"
                value={llmParams.gradientAccumulationSteps || "1"}
                onChange={onChange}
                inputProps={{ min: "1", step: "1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="loggingSteps"
                label="Logging Steps"
                name="llmParam_loggingSteps"
                type="number"
                value={llmParams.loggingSteps || "10"}
                onChange={onChange}
                inputProps={{ min: "1", step: "1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="maxSteps"
                label="Max Steps"
                name="llmParam_maxSteps"
                type="number"
                value={llmParams.maxSteps || "100"}
                onChange={onChange}
                inputProps={{ min: "1", step: "1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="saveSteps"
                label="Save Steps"
                name="llmParam_saveSteps"
                type="number"
                value={llmParams.saveSteps || "50"}
                onChange={onChange}
                inputProps={{ min: "1", step: "1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="saveTotalLimit"
                label="Save Total Limit"
                name="llmParam_saveTotalLimit"
                type="number"
                value={llmParams.saveTotalLimit || "2"}
                onChange={onChange}
                inputProps={{ min: "1", step: "1" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="normal"
                fullWidth
                id="lrSchedulerType"
                label="LR Scheduler Type"
                name="llmParam_lrSchedulerType"
                value={llmParams.lrSchedulerType || "linear"}
                onChange={onChange}
                helperText="e.g., constant, linear, cosine"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <FormLabel>Gradient Checkpointing</FormLabel>
                <RadioGroup
                  row
                  name="llmParam_gradientCheckpointing"
                  value={llmParams.gradientCheckpointing || "true"}
                  onChange={onChange}
                >
                  <FormControlLabel value={true} control={<Radio />} label="True" />
                  <FormControlLabel value={false} control={<Radio />} label="False" />
                </RadioGroup>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
      )}
    </>
  );
};

export default TaskConfigForm;
