import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DashRun, OUTCOME_COLORS } from './types';
import { fmtDate, fmtTime, timeAgo } from './dashUtils';

interface HistoryCardProps {
  run: DashRun;
}

const OUTCOME_BORDER: Record<string, string> = {
  late: '#2196F3',
  missed: '#EF4444',
  incomplete: '#FF9800',
};

const OUTCOME_BADGE_STYLE: Record<string, { bg: string; color: string }> = {
  completed:  { bg: '#DCFCE7', color: '#16A34A' },
  late:       { bg: 'rgba(33,150,243,0.12)', color: '#1976D2' },
  incomplete: { bg: 'rgba(255,152,0,0.14)',  color: '#C2660A' },
  missed:     { bg: 'rgba(239,68,68,0.10)',  color: '#EF4444' },
};

const TRACK_COLOR: Record<string, string> = {
  completed:  '#16A34A',
  late:       '#2196F3',
  incomplete: '#FF9800',
  missed:     '#EF4444',
};

export function HistoryCard({ run }: HistoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(run.dateISO);
  const isMissed = run.outcome === 'missed';
  const isIncomplete = run.outcome === 'incomplete';
  const borderColor = OUTCOME_BORDER[run.outcome];
  const badge = OUTCOME_BADGE_STYLE[run.outcome] ?? { bg: '#F0F0F0', color: '#888' };

  return (
    <View
      style={[styles.card, borderColor ? { borderLeftColor: borderColor, borderLeftWidth: 3 } : undefined]}
      accessibilityRole="none"
      accessibilityLabel={`${run.checklistName}, ${run.outcome}, ${fmtDate(date)}`}
    >
      <View style={[styles.head, borderColor && styles.headIndented]}>
        <View style={styles.headLeft}>
          <View style={styles.nameBadge}>
            <Text style={styles.nameBadgeText}>{run.checklistName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusText, { color: badge.color }]}>{run.outcome}</Text>
          </View>
        </View>
        <Text style={styles.timeAgo}>{isMissed ? 'no run logged' : timeAgo(run.dateISO)}</Text>
      </View>

      <Text style={[styles.dateText, borderColor && styles.headIndented]}>
        {fmtDate(date)}{!isMissed && ` • ${fmtTime(date)}`}
      </Text>

      {!isMissed && (
        <>
          <View style={[styles.stats, borderColor && styles.headIndented]}>
            <View style={styles.statChip}>
              <Text style={styles.statN}>{run.tasksDone}/{run.tasksTotal}</Text>
              <Text style={styles.statL}>tasks</Text>
            </View>
            <View style={[styles.statChip, isIncomplete ? styles.statWarn : styles.statReq]}>
              <Text style={[styles.statN, isIncomplete ? styles.statNWarn : styles.statNReq]}>
                {run.requiredDone}/{run.requiredTotal}
              </Text>
              <Text style={[styles.statL, isIncomplete ? styles.statLWarn : styles.statLReq]}>required</Text>
            </View>
            {run.missedRequired.length > 0 && (
              <View style={[styles.statChip, styles.statWarn]}>
                <Text style={[styles.statN, styles.statNWarn]}>{run.missedRequired.length}</Text>
                <Text style={[styles.statL, styles.statLWarn]}>missed</Text>
              </View>
            )}
          </View>
          <View style={[styles.track, borderColor && styles.trackIndented]}>
            <View style={[
              styles.trackFill,
              { width: `${(run.requiredDone / Math.max(run.requiredTotal, 1)) * 100}%` as `${number}%`,
                backgroundColor: TRACK_COLOR[run.outcome] ?? '#C8102E' }
            ]} />
          </View>
          {run.missedRequired.length > 0 && (
            <Pressable
              onPress={() => setExpanded(v => !v)}
              style={styles.expandBtn}
              accessibilityRole="button"
              accessibilityLabel={expanded ? 'Hide missed steps' : 'Show missed steps'}
            >
              <Text style={styles.expandBtnText}>
                {expanded ? 'Hide Missed Steps ▲' : 'Show Missed Steps ▼'}
              </Text>
            </Pressable>
          )}
          {expanded && run.missedRequired.length > 0 && (
            <View style={styles.missedList}>
              {run.missedRequired.map(m => (
                <View key={m.id} style={styles.missedItem}>
                  <Text style={styles.missedX}>✕</Text>
                  <View style={styles.missedInfo}>
                    <Text style={styles.missedText}>{m.text}</Text>
                    <Text style={styles.missedSection}>{m.section}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {isMissed && (
        <View style={[styles.missedBanner, borderColor && styles.headIndented]}>
          <View style={styles.missedBannerPill}>
            <Text style={styles.missedBannerPillText}>!</Text>
          </View>
          <Text style={styles.missedBannerText}>
            No close was logged. {run.requiredTotal} required tasks expected.
          </Text>
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
    borderRadius: 14,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 10, paddingBottom: 4, gap: 8, flexWrap: 'wrap',
  },
  headIndented: { paddingLeft: 11 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  nameBadge: {
    backgroundColor: '#FFF0F2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
  },
  nameBadgeText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#C8102E' },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999,
  },
  statusText: {
    fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase',
  },
  timeAgo: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#888888' },
  dateText: {
    paddingHorizontal: 10, paddingBottom: 8,
    fontSize: 12, fontFamily: 'Inter_400Regular', color: '#888888',
  },
  stats: {
    flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingBottom: 8, flexWrap: 'wrap',
  },
  statChip: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  statReq: { backgroundColor: '#FFF0F2' },
  statWarn: { backgroundColor: 'rgba(255,152,0,0.12)' },
  statN: { fontSize: 13, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'], color: '#1A1A1A' },
  statNReq: { color: '#C8102E' },
  statNWarn: { color: '#C2660A' },
  statL: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#888888' },
  statLReq: { color: '#C8102E' },
  statLWarn: { color: '#C2660A' },
  track: {
    height: 4, backgroundColor: '#E5E5E5', marginHorizontal: 10, marginBottom: 2, borderRadius: 2, overflow: 'hidden',
  },
  trackIndented: { marginLeft: 11 },
  trackFill: { height: '100%', borderRadius: 2 },
  expandBtn: {
    paddingVertical: 10, paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.08)',
    marginTop: 6, alignItems: 'center',
  },
  expandBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#C8102E' },
  missedList: { paddingHorizontal: 14, paddingBottom: 10, gap: 6 },
  missedItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  missedX: {
    fontSize: 12, fontFamily: 'Inter_700Bold', color: '#EF4444',
    width: 16, height: 16, textAlign: 'center', lineHeight: 16,
  },
  missedInfo: { flex: 1 },
  missedText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#EF4444', lineHeight: 18 },
  missedSection: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#888888', marginTop: 1 },
  missedBanner: {
    margin: 10, marginTop: 0, padding: 8, borderRadius: 6,
    backgroundColor: 'rgba(239,68,68,0.06)',
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  missedBannerPill: {
    backgroundColor: '#EF4444', borderRadius: 9999, paddingHorizontal: 6, paddingVertical: 1,
  },
  missedBannerPillText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  missedBannerText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#EF4444', flex: 1, lineHeight: 16 },
});
