import React from 'react';
import { Container, Grid, Paper, Box, Typography, Button } from '@mui/material';

const PAPER_SX = {
  width: '100%',
  height: '100%',
  minHeight: { md: 220 },
  p: { xs: 2.25, sm: 2.5 },
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-start',
  overflow: 'hidden',
  borderColor: 'divider',
  backgroundColor: 'background.paper',
};

const FeatureCard = ({ title, summary }) => (
  <Paper variant="outlined" sx={PAPER_SX}>
    <Typography
      variant="h6"
      sx={{
        mb: 1.25,
        lineHeight: 1.3,
        overflowWrap: 'anywhere',
      }}
    >
      {title}
    </Typography>
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{
        lineHeight: 1.7,
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        hyphens: 'auto',
      }}
    >
      {summary}
    </Typography>
  </Paper>
);

const FEATURES = [
  {
    title: 'Heterogeneity Management',
    summary: 'Runs across mixed CPU/GPU/edge fleets and remains robust to noisy networks and uneven data or compute distributions.',
  },
  {
    title: 'Scalable Deployment',
    summary: 'Auto-generates validated configs and runnable FL server/client code stubs from your task spec. Strategies, metrics, hooks, and datasets are pre-wired.',
  },
  {
    title: 'Real-time Monitoring',
    summary: 'Track creation, execution, and termination; stream server logs; catch errors early; watch learning curves; and download trained models.',
  },
  {
    title: 'Federated LLM Fine-Tuning',
    summary: 'FlowerTune-powered LoRA/PEFT training with aggregation and global checkpointing for privacy-preserving LLM adaptation at scale.',
  },
  {
    title: 'Explainable & Intelligent FL',
    summary: 'Built-in XAI, client clustering, and HPO help address severe non-IID data through task-level configuration.',
  },
  {
    title: 'Multimodal & IoT Integration',
    summary: 'FedMAP multimodal aggregation and an open-source Fitbit pipeline support privacy-preserving, real-world wearable analytics.',
  },
];

