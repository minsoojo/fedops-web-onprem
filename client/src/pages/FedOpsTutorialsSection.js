import React from "react";
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CardMedia,
  Chip,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import FedOps_Server_tutorials from '../img/FedOps_Server_tutorials.png';
import FedOps_Client_tutorials from "../img/FedOps_Client_tutorials.png";
import FedOps_Custom_tutorials from "../img/FedOps_Custom_tutorials.png";

/**
 * FedOpsTutorialsSection
 * - 바깥 Container: maxWidth={false} + disableGutters → 배경 풀폭
 * - 안쪽 Container: maxWidth="lg" → 콘텐츠 폭 제한
 * - 카드: 단계 번호 Chip, 일러스트(선택), 체크리스트, "Start now" 버튼
 */
export default function FedOpsTutorialsSection() {
  const tutorials = [
    {
      step: "01",
      title: "Create FL Server",
      bullets: [
        "Classic Machine Learning",
        "Challenges of Classical ML",
        "Federated Learning",
        "Federated Evaluation",
        "Federated Analytics",
        "Differential Privacy",
      ],
      href: "https://gachon-cclab.github.io/docs/FedOps-Tutorials/Create-FL-Server/",
      img: FedOps_Server_tutorials,
      imgAlt: "Monitor and database illustration",
    },
    {
      step: "02",
      title: "Run FL Client",
      bullets: [
        "Preparation",
        "Step 01: Centralized Training (PyTorch)",
        "Step 02: Federated Learning with FedOps",
      ],
      href: "https://gachon-cclab.github.io/docs/FedOps-Tutorials/Run-FL-Client/",
      img: FedOps_Client_tutorials,
      imgAlt: "Starter kit illustration",
    },
    {
      step: "03",
      title: "Use Model & Data",
      bullets: [
        "Preparation",
        "Strategy customization",
        "Server-side parameter evaluation",
        "Send/receive arbitrary values",
        "Scaling Federated Learning",
      ],
      href: "https://gachon-cclab.github.io/docs/FedOps-Tutorials/Your-Own-with-FedOps/",
      img: FedOps_Custom_tutorials,
      imgAlt: "Puzzle strategy illustration",
    },
    // 필요하면 더 추가
    // {
    //   step: "03",
    //   title: "Monitoring & Ops",
    //   bullets: ["Live logs & metrics", "Rounds & alerts", "Failure handling"],
    //   href: "/docs/tutorials/03-monitoring",
    //   img: "/fedops/img/tutorials/03.png",
    //   imgAlt: "Monitoring illustration",
    // },
  ];

  return (
    <Container maxWidth={false} disableGutters sx={{ bgcolor: "#fffef9" }}>
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Typography
          variant="h3"
          align="center"
          sx={{ fontWeight: 600, mb: 3 }}
        >
          FedOps Tutorials
        </Typography>
        <Typography
          variant="h6"
          align="center"
          color="text.secondary"
          sx={{ mb: { xs: 4, md: 6 } }}
        >
          This series introduces the fundamentals of Federated Learning and how
          to implement and operate it with FedOps.
        </Typography>

        <Grid container spacing={{ xs: 3, md: 4 }}>
          {tutorials.map((t) => (
            <Grid item xs={12} sm={6} md={4} key={t.step}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  borderRadius: 3,
                  borderColor: "divider",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  position: "relative",
                  "&:hover": {
                    boxShadow: "0 6px 24px rgba(0,0,0,0.08)",
                    transform: "translateY(-2px)",
                  },
                  transition: "all 220ms ease",
                }}
              >
                {/* 단계 번호 배지 */}
                <Chip
                  label={t.step}
                  sx={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    fontWeight: 800,
                    bgcolor: "#ffeb99",
                    color: "#a17900",
                  }}
                />

                {/* 일러스트 (옵션) */}
                {t.img && (
                  <CardMedia
                    component="img"
                    image={t.img}
                    alt={t.imgAlt}
                    sx={{
                      height: 220,
                      objectFit: "contain",
                      pt: 4, // 상단 공간 확보(Chip와 겹침 방지)
                    }}
                  />
                )}

                <CardContent sx={{ pt: t.img ? 1 : 6 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                    {t.title}
                  </Typography>
                {/*
                  <List dense disablePadding>
                    {t.bullets.map((b, idx) => (
                      <ListItem key={idx} sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <CheckCircleOutlineIcon
                            fontSize="small"
                            sx={{ color: "#f2b800" }}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primaryTypographyProps={{ variant: "body2" }}
                          primary={b}
                        />
                      </ListItem>
                    ))}
                  </List>
                  */}
                </CardContent>

                <CardActions sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    color="inherit"
                    href={t.href}
                    sx={{
                      borderWidth: 2,
                      "&:hover": { borderWidth: 2, backgroundColor: "#fff9e6" },
                    }}
                  >
                    Start now
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Container>
  );
}
