import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Chip } from 'react-native-paper';

import shape from '@/constants/shape';
import { useMd } from '@/theme/useMd';
import { DonutChart } from './DonutChart';
import { DeltaResult, RunOutcome } from './types';
import { deltaPct } from './dashUtils';

interface KpiCardProps {
  kind: RunOutcome;
  label: string;
  value: number;
  total: number;
  prev: number;
}

export function KpiCard({ kind, label, value, total, prev }: KpiCardProps) {
  const md = useMd();
  const RING_COLORS: Record<RunOutcome, string> = {
    completed: md.primary,
    late: md.tertiary,
    incomplete: md.secondary,
    missed: md.error,
  };

  const pct = total > 0 ? value / total : 0;
  const d: DeltaResult = deltaPct(value, prev);
  const polarity = kind === 'completed' ? 1 : -1;
  let pillKind: 'good' | 'bad' | 'flat' = 'flat';
  if (d.kind === 'up') pillKind = polarity > 0 ? 'good' : 'bad';
  else if (d.kind === 'down') pillKind = polarity > 0 ? 'bad' : 'good';
  const arrow = d.kind === 'up' ? '↑' : d.kind === 'down' ? '↓' : '';
  const ringColor = RING_COLORS[kind];
  const dotColor = ringColor;

  const pillBg = pillKind === 'good' ? md.successContainer : pillKind === 'bad' ? md.errorContainer : md.surfaceContainerHighest;
  const pillText = pillKind === 'good' ? md.onSuccessContainer : pillKind === 'bad' ? md.onErrorContainer : md.onSurfaceVariant;

  return (
    <View
      style={[styles.card, { backgroundColor: md.surfaceContainerHigh, borderRadius: shape.lg }]}
      accessibilityRole="none"
    >
      <View style={styles.content}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={[styles.eyebrow, { color: md.onSurfaceVariant }]}>{label}</Text>
        </View>
        <Text style={[styles.num, { color: md.onSurface }]} accessibilityLabel={`${value} out of ${total}`}>
          {value}
          <Text style={[styles.of, { color: md.onSurfaceVariant }]}> / {total}</Text>
        </Text>
        <View style={styles.deltaRow}>
          <Chip
            compact
            style={{ backgroundColor: pillBg }}
            textStyle={[styles.pillText, { color: pillText }]}
          >
            {arrow}{arrow ? ' ' : ''}{d.text}
          </Chip>
          <Text style={[styles.wasNote, { color: md.onSurfaceVariant }]}>was {prev}</Text>
        </View>
      </View>
      <DonutChart size={64} stroke={8} pct={pct} color={ringColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    flex: 1,
    minWidth: 160,
  },
  content: { flex: 1, gap: 6 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  eyebrow: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  num: {
    fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: -0.8,
  },
  of: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pillText: {
    fontSize: 12, fontFamily: 'Inter_700Bold',
  },
  wasNote: { fontSize: 12, fontFamily: 'Inter_500Medium' },
});
