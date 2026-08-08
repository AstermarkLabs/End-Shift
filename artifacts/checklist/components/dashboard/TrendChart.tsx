import React from 'react';
import { Circle, G, Line, Path, Svg, Text as SvgText } from 'react-native-svg';

import { useMd } from '@/theme/useMd';
import { Bucket, RunOutcome } from './types';

const W = 800, H = 200;
const PAD_L = 32, PAD_R = 12, PAD_T = 12, PAD_B = 28;
const innerW = W - PAD_L - PAD_R;
const innerH = H - PAD_T - PAD_B;

function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  const t = 0.25;
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 2] || pts[i - 1];
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = pts[i + 1] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) * t;
    const cp1y = p1[1] + (p2[1] - p0[1]) * t;
    const cp2x = p2[0] - (p3[0] - p1[0]) * t;
    const cp2y = p2[1] - (p3[1] - p1[1]) * t;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function areaPath(pts: [number, number][], baseline: number): string {
  if (pts.length === 0) return '';
  return smoothPath(pts) + ` L ${pts[pts.length - 1][0]} ${baseline} L ${pts[0][0]} ${baseline} Z`;
}

interface TrendChartProps {
  buckets: Bucket[];
  prevBuckets: Bucket[];
  compare: boolean;
}

export function TrendChart({ buckets, prevBuckets, compare }: TrendChartProps) {
  const md = useMd();
  const STATUS: { id: RunOutcome; label: string; color: string }[] = [
    { id: 'completed', label: 'Completed', color: md.primary },
    { id: 'late', label: 'Late', color: md.tertiary },
    { id: 'incomplete', label: 'Incomplete', color: md.secondary },
    { id: 'missed', label: 'Missed', color: md.error },
  ];

  const n = buckets.length;

  let maxVal = 1;
  for (const b of [...buckets, ...(compare ? prevBuckets : [])]) {
    for (const s of STATUS) maxVal = Math.max(maxVal, b[s.id]);
  }
  const yMax = Math.max(2, Math.ceil(maxVal));
  const yTicks = Array.from({ length: yMax + 1 }, (_, i) => i);

  const xFor = (i: number) => PAD_L + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yFor = (v: number) => PAD_T + (1 - v / yMax) * innerH;
  const baseline = yFor(0);

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {yTicks.map((v, i) => (
        <G key={i}>
          <Line
            x1={PAD_L} x2={W - PAD_R} y1={yFor(v)} y2={yFor(v)}
            stroke={v === 0 ? md.outlineVariant : md.surfaceContainerHighest}
            strokeWidth={v === 0 ? 1.5 : 1}
          />
          <SvgText x={PAD_L - 5} y={yFor(v) + 3.5}
            textAnchor="end"
            fontFamily="Inter_500Medium" fontSize="10" fill={md.onSurfaceVariant}>
            {v}
          </SvgText>
        </G>
      ))}

      {compare && STATUS.map(s => {
        const pts: [number, number][] = prevBuckets.map((b, i) => [xFor(i), yFor(b[s.id])]);
        return (
          <Path key={`prev-${s.id}`}
            d={smoothPath(pts)} fill="none"
            stroke={s.color} strokeWidth="1.5" opacity="0.35"
            strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round"
          />
        );
      })}

      {STATUS.map(s => {
        const pts: [number, number][] = buckets.map((b, i) => [xFor(i), yFor(b[s.id])]);
        return (
          <G key={s.id}>
            <Path d={areaPath(pts, baseline)} fill={s.color} opacity="0.07" />
            <Path d={smoothPath(pts)} fill="none"
              stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            />
            {pts.map(([x, y], i) => (
              buckets[i][s.id] > 0
                ? <Circle key={i} cx={x} cy={y} r="3" fill={s.color} />
                : <Circle key={i} cx={x} cy={y} r="2" fill="none" stroke={s.color} strokeWidth="1.5" opacity="0.4" />
            ))}
          </G>
        );
      })}

      {buckets.map((b, i) => {
        const showEvery = n <= 7 ? 1 : n <= 16 ? 2 : Math.ceil(n / 10);
        if (i % showEvery !== 0 && i !== n - 1) return null;
        return (
          <SvgText key={i} x={xFor(i)} y={H - 6}
            textAnchor="middle"
            fontFamily="Inter_500Medium" fontSize="10" fill={md.onSurfaceVariant}>
            {b.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}
