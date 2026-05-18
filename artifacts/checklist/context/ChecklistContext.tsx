import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "@/context/AuthContext";

import {
  listChecklists,
  getChecklist,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  createChecklistTask,
  updateChecklistTask,
  deleteChecklistTask,
  openShift,
  listShifts,
  getShift,
  submitShift,
  completeShiftTask,
  uncompleteShiftTask,
} from "@workspace/api-client-react";

import type {
  Checklist,
  ChecklistWithTasks,
  ChecklistTask,
  ShiftWithCompletions,
  ShiftLog,
} from "@workspace/api-client-react";

// ─── Public types (kept identical for backward compat) ────────────────────────

export interface Task {
  id: number;
  category: string;
  text: string;
  completed: boolean;
  required: boolean;
}

export interface ChecklistMeta {
  id: string;
  name: string;
  sections: string[];
}

export interface AppConfig {
  name: string;
  primaryColor: string;
  icon: string;
  customIconUri?: string;
}

export interface CompletedChecklist {
  id: string;
  checklistId: string;
  checklistName: string;
  completedAt: string;
  sections: string[];
  tasks: Array<{
    id: number;
    category: string;
    text: string;
    completed: boolean;
    required: boolean;
  }>;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEY_ACTIVE = "@end_shift_v4_active_cl";
const KEY_ACTIVE_SHIFTS = "@end_shift_v4_active_shifts"; // { [clId]: shiftId }
const KEY_HIDDEN_SHIFTS = "@end_shift_v4_hidden_shifts"; // string[]
const KEY_PENDING_SECTIONS = "@end_shift_v4_pending_sections"; // { [clId]: string[] }
const KEY_APP_CONFIG = "@end_shift_app_config";

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_APP_CONFIG: AppConfig = {
  name: "End Shift",
  primaryColor: "#C8102E",
  icon: "🕐",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveSections(tasks: ChecklistTask[], pendingSections: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const t of tasks) {
    if (!seen.has(t.section)) {
      seen.add(t.section);
      ordered.push(t.section);
    }
  }
  for (const s of pendingSections) {
    if (!seen.has(s)) {
      seen.add(s);
      ordered.push(s);
    }
  }
  return ordered;
}

function toTask(t: ChecklistTask, completedIds: Set<number>): Task {
  return {
    id: t.id,
    category: t.section,
    text: t.text,
    completed: completedIds.has(t.id),
    required: t.required,
  };
}

function toChecklistMeta(cl: Checklist, sections: string[]): ChecklistMeta {
  return { id: String(cl.id), name: cl.name, sections };
}

function shiftToCompleted(
  shift: ShiftWithCompletions,
  clName: string,
  tasks: ChecklistTask[],
  sections: string[],
): CompletedChecklist {
  const completedIds = new Set(shift.completions.map((c) => c.taskId));
  return {
    id: String(shift.id),
    checklistId: String(shift.checklistId ?? ""),
    checklistName: clName,
    completedAt: shift.submittedAt ?? shift.openedAt,
    sections,
    tasks: tasks.map((t) => ({
      id: t.id,
      category: t.section,
      text: t.text,
      completed: completedIds.has(t.id),
      required: t.required,
    })),
  };
}

// ─── Context type ─────────────────────────────────────────────────────────────

interface ChecklistContextValue {
  checklists: ChecklistMeta[];
  activeChecklistId: string;
  setActiveChecklistId: (id: string) => void;
  addChecklist: (name: string) => void;
  updateChecklistName: (id: string, name: string) => void;
  removeChecklist: (id: string) => void;
  reorderChecklists: (newChecklists: ChecklistMeta[]) => void;

  tasks: Task[];
  sections: string[];

  toggleTask: (id: number) => void;
  resetChecklist: () => void;
  addTask: (category: string, text: string, required: boolean) => void;
  updateTask: (id: number, updates: Partial<Omit<Task, "id">>) => void;
  removeTask: (id: number) => void;

  addSection: (title: string) => void;
  updateSection: (oldTitle: string, newTitle: string) => void;
  removeSection: (title: string) => void;
  reorderSections: (newSections: string[]) => void;
  reorderTasksInSection: (category: string, newSectionTasks: Task[]) => void;

  completionHistory: CompletedChecklist[];
  completeChecklist: () => void;
  deleteHistoryEntry: (id: string) => void;
  clearHistory: () => void;
  clearMockHistory: () => void;
  seedHistory: (items: CompletedChecklist[]) => void;

  appConfig: AppConfig;
  updateAppConfig: (updates: Partial<AppConfig>) => void;

