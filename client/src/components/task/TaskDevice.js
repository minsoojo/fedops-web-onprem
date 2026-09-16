import React from 'react';
import {
  Box,
  Card,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { formatClientLastSeen } from '../../lib/clientPresence';

// cluster_id 정규화: 표시 조건에만 사용 (없으면 null)
const normalizeClusterId = (id) => {
  if (id === null || id === undefined) return null;
  const s = String(id).trim();
  if (s === '' || s.toLowerCase() === 'none') return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;   // 숫자만 유효
};

// 라벨 생성: id가 유효할 때만 라벨 생성 + 저장
// 같은 노이즈 ID는 항상 같은 서브라벨로 보여주기 위해 localStorage에 매핑 저장
const noiseLabelFromId = (() => {
  const KEY = 'noiseLabelMap';
  const stored = JSON.parse(localStorage.getItem(KEY) || '{}'); // { "10023": "Noise-A", ... }
  const map = new Map(Object.entries(stored));
  const ALPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // 숫자를 A, B, ... Z, AA, AB ...로 변환
  const numToLetters = (k) => {
    let x = k, out = '';
    do { out = ALPH[x % 26] + out; x = Math.floor(x / 26) - 1; } while (x >= 0);
    return out;
  };

  // 주어진 id에 대해 일관된 Noise-? 라벨을 돌려줌
  return (rawId) => {
    const key = String(rawId);
    if (map.has(key)) return map.get(key);

    // rawId가 -1이면 구분자 생성용 임의 인덱스
    let idx;
    const n = Number(rawId);
    if (!Number.isNaN(n) && n >= 10000) {
      idx = n - 10000; // 10000 오프셋 제거 → 0,1,2...
    } else {
      // -1 같은 경우: 현재 저장된 개수를 기반으로 새 인덱스 부여
      idx = map.size;
    }

    const label = `Noise-${numToLetters(idx)}`; // Noise-A, Noise-B, ...
    map.set(key, label);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(map)));
    return label;
  };
})();

// 통합 라벨 함수
const labelFromId = (id, deviceMac) => {
  if (id === null || id === undefined) return null;
  const s = String(id).trim();
  if (!s || s.toLowerCase() === 'none') return null;

  const n = Number(s);
  if (!Number.isNaN(n) && (n === -1 || n >= 10000)) {
    return noiseLabelFromId(s);  // ← 노이즈를 Noise-A/B...로
  }
  if (s.toLowerCase() === 'noise') return noiseLabelFromId(s);

  if (Number.isNaN(n)) return null;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const label = letters[n] || `C${n}`;
  if (deviceMac) localStorage.setItem(`lastCluster:${deviceMac}`, label);
  return label;
};


// 색상 매핑 (라벨이 있을 때만 호출)
const colorFromLabel = (() => {
  const KEY = 'labelColors';
  const KEY_IDX = 'labelColors:idx';
  const RESERVED = { Noise: 'gray' };
  const PALETTE = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f',
                   '#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ab'];

  const stored = JSON.parse(localStorage.getItem(KEY) || '[]');
  const map = new Map([...Object.entries(RESERVED), ...stored]);
  let idx = +localStorage.getItem(KEY_IDX) || 0;

  const hashToHsl = (str) => {
    let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360; return `hsl(${hue},65%,55%)`;
  };

  return (label) => {
    if (!label) return undefined;              // ★ 라벨 없으면 색상 없음
    if (map.has(label)) return map.get(label);
    const color = PALETTE[idx] ?? hashToHsl(label);
    idx = (idx + 1) % Math.max(PALETTE.length, 1);
    map.set(label, color);
    localStorage.setItem(KEY, JSON.stringify([...map]));
    localStorage.setItem(KEY_IDX, String(idx));
    return color;
  };
})();



export const TaskDevice = ({
  device,
  clusterId,
  index,
  presence,
}) => {
  // 1) 표시 조건: 이번 응답에 실제 cluster_id가 왔는가?
  const normalizedId = normalizeClusterId(clusterId);
  const hasCluster = normalizedId !== null;

  // 2) 라벨/색상은 표시 조건이 true일 때만 계산
  const label = hasCluster ? labelFromId(normalizedId, device?.Device_mac) : null;
  const clusterColor = hasCluster ? colorFromLabel(label) : undefined;

  return (
    <Card
      variant="outlined"
      sx={{
        width: '100%',
        minWidth: 0,
        height: '100%',
        p: 2,
        bgcolor: presence?.state === 'offline' ? '#fafaf9' : 'background.paper',
        borderColor: presence?.state === 'online' ? '#bbf7d0' : 'divider',
        borderLeft: hasCluster && clusterColor
          ? `4px solid ${clusterColor}`
          : undefined,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box sx={{ pt: 0.25 }}>
          <FiberManualRecordIcon
            fontSize="small"
            color={presence?.state === 'online'
              ? 'success'
              : presence?.state === 'stale'
                ? 'warning'
                : 'disabled'}
          />
        </Box>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={1}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600}>
                Client {index + 1}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.25, overflowWrap: 'anywhere' }}
              >
                {device?.Device_hostname || 'Unknown host'}
                {device?.Device_mac ? ` · ${device.Device_mac}` : ''}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              {device?.Device_training && presence?.state !== 'offline' && (
                <Chip
                  size="small"
                  label="Training"
                  color="info"
                  variant="outlined"
                />
              )}
              <Chip
                size="small"
                icon={(
                  <FiberManualRecordIcon
                    sx={{ fontSize: '10px !important' }}
                  />
                )}
                label={presence?.label || 'Offline'}
                color={presence?.color || 'default'}
                variant="outlined"
                sx={{ flexShrink: 0 }}
              />
            </Stack>
          </Stack>

          <Stack
            direction="row"
            spacing={1.25}
            useFlexGap
            flexWrap="wrap"
            alignItems="center"
            sx={{ mt: 1.25 }}
          >
            <Typography variant="caption" color="text.secondary">
              {formatClientLastSeen(presence)}
            </Typography>
            {hasCluster && label && (
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: clusterColor,
                  }}
                />
                <Typography variant="caption" sx={{ fontWeight: 600, color: clusterColor }}>
                  Cluster {label}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Box>
      </Stack>
    </Card>
  );
};
