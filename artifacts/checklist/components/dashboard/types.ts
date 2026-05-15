export type RunOutcome = 'completed' | 'incomplete' | 'late' | 'missed';

export interface DashRun {
  id: string;
  checklistId: string;
  checklistName: string;
  dateISO: string;
  outcome: RunOutcome;
  tasksTotal: number;
  tasksDone: number;
  requiredTotal: number;
  requiredDone: number;
  missedRequired: { id: string; text: string; section: string }[];
  completedTaskIds: number[];
}

export interface Counts {
  completed: number;
  late: number;
  incomplete: number;
  missed: number;
  total: number;
}

export interface DateWindow {
  start: Date;
  end: Date;
}

export interface Bucket {
  label: string;
  start: Date;
  end: Date;
  completed: number;
  late: number;
  incomplete: number;
  missed: number;
}

export interface MissedStep {
  id: string;
  text: string;
  section: string;
  checklistName: string;
  count: number;
}

export interface DeltaResult {
  kind: 'up' | 'down' | 'flat';
  text: string;
  raw: number;
}

export type Period = 'day' | 'week' | 'period' | 'month';

export const OUTCOME_COLORS: Record<RunOutcome, string> = {
  completed: '#16A34A',
  late: '#2196F3',
  incomplete: '#FF9800',
  missed: '#EF4444',
};

export const OUTCOME_LABELS: Record<RunOutcome, string> = {
  completed: 'Completed',
  late: 'Late',
  incomplete: 'Incomplete',
  missed: 'Missed',
};

export const PERIOD_DAYS = 14;
