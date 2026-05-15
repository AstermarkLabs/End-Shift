import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TrendChart } from './TrendChart';
import { Bucket } from './types';

interface TrendCardProps {
  buckets: Bucket[];
  prevBuckets: Bucket[];
  compare: boolean;
  period: string;
}

const LEGEND = [
  { color: '#16A34A', label: 'Completed' },
  { color: '#2196F3', label: 'Late' },
  { color: '#FF9800', label: 'Incomplete' },
  { color: '#EF4444', label: 'Missed' },
];

export function TrendCard({ buckets, prevBuckets, compare, period: _ }: TrendCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Shifts Over Time</Text>
          <Text style={styles.sub}>Daily breakdown of every expected close</Text>
        </View>
        <View style={styles.legendRow}>
          {LEGEND.map(l => (
            <View key={l.label} style={styles.chip}>
              <View style={[styles.swatch, { backgroundColor: l.color }]} />
              <Text style={styles.chipLabel}>{l.label}</Text>
            </View>
          ))}
          {compare && (
            <Text style={styles.dashLegend}>— — prev. period</Text>
          )}
        </View>
      </View>
      <TrendChart buckets={buckets} prevBuckets={prevBuckets} compare={compare} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
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
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#1A1A1A', letterSpacing: -0.1 },
  sub: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#888888', marginTop: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 12, height: 4, borderRadius: 2 },
  chipLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#888888' },
  dashLegend: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#888888' },
});
