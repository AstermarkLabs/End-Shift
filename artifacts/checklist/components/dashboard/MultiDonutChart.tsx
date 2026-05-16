import React from 'react';
import { Circle, G, Svg, Text as SvgText } from 'react-native-svg';

interface Segment {
  value: number;
  color: string;
}

interface MultiDonutChartProps {
  size?: number;
  stroke?: number;
  segments: Segment[];
}

export function MultiDonutChart({ size = 160, stroke = 20, segments }: MultiDonutChartProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  const arcTotal = total || 1;
  let acc = 0;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="#F0F0F0" strokeWidth={stroke} />
      <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
        {segments.map((s, i) => {
          if (s.value === 0) return null;
          const len = (s.value / arcTotal) * c;
          const offset = -(acc / arcTotal) * c;
          acc += s.value;
          return (
            <Circle key={i} cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={offset}
            />
          );
        })}
      </G>
      <SvgText
        x={size / 2}
        y={size * 0.5}
        textAnchor="middle"
        fontFamily="Inter_700Bold" fontWeight="700" fontSize="30"
        fill="#1A1A1A"
      >
        {String(total)}
      </SvgText>
      <SvgText
        x={size / 2}
        y={size * 0.65}
        textAnchor="middle"
        fontFamily="Inter_600SemiBold" fontWeight="600" fontSize="10"
        fill="#888"
      >
        SHIFTS
      </SvgText>
    </Svg>
  );
}
