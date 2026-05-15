import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DonutChart } from './DonutChart';
import { DeltaResult, RunOutcome } from './types';
import { deltaPct } from './dashUtils';

const RING_COLORS: Record<RunOutcome, string> = {
  completed: '#16A34A',
  late: '#2196F3',
  incomplete: '#FF9800',
  missed: '#EF4444',
};

const DOT_COLORS = RING_COLORS;

interface KpiCardProps {
  kind: RunOutcome;
  label: string;
  value: number;
  total: number;
  prev: number;
}

export function KpiCard({ kind, label, value, total, prev }: KpiCardProps) {
  const pct = total > 0 ? value / total : 0;
  const d: DeltaResult = deltaPct(value, prev);
  const polarity = kind === 'completed' ? 1 : -1;
  let pillKind: 'good' | 'bad' | 'flat' = 'flat';
  if (d.kind === 'up') pillKind = polarity > 0 ? 'good' : 'bad';
  else if (d.kind === 'down') pillKind = polarity > 0 ? 'bad' : 'good';
  const arrow = d.kind === 'up' ? '↑' : d.kind === 'down' ? '↓' : '';
  const ringColor = RING_COLORS[kind];
  const dotColor = DOT_COLORS[kind];

  return (
    <View style={styles.card} accessibilityRole="none">
      <View style={styles.content}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={styles.eyebrow}>{label}</Text>
        </View>
        <Text style={styles.num} accessibilityLabel={`${value} out of ${total}`}>
          {value}
          <Text style={styles.of}> / {total}</Text>
        </Text>
        <View style={styles.deltaRow}>
          <View style={[
            styles.pill,
            pillKind === 'good' && styles.pillGood,
            pillKind === 'bad' && styles.pillBad,
          ]}>
            <Text style={[
              styles.pillText,
              pillKind === 'good' && styles.pillTextGood,
              pillKind === 'bad' && styles.pillTextBad,
              pillKind === 'flat' && styles.pillTextFlat,
            ]}>{arrow}{arrow ? ' ' : ''}{d.text}</Text>
          </View>
          <Text style={styles.wasNote}>was {prev}</Text>
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: 160,
  },
  content: { flex: 1, gap: 6 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  eyebrow: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#888888',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  num: {
    fontSize: 32, fontFamily: 'Inter_700Bold', color: '#1A1A1A', letterSpacing: -0.8,
  },
  of: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#888888' },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  pillGood: { backgroundColor: 'rgba(22,163,74,0.10)' },
  pillBad: { backgroundColor: 'rgba(239,68,68,0.10)' },
  pillText: {
    fontSize: 12, fontFamily: 'Inter_700Bold', color: '#888888',
  },
  pillTextGood: { color: '#16A34A' },
  pillTextBad: { color: '#EF4444' },
  pillTextFlat: { color: '#888888' },
  wasNote: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#888888' },
});
