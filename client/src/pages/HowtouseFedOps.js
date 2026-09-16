import React from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Typography,
} from '@mui/material';

// 이미지는 src/img에서 import 해 번들러가 관리하도록 변경합니다.
import FedOpsLLM from '../img/FedOps_LLM.png';
import FedOpsMulti from '../img/FedOps_Multimodal.png';
import FedOpsWearable from '../img/FedOps_Wearable.png';
// 하이퍼파라미터용 이미지가 지정되어 있지 않아 대체 이미지로 Multimodal을 사용합니다.
import FedOpsHPO from '../img/FedOps_HPO.png';

/**
 * HowToUseFedOpsSection
 * - 바깥 Container: maxWidth={false} + disableGutters → 배경 풀폭
 * - 안쪽 Container: maxWidth="lg" → 콘텐츠 폭 제한
 * - 각 카드: 이미지 전체가 클릭 영역(접근성 포함)
 */
export default function HowToUseFedOpsSection() {
  // 각 항목은 원하는 문서 경로/이미지로 바꾸세요
  const items = [
    {
      title: 'LLM',
      subtitle: 'Create and manage LLM federated experiments',
      href: 'https://gachon-cclab.github.io/docs/FedOps-LLM',
      img: FedOpsLLM,
      alt: 'LLM in FedOps',
    },
    {
      title: 'Multimodal',
      subtitle: 'Create and manage Multimodal federated experiments',
      href: 'https://gachon-cclab.github.io/docs/FedOps-Aggregation-method',
      img: FedOpsMulti,
      alt: 'Multimodal in FedOps',
    },
    {
      title: 'Hyperparameter Optimization',
      subtitle: 'Optimize federated learning hyperparameters',
      href: 'https://gachon-cclab.github.io/docs/FedOps-Clustering-Tuning',
      img: FedOpsHPO,
      alt: 'Hyperparameter Optimization in FedOps',
    },
    {
      title: 'Wearable',
      subtitle: 'Manage federated experiments for wearable device data',
      href: 'https://gachon-cclab.github.io/docs/FedOps-Fitbit-Health-Pipeline',
      img: FedOpsWearable,
      alt: 'Wearable in FedOps',
    },
  ];

  return (
    <Container maxWidth={false} disableGutters sx={{ bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Typography
          variant="h3"
          align="center"
          sx={{ fontWeight: 600, mb: 3 }}
        >
          How to use FedOps 1.2?
        </Typography>

        <Typography
          variant="h6"
          align="center"
          color="text.secondary"
          sx={{ mb: { xs: 4, md: 8 } }}
        >
          Explore how FedOps streamlines federated learning— LLM, Multimodal, Hyperparameter Optimization, Wearable
        </Typography>

        <Grid container spacing={{ xs: 3, md: 4 }} justifyContent="center">
          {items.map((it) => (
            <Grid key={it.title} item xs={12} sm={6} md={3}>
              <Card
                elevation={3}
                sx={{
                  height: '100%',
                  borderRadius: 3,
                }}
              >
                <CardActionArea
                  href={it.href}
                  aria-label={`${it.title} — ${it.subtitle}`}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    p: 2.5,
                    '&:hover': {
                      transform: 'translateY(-4px)',
                    },
                    transition: 'transform 200ms ease',
                  }}
                >
                  <Box
                    component="img"
                    src={it.img}
                    alt={it.alt}
                    sx={{
                      width: '100%',
                      maxWidth: 220,
                      height: 'auto',
                      mb: 2,
                      display: 'block',
                    }}
                    loading="lazy"
                  />
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {it.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {it.subtitle}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Container>
  );
}
