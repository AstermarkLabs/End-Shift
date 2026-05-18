import { CompletedChecklist } from '@/context/ChecklistContext';

// Mirrors the default "Closing Checklist" task list in ChecklistContext.
// Only needs id + required to generate realistic outcomes.
const CLOSING_TASKS: { id: number; category: string; text: string; required: boolean }[] = [
  { id: 1,  category: '1 Hour Before Closing',      text: 'Begin the daily count sheet and complete inventory counts.',                                                        required: true  },
  { id: 2,  category: '1 Hour Before Closing',      text: 'Ensure all required labels are completed; pull any labels that need to be removed.',                               required: true  },
  { id: 3,  category: '1 Hour Before Closing',      text: 'Pull product as required at this time.',                                                                           required: true  },
  { id: 4,  category: '1 Hour Before Closing',      text: 'Close the driver till.',                                                                                           required: true  },
  { id: 5,  category: '1 Hour Before Closing',      text: 'Remove all trash except one can; replace liners in all bins.',                                                     required: true  },
  { id: 6,  category: '1 Hour Before Closing',      text: 'Pull tea and thoroughly clean the coffee machine.',                                                                required: true  },
  { id: 7,  category: '1 Hour Before Closing',      text: 'Reduce operations to bare minimum.',                                                                               required: false },
  { id: 8,  category: '1 Hour Before Closing',      text: 'Wipe down countertops and the top of the make line.',                                                              required: true  },
  { id: 9,  category: '1 Hour Before Closing',      text: 'Place lids on the make line.',                                                                                     required: true  },
  { id: 10, category: '1 Hour Before Closing',      text: 'Sweep floors.',                                                                                                    required: true  },
  { id: 11, category: '1 Hour Before Closing',      text: 'Check the lobby for trash and dirty tables.',                                                                      required: false },
  { id: 12, category: '1 Hour Before Closing',      text: 'Check bathrooms for trash and debris.',                                                                            required: false },
  { id: 13, category: '30 Minutes Before Closing',  text: 'Filter the fryer.',                                                                                                required: true  },
  { id: 14, category: '30 Minutes Before Closing',  text: 'Enter inventory counts and complete closing procedures on the tablet.',                                            required: true  },
  { id: 15, category: '30 Minutes Before Closing',  text: 'Pull any remaining labels that are no longer needed.',                                                             required: true  },
  { id: 16, category: '30 Minutes Before Closing',  text: 'Remove sanitizer buckets.',                                                                                        required: true  },
  { id: 17, category: '30 Minutes Before Closing',  text: 'Mop floors if time permits.',                                                                                      required: false },
  { id: 18, category: '30 Minutes Before Closing',  text: 'Close the front till.',                                                                                            required: true  },
  { id: 19, category: 'Driver Area Cleaning',       text: 'Sweep the driver area, including under the sink and drying shelves.',                                              required: true  },
  { id: 20, category: 'Driver Area Cleaning',       text: 'Clean the dishwasher.',                                                                                            required: true  },
  { id: 21, category: 'Driver Area Cleaning',       text: 'Spray out and clean all trash bins.',                                                                              required: true  },
  { id: 22, category: 'Final Walk-Through',         text: 'Dishwasher is cleaned and turned off.',                                                                            required: true  },
  { id: 23, category: 'Final Walk-Through',         text: 'Dish bins are sprayed out.',                                                                                       required: true  },
  { id: 24, category: 'Final Walk-Through',         text: 'Sink areas on both sides of the dishwasher are clean.',                                                            required: true  },
  { id: 25, category: 'Final Walk-Through',         text: 'Back door is locked.',                                                                                             required: true  },
  { id: 26, category: 'Final Walk-Through',         text: 'All lights are turned off.',                                                                                       required: true  },
  { id: 27, category: 'Final Walk-Through',         text: 'Labels have been pulled.',                                                                                         required: true  },
  { id: 28, category: 'Final Walk-Through',         text: 'Make line lids are on.',                                                                                           required: true  },
  { id: 29, category: 'Final Walk-Through',         text: 'Counters are wiped down. LIDS are on cut table.',                                                                  required: true  },
  { id: 30, category: 'Final Walk-Through',         text: 'Trash has been taken out.',                                                                                        required: true  },
  { id: 31, category: 'Final Walk-Through',         text: 'Buckets have been removed.',                                                                                       required: true  },
  { id: 32, category: 'Final Walk-Through',         text: 'TV, oven, proofer, and hot box are turned off.',                                                                   required: true  },
  { id: 33, category: 'Final Walk-Through',         text: 'Window is locked.',                                                                                                required: true  },
  { id: 34, category: 'Final Walk-Through',         text: 'Safe is locked.',                                                                                                  required: true  },
  { id: 35, category: 'Final Walk-Through',         text: 'Both doors are locked.',                                                                                           required: true  },
  { id: 36, category: 'Final Walk-Through',         text: 'Tea containers have been washed out.',                                                                             required: true  },
];

