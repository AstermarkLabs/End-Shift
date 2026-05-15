import { CompletedChecklist } from '@/context/ChecklistContext';
import { Bucket, Counts, DashRun, DateWindow, DeltaResult, MissedStep, Period } from './types';

// ── Date utilities ────────────────────────────────────────────────────────────

export function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
export function endOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - dow);
  return x;
}
export function startOfMonth(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(1); return x;
}
export function endOfMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999); return x;
}
export function sameDate(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export function fmtDate(d: Date): string {
  return `${DOW_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
export function fmtTime(d: Date): string {
  const h = d.getHours(); const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
export function fmtRange(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameDate(start, end)) {
    return `${DOW_SHORT[start.getDay()]}, ${MONTH_SHORT[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
  }
  if (sameMonth) {
    return `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
  }
  if (sameYear) {
    return `${MONTH_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTH_SHORT[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()} – ${MONTH_SHORT[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const wks = Math.floor(days / 7);
  if (wks < 5) return `${wks}w ago`;
  const mos = Math.floor(days / 30);
  if (mos < 12) return `${mos}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ── Period math ───────────────────────────────────────────────────────────────

export function windowFor(anchor: Date, period: Period, periodDays: number): DateWindow {
  if (period === 'day') return { start: startOfDay(anchor), end: endOfDay(anchor) };
  if (period === 'week') {
    const s = startOfWeek(anchor);
    return { start: s, end: endOfDay(addDays(s, 6)) };
  }
  if (period === 'month') return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  // 'period' — biweekly rolling window
  const today = new Date();
  let endOfCurrent = new Date(today);
  while (endOfCurrent.getDay() !== 6) endOfCurrent = addDays(endOfCurrent, 1);
  const back = Math.floor(daysBetween(anchor, endOfCurrent) / periodDays);
  const end = endOfDay(addDays(endOfCurrent, -back * periodDays));
  const start = startOfDay(addDays(end, -(periodDays - 1)));
  return { start, end };
}

export function shiftWindow(anchor: Date, period: Period, dir: number, periodDays: number): Date {
  if (period === 'day') return addDays(anchor, dir);
  if (period === 'week') return addDays(anchor, dir * 7);
  if (period === 'month') {
    const x = new Date(anchor); x.setDate(1); x.setMonth(x.getMonth() + dir); return x;
  }
  return addDays(anchor, dir * periodDays);
}

export function prevWindow(win: DateWindow): DateWindow {
  const lenDays = daysBetween(win.start, win.end) + 1;
  const end = endOfDay(addDays(win.start, -1));
  const start = startOfDay(addDays(end, -(lenDays - 1)));
  return { start, end };
}

// ── Aggregation ───────────────────────────────────────────────────────────────

export function runsIn(runs: DashRun[], win: DateWindow, checklistId: string): DashRun[] {
  return runs.filter(r => {
    const d = new Date(r.dateISO);
    if (d < win.start || d > win.end) return false;
    if (checklistId !== 'all' && r.checklistId !== checklistId) return false;
    return true;
  });
}

export function counts(runs: DashRun[]): Counts {
  const c = { completed: 0, late: 0, incomplete: 0, missed: 0, total: 0 };
  for (const r of runs) {
    c[r.outcome]++;
    c.total++;
  }
  return c;
}

export function deltaPct(curr: number, prev: number): DeltaResult {
  if (prev === 0 && curr === 0) return { kind: 'flat', text: '—', raw: 0 };
  if (prev === 0) return { kind: curr > 0 ? 'up' : 'flat', text: 'new', raw: 100 };
  const d = ((curr - prev) / prev) * 100;
  if (Math.abs(d) < 0.5) return { kind: 'flat', text: '0%', raw: 0 };
  return {
    kind: d > 0 ? 'up' : 'down',
    text: `${d > 0 ? '+' : ''}${d.toFixed(0)}%`,
    raw: d,
  };
}

export function buildBuckets(runs: DashRun[], win: DateWindow): Bucket[] {
  const days = daysBetween(win.start, win.end) + 1;
  const useWeekly = days > 31;
  const buckets: Bucket[] = [];
  if (useWeekly) {
    const start = startOfWeek(win.start);
    let cur = start;
    while (cur <= win.end) {
      buckets.push({
        label: `${MONTH_SHORT[cur.getMonth()]} ${cur.getDate()}`,
        start: cur,
        end: endOfDay(addDays(cur, 6)),
        completed: 0, late: 0, incomplete: 0, missed: 0,
      });
      cur = addDays(cur, 7);
    }
  } else {
    for (let i = 0; i < days; i++) {
      const d = addDays(win.start, i);
      const label = days <= 7
        ? DOW_SHORT[d.getDay()]
        : days <= 16 ? `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}` : `${d.getDate()}`;
      buckets.push({
        label,
        start: startOfDay(d),
        end: endOfDay(d),
        completed: 0, late: 0, incomplete: 0, missed: 0,
      });
    }
  }
  for (const r of runs) {
    const t = new Date(r.dateISO);
    const b = buckets.find(bk => t >= bk.start && t <= bk.end);
    if (b) b[r.outcome]++;
  }
  return buckets;
}

// ── Convert CompletedChecklist → DashRun ──────────────────────────────────────

export function historyToDashRuns(history: CompletedChecklist[]): DashRun[] {
  return history.map(cc => {
    const required = cc.tasks.filter(t => t.required);
    const done = cc.tasks.filter(t => t.completed);
    const requiredDone = required.filter(t => t.completed);
    const missedRequired = required.filter(t => !t.completed);
    const allRequiredDone = missedRequired.length === 0;
    const outcome = allRequiredDone ? 'completed' : 'incomplete';

    return {
      id: cc.id,
      checklistId: cc.checklistId,
      checklistName: cc.checklistName,
      dateISO: cc.completedAt,
      outcome,
      tasksTotal: cc.tasks.length,
      tasksDone: done.length,
      requiredTotal: required.length,
      requiredDone: requiredDone.length,
      missedRequired: missedRequired.map(t => ({
        id: String(t.id),
        text: t.text,
        section: t.category,
      })),
      completedTaskIds: done.map(t => t.id),
    } as DashRun;
  });
}

export function computeMissedSteps(runs: DashRun[]): MissedStep[] {
  const map = new Map<string, MissedStep>();
  for (const r of runs) {
    for (const m of r.missedRequired) {
      const k = `${r.checklistId}::${m.id}`;
      if (!map.has(k)) {
        map.set(k, { id: k, text: m.text, section: m.section, checklistName: r.checklistName, count: 0 });
      }
      map.get(k)!.count++;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
