import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Divider } from 'react-native-paper';

import shape from '@/constants/shape';
import { useMd } from '@/theme/useMd';
import { MissedStep } from './types';

interface MissedStepsCardProps {
  rows: MissedStep[];
}

export function MissedStepsCard({ rows }: MissedStepsCardProps) {
  const md = useMd();
  const top = rows.slice(0, 7);
  const maxN = Math.max(1, ...top.map(r => r.count));

  return (
    <View
      style={[styles.card, { backgroundColor: md.surfaceContainerHigh, borderRadius: shape.lg }]}
      accessibilityLabel="Commonly Missed Required Steps"
    >
      <View style={styles.header}>
        {/* flex:1 on this wrapper prevents the count from being pushed off-screen */}
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: md.onSurface }]}>Commonly Missed Required Steps</Text>
          <Text style={[styles.sub, { color: md.onSurfaceVariant }]}>Tasks left unchecked when a shift was saved incomplete</Text>
        </View>
        <Text style={[styles.eyebrow, { color: md.onSurfaceVariant }]}>{rows.length} unique</Text>
      </View>

      {top.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIco}>✅</Text>
          <Text style={[styles.emptyTitle, { color: md.onSurface }]}>Nothing missed this period</Text>
          <Text style={[styles.emptyBody, { color: md.onSurfaceVariant }]}>Every saved shift had all required tasks checked.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          {top.map((r, i) => (
            <React.Fragment key={r.id}>
            {i > 0 && <Divider style={{ backgroundColor: md.outlineVariant }} />}
            <View
              style={styles.row}
              accessibilityLabel={`Rank ${i + 1}: ${r.text}, missed ${r.count} times`}
            >
              <Text style={[styles.rank, { color: md.onSurfaceVariant }]}>{String(i + 1).padStart(2, '0')}</Text>
              <View style={styles.rowMid}>
                <Text style={[styles.rowText, { color: md.onSurface }]} numberOfLines={2}>{r.text}</Text>
                <View style={styles.metaRow}>
                  <View style={[styles.sectionChip, { backgroundColor: md.errorContainer, borderRadius: shape.sm }]}>
                    <Text style={[styles.sectionChipText, { color: md.onErrorContainer }]}>{r.section}</Text>
                  </View>
                  <Text style={[styles.metaExtra, { color: md.onSurfaceVariant }]}>· {r.checklistName}</Text>
                </View>
              </View>
              <View style={styles.rowRight}>
                <View style={[styles.bar, { backgroundColor: md.surfaceContainerHighest, borderRadius: shape.xs }]}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${(r.count / maxN) * 100}%` as `${number}%`, backgroundColor: md.error, borderRadius: shape.xs },
                    ]}
                  />
                </View>
                <Text style={[styles.countText, { color: md.error }]}>{r.count}× missed</Text>
              </View>
            </View>
            </React.Fragment>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 480,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: { flex: 1 },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  eyebrow: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0,
  },
  scroll: { flex: 1 },
  list: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rank: {
    fontSize: 13, fontFamily: 'Inter_700Bold',
    fontVariant: ['tabular-nums'], width: 24, flexShrink: 0,
  },
  rowMid: { flex: 1, gap: 4 },
  rowText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionChip: {
    paddingHorizontal: 7, paddingVertical: 2,
  },
  sectionChipText: {
    fontSize: 10, fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase', letterSpacing: 0.2,
  },
  metaExtra: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  rowRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0, minWidth: 100 },
  bar: {
    width: 100, height: 8, overflow: 'hidden',
  },
  barFill: { height: '100%' },
  countText: {
    fontSize: 12, fontFamily: 'Inter_700Bold',
    fontVariant: ['tabular-nums'],
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyIco: { fontSize: 28 },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  emptyBody: { fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
