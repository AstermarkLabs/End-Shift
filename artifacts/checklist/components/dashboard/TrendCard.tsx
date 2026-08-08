import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import shape from '@/constants/shape';
import { useMd } from '@/theme/useMd';
import { TrendChart } from './TrendChart';
import { Bucket } from './types';

interface TrendCardProps {
  buckets: Bucket[];
  prevBuckets: Bucket[];
  compare: boolean;
  period: string;
}

export function TrendCard({ buckets, prevBuckets, compare, period: _ }: TrendCardProps) {
  const md = useMd();

  const LEGEND = [
    { color: md.primary, label: 'Completed' },
    { color: md.tertiary, label: 'Late' },
    { color: md.secondary, label: 'Incomplete' },
    { color: md.error, label: 'Missed' },
  ];

  return (
    <View style={[styles.card, { backgroundColor: md.surfaceContainerHigh, borderRadius: shape.lg }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: md.onSurface }]}>Shifts Over Time</Text>
          <Text style={[styles.sub, { color: md.onSurfaceVariant }]}>Daily breakdown of every expected close</Text>
        </View>
        <View style={styles.legendRow}>
          {LEGEND.map(l => (
            <View key={l.label} style={styles.chip}>
              <View style={[styles.swatch, { backgroundColor: l.color, borderRadius: shape.xs }]} />
              <Text style={[styles.chipLabel, { color: md.onSurfaceVariant }]}>{l.label}</Text>
            </View>
          ))}
          {compare && (
            <Text style={[styles.dashLegend, { color: md.onSurfaceVariant }]}>— — prev. period</Text>
          )}
        </View>
      </View>
      <TrendChart buckets={buckets} prevBuckets={prevBuckets} compare={compare} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: -0.1 },
  sub: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 12, height: 4 },
  chipLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  dashLegend: { fontSize: 11, fontFamily: 'Inter_500Medium' },
});