const SECTIONS = [
  '1 Hour Before Closing',
  '30 Minutes Before Closing',
  'Driver Area Cleaning',
  'Final Walk-Through',
];

// Deterministic PRNG so the same seed always produces the same data set.
function makePrng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// Tasks that are commonly skipped — they'll show up in "Missed Steps".
const STUBBORN_IDS = new Set([2, 6, 13, 14, 20, 27, 36]);

/**
 * Generate `days` days of closing-shift history ending at `anchorDate`.
 * Outcome weights:
 *   - recent 28 days:  58% completed, 20% incomplete
 *   - older days:      74% completed, 12% incomplete
 * (No "late" or "missed" in the current data model — those require window
 *  times which aren't tracked yet.)
 */
export function generateMockHistory(
  anchorDate: Date = new Date(),
  days = 60,
  seed = 20260514,
): CompletedChecklist[] {
  const rand = makePrng(seed);
  const entries: CompletedChecklist[] = [];

  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date(anchorDate);
    day.setDate(day.getDate() - offset);

    const recent = offset < 28;
    const r = rand();

    // Skip ~10% of days (simulates no close logged)
    if (r < 0.10) continue;

    // Outcome weights
    const completedThreshold = recent ? 0.58 : 0.74;
    const isComplete = r < completedThreshold;

    // Pick which required tasks were missed
    const required = CLOSING_TASKS.filter(t => t.required);
    const missedRequiredIds = new Set<number>();

    if (!isComplete) {
      const dropCount = 1 + Math.floor(rand() * 3);
      const pool = [...required];
      for (let k = 0; k < dropCount && pool.length > 0; k++) {
        const stubbornPool = pool.filter(t => STUBBORN_IDS.has(t.id));
        const fromStubborn = stubbornPool.length > 0 && rand() < 0.65;
        const candidates = fromStubborn ? stubbornPool : pool;
        const choice = candidates[Math.floor(rand() * candidates.length)];
        missedRequiredIds.add(choice.id);
        pool.splice(pool.indexOf(choice), 1);
      }
    }

    // Optional tasks — ~55% of sessions do some
    const includeOptional = rand() < 0.55;
    const optionalDoneIds = new Set<number>(
      includeOptional
        ? CLOSING_TASKS.filter(t => !t.required && rand() < 0.7).map(t => t.id)
        : []
    );

    // Completion time: 1–3 hours before midnight
    const closeHour = 22 + Math.floor(rand() * 2);
    const closeMin  = Math.floor(rand() * 60);
    const completedAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), closeHour, closeMin, 0);

    const tasks = CLOSING_TASKS.map(t => ({
      id: t.id,
      category: t.category,
      subsection: null,
      text: t.text,
      required: t.required,
      completed: t.required
        ? !missedRequiredIds.has(t.id)
        : optionalDoneIds.has(t.id),
    }));

    entries.push({
      id: `mock-${offset}-${seed}`,
      checklistId: 'closing',
      checklistName: 'Closing Checklist',
      completedAt: completedAt.toISOString(),
      sections: SECTIONS,
      tasks,
    });
  }

  return entries;
}
