import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MultiDonutChart } from './MultiDonutChart';
import { Counts, DeltaResult } from './types';
import { deltaPct } from './dashUtils';

interface BreakdownCardProps {
  current: Counts;
  prev: Counts;
  compare: boolean;
  period: string;
}

interface LegendRow {
  color: string;
  name: string;
  meta: string;
  val: number;
  prevVal: number;
  polarity: 1 | -1;
}

function calcDelta(cur: number, prv: number, compare: boolean): DeltaResult | null {
  if (!compare) return null;
  if (prv === 0 && cur === 0) return null;
  if (prv === 0) return { kind: 'up', text: 'new', raw: 100 };
  const d = ((cur - prv) / prv) * 100;
  if (Math.abs(d) < 0.5) return { kind: 'flat', text: '—', raw: 0 };
  return { kind: d > 0 ? 'up' : 'down', text: `${Math.abs(Math.round(d))}%`, raw: d };
}

export function BreakdownCard({ current, prev, compare, period }: BreakdownCardProps) {
  const [showPct, setShowPct] = useState(false);
  const { completed, late, incomplete, missed, total } = current;

  const segments = [
    { value: completed, color: '#16A34A' },
    { value: late,       color: '#2196F3' },
    { value: incomplete, color: '#FF9800' },
    { value: missed,     color: '#EF4444' },
  ];

  const pct = (v: number) => total > 0 ? `${Math.round(v / total * 100)}%` : '0%';

  const rows: LegendRow[] = [
    { color: '#16A34A', name: 'Completed',  meta: 'All required tasks done',        val: completed,  prevVal: prev.completed,  polarity:  1 },
    { color: '#2196F3', name: 'Late',       meta: 'Completed past shift window',    val: late,       prevVal: prev.late,       polarity: -1 },
    { color: '#FF9800', name: 'Incomplete', meta: 'Saved with tasks unchecked',     val: incomplete, prevVal: prev.incomplete, polarity: -1 },
    { color: '#EF4444', name: 'Missed',     meta: 'Shift never logged',             val: missed,     prevVal: prev.missed,     polarity: -1 },
  ];

  const prevTotal = (prev.completed || 0) + (prev.late || 0) + (prev.incomplete || 0) + (prev.missed || 0);
  const compRate  = total     > 0 ? completed      / total     : 0;
  const prevRate  = prevTotal > 0 ? prev.completed / prevTotal : 0;
  const overallD  = calcDelta(compRate * 100, prevRate * 100, compare);

  return (
    <View style={styles.card} accessibilityLabel="Shift Breakdown">
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardTitle}>Shift Breakdown</Text>
          <View style={styles.subRow}>
            <Text style={styles.cardSub}>This {period}</Text>
            {overallD && overallD.kind !== 'flat' && (
              <View style={[styles.overallBadge, overallD.kind === 'up' ? styles.overallBadgeGood : styles.overallBadgeBad]}>
                <Text style={[styles.overallBadgeText, overallD.kind === 'up' ? styles.overallBadgeTextGood : styles.overallBadgeTextBad]}>
                  {overallD.kind === 'up' ? '↑' : '↓'} {overallD.text} overall
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.cardHeaderRight}>
          <View style={styles.segmented}>
            <Pressable
              onPress={() => setShowPct(false)}
              style={[styles.segBtn, !showPct && styles.segBtnActive]}
              accessibilityRole="button"
              accessibilityLabel="Show count"
              accessibilityState={{ selected: !showPct }}
            >
              <Text style={[styles.segBtnText, !showPct && styles.segBtnTextActive]}>#</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowPct(true)}
              style={[styles.segBtn, showPct && styles.segBtnActive]}
              accessibilityRole="button"
              accessibilityLabel="Show percentage"
              accessibilityState={{ selected: showPct }}
            >
              <Text style={[styles.segBtnText, showPct && styles.segBtnTextActive]}>%</Text>
            </Pressable>
          </View>
          <Text style={styles.eyebrow}>{total} shifts</Text>
        </View>
      </View>

      <View style={styles.body}>
        <MultiDonutChart segments={segments} size={150} stroke={18} />
        <View style={styles.legend}>
          {rows.map(row => {
            const d = calcDelta(row.val, row.prevVal, compare);
            const good = d && ((d.kind === 'up' && row.polarity > 0) || (d.kind === 'down' && row.polarity < 0));
            const bad  = d && ((d.kind === 'up' && row.polarity < 0) || (d.kind === 'down' && row.polarity > 0));
            const arrow = d ? (d.kind === 'up' ? '↑' : d.kind === 'down' ? '↓' : '') : '';
            const displayVal = showPct ? pct(row.val) : String(row.val);

            return (
              <View key={row.name} style={styles.legendRow} accessibilityLabel={`${row.name}: ${displayVal}`}>
                {/* Color swatch — LEFT edge, always aligned */}
                <View style={[styles.swatch, { backgroundColor: row.color }]} />
                {/* Name + meta — middle, flex */}
                <View style={styles.labelBlock}>
                  <Text style={styles.legendName}>{row.name}</Text>
                  <Text style={styles.legendMeta} numberOfLines={1}>{row.meta}</Text>
                </View>
                {/* Value + delta — right */}
                <View style={styles.valBlock}>
                  <View style={styles.valRow}>
                    <Text style={styles.valText}>{displayVal}</Text>
                    {d && (
                      <View style={[
                        styles.deltaPill,
                        good ? styles.deltaPillGood : bad ? styles.deltaPillBad : styles.deltaPillFlat,
                      ]}>
                        <Text style={[
                          styles.deltaPillText,
                          good ? styles.deltaPillTextGood : bad ? styles.deltaPillTextBad : styles.deltaPillTextFlat,
                        ]}>{arrow}{d.text}</Text>
                      </View>
                    )}
                  </View>
                  {compare && d && (
                    <Text style={styles.wasText}>was {showPct ? pct(row.prevVal) : row.prevVal}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  cardHeaderLeft: { flex: 1, gap: 4 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#1A1A1A', letterSpacing: -0.1 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardSub: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#888888' },
  overallBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4,
  },
  overallBadgeGood: { backgroundColor: 'rgba(22,163,74,0.12)' },
  overallBadgeBad: { backgroundColor: 'rgba(239,68,68,0.10)' },
  overallBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  overallBadgeTextGood: { color: '#16A34A' },
  overallBadgeTextBad: { color: '#EF4444' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 2,
  },
  segBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
  },
  segBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#888888' },
  segBtnTextActive: { color: '#C8102E' },
  eyebrow: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#888888',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  legend: {
    flex: 1,
    minWidth: 200,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // LEFT: color swatch — fixed width, always the left edge
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    flexShrink: 0,
  },
  // MIDDLE: name + meta
  labelBlock: {
    flex: 1,
    gap: 2,
  },
  legendName: {
    fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#1A1A1A',
  },
  legendMeta: {
    fontSize: 10, fontFamily: 'Inter_500Medium', color: '#888888',
  },
  // RIGHT: value + delta pill
  valBlock: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
    minWidth: 64,
  },
  valRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  valText: {
    fontSize: 18, fontFamily: 'Inter_700Bold', color: '#1A1A1A', letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  deltaPill: {
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 9999,
  },
  deltaPillGood: { backgroundColor: 'rgba(22,163,74,0.10)' },
  deltaPillBad: { backgroundColor: 'rgba(239,68,68,0.10)' },
  deltaPillFlat: { backgroundColor: 'rgba(0,0,0,0.05)' },
  deltaPillText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  deltaPillTextGood: { color: '#16A34A' },
  deltaPillTextBad: { color: '#EF4444' },
  deltaPillTextFlat: { color: '#888888' },
  wasText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#888888' },
});
