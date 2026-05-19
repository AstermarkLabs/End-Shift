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
import { ChecklistCache } from "@/utils/checklistCache";
import {
  STORAGE_MODE_KEY,
  type StorageMode,
  localListChecklists,
  localGetChecklist,
  localCreateChecklist,
  localUpdateChecklist,
  localDeleteChecklist,
  localSaveChecklist,
  localCreateChecklistTask,
  localUpdateChecklistTask,
  localDeleteChecklistTask,
  localOpenShift,
  localListShifts,
  localGetShift,
  localSubmitShift,
  localCompleteShiftTask,
  localUncompleteShiftTask,
} from "@/utils/localChecklistStore";

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
  subsection: string | null;
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
    subsection: string | null;
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
    subsection: t.subsection ?? null,
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
    completedAt: String(shift.submittedAt ?? shift.openedAt),
    sections,
    tasks: tasks.map((t) => ({
      id: t.id,
      category: t.section,
      subsection: t.subsection ?? null,
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

  storageMode: StorageMode;
}

export const ChecklistContext = createContext<ChecklistContextValue | null>(null);

export function ChecklistProvider({ children }: { children: React.ReactNode }) {
  const { ready, profile, noAuthMode } = useAuth();

  // ── Raw API/local data ──────────────────────────────────────────────────────
  const [apiChecklists, setApiChecklists] = useState<Checklist[]>([]);
  const [activeCl, setActiveCl] = useState<ChecklistWithTasks | null>(null);
  const [activeShift, setActiveShift] = useState<ShiftWithCompletions | null>(null);
  const [historyShifts, setHistoryShifts] = useState<ShiftWithCompletions[]>([]);

  // ── Local-only state ────────────────────────────────────────────────────────
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeShiftIds, setActiveShiftIds] = useState<Record<string, number>>({});
  const [hiddenShiftIds, setHiddenShiftIds] = useState<Set<string>>(new Set());
  const [pendingSections, setPendingSections] = useState<Record<string, string[]>>({});
  const [sectionOrderOverride, setSectionOrderOverride] = useState<Record<string, string[]>>({});
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [storageMode, setStorageMode] = useState<StorageMode>("cloud");

  const loaded = useRef(false);
  const hasFetchedRef = useRef(false);
  const fetchVersionRef = useRef(0);
  const activeIdRef = useRef<number | null>(null);
  activeIdRef.current = activeId;
  const [storageLoaded, setStorageLoaded] = useState(false);
  const storageModeRef = useRef<StorageMode>("cloud");
  storageModeRef.current = storageMode;

  const clMemCacheRef = useRef<Map<number, ChecklistWithTasks>>(new Map());
  const shiftMemCacheRef = useRef<Map<number, ShiftWithCompletions>>(new Map());
  const historyMemCacheRef = useRef<Map<number, ShiftWithCompletions[]>>(new Map());

  // ── Load persisted state + seed from cache ─────────────────────────────────
  useEffect(() => {
    async function init() {
      const pairs = await AsyncStorage.multiGet([
        KEY_ACTIVE,
        KEY_ACTIVE_SHIFTS,
        KEY_HIDDEN_SHIFTS,
        KEY_PENDING_SECTIONS,
        KEY_APP_CONFIG,
        STORAGE_MODE_KEY,
      ]);
      const [active, shifts, hidden, pending, cfg, modeRaw] = pairs.map(([, v]) => v);

      const loadedMode: StorageMode = (modeRaw === "local" || modeRaw === "local-no-auth") ? "local" : "cloud";
      setStorageMode(loadedMode);
      storageModeRef.current = loadedMode;

      let initialId: number | null = null;
      if (active) {
        initialId = Number(active);
        setActiveId(initialId);
      }
      if (shifts) { try { setActiveShiftIds(JSON.parse(shifts)); } catch {} }
      if (hidden) { try { setHiddenShiftIds(new Set(JSON.parse(hidden))); } catch {} }
      if (pending) { try { setPendingSections(JSON.parse(pending)); } catch {} }
      if (cfg) { try { setAppConfig({ ...DEFAULT_APP_CONFIG, ...JSON.parse(cfg) }); } catch {} }

      if (loadedMode === "local") {
        // Seed from local store (AsyncStorage is source of truth)
        const localList = await localListChecklists();
        if (localList.length > 0) {
          setApiChecklists(localList);
          if (initialId == null) {
            initialId = localList[0].id;
            setActiveId(initialId);
          }
        }
        if (initialId != null) {
          const cl = await localGetChecklist(initialId).catch(() => null);
          if (cl) {
            clMemCacheRef.current.set(initialId, cl);
            setActiveCl(cl);
          }
          // Restore the stored shift ID, or open a new one
          let storedShiftIds: Record<string, number> = {};
          try {
            const raw = await AsyncStorage.getItem(KEY_ACTIVE_SHIFTS);
            if (raw) storedShiftIds = JSON.parse(raw);
          } catch {}
          const existingShiftId = storedShiftIds[String(initialId)];
          let shift: ShiftWithCompletions | null = null;
          if (existingShiftId) {
            shift = await localGetShift(existingShiftId).catch(() => null);
            if (shift?.submittedAt) shift = null;
          }
          if (!shift) {
            shift = await localOpenShift(initialId).catch(() => null);
            if (shift) {
              setActiveShiftIds((prev) => ({ ...prev, [String(initialId!)]: shift!.id }));
            }
          }
          if (shift) {
            shiftMemCacheRef.current.set(initialId, shift);
            setActiveShift(shift);
          }
        }
      } else {
        // Cloud mode: seed from disk cache for instant display
        const cachedList = await ChecklistCache.loadList();
        if (cachedList && cachedList.length > 0) {
          setApiChecklists(cachedList);
          if (initialId == null) {
            initialId = cachedList[0].id;
            setActiveId(initialId);
          }
        }
        if (initialId != null) {
          const cache = new ChecklistCache(initialId);
          const { checklist, shift, history } = await cache.load();
          if (checklist) {
            clMemCacheRef.current.set(initialId, checklist);
            setActiveCl(checklist);
          }
          if (shift && !shift.submittedAt) {
            shiftMemCacheRef.current.set(initialId, shift);
            setActiveShift(shift);
          }
          const validHistory = history.filter((s) => s.submittedAt != null);
          if (validHistory.length > 0) {
            historyMemCacheRef.current.set(initialId, validHistory);
            setHistoryShifts(validHistory);
          }
        }
      }

      loaded.current = true;
      setStorageLoaded(true);
    }

    init();
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

  // ── Fetch / sync all data once (on app open) ────────────────────────────────
  const fetchAllCloud = useCallback(async () => {
    try {
      const cls = await listChecklists();
      setApiChecklists(cls);
      ChecklistCache.saveList(cls).catch(() => null);

      const currentId = activeIdRef.current ?? cls[0]?.id ?? null;
      if (activeIdRef.current == null && currentId != null) {
        setActiveId(currentId);
      }

      let storedShiftIds: Record<string, number> = {};
      try {
        const raw = await AsyncStorage.getItem(KEY_ACTIVE_SHIFTS);
        if (raw) storedShiftIds = JSON.parse(raw);
      } catch {}

      await Promise.all(
        cls.map(async (c) => {
          try {
            const cl = await getChecklist(c.id);
            clMemCacheRef.current.set(c.id, cl);
            new ChecklistCache(c.id).saveChecklist(cl).catch(() => null);
            if (c.id === currentId && c.id === activeIdRef.current) {
              setActiveCl(cl);
            }
          } catch {}
        })
      );

      if (currentId != null) {
        const existingShiftId = storedShiftIds[String(currentId)];
        let shift: ShiftWithCompletions | null = null;

        if (existingShiftId) {
          try {
            const fetched = await getShift(existingShiftId);
            if (!fetched.submittedAt) shift = fetched;
          } catch {}
        }

        if (!shift) {
          try {
            shift = await openShift(currentId);
            setActiveShiftIds((prev) => ({ ...prev, [String(currentId)]: shift!.id }));
          } catch {}
        }

        if (shift && currentId === activeIdRef.current) {
          shiftMemCacheRef.current.set(currentId, shift);
          setActiveShift(shift);
          new ChecklistCache(currentId).saveShift(shift).catch(() => null);
        }

        try {
          const allShifts = await listShifts(currentId);
          const submitted = allShifts.filter((s) => s.submittedAt != null);
          const full = await Promise.all(submitted.map((s) => getShift(s.id).catch(() => null)));
          const valid = full.filter((s): s is ShiftWithCompletions => s !== null && s.submittedAt != null);
          if (currentId === activeIdRef.current) {
            historyMemCacheRef.current.set(currentId, valid);
            setHistoryShifts(valid);
            new ChecklistCache(currentId).saveHistory(valid).catch(() => null);
          }
        } catch {}
      }

      await Promise.all(
        cls
          .filter((c) => c.id !== currentId && storedShiftIds[String(c.id)] != null)
          .map(async (c) => {
            try {
              const shift = await getShift(storedShiftIds[String(c.id)]);
              if (!shift.submittedAt) {
                shiftMemCacheRef.current.set(c.id, shift);
                new ChecklistCache(c.id).saveShift(shift).catch(() => null);
              }
            } catch {}
          })
      );
    } catch {
      // Network unavailable — cached data already displayed
    } finally {
      hasFetchedRef.current = true;
    }
  }, []);

  const fetchAllLocal = useCallback(async () => {
    const v = ++fetchVersionRef.current;
    try {
      const cls = await localListChecklists();
      if (fetchVersionRef.current !== v) return;
      setApiChecklists(cls);

      const currentId = activeIdRef.current ?? cls[0]?.id ?? null;
      if (activeIdRef.current == null && currentId != null) {
        setActiveId(currentId);
      }

      await Promise.all(
        cls.map(async (c) => {
          try {
            const cl = await localGetChecklist(c.id);
            if (fetchVersionRef.current !== v) return;
            clMemCacheRef.current.set(c.id, cl);
            if (c.id === currentId && c.id === activeIdRef.current) {
              setActiveCl(cl);
            }
          } catch {}
        })
      );

      if (currentId != null) {
        let storedShiftIds: Record<string, number> = {};
        try {
          const raw = await AsyncStorage.getItem(KEY_ACTIVE_SHIFTS);
          if (raw) storedShiftIds = JSON.parse(raw);
        } catch {}

        if (fetchVersionRef.current !== v) return;

        const existingShiftId = storedShiftIds[String(currentId)];
        let shift: ShiftWithCompletions | null = null;

        if (existingShiftId) {
          try {
            const fetched = await localGetShift(existingShiftId);
            if (!fetched.submittedAt) shift = fetched;
          } catch {}
        }

        if (!shift) {
          try {
            shift = await localOpenShift(currentId);
            if (fetchVersionRef.current !== v) return;
            setActiveShiftIds((prev) => ({ ...prev, [String(currentId)]: shift!.id }));
          } catch {}
        }

        if (fetchVersionRef.current !== v) return;
        if (shift && currentId === activeIdRef.current) {
          shiftMemCacheRef.current.set(currentId, shift);
          setActiveShift(shift);
        }

        try {
          const allShifts = await localListShifts(currentId);
          const submitted = allShifts.filter((s) => s.submittedAt != null);
          const full = await Promise.all(submitted.map((s) => localGetShift(s.id).catch(() => null)));
          const valid = full.filter((s): s is ShiftWithCompletions => s !== null && s.submittedAt != null);
          if (fetchVersionRef.current !== v) return;
          if (currentId === activeIdRef.current) {
            historyMemCacheRef.current.set(currentId, valid);
            setHistoryShifts(valid);
          }
        } catch {}
      }
    } catch {
      // Local store unavailable — cached data already displayed
    } finally {
      if (fetchVersionRef.current === v) hasFetchedRef.current = true;
    }
  }, []);

  // Fetch from source once when auth is ready and storage has loaded.
  useEffect(() => {
    if (!storageLoaded || hasFetchedRef.current) return;
    if (storageModeRef.current === "local") {
      fetchAllLocal();
    } else {
      if (!ready || !profile) return;
      fetchAllCloud();
    }
  }, [ready, profile?.id, storageLoaded, storageMode, fetchAllCloud, fetchAllLocal]);

  // Clear all checklist state when the user signs out.
  useEffect(() => {
    if (!ready || profile) return;
    const ids = apiChecklists.map((c) => c.id);
    fetchVersionRef.current++; // cancel any in-flight fetch
    setApiChecklists([]);
    setActiveCl(null);
    setActiveShift(null);
    setHistoryShifts([]);
    setActiveId(null);
    setActiveShiftIds({});
    clMemCacheRef.current.clear();
    shiftMemCacheRef.current.clear();
    historyMemCacheRef.current.clear();
    hasFetchedRef.current = false;
    if (storageModeRef.current === "cloud") {
      ChecklistCache.clearAllByIds(ids).catch(() => null);
    }
    // Restore local data for non-noAuthMode local devices.
    // noAuthMode devices switch back via the mode-switch effect below.
    if (storageModeRef.current === "local") {
      fetchAllLocal();
    }
  }, [ready, profile, fetchAllLocal]);

  // For local-no-auth devices: dynamically switch between local and cloud mode
  // as the user signs in/out of a cloud account.
  useEffect(() => {
    if (!storageLoaded) return;
    if (noAuthMode && profile && storageModeRef.current !== "cloud") {
      // Signed into cloud account from personal device — show cloud data
      fetchVersionRef.current++;
      setApiChecklists([]);
      setActiveCl(null);
      setActiveShift(null);
      setHistoryShifts([]);
      hasFetchedRef.current = false;
      setStorageMode("cloud");
    } else if (noAuthMode && !profile && storageModeRef.current === "cloud") {
      // Signed out of cloud account — return to personal local data
      fetchVersionRef.current++;
      hasFetchedRef.current = false;
      setStorageMode("local");
    }
  // !!profile captures sign-in/out without depending on identity changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noAuthMode, !!profile, storageLoaded]);

  // ── Auto-save cache when active checklist changes ───────────────────────────
  useEffect(() => {
    if (!activeCl || activeId == null || activeCl.id !== activeId) return;
    clMemCacheRef.current.set(activeId, activeCl);
    if (storageModeRef.current === "local") {
      localSaveChecklist(activeCl).catch(() => null);
    } else {
      new ChecklistCache(activeId).saveChecklist(activeCl).catch(() => null);
    }
  }, [activeCl, activeId]);

  // Shifts: only auto-save to cloud cache (local mode shifts are written directly per-mutation)
  useEffect(() => {
    if (!activeShift || activeId == null) return;
    shiftMemCacheRef.current.set(activeId, activeShift);
    if (storageModeRef.current === "cloud") {
      new ChecklistCache(activeId).saveShift(activeShift).catch(() => null);
    }
  }, [activeShift, activeId]);

  useEffect(() => {
    if (activeId == null) return;
    historyMemCacheRef.current.set(activeId, historyShifts);
    if (storageModeRef.current === "cloud") {
      new ChecklistCache(activeId).saveHistory(historyShifts).catch(() => null);
    }
  }, [historyShifts, activeId]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const clIdStr = activeId != null ? String(activeId) : "";
  const rawSections = activeCl ? deriveSections(activeCl.tasks, pendingSections[clIdStr] ?? []) : [];
  const sections = sectionOrderOverride[clIdStr] ?? rawSections;

  const completedIds = new Set(activeShift?.completions.map((c) => c.taskId) ?? []);
  const tasks: Task[] = activeCl ? activeCl.tasks.map((t) => toTask(t, completedIds)) : [];

  const checklistMetas: ChecklistMeta[] = apiChecklists.map((cl) => {
    const clTasks = cl.id === activeCl?.id ? (activeCl?.tasks ?? []) : [];
    const clSections = deriveSections(clTasks, pendingSections[String(cl.id)] ?? []);
    const ordered = sectionOrderOverride[String(cl.id)] ?? clSections;
    return toChecklistMeta(cl, ordered);
  });

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
    if (numId === activeIdRef.current) return;

    const cachedCl = clMemCacheRef.current.get(numId) ?? null;
    const cachedShift = shiftMemCacheRef.current.get(numId) ?? null;
    const cachedHistory = historyMemCacheRef.current.get(numId) ?? [];

    setActiveCl(cachedCl);
    setActiveShift(cachedShift && !cachedShift.submittedAt ? cachedShift : null);
    setHistoryShifts(cachedHistory.filter((s) => s.submittedAt != null));
    setActiveId(numId);

    if (!cachedCl) {
      const targetId = numId;
      const loadFn = storageModeRef.current === "local"
        ? async () => {
            const cl = await localGetChecklist(targetId);
            const shift = await localOpenShift(targetId).catch(() => null);
            const allShifts = await localListShifts(targetId);
            const submitted = allShifts.filter((s) => s.submittedAt != null);
            const full = await Promise.all(submitted.map((s) => localGetShift(s.id).catch(() => null)));
            const history = full.filter((s): s is ShiftWithCompletions => s !== null && s.submittedAt != null);
            return { checklist: cl, shift: shift && !shift.submittedAt ? shift : null, history };
          }
        : () => new ChecklistCache(targetId).load();

      loadFn().then(({ checklist, shift, history }) => {
        if (activeIdRef.current !== targetId) return;
        if (checklist) {
          clMemCacheRef.current.set(targetId, checklist);
          setActiveCl(checklist);
        }
        if (shift && !shift.submittedAt) {
          shiftMemCacheRef.current.set(targetId, shift);
          setActiveShift(shift);
        }
        const validHistory = history.filter((s) => s.submittedAt != null);
        historyMemCacheRef.current.set(targetId, validHistory);
        setHistoryShifts(validHistory);
      }).catch(() => null);
    }
  }, []);

  const addChecklist = useCallback(async (name: string) => {
    try {
      const created = storageModeRef.current === "local"
        ? await localCreateChecklist({ name })
        : await createChecklist({ name, ...(profile?.orgUnitId != null ? { locationId: profile.orgUnitId } : {}) });
      const newCl: ChecklistWithTasks = { ...created, tasks: [] };
      clMemCacheRef.current.set(created.id, newCl);
      if (storageModeRef.current === "cloud") {
        new ChecklistCache(created.id).saveChecklist(newCl).catch(() => null);
      }
      setApiChecklists((prev) => [...prev, created]);
      setActiveId(created.id);
      setActiveCl(newCl);
      setActiveShift(null);
      setHistoryShifts([]);
    } catch {}
  }, [profile?.orgUnitId]);

  const updateChecklistName = useCallback(async (id: string, name: string) => {
    const numId = Number(id);
    try {
      const updated = storageModeRef.current === "local"
        ? await localUpdateChecklist(numId, { name })
        : await updateChecklist(numId, { name });
      setApiChecklists((prev) => prev.map((c) => (c.id === numId ? updated : c)));
      if (numId === activeId) {
        setActiveCl((prev) => prev ? { ...prev, name: updated.name } : prev);
      }
    } catch {}
  }, [activeId]);

  const removeChecklist = useCallback(async (id: string) => {
    const numId = Number(id);
    try {
      if (storageModeRef.current === "local") {
        await localDeleteChecklist(numId);
      } else {
        await deleteChecklist(numId);
      }
      clMemCacheRef.current.delete(numId);
      if (storageModeRef.current === "cloud") {
        new ChecklistCache(numId).clear().catch(() => null);
      }
      setApiChecklists((prev) => {
        const next = prev.filter((c) => c.id !== numId);
        if (numId === activeId && next.length > 0) {
          const nextId = next[0].id;
          setActiveId(nextId);
          setActiveCl(clMemCacheRef.current.get(nextId) ?? null);
          setActiveShift(shiftMemCacheRef.current.get(nextId) ?? null);
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
        return {
          ...prev,
          completions: [
            ...prev.completions,
            { id: -Date.now(), shiftLogId: prev.id, taskId: id, completedBy: null, completedAt: new Date().toISOString() },
          ],
        };
      }
    });

    try {
      if (storageModeRef.current === "local") {
        if (isCompleted) {
          await localUncompleteShiftTask(activeShift.id, id);
        } else {
          await localCompleteShiftTask(activeShift.id, id);
        }
      } else {
        if (isCompleted) {
          await uncompleteShiftTask(activeShift.id, id);
        } else {
          await completeShiftTask(activeShift.id, id);
        }
      }
    } catch {
      // Revert optimistic update
      setActiveShift((prev) => {
        if (!prev) return prev;
        if (isCompleted) {
          return {
            ...prev,
            completions: [
              ...prev.completions,
              { id: -Date.now(), shiftLogId: prev.id, taskId: id, completedBy: null, completedAt: new Date().toISOString() },
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
      const newShift = storageModeRef.current === "local"
        ? await localOpenShift(activeId)
        : await openShift(activeId);
      setActiveShift(newShift);
      setActiveShiftIds((prev) => ({ ...prev, [String(activeId)]: newShift.id }));
    } catch {}
  }, [activeId]);

  const addTask = useCallback(async (category: string, text: string, required: boolean) => {
    if (activeId == null) return;
    const sortOrder = (activeCl?.tasks.filter((t) => t.section === category).length ?? 0);
    try {
      const created = storageModeRef.current === "local"
        ? await localCreateChecklistTask(activeId, { section: category, text, required, sortOrder })
        : await createChecklistTask(activeId, { section: category, text, required, sortOrder });
      setActiveCl((prev) => prev ? { ...prev, tasks: [...prev.tasks, created] } : prev);
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
      const updated = storageModeRef.current === "local"
        ? await localUpdateChecklistTask(id, apiUpdates as Parameters<typeof localUpdateChecklistTask>[1])
        : await updateChecklistTask(activeId, id, apiUpdates);
      setActiveCl((prev) => {
        if (!prev) return prev;
        return { ...prev, tasks: prev.tasks.map((t) => (t.id === id ? updated : t)) };
      });
    } catch {}
  }, [activeId]);

  const removeTask = useCallback(async (id: number) => {
    if (activeId == null) return;
    try {
      if (storageModeRef.current === "local") {
        await localDeleteChecklistTask(id);
      } else {
        await deleteChecklistTask(activeId, id);
      }
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
    const tasksToUpdate = (activeCl?.tasks ?? []).filter((t) => t.section === oldTitle);
    if (storageModeRef.current === "local") {
      await Promise.all(
        tasksToUpdate.map((t) =>
          localUpdateChecklistTask(t.id, { section: newTitle }).catch(() => null)
        )
      );
    } else {
      await Promise.all(
        tasksToUpdate.map((t) =>
          updateChecklistTask(activeId, t.id, { section: newTitle }).catch(() => null)
        )
      );
    }
    setActiveCl((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) => (t.section === oldTitle ? { ...t, section: newTitle } : t)),
      };
    });
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
    const tasksToDelete = (activeCl?.tasks ?? []).filter((t) => t.section === title);
    if (storageModeRef.current === "local") {
      await Promise.all(
        tasksToDelete.map((t) => localDeleteChecklistTask(t.id).catch(() => null))
      );
    } else {
      await Promise.all(
        tasksToDelete.map((t) => deleteChecklistTask(activeId, t.id).catch(() => null))
      );
    }
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
    setActiveCl((prev) => {
      if (!prev) return prev;
      const otherTasks = prev.tasks.filter((t) => t.section !== category);
      const reordered = newSectionTasks.map((t, i) => ({
        ...prev.tasks.find((pt) => pt.id === t.id)!,
        sortOrder: i,
      }));
      return { ...prev, tasks: [...otherTasks, ...reordered] };
    });
    // Persist sortOrder (fire-and-forget)
    if (storageModeRef.current === "local") {
      newSectionTasks.forEach((t, i) => {
        localUpdateChecklistTask(t.id, { sortOrder: i }).catch(() => null);
      });
    } else {
      newSectionTasks.forEach((t, i) => {
        updateChecklistTask(activeId, t.id, { sortOrder: i }).catch(() => null);
      });
    }
  }, [activeId]);

  // ── History operations ──────────────────────────────────────────────────────
  const completeChecklist = useCallback(async () => {
    if (!activeShift || activeId == null) return;
    try {
      const submitted = storageModeRef.current === "local"
        ? await localSubmitShift(activeShift.id)
        : await submitShift(activeShift.id, {});
      setHistoryShifts((prev) => [submitted, ...prev]);
      const newShift = storageModeRef.current === "local"
        ? await localOpenShift(activeId)
        : await openShift(activeId);
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

  const clearMockHistory = useCallback(() => {}, []);

  const seedHistory = useCallback((_items: CompletedChecklist[]) => {}, []);

  const updateAppConfig = useCallback((updates: Partial<AppConfig>) => {
    setAppConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const onChecklistImported = useCallback(async (checklist: Checklist) => {
    const stub: ChecklistWithTasks = { ...checklist, tasks: [] };
    clMemCacheRef.current.set(checklist.id, stub);
    if (storageModeRef.current === "cloud") {
      new ChecklistCache(checklist.id).saveChecklist(stub).catch(() => null);
    }
    setApiChecklists((prev) => [...prev, checklist]);
    setActiveId(checklist.id);
    setActiveCl(stub);
    setActiveShift(null);
    setHistoryShifts([]);

    try {
      if (storageModeRef.current === "local") {
        await localSaveChecklist(stub);
        const shift = await localOpenShift(checklist.id);
        shiftMemCacheRef.current.set(checklist.id, shift);
        if (activeIdRef.current === checklist.id) {
          setActiveShift(shift);
          setActiveShiftIds((prev) => ({ ...prev, [String(checklist.id)]: shift.id }));
        }
      } else {
        const [full, shift] = await Promise.all([
          getChecklist(checklist.id),
          openShift(checklist.id),
        ]);
        clMemCacheRef.current.set(checklist.id, full);
        new ChecklistCache(checklist.id).saveChecklist(full).catch(() => null);
        shiftMemCacheRef.current.set(checklist.id, shift);
        new ChecklistCache(checklist.id).saveShift(shift).catch(() => null);
        if (activeIdRef.current === checklist.id) {
          setActiveCl(full);
          setActiveShift(shift);
          setActiveShiftIds((prev) => ({ ...prev, [String(checklist.id)]: shift.id }));
        }
      }
    } catch {}
  }, []);

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
        appConfig: profile?.tenantName ? { ...appConfig, name: profile.tenantName } : appConfig,
        updateAppConfig,
        onChecklistImported,
        storageMode,
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
