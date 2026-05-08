import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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

export interface CompletedChecklist {
  id: string;
  checklistId: string;
  checklistName: string;
  completedAt: string; // ISO string
  sections: string[];
  tasks: Array<{
    id: number;
    category: string;
    text: string;
    completed: boolean;
    required: boolean;
  }>;
}

// ─── Default data ────────────────────────────────────────────────────────────

const DEFAULT_SECTIONS = [
  "1 Hour Before Closing",
  "30 Minutes Before Closing",
  "Driver Area Cleaning",
  "Final Walk-Through",
];

const DEFAULT_TASKS: Task[] = [
  { id: 1, category: "1 Hour Before Closing", text: "Begin the daily count sheet and complete inventory counts.", completed: false, required: true },
  { id: 2, category: "1 Hour Before Closing", text: "Ensure all required labels are completed; pull any labels that need to be removed.", completed: false, required: true },
  { id: 3, category: "1 Hour Before Closing", text: "Pull product as required at this time.", completed: false, required: true },
  { id: 4, category: "1 Hour Before Closing", text: "Close the driver till.", completed: false, required: true },
  { id: 5, category: "1 Hour Before Closing", text: "Remove all trash except one can; replace liners in all bins.", completed: false, required: true },
  { id: 6, category: "1 Hour Before Closing", text: "Pull tea and thoroughly clean the coffee machine.", completed: false, required: true },
  { id: 7, category: "1 Hour Before Closing", text: "Reduce operations to bare minimum.", completed: false, required: false },
  { id: 8, category: "1 Hour Before Closing", text: "Wipe down countertops and the top of the make line.", completed: false, required: true },
  { id: 9, category: "1 Hour Before Closing", text: "Place lids on the make line.", completed: false, required: true },
  { id: 10, category: "1 Hour Before Closing", text: "Sweep floors.", completed: false, required: true },
  { id: 11, category: "1 Hour Before Closing", text: "Check the lobby for trash and dirty tables.", completed: false, required: false },
  { id: 12, category: "1 Hour Before Closing", text: "Check bathrooms for trash and debris.", completed: false, required: false },
  { id: 13, category: "30 Minutes Before Closing", text: "Filter the fryer. When refilling, allow it to continue filling until you are ready to leave so no oil remains at the bottom.", completed: false, required: true },
  { id: 14, category: "30 Minutes Before Closing", text: "Enter inventory counts and complete closing procedures on the tablet.", completed: false, required: true },
  { id: 15, category: "30 Minutes Before Closing", text: "Pull any remaining labels that are no longer needed.", completed: false, required: true },
  { id: 16, category: "30 Minutes Before Closing", text: "Remove sanitizer buckets.", completed: false, required: true },
  { id: 17, category: "30 Minutes Before Closing", text: "Mop floors if time permits.", completed: false, required: false },
  { id: 18, category: "30 Minutes Before Closing", text: "Close the front till. At this point, only the window till should remain open.", completed: false, required: true },
  { id: 19, category: "Driver Area Cleaning", text: "Sweep the driver area, including under the sink and drying shelves.", completed: false, required: true },
  { id: 20, category: "Driver Area Cleaning", text: "Clean the dishwasher.", completed: false, required: true },
  { id: 21, category: "Driver Area Cleaning", text: "Spray out and clean all trash bins.", completed: false, required: true },
  { id: 22, category: "Final Walk-Through", text: "Dishwasher is cleaned and turned off.", completed: false, required: true },
  { id: 23, category: "Final Walk-Through", text: "Dish bins are sprayed out.", completed: false, required: true },
  { id: 24, category: "Final Walk-Through", text: "Sink areas on both sides of the dishwasher are clean.", completed: false, required: true },
  { id: 25, category: "Final Walk-Through", text: "Back door is locked.", completed: false, required: true },
  { id: 26, category: "Final Walk-Through", text: "All lights are turned off.", completed: false, required: true },
  { id: 27, category: "Final Walk-Through", text: "Labels have been pulled.", completed: false, required: true },
  { id: 28, category: "Final Walk-Through", text: "Make line lids are on.", completed: false, required: true },
  { id: 29, category: "Final Walk-Through", text: "Counters are wiped down. LIDS are on cut table.", completed: false, required: true },
  { id: 30, category: "Final Walk-Through", text: "Trash has been taken out. (don't forget bathrooms)", completed: false, required: true },
  { id: 31, category: "Final Walk-Through", text: "Buckets have been removed.", completed: false, required: true },
  { id: 32, category: "Final Walk-Through", text: "TV, oven, proofer, and hot box are turned off.", completed: false, required: true },
  { id: 33, category: "Final Walk-Through", text: "Window is locked.", completed: false, required: true },
  { id: 34, category: "Final Walk-Through", text: "Safe is locked.", completed: false, required: true },
  { id: 35, category: "Final Walk-Through", text: "Both doors are locked.", completed: false, required: true },
  { id: 36, category: "Final Walk-Through", text: "Tea containers have been washed out.", completed: false, required: true },
];