const FedOps1_2 = () => {
  return (
    <React.Fragment>
        {/* <HeroBanner
          title="연합학습 운영을 단순화하세요 — FedOps"
          subtitle="보안과 개인정보 보호를 유지하면서 실험부터 배포·모니터링까지 이어지는 엔드투엔드 플랫폼입니다."
          ctas={[{ label: 'Quickstart', href: '/create', primary: true }, { label: '문서 보기', href: '/docs' }]}
          imageSrc="/fedops/img/process-map.png"
        /> */}

        <Container maxWidth="lg" sx={{ mt: 4 }}>
          <Typography
            variant="h3"
            align="center"
            sx={{
              mb: { xs: 3, md: 4 },
              fontWeight: 600,
              fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
              lineHeight: 1.15,
            }}
          >
            FedOps 1.2 New Features
          </Typography>
          <Grid container spacing={{ xs: 2, md: 2.5 }} alignItems="stretch" sx={{ mb: 4 }}>
            {FEATURES.map((feature) => (
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
                key={feature.title}
                sx={{ display: 'flex' }}
              >
                <FeatureCard {...feature} />
              </Grid>
            ))}
          </Grid>
          {/* <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 4 }}>
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                🧠 Federated LLM Fine-Tuning
              </Typography>
              <Typography variant="body1" paragraph>
                <strong>Adapt LLMs to distributed data without sharing raw data</strong> — fully privacy-preserving. Powered by <strong>FlowerTune</strong>, FedOps 1.2 automates the end-to-end pipeline: task config → distributed <strong>LoRA</strong> training → model aggregation → global checkpointing.
              </Typography>
              <Typography variant="body2" paragraph>
                <strong>Solves</strong>: high GPU/comm overhead, data silos, manual orchestration.
                <br />
                <strong>Delivers</strong>: parameter-efficient tuning, minimal setup, domain-specific LLM adaptation at scale.
              </Typography>
              <Typography variant="body2">
                참고: <a href="https://gachon-cclab.github.io/docs/FedOps-LLM/LLM-Finetune/" target="_blank" rel="noopener noreferrer">FedOps LLM Fine-Tuning 문서</a>
              </Typography>
            </Paper>

            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                ✨ Enhanced Automatic Configuration and FL Server Code Generation
              </Typography>
              <Typography variant="body1" paragraph>
                FedOps 1.2 auto-generates validated configs and runnable FL server/client code stubs instantly from your task spec. Strategy, metrics, hooks, and datasets are pre-wired so deployment is drastically faster — no more manual tuning.
              </Typography>
            </Paper>

            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                🔬 Advanced Federated Learning Capabilities — Turnkey via Simple Config Flags
              </Typography>
              <Typography variant="subtitle1" gutterBottom>
                Explainable AI (XAI) Built-In
              </Typography>
              <Typography variant="body2" paragraph>
                Enable federated interpretability with Grad-CAM-based XAI to visualize model decisions on local physiological or image data. Clients generate Grad-CAM heatmaps, report aggregated metrics (entropy, similarity), and produce per-round explainability hooks and exportable reports.
                <br />
                Docs: <a href="https://gachon-cclab.github.io/docs/FedOps-XAI/How-to-use-XAI/" target="_blank" rel="noopener noreferrer">How to use XAI</a>
              </Typography>

              <Typography variant="subtitle1" gutterBottom>
                Intelligent Client Clustering + Hyperparameter Optimization (HPO)
              </Typography>
              <Typography variant="body2" paragraph>
                Automatically group clients by data/behavioral signatures, then run cluster-specific HPO to unlock optimal performance even under severe Non-IID conditions.
                <br />
                Docs: <a href="https://gachon-cclab.github.io/docs/FedOps-Hyperparameter-Optimize/How-to-use-Clustering/" target="_blank" rel="noopener noreferrer">Clustering & HPO</a>
              </Typography>

              <Typography variant="subtitle1" gutterBottom>
                FedMAP Aggregation for Multimodal FL (MMFL)
              </Typography>
              <Typography variant="body2" paragraph>
                A multimodal FL aggregation method that dynamically learns adaptive client weights from interpretable meta-features—engineered for real-world multimodal, non-IID clients.
                <br />
                Docs: <a href="https://gachon-cclab.github.io/docs/FedOps-Aggregation-method/How-use-FedMAP/" target="_blank" rel="noopener noreferrer">How to use FedMAP</a>
              </Typography>
            </Paper>

            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                ⌚ Fitbit Wearable Pipeline
              </Typography>
              <Typography variant="body1" paragraph>
                We integrated a real-world federated IoT health pipeline using Fitbit wearable data. Enables privacy-preserving sleep-quality prediction and personalized monitoring without centralizing user data. Includes an open-source lightweight SleepLSTM (3-layer LSTM + projection bottleneck) as a baseline.
              </Typography>
              <Typography variant="body2" color="textSecondary">
                (Link: Fitbit/Emedy docs link to be added)
              </Typography>
            </Paper>

            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                🖥️ Enhanced FL Server Logs & Monitoring
              </Typography>
              <Typography variant="body1" paragraph>
                Deep observability with real-time insights into metrics, logs, and lifecycle state. Track creation → execution → termination stages and stream server logs directly to the web dashboard for instant debugging.
              </Typography>
              <Typography variant="body2">
                Tutorials: <a href="https://gachon-cclab.github.io/docs/FedOps-Tutorials" target="_blank" rel="noopener noreferrer">FedOps Tutorials</a>
              </Typography>
            </Paper>

            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="body1">
                <strong>All features ship with full guided tutorials, end-to-end examples, and production-ready use cases.</strong>
              </Typography>
            </Paper>
          </Box> */}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button
                variant="contained"
                color="primary"
                href="https://gachon-cclab.github.io/docs/What's-new-in-FedOps-1.2/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn More
              </Button>
          </Box>

          {/* <Typography variant="h5" gutterBottom>
            Live Preview
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <RealtimeStatus
                isConnected={demoStatus.isConnected}
                lastUpdate={demoStatus.lastUpdate}
                error={null}
                onReconnect={() => window.location.reload()}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  빠른 액션
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  서버 관리 페이지로 이동하거나 새 작업을 만들어 즉시 배포를 시작하세요.
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button variant="contained" color="primary" href="/server-management">서버 관리</Button>
                  <Button variant="outlined" href="/create">새 작업 생성</Button>
                </Box>
              </Paper>
            </Grid>
          </Grid> */}
        </Container>
    </React.Fragment>
  );
};

export default FedOps1_2;
