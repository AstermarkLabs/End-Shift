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

const INITIAL_TASKS: Task[] = [
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

const INITIAL_SECTIONS = [
  "1 Hour Before Closing",
  "30 Minutes Before Closing",
  "Driver Area Cleaning",
  "Final Walk-Through",
];

const TASKS_KEY = "@pizza_hut_tasks_v2";
const SECTIONS_KEY = "@pizza_hut_sections_v2";

interface ChecklistContextValue {
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
}

const ChecklistContext = createContext<ChecklistContextValue | null>(null);

let nextId = 100;

export function ChecklistProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [sections, setSections] = useState<string[]>(INITIAL_SECTIONS);
  const loaded = useRef(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(TASKS_KEY),
      AsyncStorage.getItem(SECTIONS_KEY),
    ]).then(([tasksData, sectionsData]) => {
      if (tasksData) {
        try {
          const parsed = JSON.parse(tasksData) as Task[];
          setTasks(parsed);
          const maxId = parsed.reduce((m, t) => Math.max(m, t.id), 0);
          nextId = maxId + 1;
        } catch {}
      }
      if (sectionsData) {
        try {
          setSections(JSON.parse(sectionsData));
        } catch {}
      }
      loaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(SECTIONS_KEY, JSON.stringify(sections));
  }, [sections]);

  const toggleTask = useCallback((id: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  }, []);

  const resetChecklist = useCallback(() => {
    setTasks((prev) => prev.map((t) => ({ ...t, completed: false })));
  }, []);

  const addTask = useCallback((category: string, text: string, required: boolean) => {
    setTasks((prev) => [
      ...prev,
      { id: nextId++, category, text, completed: false, required },
    ]);
  }, []);

  const updateTask = useCallback(
    (id: number, updates: Partial<Omit<Task, "id">>) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
    },
    []
  );

  const removeTask = useCallback((id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addSection = useCallback((title: string) => {
    setSections((prev) => [...prev, title]);
  }, []);

  const updateSection = useCallback((oldTitle: string, newTitle: string) => {
    setSections((prev) => prev.map((s) => (s === oldTitle ? newTitle : s)));
    setTasks((prev) =>
      prev.map((t) => (t.category === oldTitle ? { ...t, category: newTitle } : t))
    );
  }, []);

  const removeSection = useCallback((title: string) => {
    setSections((prev) => prev.filter((s) => s !== title));
    setTasks((prev) => prev.filter((t) => t.category !== title));
  }, []);

  return (
    <ChecklistContext.Provider
      value={{
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
