import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Chip, Divider, IconButton, SegmentedButtons, Switch } from 'react-native-paper';

import { Ionicons } from '@expo/vector-icons';

import { useChecklist } from '@/context/ChecklistContext';
import { useAuth } from '@/context/AuthContext';
import { generateMockHistory } from '@/utils/mockData';
import shape from '@/constants/shape';
import { useMd } from '@/theme/useMd';

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
  const md = useMd();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { completionHistory, checklists, seedHistory, clearMockHistory } = useChecklist();

  const [period, setPeriod] = useState<Period>('period');
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [compare, setCompare] = useState(true);
  const [checklistId, setChecklistId] = useState<string>('all');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [checklistPickerOpen, setChecklistPickerOpen] = useState(false);

  const { profile } = useAuth();
  const isWeb = Platform.OS === 'web';
  const isWide = width >= 900;

  const showAdminLink = isWeb && !!profile && (
    profile.role.isSystem ||
    profile.role.rights.includes("manage_profiles") ||
    profile.role.rights.includes("manage_roles") ||
    profile.role.rights.includes("assign_roles") ||
    profile.role.rights.includes("manage_org_units")
  );

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
    <View style={[styles.root, { backgroundColor: md.surface }]}>
      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.topbar,
          { backgroundColor: md.surface, borderBottomColor: md.outlineVariant, paddingTop: insets.top + 8 },
        ]}
        accessibilityRole="header"
      >
        <View style={styles.topbarInner}>
          <View style={[styles.brandIconWrap, { borderRadius: shape.sm, backgroundColor: md.primaryContainer }]}>
            <Text style={styles.brandIcon}>🕐</Text>
          </View>
          <View style={styles.brand}>
            <Text style={[styles.brandName, { color: md.onSurface }]}>End Shift</Text>
            <Text style={[styles.crumb, { color: md.onSurfaceVariant }]}>Shift Reports</Text>
          </View>
          <View style={styles.topbarSpacer} />
          {showAdminLink && (
            <Button
              mode="contained-tonal"
              compact
              onPress={() => router.push('/admin')}
              accessibilityLabel="Admin panel"
            >
              Admin
            </Button>
          )}
          {!isWeb && (
            <IconButton
              icon={() => <Ionicons name="arrow-back" size={20} color={md.onSurfaceVariant} />}
              onPress={() => router.back()}
              accessibilityLabel="Back to checklist"
            />
          )}
        </View>
      </View>

      {/* ── Sub-nav ───────────────────────────────────────────────────────── */}
      <View
        style={[styles.subnav, { backgroundColor: md.surfaceContainerLow, borderBottomColor: md.outlineVariant }]}
        accessibilityRole="none"
        accessibilityLabel="Report controls"
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subnavInner}
        >
          {/* Period selector */}
          <View style={styles.segmented} accessibilityRole="tablist" accessibilityLabel="Reporting period">
            <SegmentedButtons
              value={period}
              onValueChange={(v) => { setPeriod(v as Period); setAnchor(new Date()); }}
              density="small"
              buttons={(['day', 'week', 'period', 'month'] as Period[]).map(p => ({
                value: p,
                label: PERIOD_META[p].btn,
                accessibilityLabel: PERIOD_META[p].btn,
              }))}
            />
          </View>

          {/* Range nav */}
          <View style={styles.rangeNav} accessibilityLabel="Date range navigation">
            <IconButton
              icon={() => <Ionicons name="chevron-back" size={18} color={md.onSurface} />}
              mode="outlined"
              size={18}
              onPress={goBack}
              accessibilityLabel="Previous period"
            />
            <View style={styles.rangeWrap}>
              <Text style={[styles.rangeLabel, { color: md.onSurface }]} numberOfLines={1} adjustsFontSizeToFit>
                {rangeLabel}
              </Text>
            </View>
            <IconButton
              icon={() => <Ionicons name="chevron-forward" size={18} color={canGoNext ? md.onSurface : md.onSurfaceVariant} />}
              mode="outlined"
              size={18}
              disabled={!canGoNext}
              onPress={goNext}
              accessibilityLabel="Next period"
              accessibilityState={{ disabled: !canGoNext }}
            />
          </View>

          {/* Today button */}
          <Button mode="text" compact onPress={goToday} accessibilityLabel="Go to today">
            Today
          </Button>

          <View style={styles.subnavSpacer} />

          {/* Checklist filter */}
          {checklists.length > 1 && (
            <Chip
              icon={() => <Ionicons name="chevron-down" size={14} color={md.onSurfaceVariant} />}
              onPress={() => setChecklistPickerOpen(v => !v)}
              selected={checklistPickerOpen}
              mode="outlined"
              accessibilityLabel="Filter by checklist"
            >
              {checklistId === 'all'
                ? 'All checklists'
                : checklists.find(c => c.id === checklistId)?.name ?? 'All'}
            </Chip>
          )}

          {/* Compare toggle */}
          <Pressable
            onPress={() => setCompare(v => !v)}
            style={styles.compareBtn}
            accessibilityRole="switch"
            accessibilityLabel="Compare to previous period"
            accessibilityState={{ checked: compare }}
          >
            <Switch value={compare} onValueChange={setCompare} color={md.primary} />
            <Text style={[styles.compareBtnText, { color: md.onSurface }]}>Compare</Text>
          </Pressable>
        </ScrollView>

        {/* Checklist dropdown */}
        {checklistPickerOpen && checklists.length > 1 && (
          <View style={[styles.dropdown, { backgroundColor: md.surfaceContainerHigh, borderRadius: shape.md }]}>
            {[{ id: 'all', name: 'All checklists' }, ...checklists].map((cl, i, arr) => {
              const active = cl.id === checklistId;
              return (
                <React.Fragment key={cl.id}>
                  <Pressable
                    onPress={() => { setChecklistId(cl.id); setChecklistPickerOpen(false); }}
                    style={[styles.dropdownItem, active && { backgroundColor: md.secondaryContainer }]}
                    accessibilityRole="menuitem"
                    accessibilityLabel={cl.name}
                  >
                    <Text style={[styles.dropdownItemText, { color: active ? md.onSecondaryContainer : md.onSurface }]}>
                      {cl.name}
                    </Text>
                  </Pressable>
                  {i < arr.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
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
          <View style={[styles.sampleBanner, { backgroundColor: md.primaryContainer, borderRadius: shape.lg }]}>
            <View style={styles.sampleBannerLeft}>
              <Text style={[styles.sampleBannerTitle, { color: md.onPrimaryContainer }]}>No shift history yet</Text>
              <Text style={[styles.sampleBannerSub, { color: md.onPrimaryContainer }]}>Load sample data to preview the dashboard.</Text>
            </View>
            <Button
              mode="contained"
              compact
              onPress={() => seedHistory(generateMockHistory())}
              accessibilityLabel="Load sample data"
            >
              Load sample data
            </Button>
          </View>
        )}

        {/* Clear sample data — shown when seeded mock data is present */}
        {completionHistory.length > 0 && completionHistory.some(e => e.id.startsWith('mock-')) && (
          <View style={[styles.sampleBanner, { backgroundColor: md.surfaceContainerHigh, borderRadius: shape.lg }]}>
            <Text style={[styles.sampleBannerSub, { color: md.onSurfaceVariant }]}>Showing sample data</Text>
            <Button
              mode="contained-tonal"
              compact
              onPress={clearMockHistory}
              accessibilityLabel="Clear sample data"
            >
              Clear
            </Button>
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
  const md = useMd();
  return (
    <View
      style={[styles.historyCard, { backgroundColor: md.surfaceContainerHigh, borderRadius: shape.lg }]}
      accessibilityRole="none"
      accessibilityLabel="Shift History"
    >
      <View style={styles.historyHead}>
        <View>
          <Text style={[styles.cardTitle, { color: md.onSurface }]}>Shift History</Text>
          <Text style={[styles.cardSub, { color: md.onSurfaceVariant }]}>{items.length} shifts this {period}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.historyFilters}
        >
          {HISTORY_FILTERS.map(f => {
            const active = f.id === filter;
            return (
              <Chip
                key={f.id}
                selected={active}
                showSelectedCheck={false}
                onPress={() => onFilterChange(f.id)}
                mode={active ? 'flat' : 'outlined'}
                compact
                style={active ? { backgroundColor: md.secondaryContainer } : undefined}
                textStyle={{ color: active ? md.onSecondaryContainer : md.onSurfaceVariant, fontSize: 12 }}
                accessibilityLabel={`Filter: ${f.label}`}
                accessibilityState={{ selected: active }}
              >
                {f.label}
              </Chip>
            );
          })}
        </ScrollView>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIco}>📋</Text>
          <Text style={[styles.emptyTitle, { color: md.onSurface }]}>No history in this {period}</Text>
          <Text style={[styles.emptyBody, { color: md.onSurfaceVariant }]}>Try a different filter or step back through the range.</Text>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 20,
  },
  topbarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  brand: { flexShrink: 1, gap: 1 },
  brandName: {
    fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.2,
  },
  crumb: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  topbarSpacer: { flex: 1 },
  brandIconWrap: {
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  brandIcon: { fontSize: 18 },

  // Sub-nav
  subnav: {
    borderBottomWidth: 1,
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

  // Period selector
  segmented: {
    minWidth: 300,
  },

  // Range nav
  rangeNav: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rangeWrap: { alignItems: 'center', minWidth: 150 },
  rangeLabel: {
    fontSize: 13, fontFamily: 'Inter_600SemiBold', textAlign: 'center',
  },

  // Compare toggle
  compareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compareBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  // Dropdown
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
    minWidth: 160,
    overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 12 },
  dropdownItemText: { fontSize: 14, fontFamily: 'Inter_500Medium' },

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
    gap: 12, padding: 14,
  },
  sampleBannerLeft: { flex: 1 },
  sampleBannerTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  sampleBannerSub: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },

  // History card
  historyCard: {
    height: 480,
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
  cardTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  cardSub: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  historyFilters: { flexDirection: 'row', gap: 6 },
  historyScroll: { flex: 1, minHeight: 0 },
  historyList: { gap: 10, paddingRight: 4 },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 32, gap: 6 },
  emptyIco: { fontSize: 28 },
  emptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  emptyBody: { fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center' },
});
