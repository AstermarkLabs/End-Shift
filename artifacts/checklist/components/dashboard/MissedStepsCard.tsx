import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MissedStep } from './types';

interface MissedStepsCardProps {
  rows: MissedStep[];
}

export function MissedStepsCard({ rows }: MissedStepsCardProps) {
  const top = rows.slice(0, 7);
  const maxN = Math.max(1, ...top.map(r => r.count));

  return (
    <View style={styles.card} accessibilityLabel="Commonly Missed Required Steps">
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Commonly Missed Required Steps</Text>
          <Text style={styles.sub}>Tasks left unchecked when a shift was saved incomplete</Text>
        </View>
        <Text style={styles.eyebrow}>{rows.length} unique</Text>
      </View>

      {top.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIco}>✅</Text>
          <Text style={styles.emptyTitle}>Nothing missed this period</Text>
          <Text style={styles.emptyBody}>Every saved shift had all required tasks checked.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {top.map((r, i) => (
            <View key={r.id} style={[styles.row, i === 0 && styles.rowFirst]} accessibilityLabel={`Rank ${i + 1}: ${r.text}, missed ${r.count} times`}>
              <Text style={styles.rank}>{String(i + 1).padStart(2, '0')}</Text>
              <View style={styles.rowMid}>
                <Text style={styles.rowText} numberOfLines={2}>{r.text}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.sectionChip}>
                    <Text style={styles.sectionChipText}>{r.section}</Text>
                  </View>
                  <Text style={styles.metaExtra}>· {r.checklistName}</Text>
                </View>
              </View>
              <View style={styles.rowRight}>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${(r.count / maxN) * 100}%` as `${number}%` }]} />
                </View>
                <Text style={styles.countText}>{r.count}× missed</Text>
              </View>
            </View>
          ))}
        </View>
      )}
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
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#1A1A1A', flex: 1 },
  sub: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#888888', marginTop: 2 },
  eyebrow: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#888888',
    textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0,
  },
  list: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  rowFirst: { borderTopWidth: 0 },
  rank: {
    fontSize: 13, fontFamily: 'Inter_700Bold', color: '#888888',
    fontVariant: ['tabular-nums'], width: 24, flexShrink: 0,
  },
  rowMid: { flex: 1, gap: 4 },
  rowText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1A1A1A', lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionChip: {
    backgroundColor: '#FFF0F2', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  sectionChipText: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: '#C8102E',
    textTransform: 'uppercase', letterSpacing: 0.2,
  },
  metaExtra: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#888888' },
  rowRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0, minWidth: 100 },
  bar: {
    width: 100, height: 8, backgroundColor: '#F0F0F0', borderRadius: 4, overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: '#EF4444', borderRadius: 4 },
  countText: {
    fontSize: 12, fontFamily: 'Inter_700Bold', color: '#EF4444',
    fontVariant: ['tabular-nums'],
  },
  empty: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyIco: { fontSize: 28 },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#1A1A1A' },
  emptyBody: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#888888', textAlign: 'center' },
});
