import React from 'react';
import { Circle, G, Svg, Text as SvgText } from 'react-native-svg';

interface DonutChartProps {
  size?: number;
  stroke?: number;
  pct: number;
  color: string;
}

export function DonutChart({ size = 72, stroke = 9, pct, color }: DonutChartProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, pct)) * c;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#EFEFEF" strokeWidth={stroke}
        />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </G>
      <SvgText
        x={size / 2}
        y={size / 2 + size * 0.27 * 0.38}
        textAnchor="middle"
        fontFamily="Inter_700Bold"
        fontWeight="700"
        fontSize={size * 0.27}
        fill="#1A1A1A"
      >
        {Math.round(pct * 100)}%
      </SvgText>
    </Svg>
  );
}
