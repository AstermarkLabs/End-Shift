import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  Checklist,
  ChecklistWithTasks,
  ChecklistTask,
  ShiftWithCompletions,
  ShiftLog,
} from "@workspace/api-client-react";

// ─── Storage mode ─────────────────────────────────────────────────────────────

export const STORAGE_MODE_KEY = "@end_shift_storage_mode";
export type StorageMode = "local" | "local-no-auth" | "cloud";

export async function saveStorageMode(mode: StorageMode): Promise<void> {
  await AsyncStorage.setItem(STORAGE_MODE_KEY, mode);
}

// ─── Internal storage keys ────────────────────────────────────────────────────

const LOCAL_CLS_KEY = "@end_shift_local_cls_v1";
const LOCAL_SHIFTS_KEY = "@end_shift_local_shifts_v1";

// ─── ID generation ────────────────────────────────────────────────────────────

let _idCounter = Date.now();
function uid(): number {
  return ++_idCounter;
}

// ─── Raw I/O ──────────────────────────────────────────────────────────────────

async function readChecklists(): Promise<ChecklistWithTasks[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_CLS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChecklistWithTasks[];
  } catch {
    return [];
  }
}

async function writeChecklists(cls: ChecklistWithTasks[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_CLS_KEY, JSON.stringify(cls));
}

async function readShifts(): Promise<ShiftWithCompletions[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_SHIFTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ShiftWithCompletions[];
  } catch {
    return [];
  }
}

