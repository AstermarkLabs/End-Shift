import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Chip } from 'react-native-paper';

import shape from '@/constants/shape';
import { useMd } from '@/theme/useMd';
import { DashRun, RunOutcome } from './types';
import { fmtDate, fmtTime, timeAgo } from './dashUtils';

interface HistoryCardProps {
  run: DashRun;
}

export function HistoryCard({ run }: HistoryCardProps) {
  const md = useMd();
  const [expanded, setExpanded] = useState(false);
  const date = new Date(run.dateISO);
  const isMissed = run.outcome === 'missed';
  const isIncomplete = run.outcome === 'incomplete';

  const OUTCOME_ACCENT: Record<RunOutcome, string> = {
    completed: md.primary,
    late: md.tertiary,
    incomplete: md.secondary,
    missed: md.error,
  };

  const OUTCOME_BADGE_STYLE: Record<RunOutcome, { bg: string; color: string }> = {
    completed: { bg: md.primaryContainer, color: md.onPrimaryContainer },
    late: { bg: md.surfaceContainerHighest, color: md.tertiary },
    incomplete: { bg: md.surfaceContainerHighest, color: md.onSurfaceVariant },
    missed: { bg: md.errorContainer, color: md.onErrorContainer },
  };

  const borderColor = run.outcome === 'late' || run.outcome === 'missed' || run.outcome === 'incomplete'
    ? OUTCOME_ACCENT[run.outcome]
    : undefined;
  const badge = OUTCOME_BADGE_STYLE[run.outcome] ?? { bg: md.surfaceContainerHighest, color: md.onSurfaceVariant };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: md.surfaceContainerHigh, borderRadius: shape.lg },
        borderColor ? { borderLeftColor: borderColor, borderLeftWidth: 3 } : undefined,
      ]}
      accessibilityRole="none"
      accessibilityLabel={`${run.checklistName}, ${run.outcome}, ${fmtDate(date)}`}
    >
      <View style={[styles.head, borderColor && styles.headIndented]}>
        <View style={styles.headLeft}>
          <View style={[styles.nameBadge, { backgroundColor: md.primaryContainer, borderRadius: shape.sm }]}>
            <Text style={[styles.nameBadgeText, { color: md.onPrimaryContainer }]}>{run.checklistName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderRadius: shape.full }]}>
            <Text style={[styles.statusText, { color: badge.color }]}>{run.outcome}</Text>
          </View>
        </View>
        <Text style={[styles.timeAgo, { color: md.onSurfaceVariant }]}>{isMissed ? 'no run logged' : timeAgo(run.dateISO)}</Text>
      </View>

      <Text style={[styles.dateText, { color: md.onSurfaceVariant }, borderColor && styles.headIndented]}>
        {fmtDate(date)}{!isMissed && ` • ${fmtTime(date)}`}
      </Text>

      {!isMissed && (
        <>
          <View style={[styles.stats, borderColor && styles.headIndented]}>
            <View style={[styles.statChip, { backgroundColor: md.surfaceContainerHighest, borderRadius: shape.sm }]}>
              <Text style={[styles.statN, { color: md.onSurface }]}>{run.tasksDone}/{run.tasksTotal}</Text>
              <Text style={[styles.statL, { color: md.onSurfaceVariant }]}>tasks</Text>
            </View>
            <View
              style={[
                styles.statChip,
                { borderRadius: shape.sm },
                isIncomplete ? { backgroundColor: md.errorContainer } : { backgroundColor: md.primaryContainer },
              ]}
            >
              <Text style={[styles.statN, { color: isIncomplete ? md.onErrorContainer : md.onPrimaryContainer }]}>
                {run.requiredDone}/{run.requiredTotal}
              </Text>
              <Text style={[styles.statL, { color: isIncomplete ? md.onErrorContainer : md.onPrimaryContainer }]}>required</Text>
            </View>
            {run.missedRequired.length > 0 && (
              <View style={[styles.statChip, { backgroundColor: md.errorContainer, borderRadius: shape.sm }]}>
                <Text style={[styles.statN, { color: md.onErrorContainer }]}>{run.missedRequired.length}</Text>
                <Text style={[styles.statL, { color: md.onErrorContainer }]}>missed</Text>
              </View>
            )}
          </View>
          <View style={[styles.track, { backgroundColor: md.outlineVariant }, borderColor && styles.trackIndented]}>
            <View style={[
              styles.trackFill,
              { width: `${(run.requiredDone / Math.max(run.requiredTotal, 1)) * 100}%` as `${number}%`,
                backgroundColor: OUTCOME_ACCENT[run.outcome] ?? md.primary }
            ]} />
          </View>
          {run.missedRequired.length > 0 && (
            <Pressable
              onPress={() => setExpanded(v => !v)}
              style={[styles.expandBtn, { borderTopColor: md.outlineVariant }]}
              accessibilityRole="button"
              accessibilityLabel={expanded ? 'Hide missed steps' : 'Show missed steps'}
            >
              <Text style={[styles.expandBtnText, { color: md.primary }]}>
                {expanded ? 'Hide Missed Steps ▲' : 'Show Missed Steps ▼'}
              </Text>
            </Pressable>
          )}
          {expanded && run.missedRequired.length > 0 && (
            <View style={styles.missedList}>
              {run.missedRequired.map(m => (
                <View key={m.id} style={styles.missedItem}>
                  <Text style={[styles.missedX, { color: md.error }]}>✕</Text>
                  <View style={styles.missedInfo}>
                    <Text style={[styles.missedText, { color: md.error }]}>{m.text}</Text>
                    <Text style={[styles.missedSection, { color: md.onSurfaceVariant }]}>{m.section}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {isMissed && (
        <View style={[styles.missedBanner, { backgroundColor: md.errorContainer, borderRadius: shape.sm }, borderColor && styles.headIndented]}>
          <View style={[styles.missedBannerPill, { backgroundColor: md.error, borderRadius: shape.full }]}>
            <Text style={[styles.missedBannerPillText, { color: md.onError }]}>!</Text>
          </View>
          <Text style={[styles.missedBannerText, { color: md.onErrorContainer }]}>
            No close was logged. {run.requiredTotal} required tasks expected.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 10, paddingBottom: 4, gap: 8, flexWrap: 'wrap',
  },
  headIndented: { paddingLeft: 11 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  nameBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
  },
  nameBadgeText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
  },
  statusText: {
    fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase',
  },
  timeAgo: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  dateText: {
    paddingHorizontal: 10, paddingBottom: 8,
    fontSize: 12, fontFamily: 'Inter_400Regular',
  },
  stats: {
    flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingBottom: 8, flexWrap: 'wrap',
  },
  statChip: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  statN: { fontSize: 13, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
  statL: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  track: {
    height: 4, marginHorizontal: 10, marginBottom: 2, borderRadius: 2, overflow: 'hidden',
  },
  trackIndented: { marginLeft: 11 },
  trackFill: { height: '100%', borderRadius: 2 },
  expandBtn: {
    paddingVertical: 10, paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 6, alignItems: 'center',
  },
  expandBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  missedList: { paddingHorizontal: 14, paddingBottom: 10, gap: 6 },
  missedItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  missedX: {
    fontSize: 12, fontFamily: 'Inter_700Bold',
    width: 16, height: 16, textAlign: 'center', lineHeight: 16,
  },
  missedInfo: { flex: 1 },
  missedText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', lineHeight: 18 },
  missedSection: { fontSize: 11, fontFamily: 'Inter_500Medium', marginTop: 1 },
  missedBanner: {
    margin: 10, marginTop: 0, padding: 8,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  missedBannerPill: {
    paddingHorizontal: 6, paddingVertical: 1,
  },
  missedBannerPillText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  missedBannerText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', flex: 1, lineHeight: 16 },
});