  onChecklistImported: (checklist: Checklist) => void;
}

export const ChecklistContext = createContext<ChecklistContextValue | null>(null);

export function ChecklistProvider({ children }: { children: React.ReactNode }) {
  const { ready, profile } = useAuth();

  // ── Raw API data ────────────────────────────────────────────────────────────
  const [apiChecklists, setApiChecklists] = useState<Checklist[]>([]);
  const [activeCl, setActiveCl] = useState<ChecklistWithTasks | null>(null);
  const [activeShift, setActiveShift] = useState<ShiftWithCompletions | null>(null);
  const [historyShifts, setHistoryShifts] = useState<ShiftWithCompletions[]>([]);

  // ── Local-only state ────────────────────────────────────────────────────────
  const [activeId, setActiveId] = useState<number | null>(null);
  // { [clId]: shiftId } — the currently open shift per checklist
  const [activeShiftIds, setActiveShiftIds] = useState<Record<string, number>>({});
  // Shift IDs hidden by deleteHistoryEntry / clearHistory
  const [hiddenShiftIds, setHiddenShiftIds] = useState<Set<string>>(new Set());
  // Sections with no tasks yet, per checklist
  const [pendingSections, setPendingSections] = useState<Record<string, string[]>>({});
  // Local reorder state: maps cl id (string) to section order override
  const [sectionOrderOverride, setSectionOrderOverride] = useState<Record<string, string[]>>({});
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);

  const loaded = useRef(false);
  const activeIdRef = useRef<number | null>(null);
  activeIdRef.current = activeId;