async function writeShifts(shifts: ShiftWithCompletions[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_SHIFTS_KEY, JSON.stringify(shifts));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripTasks(cl: ChecklistWithTasks): Checklist {
  const { tasks: _, ...rest } = cl;
  return rest;
}

// ─── Checklist CRUD ───────────────────────────────────────────────────────────

export async function localListChecklists(): Promise<Checklist[]> {
  const cls = await readChecklists();
  return cls.map(stripTasks);
}

export async function localGetChecklist(id: number): Promise<ChecklistWithTasks> {
  const cls = await readChecklists();
  const cl = cls.find((c) => c.id === id);
  if (!cl) throw new Error(`Checklist ${id} not found`);
  return cl;
}

export async function localCreateChecklist(data: {
  name: string;
  locationId?: number | null;
}): Promise<Checklist> {
  const cls = await readChecklists();
  const now = new Date().toISOString();
  const newCl: ChecklistWithTasks = {
    id: uid(),
    tenantId: 0,
    locationId: data.locationId ?? null,
    name: data.name,
    createdBy: null,
    allowedRoleIds: [],
    createdAt: now,
    updatedAt: now,
    tasks: [],
  };
  await writeChecklists([...cls, newCl]);
  return stripTasks(newCl);
}

export async function localUpdateChecklist(
  id: number,
  data: { name?: string },
): Promise<Checklist> {
  const cls = await readChecklists();
  const idx = cls.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error(`Checklist ${id} not found`);
  const updated: ChecklistWithTasks = { ...cls[idx], ...data, updatedAt: new Date().toISOString() };
  const newCls = [...cls];
  newCls[idx] = updated;
  await writeChecklists(newCls);
  return stripTasks(updated);
}

export async function localDeleteChecklist(id: number): Promise<void> {
  const cls = await readChecklists();
  await writeChecklists(cls.filter((c) => c.id !== id));
  const shifts = await readShifts();
  await writeShifts(shifts.filter((s) => s.checklistId !== id));
}

// Atomic save of an entire checklist (used by auto-save in ChecklistContext)
export async function localSaveChecklist(cl: ChecklistWithTasks): Promise<void> {
  const cls = await readChecklists();
  const idx = cls.findIndex((c) => c.id === cl.id);
  if (idx === -1) {
    await writeChecklists([...cls, cl]);
  } else {
    const newCls = [...cls];
    newCls[idx] = cl;
    await writeChecklists(newCls);
  }
}

// ─── Task CRUD ────────────────────────────────────────────────────────────────

export async function localCreateChecklistTask(
  checklistId: number,
  data: {
    section: string;
    subsection?: string | null;
    text: string;
    required: boolean;
    sortOrder?: number;
  },
): Promise<ChecklistTask> {
  const cls = await readChecklists();
  const idx = cls.findIndex((c) => c.id === checklistId);
  if (idx === -1) throw new Error(`Checklist ${checklistId} not found`);
  const task: ChecklistTask = {
    id: uid(),
    checklistId,
    section: data.section,
    subsection: data.subsection ?? null,
    text: data.text,
    required: data.required,
    sortOrder: data.sortOrder ?? cls[idx].tasks.length,
    createdAt: new Date().toISOString(),
  };
  const newCls = [...cls];
  newCls[idx] = { ...cls[idx], tasks: [...cls[idx].tasks, task], updatedAt: new Date().toISOString() };
  await writeChecklists(newCls);
  return task;
}

export async function localUpdateChecklistTask(
  taskId: number,
  data: Partial<Pick<ChecklistTask, "section" | "subsection" | "text" | "required" | "sortOrder">>,
): Promise<ChecklistTask> {
  const cls = await readChecklists();
  let found: ChecklistTask | null = null;
  const newCls = cls.map((cl) => {
    const taskIdx = cl.tasks.findIndex((t) => t.id === taskId);
    if (taskIdx === -1) return cl;
    const updated = { ...cl.tasks[taskIdx], ...data };
    found = updated;
    const newTasks = [...cl.tasks];
    newTasks[taskIdx] = updated;
    return { ...cl, tasks: newTasks, updatedAt: new Date().toISOString() };
  });
  if (!found) throw new Error(`Task ${taskId} not found`);
  await writeChecklists(newCls);
  return found;
}

export async function localDeleteChecklistTask(taskId: number): Promise<void> {
  const cls = await readChecklists();
  await writeChecklists(
    cls.map((cl) => ({
      ...cl,
      tasks: cl.tasks.filter((t) => t.id !== taskId),
      updatedAt: new Date().toISOString(),
    })),
  );
}

// ─── Shift operations ─────────────────────────────────────────────────────────

export async function localOpenShift(checklistId: number): Promise<ShiftWithCompletions> {
  const shifts = await readShifts();
  const existing = shifts.find((s) => s.checklistId === checklistId && !s.submittedAt);
  if (existing) return existing;
  const shift: ShiftWithCompletions = {
    id: uid(),
    tenantId: 0,
    checklistId,
    locationId: null,
    openedBy: null,
    submittedBy: null,
    openedAt: new Date().toISOString(),
    submittedAt: null,
    notes: null,
    completions: [],
  };
  await writeShifts([...shifts, shift]);
  return shift;
}

export async function localListShifts(checklistId: number): Promise<ShiftLog[]> {
  const shifts = await readShifts();
  return shifts
    .filter((s) => s.checklistId === checklistId)
    .map(({ completions: _, ...s }) => s);
}

export async function localGetShift(id: number): Promise<ShiftWithCompletions> {
  const shifts = await readShifts();
  const shift = shifts.find((s) => s.id === id);
  if (!shift) throw new Error(`Shift ${id} not found`);
  return shift;
}

export async function localSubmitShift(id: number): Promise<ShiftWithCompletions> {
  const shifts = await readShifts();
  const idx = shifts.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error(`Shift ${id} not found`);
  const updated = { ...shifts[idx], submittedAt: new Date().toISOString() };
  const newShifts = [...shifts];
  newShifts[idx] = updated;
  await writeShifts(newShifts);
  return updated;
}

export async function localCompleteShiftTask(shiftId: number, taskId: number): Promise<void> {
  const shifts = await readShifts();
  const idx = shifts.findIndex((s) => s.id === shiftId);
  if (idx === -1) return;
  const completion = {
    id: uid(),
    shiftLogId: shiftId,
    taskId,
    completedBy: null,
    completedAt: new Date().toISOString(),
  };
  const newShifts = [...shifts];
  newShifts[idx] = {
    ...shifts[idx],
    completions: [
      ...shifts[idx].completions.filter((c) => c.taskId !== taskId),
      completion,
    ],
  };
  await writeShifts(newShifts);
}

export async function localUncompleteShiftTask(shiftId: number, taskId: number): Promise<void> {
  const shifts = await readShifts();
  const idx = shifts.findIndex((s) => s.id === shiftId);
  if (idx === -1) return;
  const newShifts = [...shifts];
  newShifts[idx] = {
    ...shifts[idx],
    completions: shifts[idx].completions.filter((c) => c.taskId !== taskId),
  };
  await writeShifts(newShifts);
}

// Atomic save of a single shift (not used for completion toggling, only for full shift saves)
export async function localSaveShift(shift: ShiftWithCompletions): Promise<void> {
  const shifts = await readShifts();
  const idx = shifts.findIndex((s) => s.id === shift.id);
  if (idx === -1) {
    await writeShifts([...shifts, shift]);
  } else {
    const newShifts = [...shifts];
    newShifts[idx] = shift;
    await writeShifts(newShifts);
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function localClearAll(): Promise<void> {
  await AsyncStorage.multiRemove([LOCAL_CLS_KEY, LOCAL_SHIFTS_KEY]);
}
