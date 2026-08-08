import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Divider, SegmentedButtons } from 'react-native-paper';

import shape from '@/constants/shape';
import { useMd } from '@/theme/useMd';
import { MultiDonutChart } from './MultiDonutChart';
import { Counts, DeltaResult } from './types';

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
  const md = useMd();
  const [showPct, setShowPct] = useState(false);
  const { completed, late, incomplete, missed, total } = current;

  const segments = [
    { value: completed, color: md.primary },
    { value: late, color: md.tertiary },
    { value: incomplete, color: md.secondary },
    { value: missed, color: md.error },
  ];

  const pct = (v: number) => total > 0 ? `${Math.round(v / total * 100)}%` : '0%';

  const rows: LegendRow[] = [
    { color: md.primary, name: 'Completed', meta: 'All required tasks done', val: completed, prevVal: prev.completed, polarity: 1 },
    { color: md.tertiary, name: 'Late', meta: 'Completed past shift window', val: late, prevVal: prev.late, polarity: -1 },
    { color: md.secondary, name: 'Incomplete', meta: 'Saved with tasks unchecked', val: incomplete, prevVal: prev.incomplete, polarity: -1 },
    { color: md.error, name: 'Missed', meta: 'Shift never logged', val: missed, prevVal: prev.missed, polarity: -1 },
  ];

  const prevTotal = (prev.completed || 0) + (prev.late || 0) + (prev.incomplete || 0) + (prev.missed || 0);
  const compRate = total > 0 ? completed / total : 0;
  const prevRate = prevTotal > 0 ? prev.completed / prevTotal : 0;
  const overallD = calcDelta(compRate * 100, prevRate * 100, compare);

  return (
    <View
      style={[styles.card, { backgroundColor: md.surfaceContainerHigh, borderRadius: shape.lg }]}
      accessibilityLabel="Shift Breakdown"
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={[styles.cardTitle, { color: md.onSurface }]}>Shift Breakdown</Text>
          <View style={styles.subRow}>
            <Text style={[styles.cardSub, { color: md.onSurfaceVariant }]}>This {period}</Text>
            {overallD && overallD.kind !== 'flat' && (
              <View
                style={[
                  styles.overallBadge,
                  { borderRadius: shape.xs },
                  overallD.kind === 'up' ? { backgroundColor: md.successContainer } : { backgroundColor: md.errorContainer },
                ]}
              >
                <Text
                  style={[
                    styles.overallBadgeText,
                    overallD.kind === 'up' ? { color: md.onSuccessContainer } : { color: md.onErrorContainer },
                  ]}
                >
                  {overallD.kind === 'up' ? '↑' : '↓'} {overallD.text} overall
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.cardHeaderRight}>
          <View style={styles.segmented}>
            <SegmentedButtons
              value={showPct ? 'pct' : 'count'}
              onValueChange={(v) => setShowPct(v === 'pct')}
              density="small"
              buttons={[
                { value: 'count', label: '#', accessibilityLabel: 'Show count' },
                { value: 'pct', label: '%', accessibilityLabel: 'Show percentage' },
              ]}
            />
          </View>
          <Text style={[styles.eyebrow, { color: md.onSurfaceVariant }]}>{total} shifts</Text>
        </View>
      </View>

      <View style={styles.body}>
        <MultiDonutChart segments={segments} size={150} stroke={18} />
        <View style={styles.legend}>
          {rows.map((row, i) => {
            const d = calcDelta(row.val, row.prevVal, compare);
            const good = d && ((d.kind === 'up' && row.polarity > 0) || (d.kind === 'down' && row.polarity < 0));
            const bad = d && ((d.kind === 'up' && row.polarity < 0) || (d.kind === 'down' && row.polarity > 0));
            const arrow = d ? (d.kind === 'up' ? '↑' : d.kind === 'down' ? '↓' : '') : '';
            const displayVal = showPct ? pct(row.val) : String(row.val);

            return (
              <React.Fragment key={row.name}>
              {i > 0 && <Divider style={{ backgroundColor: md.outlineVariant }} />}
              <View style={styles.legendRow} accessibilityLabel={`${row.name}: ${displayVal}`}>
                {/* Color swatch — LEFT edge, always aligned */}
                <View style={[styles.swatch, { backgroundColor: row.color, borderRadius: shape.xs }]} />
                {/* Name + meta — middle, flex */}
                <View style={styles.labelBlock}>
                  <Text style={[styles.legendName, { color: md.onSurface }]}>{row.name}</Text>
                  <Text style={[styles.legendMeta, { color: md.onSurfaceVariant }]} numberOfLines={1}>{row.meta}</Text>
                </View>
                {/* Value + delta — right */}
                <View style={styles.valBlock}>
                  <View style={styles.valRow}>
                    <Text style={[styles.valText, { color: md.onSurface }]}>{displayVal}</Text>
                    {d && (
                      <View
                        style={[
                          styles.deltaPill,
                          { borderRadius: shape.full },
                          good ? { backgroundColor: md.successContainer } : bad ? { backgroundColor: md.errorContainer } : { backgroundColor: md.surfaceContainerHighest },
                        ]}
                      >
                        <Text
                          style={[
                            styles.deltaPillText,
                            good ? { color: md.onSuccessContainer } : bad ? { color: md.onErrorContainer } : { color: md.onSurfaceVariant },
                          ]}
                        >{arrow}{d.text}</Text>
                      </View>
                    )}
                  </View>
                  {compare && d && (
                    <Text style={[styles.wasText, { color: md.onSurfaceVariant }]}>was {showPct ? pct(row.prevVal) : row.prevVal}</Text>
                  )}
                </View>
              </View>
              </React.Fragment>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
  cardTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: -0.1 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardSub: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  overallBadge: {
    paddingHorizontal: 7, paddingVertical: 2,
  },
  overallBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  segmented: {
    minWidth: 90,
  },
  eyebrow: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold',
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
    maxWidth: 300,
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
    flexShrink: 0,
  },
  // MIDDLE: name + meta — flex:1 so value aligns to a consistent right edge
  labelBlock: {
    flex: 1,
    gap: 2,
  },
  legendName: {
    fontSize: 13, fontFamily: 'Inter_600SemiBold',
  },
  legendMeta: {
    fontSize: 10, fontFamily: 'Inter_500Medium',
  },
  // RIGHT: value + delta pill
  valBlock: {
    alignItems: 'flex-start',
    gap: 2,
    flexShrink: 0,
  },
  valRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  valText: {
    fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  deltaPill: {
    paddingHorizontal: 5, paddingVertical: 2,
  },
  deltaPillText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  wasText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
});