const DEFAULT_CHECKLIST_ID = "closing";
const DEFAULT_CHECKLISTS: ChecklistMeta[] = [
  { id: DEFAULT_CHECKLIST_ID, name: "Closing Checklist", sections: DEFAULT_SECTIONS },
];
const DEFAULT_TASKS_BY_CHECKLIST: Record<string, Task[]> = {
  [DEFAULT_CHECKLIST_ID]: DEFAULT_TASKS,
};

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEY_CHECKLISTS = "@pizza_hut_v3_checklists";
const KEY_TASKS = "@pizza_hut_v3_tasks";
const KEY_ACTIVE = "@pizza_hut_v3_active";
const KEY_HISTORY = "@pizza_hut_v3_history";

// ─── ID generation ────────────────────────────────────────────────────────────

let _nextTaskId = 200;
function nextTaskId() { return _nextTaskId++; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

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

  // History
  completionHistory: CompletedChecklist[];
  completeChecklist: () => void;
  deleteHistoryEntry: (id: string) => void;
  clearHistory: () => void;
}

const ChecklistContext = createContext<ChecklistContextValue | null>(null);

export function ChecklistProvider({ children }: { children: React.ReactNode }) {
  const [checklists, setChecklists] = useState<ChecklistMeta[]>(DEFAULT_CHECKLISTS);
  const [activeId, setActiveId] = useState<string>(DEFAULT_CHECKLIST_ID);
  const [tasksByChecklist, setTasksByChecklist] = useState<Record<string, Task[]>>(
    DEFAULT_TASKS_BY_CHECKLIST
  );
  const [completionHistory, setCompletionHistory] = useState<CompletedChecklist[]>([]);
  const loaded = useRef(false);

  // ── Load from storage ──────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(KEY_CHECKLISTS),
      AsyncStorage.getItem(KEY_TASKS),
      AsyncStorage.getItem(KEY_ACTIVE),
      AsyncStorage.getItem(KEY_HISTORY),
    ]).then(([cl, tk, ac, hist]) => {
      try {
        if (cl) setChecklists(JSON.parse(cl));
        if (tk) {
          const parsed = JSON.parse(tk) as Record<string, Task[]>;
          setTasksByChecklist(parsed);
          let max = 200;
          for (const arr of Object.values(parsed)) {
            for (const t of arr) max = Math.max(max, t.id);
          }
          _nextTaskId = max + 1;
        }
        if (ac) setActiveId(JSON.parse(ac));
        if (hist) setCompletionHistory(JSON.parse(hist));
      } catch {}
      loaded.current = true;
    });
  }, []);

  // ── Persist on change ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY_CHECKLISTS, JSON.stringify(checklists));
  }, [checklists]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY_TASKS, JSON.stringify(tasksByChecklist));
  }, [tasksByChecklist]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY_ACTIVE, JSON.stringify(activeId));
  }, [activeId]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY_HISTORY, JSON.stringify(completionHistory));
  }, [completionHistory]);

  // ── Derived active data ────────────────────────────────────────────────────
  const activeMeta = checklists.find((c) => c.id === activeId) ?? checklists[0];
  const tasks = tasksByChecklist[activeMeta?.id] ?? [];
  const sections = activeMeta?.sections ?? [];

  // ── Multi-checklist ops ────────────────────────────────────────────────────
  const setActiveChecklistId = useCallback((id: string) => setActiveId(id), []);

  const addChecklist = useCallback((name: string) => {
    const id = uid();
    setChecklists((prev) => [...prev, { id, name, sections: [] }]);
    setTasksByChecklist((prev) => ({ ...prev, [id]: [] }));
    setActiveId(id);
  }, []);

  const updateChecklistName = useCallback((id: string, name: string) => {
    setChecklists((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }, []);

  const removeChecklist = useCallback(
    (id: string) => {
      setChecklists((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (next.length === 0) return prev;
        return next;
      });
      setTasksByChecklist((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setActiveId((prev) => {
        if (prev !== id) return prev;
        const remaining = checklists.filter((c) => c.id !== id);
        return remaining[0]?.id ?? prev;
      });
    },
    [checklists]
  );

  const reorderChecklists = useCallback(
    (newChecklists: ChecklistMeta[]) => setChecklists(newChecklists),
    []
  );

  // ── Task ops ───────────────────────────────────────────────────────────────
  const updateActiveTasks = useCallback(
    (fn: (tasks: Task[]) => Task[]) => {
      setTasksByChecklist((prev) => ({
        ...prev,
        [activeMeta.id]: fn(prev[activeMeta.id] ?? []),
      }));
    },
    [activeMeta?.id]
  );

  const toggleTask = useCallback(
    (id: number) =>
      updateActiveTasks((ts) => ts.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))),
    [updateActiveTasks]
  );

  const resetChecklist = useCallback(
    () => updateActiveTasks((ts) => ts.map((t) => ({ ...t, completed: false }))),
    [updateActiveTasks]
  );

  const addTask = useCallback(
    (category: string, text: string, required: boolean) =>
      updateActiveTasks((ts) => [
        ...ts,
        { id: nextTaskId(), category, text, completed: false, required },
      ]),
    [updateActiveTasks]
  );

  const updateTask = useCallback(
    (id: number, updates: Partial<Omit<Task, "id">>) =>
      updateActiveTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...updates } : t))),
    [updateActiveTasks]
  );

  const removeTask = useCallback(
    (id: number) => updateActiveTasks((ts) => ts.filter((t) => t.id !== id)),
    [updateActiveTasks]
  );

  // ── Section ops ────────────────────────────────────────────────────────────
  const updateActiveSections = useCallback(
    (fn: (sections: string[]) => string[]) => {
      setChecklists((prev) =>
        prev.map((c) => (c.id === activeMeta.id ? { ...c, sections: fn(c.sections) } : c))
      );
    },
    [activeMeta?.id]
  );

  const addSection = useCallback(
    (title: string) => updateActiveSections((s) => [...s, title]),
    [updateActiveSections]
  );

  const updateSection = useCallback(
    (oldTitle: string, newTitle: string) => {
      updateActiveSections((s) => s.map((x) => (x === oldTitle ? newTitle : x)));
      updateActiveTasks((ts) =>
        ts.map((t) => (t.category === oldTitle ? { ...t, category: newTitle } : t))
      );
    },
    [updateActiveSections, updateActiveTasks]
  );

  const removeSection = useCallback(
    (title: string) => {
      updateActiveSections((s) => s.filter((x) => x !== title));
      updateActiveTasks((ts) => ts.filter((t) => t.category !== title));
    },
    [updateActiveSections, updateActiveTasks]
  );

  const reorderSections = useCallback(
    (newSections: string[]) => updateActiveSections(() => newSections),
    [updateActiveSections]
  );

  const reorderTasksInSection = useCallback(
    (category: string, newSectionTasks: Task[]) => {
      updateActiveTasks((prev) => {
        const categoryIndices: number[] = [];
        prev.forEach((t, i) => { if (t.category === category) categoryIndices.push(i); });
        const result = [...prev];
        categoryIndices.forEach((idx, i) => { result[idx] = newSectionTasks[i]; });
        return result;
      });
    },
    [updateActiveTasks]
  );

  // ── History ops ────────────────────────────────────────────────────────────
  const completeChecklist = useCallback(() => {
    const snapshot: CompletedChecklist = {
      id: uid(),
      checklistId: activeMeta.id,
      checklistName: activeMeta.name,
      completedAt: new Date().toISOString(),
      sections: [...sections],
      tasks: tasks.map((t) => ({
        id: t.id,
        category: t.category,
        text: t.text,
        completed: t.completed,
        required: t.required,
      })),
    };
    setCompletionHistory((prev) => [snapshot, ...prev]);
    // Reset the checklist after saving
    updateActiveTasks((ts) => ts.map((t) => ({ ...t, completed: false })));
  }, [activeMeta, sections, tasks, updateActiveTasks]);

  const deleteHistoryEntry = useCallback((id: string) => {
    setCompletionHistory((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setCompletionHistory([]);
  }, []);

  return (
    <ChecklistContext.Provider
      value={{
        checklists,
        activeChecklistId: activeMeta?.id ?? activeId,
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