  // ── Load persisted state ────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.multiGet([
      KEY_ACTIVE,
      KEY_ACTIVE_SHIFTS,
      KEY_HIDDEN_SHIFTS,
      KEY_PENDING_SECTIONS,
      KEY_APP_CONFIG,
    ]).then((pairs) => {
      const [active, shifts, hidden, pending, cfg] = pairs.map(([, v]) => v);
      if (active) setActiveId(Number(active));
      if (shifts) {
        try { setActiveShiftIds(JSON.parse(shifts)); } catch {}
      }
      if (hidden) {
        try { setHiddenShiftIds(new Set(JSON.parse(hidden))); } catch {}
      }
      if (pending) {
        try { setPendingSections(JSON.parse(pending)); } catch {}
      }
      if (cfg) {
        try { setAppConfig({ ...DEFAULT_APP_CONFIG, ...JSON.parse(cfg) }); } catch {}
      }
      loaded.current = true;
    });
  }, []);

  // ── Persist state changes ───────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded.current) return;
    if (activeId != null) AsyncStorage.setItem(KEY_ACTIVE, String(activeId));
  }, [activeId]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY_ACTIVE_SHIFTS, JSON.stringify(activeShiftIds));
  }, [activeShiftIds]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY_HIDDEN_SHIFTS, JSON.stringify([...hiddenShiftIds]));
  }, [hiddenShiftIds]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY_PENDING_SECTIONS, JSON.stringify(pendingSections));
  }, [pendingSections]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY_APP_CONFIG, JSON.stringify(appConfig));
  }, [appConfig]);

  // ── Fetch all checklists on mount ───────────────────────────────────────────
  const refreshChecklists = useCallback(async () => {
    try {
      const cls = await listChecklists();
      setApiChecklists(cls);
      // If no active id, pick first
      setActiveId((prev) => {
        if (prev != null) return prev;
        return cls[0]?.id ?? null;
      });
    } catch {
      // Network unavailable — leave state as-is
    }
  }, []);

  // Only fetch once auth is ready and a user is signed in.
  useEffect(() => {
    if (!ready || !profile) return;
    refreshChecklists();
  }, [ready, profile?.id, refreshChecklists]);

  // Clear all checklist state when the user signs out.
  useEffect(() => {
    if (!ready || profile) return;
    setApiChecklists([]);
    setActiveCl(null);
    setActiveShift(null);
    setHistoryShifts([]);
    setActiveId(null);
    setActiveShiftIds({});
  }, [ready, profile]);

  // ── Fetch active checklist + manage shift when activeId changes ─────────────
  useEffect(() => {
    if (!ready || !profile || activeId == null) return;
    let cancelled = false;

    async function load() {
      try {
        const cl = await getChecklist(activeId!);
        if (cancelled) return;
        setActiveCl(cl);

        // Find or open the active shift for this checklist
        const existingShiftId = activeShiftIds[String(activeId!)];
        if (existingShiftId) {
          // Try to fetch the existing shift
          try {
            const shift = await getShift(existingShiftId);
            if (cancelled) return;
            if (!shift.submittedAt) {
              setActiveShift(shift);
              await loadHistory(activeId!, cl);
              return;
            }
          } catch {
            // Shift not found — open a new one
          }
        }
        // Open a new shift
        const newShift = await openShift(activeId!);
        if (cancelled) return;
        setActiveShift(newShift);
        setActiveShiftIds((prev) => ({ ...prev, [String(activeId!)]: newShift.id }));
        await loadHistory(activeId!, cl);
      } catch {
        // API unavailable
      }
    }

    async function loadHistory(clId: number, cl: ChecklistWithTasks) {
      try {
        const shifts = await listShifts(clId);
        const submitted = shifts.filter((s) => s.submittedAt != null);
        // Fetch full completions for each submitted shift
        const full = await Promise.all(submitted.map((s) => getShift(s.id).catch(() => null)));
        const valid = full.filter((s): s is ShiftWithCompletions => s !== null && s.submittedAt != null);
        if (!cancelled) setHistoryShifts(valid);
      } catch {}
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, ready]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const clIdStr = activeId != null ? String(activeId) : "";
  const rawSections = activeCl ? deriveSections(activeCl.tasks, pendingSections[clIdStr] ?? []) : [];
  const sections = sectionOrderOverride[clIdStr] ?? rawSections;

  const completedIds = new Set(activeShift?.completions.map((c) => c.taskId) ?? []);
  const tasks: Task[] = activeCl ? activeCl.tasks.map((t) => toTask(t, completedIds)) : [];

  // Checklist metas (with sections derived from tasks)
  const checklistMetas: ChecklistMeta[] = apiChecklists.map((cl) => {
    const clTasks = cl.id === activeCl?.id ? (activeCl?.tasks ?? []) : [];
    const clSections = deriveSections(clTasks, pendingSections[String(cl.id)] ?? []);
    const ordered = sectionOrderOverride[String(cl.id)] ?? clSections;
    return toChecklistMeta(cl, ordered);
  });

  // Completion history
  const completionHistory: CompletedChecklist[] = historyShifts
    .filter((s) => !hiddenShiftIds.has(String(s.id)))
    .map((s) => {
      const clTasks = activeCl?.tasks ?? [];
      const clSections = sections;
      const name = apiChecklists.find((c) => c.id === s.checklistId)?.name ?? "Checklist";
      return shiftToCompleted(s, name, clTasks, clSections);
    });

  // ── Checklist management ────────────────────────────────────────────────────
  const setActiveChecklistId = useCallback((id: string) => {
    const numId = Number(id);
    if (numId !== activeIdRef.current) {
      setActiveCl(null);
      setActiveShift(null);
      setHistoryShifts([]);
    }
    setActiveId(numId);
  }, []);

  const addChecklist = useCallback(async (name: string) => {
    try {
      const locationId = profile?.orgUnitId ?? null;
      const created = await createChecklist({ name, ...(locationId != null ? { locationId } : {}) });
      setApiChecklists((prev) => [...prev, created]);
      setActiveId(created.id);
      setActiveCl({ ...created, tasks: [] });
      setActiveShift(null);
      setHistoryShifts([]);
    } catch {}
  }, [profile?.orgUnitId]);

  const updateChecklistName = useCallback(async (id: string, name: string) => {
    const numId = Number(id);
    try {
      const updated = await updateChecklist(numId, { name });
      setApiChecklists((prev) => prev.map((c) => (c.id === numId ? updated : c)));
      if (numId === activeId) {
        setActiveCl((prev) => prev ? { ...prev, name: updated.name } : prev);
      }
    } catch {}
  }, [activeId]);

  const removeChecklist = useCallback(async (id: string) => {
    const numId = Number(id);
    try {
      await deleteChecklist(numId);
      setApiChecklists((prev) => {
        const next = prev.filter((c) => c.id !== numId);
        if (numId === activeId && next.length > 0) {
          setActiveId(next[0].id);
          setActiveCl(null);
          setActiveShift(null);
        }
        return next;
      });
    } catch {}
  }, [activeId]);

  const reorderChecklists = useCallback((newChecklists: ChecklistMeta[]) => {
    setApiChecklists((prev) => {
      const map = new Map(prev.map((c) => [String(c.id), c]));
      return newChecklists.map((m) => map.get(m.id)!).filter(Boolean);
    });
  }, []);

  // ── Task operations ─────────────────────────────────────────────────────────
  const toggleTask = useCallback(async (id: number) => {
    if (!activeShift) return;
    const isCompleted = completedIds.has(id);

    // Optimistic update
    setActiveShift((prev) => {
      if (!prev) return prev;
      if (isCompleted) {
        return { ...prev, completions: prev.completions.filter((c) => c.taskId !== id) };
      } else {
        const now = new Date().toISOString();
        return {
          ...prev,
          completions: [
            ...prev.completions,
            { id: -Date.now(), shiftLogId: prev.id, taskId: id, completedBy: null, completedAt: now },
          ],
        };
      }
    });

    try {
      if (isCompleted) {
        await uncompleteShiftTask(activeShift.id, id);
      } else {
        await completeShiftTask(activeShift.id, id);
      }
    } catch {
      // Revert optimistic update
      setActiveShift((prev) => {
        if (!prev) return prev;
        if (isCompleted) {
          const now = new Date().toISOString();
          return {
            ...prev,
            completions: [
              ...prev.completions,
              { id: -Date.now(), shiftLogId: prev.id, taskId: id, completedBy: null, completedAt: now },
            ],
          };
        } else {
          return { ...prev, completions: prev.completions.filter((c) => c.taskId !== id) };
        }
      });
    }
  }, [activeShift, completedIds]);

  const resetChecklist = useCallback(async () => {
    if (activeId == null) return;
    try {
      const newShift = await openShift(activeId);
      setActiveShift(newShift);
      setActiveShiftIds((prev) => ({ ...prev, [String(activeId)]: newShift.id }));
    } catch {}
  }, [activeId]);

  const addTask = useCallback(async (category: string, text: string, required: boolean) => {
    if (activeId == null) return;
    const sortOrder = (activeCl?.tasks.filter((t) => t.section === category).length ?? 0);
    try {
      const created = await createChecklistTask(activeId, { section: category, text, required, sortOrder });
      setActiveCl((prev) => prev ? { ...prev, tasks: [...prev.tasks, created] } : prev);
      // Remove from pending sections if it was there
      setPendingSections((prev) => {
        const key = String(activeId);
        const cur = prev[key] ?? [];
        return { ...prev, [key]: cur.filter((s) => s !== category) };
      });
    } catch {}
  }, [activeId, activeCl]);

  const updateTask = useCallback(async (id: number, updates: Partial<Omit<Task, "id">>) => {
    if (activeId == null) return;
    const apiUpdates: Record<string, unknown> = {};
    if (updates.text !== undefined) apiUpdates.text = updates.text;
    if (updates.required !== undefined) apiUpdates.required = updates.required;
    if (updates.category !== undefined) apiUpdates.section = updates.category;
    try {
      const updated = await updateChecklistTask(activeId, id, apiUpdates);
      setActiveCl((prev) => {
        if (!prev) return prev;
        return { ...prev, tasks: prev.tasks.map((t) => (t.id === id ? updated : t)) };
      });
    } catch {}
  }, [activeId]);

  const removeTask = useCallback(async (id: number) => {
    if (activeId == null) return;
    try {
      await deleteChecklistTask(activeId, id);
      setActiveCl((prev) => {
        if (!prev) return prev;
        return { ...prev, tasks: prev.tasks.filter((t) => t.id !== id) };
      });
    } catch {}
  }, [activeId]);

  // ── Section operations ──────────────────────────────────────────────────────
  const addSection = useCallback((title: string) => {
    const key = String(activeId ?? "");
    setPendingSections((prev) => {
      const cur = prev[key] ?? [];
      if (cur.includes(title)) return prev;
      return { ...prev, [key]: [...cur, title] };
    });
    setSectionOrderOverride((prev) => {
      const cur = prev[key] ?? sections;
      if (cur.includes(title)) return prev;
      return { ...prev, [key]: [...cur, title] };
    });
  }, [activeId, sections]);

  const updateSection = useCallback(async (oldTitle: string, newTitle: string) => {
    if (activeId == null) return;
    // Update all tasks in this section
    const tasksToUpdate = (activeCl?.tasks ?? []).filter((t) => t.section === oldTitle);
    await Promise.all(
      tasksToUpdate.map((t) =>
        updateChecklistTask(activeId, t.id, { section: newTitle }).catch(() => null)
      )
    );
    setActiveCl((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) => (t.section === oldTitle ? { ...t, section: newTitle } : t)),
      };
    });
    // Update pending sections
    setPendingSections((prev) => {
      const key = String(activeId);
      const cur = prev[key] ?? [];
      return { ...prev, [key]: cur.map((s) => (s === oldTitle ? newTitle : s)) };
    });
    setSectionOrderOverride((prev) => {
      const key = String(activeId);
      const cur = prev[key] ?? sections;
      return { ...prev, [key]: cur.map((s) => (s === oldTitle ? newTitle : s)) };
    });
  }, [activeId, activeCl, sections]);

  const removeSection = useCallback(async (title: string) => {
    if (activeId == null) return;
    // Delete all tasks in this section
    const tasksToDelete = (activeCl?.tasks ?? []).filter((t) => t.section === title);
    await Promise.all(
      tasksToDelete.map((t) => deleteChecklistTask(activeId, t.id).catch(() => null))
    );
    setActiveCl((prev) => {
      if (!prev) return prev;
      return { ...prev, tasks: prev.tasks.filter((t) => t.section !== title) };
    });
    setPendingSections((prev) => {
      const key = String(activeId);
      return { ...prev, [key]: (prev[key] ?? []).filter((s) => s !== title) };
    });
    setSectionOrderOverride((prev) => {
      const key = String(activeId);
      return { ...prev, [key]: (prev[key] ?? sections).filter((s) => s !== title) };
    });
  }, [activeId, activeCl, sections]);

  const reorderSections = useCallback((newSections: string[]) => {
    const key = String(activeId ?? "");
    setSectionOrderOverride((prev) => ({ ...prev, [key]: newSections }));
  }, [activeId]);

  const reorderTasksInSection = useCallback(async (category: string, newSectionTasks: Task[]) => {
    if (activeId == null) return;
    // Update sortOrder for each task
    setActiveCl((prev) => {
      if (!prev) return prev;
      const otherTasks = prev.tasks.filter((t) => t.section !== category);
      const reordered = newSectionTasks.map((t, i) => ({
        ...prev.tasks.find((pt) => pt.id === t.id)!,
        sortOrder: i,
      }));
      return { ...prev, tasks: [...otherTasks, ...reordered] };
    });
    // Persist sortOrder to API (fire-and-forget)
    newSectionTasks.forEach((t, i) => {
      updateChecklistTask(activeId, t.id, { sortOrder: i }).catch(() => null);
    });
  }, [activeId]);

  // ── History operations ──────────────────────────────────────────────────────
  const completeChecklist = useCallback(async () => {
    if (!activeShift || activeId == null) return;
    try {
      const submitted = await submitShift(activeShift.id, {});
      setHistoryShifts((prev) => [submitted, ...prev]);
      // Open a new shift
      const newShift = await openShift(activeId);
      setActiveShift(newShift);
      setActiveShiftIds((prev) => ({ ...prev, [String(activeId)]: newShift.id }));
    } catch {}
  }, [activeShift, activeId]);

  const deleteHistoryEntry = useCallback((id: string) => {
    setHiddenShiftIds((prev) => new Set([...prev, id]));
  }, []);

  const clearHistory = useCallback(() => {
    setHiddenShiftIds((prev) => new Set([...prev, ...historyShifts.map((s) => String(s.id))]));
  }, [historyShifts]);

  const clearMockHistory = useCallback(() => {
    // No-op for API-backed context (no mock data)
  }, []);

  const seedHistory = useCallback((_items: CompletedChecklist[]) => {
    // No-op for API-backed context (history comes from server)
  }, []);

  const updateAppConfig = useCallback((updates: Partial<AppConfig>) => {
    setAppConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const onChecklistImported = useCallback((checklist: Checklist) => {
    setApiChecklists((prev) => [...prev, checklist]);
    setActiveId(checklist.id);
    setActiveCl(null);
    setActiveShift(null);
    setHistoryShifts([]);
  }, []);

  // ── Active checklist id (string for backward compat) ────────────────────────
  const activeChecklistId = activeId != null ? String(activeId) : (checklistMetas[0]?.id ?? "");

  return (
    <ChecklistContext.Provider
      value={{
        checklists: checklistMetas,
        activeChecklistId,
        setActiveChecklistId,
        addChecklist,
        updateChecklistName,
        removeChecklist,
        reorderChecklists,
        tasks,
        sections,
        toggleTask,
        resetChecklist,
        addTask,
        updateTask,
        removeTask,
        addSection,
        updateSection,
        removeSection,
        reorderSections,
        reorderTasksInSection,
        completionHistory,
        completeChecklist,
        deleteHistoryEntry,
        clearHistory,
        clearMockHistory,
        seedHistory,
        appConfig,
        updateAppConfig,
        onChecklistImported,
      }}
    >
      {children}
    </ChecklistContext.Provider>
  );
}

export function useChecklist() {
  const ctx = useContext(ChecklistContext);
  if (!ctx) throw new Error("useChecklist must be used within ChecklistProvider");
  return ctx;
}
