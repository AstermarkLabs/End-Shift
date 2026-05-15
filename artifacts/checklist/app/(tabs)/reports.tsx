import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useChecklist } from '@/context/ChecklistContext';
import { useColors } from '@/hooks/useColors';
import { generateMockHistory } from '@/utils/mockData';

import { BreakdownCard } from '@/components/dashboard/BreakdownCard';
import { MissedStepsCard } from '@/components/dashboard/MissedStepsCard';
import { HistoryCard } from '@/components/dashboard/HistoryCard';
import {
  computeMissedSteps,
  counts,
  fmtRange,
  historyToDashRuns,
  prevWindow,
  runsIn,
  shiftWindow,
  windowFor,
} from '@/components/dashboard/dashUtils';
import { DashRun, PERIOD_DAYS, Period } from '@/components/dashboard/types';

// ── Period labels ─────────────────────────────────────────────────────────────

const PERIOD_META: Record<Period, { btn: string; word: string }> = {
  day:    { btn: 'Day',    word: 'day'    },
  week:   { btn: 'Week',   word: 'week'   },
  period: { btn: 'Period', word: 'period' },
  month:  { btn: 'Month',  word: 'month'  },
};

// ── History filter ────────────────────────────────────────────────────────────

type HistoryFilter = 'all' | 'completed' | 'late' | 'incomplete' | 'missed';
const HISTORY_FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all',        label: 'All'        },
  { id: 'completed',  label: 'Completed'  },
  { id: 'late',       label: 'Late'       },
  { id: 'incomplete', label: 'Incomplete' },
  { id: 'missed',     label: 'Missed'     },
];

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { completionHistory, checklists, seedHistory, clearHistory } = useChecklist();

  const [period, setPeriod] = useState<Period>('period');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [compare, setCompare] = useState(true);
  const [checklistId, setChecklistId] = useState<string>('all');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [checklistPickerOpen, setChecklistPickerOpen] = useState(false);

  const isWeb = Platform.OS === 'web';
  const isWide = width >= 900;

  // ── Derived runs ────────────────────────────────────────────────────────────

  const allRuns: DashRun[] = useMemo(
    () => historyToDashRuns(completionHistory),
    [completionHistory]
  );

  const win = useMemo(
    () => windowFor(anchor, period, PERIOD_DAYS),
    [anchor, period]
  );
  const winPrev = useMemo(() => prevWindow(win), [win]);

  const currentRuns = useMemo(
    () => runsIn(allRuns, win, checklistId),
    [allRuns, win, checklistId]
  );
  const prevRuns = useMemo(
    () => runsIn(allRuns, winPrev, checklistId),
    [allRuns, winPrev, checklistId]
  );

  const cCounts = useMemo(() => counts(currentRuns), [currentRuns]);
  const pCounts = useMemo(() => counts(prevRuns), [prevRuns]);

  const missedSteps = useMemo(
    () => computeMissedSteps(currentRuns),
    [currentRuns]
  );

  const historyItems = useMemo(() => {
    return currentRuns
      .filter(r => historyFilter === 'all' ? true : r.outcome === historyFilter)
      .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
  }, [currentRuns, historyFilter]);

  // ── Nav helpers ──────────────────────────────────────────────────────────────

  const canGoNext = win.end < new Date();
  const rangeLabel = fmtRange(win.start, win.end);

  function goBack() {
    setAnchor(prev => shiftWindow(prev, period, -1, PERIOD_DAYS));
  }
  function goNext() {
    if (!canGoNext) return;
    setAnchor(prev => shiftWindow(prev, period, 1, PERIOD_DAYS));
  }
  function goToday() {
    setAnchor(new Date());
  }

  return (
    <View style={[styles.root, { backgroundColor: '#F5F5F5' }]}>
      <StatusBar barStyle="light-content" />

      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.topbar,
          { backgroundColor: colors.primary, paddingTop: insets.top + 8 },
        ]}
        accessibilityRole="header"
      >
        <View style={styles.topbarInner}>
          <View style={styles.brand}>
            <Text style={styles.brandIcon}>🕐</Text>
            <Text style={styles.brandName}>End Shift</Text>
          </View>
          <View style={styles.brandSep} />
          <Text style={styles.crumb}>Shift Reports</Text>
          <View style={styles.topbarSpacer} />
          {!isWeb && (
            <Pressable
              onPress={() => router.back()}
              style={styles.topbarBtn}
              accessibilityRole="button"
              accessibilityLabel="Back to checklist"
            >
              <Text style={styles.topbarBtnText}>← Back</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Sub-nav ───────────────────────────────────────────────────────── */}
      <View style={styles.subnav} accessibilityRole="none" accessibilityLabel="Report controls">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subnavInner}
        >
          {/* Period segmented control */}
          <View style={styles.segmented} accessibilityRole="tablist" accessibilityLabel="Reporting period">
            {(['day', 'week', 'period', 'month'] as Period[]).map(p => (
              <Pressable
                key={p}
                onPress={() => { setPeriod(p); setAnchor(new Date()); }}
                style={[styles.segBtn, p === period && styles.segBtnActive]}
                accessibilityRole="tab"
                accessibilityLabel={PERIOD_META[p].btn}
                accessibilityState={{ selected: p === period }}
              >
                <Text style={[styles.segBtnText, p === period && styles.segBtnTextActive]}>
                  {PERIOD_META[p].btn}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Range nav */}
          <View style={styles.rangeNav} accessibilityLabel="Date range navigation">
            <Pressable
              onPress={goBack}
              style={styles.rangeBtn}
              accessibilityRole="button"
              accessibilityLabel="Previous period"
            >
              <Text style={styles.rangeBtnText}>‹</Text>
            </Pressable>
            <View style={styles.rangeWrap}>
              <Text style={styles.rangeLabel} numberOfLines={1} adjustsFontSizeToFit>
                {rangeLabel}
              </Text>
            </View>
            <Pressable
              onPress={goNext}
              style={[styles.rangeBtn, !canGoNext && styles.rangeBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Next period"
              accessibilityState={{ disabled: !canGoNext }}
            >
              <Text style={[styles.rangeBtnText, !canGoNext && styles.rangeBtnTextDisabled]}>›</Text>
            </Pressable>
          </View>

          {/* Today button */}
          <Pressable
            onPress={goToday}
            style={styles.todayBtn}
            accessibilityRole="button"
            accessibilityLabel="Go to today"
          >
            <Text style={styles.todayBtnText}>Today</Text>
          </Pressable>

          <View style={styles.subnavSpacer} />

          {/* Checklist filter */}
          {checklists.length > 1 && (
            <Pressable
              onPress={() => setChecklistPickerOpen(v => !v)}
              style={styles.filterBtn}
              accessibilityRole="button"
              accessibilityLabel="Filter by checklist"
            >
              <Text style={styles.filterBtnText}>
                {checklistId === 'all'
                  ? 'All checklists'
                  : checklists.find(c => c.id === checklistId)?.name ?? 'All'}
              </Text>
              <Text style={styles.filterChevron}>▾</Text>
            </Pressable>
          )}

          {/* Compare toggle */}
          <Pressable
            onPress={() => setCompare(v => !v)}
            style={styles.compareBtn}
            accessibilityRole="switch"
            accessibilityLabel="Compare to previous period"
            accessibilityState={{ checked: compare }}
          >
            <View style={[styles.toggle, compare && { backgroundColor: colors.primary }]}>
              <View style={[styles.toggleThumb, compare && styles.toggleThumbOn]} />
            </View>
            <Text style={styles.compareBtnText}>Compare</Text>
          </Pressable>
        </ScrollView>

        {/* Checklist dropdown */}
        {checklistPickerOpen && checklists.length > 1 && (
          <View style={styles.dropdown}>
            {[{ id: 'all', name: 'All checklists' }, ...checklists].map(cl => (
              <Pressable
                key={cl.id}
                onPress={() => { setChecklistId(cl.id); setChecklistPickerOpen(false); }}
                style={[styles.dropdownItem, cl.id === checklistId && styles.dropdownItemActive]}
                accessibilityRole="menuitem"
                accessibilityLabel={cl.name}
              >
                <Text style={[styles.dropdownItemText, cl.id === checklistId && styles.dropdownItemTextActive]}>
                  {cl.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        accessibilityRole="none"
      >
        {/* Sample data banner — shown when history is empty */}
        {completionHistory.length === 0 && (
          <View style={styles.sampleBanner}>
            <View style={styles.sampleBannerLeft}>
              <Text style={styles.sampleBannerTitle}>No shift history yet</Text>
              <Text style={styles.sampleBannerSub}>Load sample data to preview the dashboard.</Text>
            </View>
            <Pressable
              onPress={() => seedHistory(generateMockHistory())}
              style={styles.sampleBtn}
              accessibilityRole="button"
              accessibilityLabel="Load sample data"
            >
              <Text style={styles.sampleBtnText}>Load sample data</Text>
            </Pressable>
          </View>
        )}

        {/* Clear sample data — shown when seeded mock data is present */}
        {completionHistory.length > 0 && completionHistory.some(e => e.id.startsWith('mock-')) && (
          <View style={[styles.sampleBanner, styles.sampleBannerFilled]}>
            <Text style={styles.sampleBannerSub}>Showing sample data</Text>
            <Pressable
              onPress={clearHistory}
              style={styles.clearBtn}
              accessibilityRole="button"
              accessibilityLabel="Clear sample data"
            >
              <Text style={styles.clearBtnText}>Clear</Text>
            </Pressable>
          </View>
        )}

        {/* Breakdown */}
        <BreakdownCard
          current={cCounts}
          prev={pCounts}
          compare={compare}
          period={PERIOD_META[period].word}
        />

        {/* Bottom row: missed steps + history */}
        {isWide ? (
          <View style={styles.bottomRow}>
            <View style={styles.bottomLeft}>
              <MissedStepsCard rows={missedSteps} />
            </View>
            <View style={styles.bottomRight}>
              <HistorySection
                items={historyItems}
                filter={historyFilter}
                onFilterChange={setHistoryFilter}
                period={PERIOD_META[period].word}
              />
            </View>
          </View>
        ) : (
          <>
            <MissedStepsCard rows={missedSteps} />
            <HistorySection
              items={historyItems}
              filter={historyFilter}
              onFilterChange={setHistoryFilter}
              period={PERIOD_META[period].word}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── History Section ───────────────────────────────────────────────────────────

function HistorySection({
  items,
  filter,
  onFilterChange,
  period,
}: {
  items: DashRun[];
  filter: HistoryFilter;
  onFilterChange: (f: HistoryFilter) => void;
  period: string;
}) {
  return (
    <View style={styles.historyCard} accessibilityRole="none" accessibilityLabel="Shift History">
      <View style={styles.historyHead}>
        <View>
          <Text style={styles.cardTitle}>Shift History</Text>
          <Text style={styles.cardSub}>{items.length} shifts this {period}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.historyFilters}
        >
          {HISTORY_FILTERS.map(f => (
            <Pressable
              key={f.id}
              onPress={() => onFilterChange(f.id)}
              style={[styles.filterSegBtn, f.id === filter && styles.filterSegBtnActive]}
              accessibilityRole="button"
              accessibilityLabel={`Filter: ${f.label}`}
              accessibilityState={{ selected: f.id === filter }}
            >
              <Text style={[styles.filterSegBtnText, f.id === filter && styles.filterSegBtnTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIco}>📋</Text>
          <Text style={styles.emptyTitle}>No history in this {period}</Text>
          <Text style={styles.emptyBody}>Try a different filter or step back through the range.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.historyScroll}
          contentContainerStyle={styles.historyList}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          {items.map(r => <HistoryCard key={r.id} run={r} />)}
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Top bar
  topbar: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 20,
  },
  topbarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandIcon: { fontSize: 22 },
  brandName: {
    fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FFFFFF', letterSpacing: -0.2,
  },
  brandSep: { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.25)' },
  crumb: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,255,255,0.85)' },
  topbarSpacer: { flex: 1 },
  topbarBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999,
  },
  topbarBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },

  // Sub-nav
  subnav: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    zIndex: 19,
  },
  subnavInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  subnavSpacer: { flex: 1, minWidth: 8 },

  // Segmented
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    padding: 3,
  },
  segBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 7 },
  segBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#888888' },
  segBtnTextActive: { color: '#C8102E' },

  // Range nav
  rangeNav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rangeBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E5',
    alignItems: 'center', justifyContent: 'center',
  },
  rangeBtnDisabled: { opacity: 0.35 },
  rangeBtnText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#1A1A1A' },
  rangeBtnTextDisabled: { color: '#888888' },
  rangeWrap: { alignItems: 'center', minWidth: 160 },
  rangeLabel: {
    fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#1A1A1A', textAlign: 'center',
  },

  // Today button
  todayBtn: {
    backgroundColor: '#F0F0F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999,
  },
  todayBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#1A1A1A' },

  // Checklist filter
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5E5',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  filterBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#1A1A1A' },
  filterChevron: { fontSize: 10, color: '#888888' },

  // Compare toggle
  compareBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggle: {
    width: 30, height: 18, borderRadius: 9, backgroundColor: '#C8C8C8', position: 'relative',
  },
  toggleThumb: {
    position: 'absolute', top: 2, left: 2,
    width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.25, shadowRadius: 2,
  },
  toggleThumbOn: { left: 14 },
  compareBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#1A1A1A' },

  // Dropdown
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
    minWidth: 160,
    overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5E5' },
  dropdownItemActive: { backgroundColor: '#FFF0F2' },
  dropdownItemText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#1A1A1A' },
  dropdownItemTextActive: { color: '#C8102E', fontFamily: 'Inter_600SemiBold' },

  // Content
  scroll: { flex: 1 },
  content: {
    padding: 16,
    gap: 16,
    maxWidth: 1320,
    alignSelf: 'center',
    width: '100%',
  },

  // Bottom row (wide layout)
  bottomRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  bottomLeft: { flex: 1 },
  bottomRight: { flex: 1 },

  // Sample data banner
  sampleBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, padding: 14, borderRadius: 10,
    backgroundColor: '#FFF0F2', borderWidth: 1, borderColor: '#FDD5DB',
  },
  sampleBannerFilled: {
    backgroundColor: '#F5F5F5', borderColor: '#E5E5E5',
  },
  sampleBannerLeft: { flex: 1 },
  sampleBannerTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1A1A1A' },
  sampleBannerSub: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#888888', marginTop: 2 },
  sampleBtn: {
    backgroundColor: '#C8102E', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  sampleBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF' },
  clearBtn: {
    backgroundColor: '#E5E5E5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  clearBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#888888' },

  // History card
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  historyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#1A1A1A' },
  cardSub: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#888888', marginTop: 2 },
  historyFilters: { flexDirection: 'row', gap: 4 },
  filterSegBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: '#F0F0F0' },
  filterSegBtnActive: { backgroundColor: '#FFF0F2' },
  filterSegBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#888888' },
  filterSegBtnTextActive: { color: '#C8102E' },
  historyScroll: { maxHeight: 480 },
  historyList: { gap: 10, paddingRight: 4 },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 32, gap: 6 },
  emptyIco: { fontSize: 28 },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#1A1A1A' },
  emptyBody: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#888888', textAlign: 'center' },
});
