import React, { useState } from 'react';
import { CheckCircle2, Circle, RefreshCw, ChevronRight } from 'lucide-react';

const INITIAL_TASKS = [
  // 1 Hour Before Closing
  { id: 1, category: "1 Hour Before Closing (or sooner)", text: "Begin the daily count sheet and complete inventory counts.", completed: false },
  { id: 2, category: "1 Hour Before Closing (or sooner)", text: "Ensure all required labels are completed; pull any labels that need to be removed.", completed: false },
  { id: 3, category: "1 Hour Before Closing (or sooner)", text: "Pull product as required at this time.", completed: false },
  { id: 4, category: "1 Hour Before Closing (or sooner)", text: "Close the driver till.", completed: false },
  { id: 5, category: "1 Hour Before Closing (or sooner)", text: "Remove all trash except one can; replace liners in all bins.", completed: false },
  { id: 6, category: "1 Hour Before Closing (or sooner)", text: "Pull tea and thoroughly clean the coffee machine.", completed: false },
  { id: 7, category: "1 Hour Before Closing (or sooner)", text: "Reduce operations to bare minimum.", completed: false },
  { id: 8, category: "1 Hour Before Closing (or sooner)", text: "Wipe down countertops and the top of the make line.", completed: false },
  { id: 9, category: "1 Hour Before Closing (or sooner)", text: "Place lids on the make line.", completed: false },
  { id: 10, category: "1 Hour Before Closing (or sooner)", text: "Sweep floors.", completed: false },
  { id: 11, category: "1 Hour Before Closing (or sooner)", text: "Check the lobby for trash and dirty tables.", completed: false },
  { id: 12, category: "1 Hour Before Closing (or sooner)", text: "Check bathrooms for trash and debris.", completed: false },
  
  // 30 Minutes Before Closing
  { id: 13, category: "30 Minutes Before Closing", text: "Filter the fryer. When refilling, allow it to continue filling until you are ready to leave so no oil remains at the bottom.", completed: false },
  { id: 14, category: "30 Minutes Before Closing", text: "Enter inventory counts and complete closing procedures on the tablet.", completed: false },
  { id: 15, category: "30 Minutes Before Closing", text: "Pull any remaining labels that are no longer needed.", completed: false },
  { id: 16, category: "30 Minutes Before Closing", text: "Remove sanitizer buckets.", completed: false },
  { id: 17, category: "30 Minutes Before Closing", text: "Mop floors if time permits.", completed: false },
  { id: 18, category: "30 Minutes Before Closing", text: "Close the front till. At this point, only the window till should remain open.", completed: false },
  
  // Driver Area Cleaning
  { id: 19, category: "Driver Area Cleaning", text: "Sweep the driver area, including under the sink and drying shelves.", completed: false },
  { id: 20, category: "Driver Area Cleaning", text: "Clean the dishwasher.", completed: false },
  { id: 21, category: "Driver Area Cleaning", text: "Spray out and clean all trash bins.", completed: false },
  
  // Final Walk-Through
  { id: 22, category: "Final Walk-Through (Circle 8 Walk)", text: "Dishwasher is cleaned and turned off.", completed: false },
  { id: 23, category: "Final Walk-Through (Circle 8 Walk)", text: "Dish bins are sprayed out.", completed: false },
  { id: 24, category: "Final Walk-Through (Circle 8 Walk)", text: "Sink areas on both sides of the dishwasher are clean.", completed: false },
  { id: 25, category: "Final Walk-Through (Circle 8 Walk)", text: "Back door is locked.", completed: false },
  { id: 26, category: "Final Walk-Through (Circle 8 Walk)", text: "All lights are turned off.", completed: false },
  { id: 27, category: "Final Walk-Through (Circle 8 Walk)", text: "Labels have been pulled.", completed: false },
  { id: 28, category: "Final Walk-Through (Circle 8 Walk)", text: "Make line lids are on.", completed: false },
  { id: 29, category: "Final Walk-Through (Circle 8 Walk)", text: "Counters are wiped down. LIDS are on cut table.", completed: false },
  { id: 30, category: "Final Walk-Through (Circle 8 Walk)", text: "Trash has been taken out. (don't forget bathrooms)", completed: false },
  { id: 31, category: "Final Walk-Through (Circle 8 Walk)", text: "Buckets have been removed.", completed: false },
  { id: 32, category: "Final Walk-Through (Circle 8 Walk)", text: "TV, oven, proofer, and hot box are turned off.", completed: false },
  { id: 33, category: "Final Walk-Through (Circle 8 Walk)", text: "Window is locked.", completed: false },
  { id: 34, category: "Final Walk-Through (Circle 8 Walk)", text: "Safe is locked.", completed: false },
  { id: 35, category: "Final Walk-Through (Circle 8 Walk)", text: "Both doors are locked.", completed: false },
  { id: 36, category: "Final Walk-Through (Circle 8 Walk)", text: "Tea containers have been washed out.", completed: false }
];

export default function App() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);

  const toggleTask = (id) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  const resetChecklist = () => {
    setTasks(tasks.map(task => ({ ...task, completed: false })));
  };

  // Group tasks by category
  const categories = [...new Set(tasks.map(t => t.category))];
  
  // Progress calculations
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const progressPercentage = Math.round((completedTasks / totalTasks) * 100);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12">
      {/* Header Area */}
      <header className="bg-red-600 text-white p-6 shadow-md border-b-4 border-red-700 mb-6 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <img src="1000009900.png" alt="Pizza Hut Logo" className="w-8 h-8 object-contain" />
              Pizza Hut Closing Checklist
            </h1>
            <button 
              onClick={resetChecklist}
              className="flex items-center gap-2 bg-red-700 hover:bg-red-800 transition-colors px-4 py-2 rounded text-sm font-semibold active:scale-95 shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>
          
          {/* Overall Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium text-red-100">
              <span>Completion Progress</span>
              <span>{progressPercentage}% Complete ({completedTasks}/{totalTasks})</span>
            </div>
            <div className="w-full bg-red-800/50 h-3 rounded-full overflow-hidden">
              <div 
                className="bg-white h-full transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Checklist Body */}
      <main className="max-w-2xl mx-auto px-4 space-y-8">
        {categories.map((category, index) => {
          const categoryTasks = tasks.filter(t => t.category === category);
          const completedInCategory = categoryTasks.filter(t => t.completed).length;
          const isCategoryComplete = completedInCategory === categoryTasks.length;

          return (
            <section key={category} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className={`p-4 border-b transition-colors ${isCategoryComplete ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <ChevronRight className={`w-5 h-5 transition-transform ${isCategoryComplete ? 'text-red-600 rotate-90' : 'text-slate-400'}`} />
                    {category}
                  </h2>
                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${isCategoryComplete ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}>
                    {completedInCategory} / {categoryTasks.length}
                  </span>
                </div>
              </div>
              
              <ul className="divide-y divide-slate-100">
                {categoryTasks.map((task) => (
                  <li 
                    key={task.id} 
                    className={`flex items-start gap-4 p-4 cursor-pointer transition-colors hover:bg-slate-50 active:bg-slate-100 select-none ${task.completed ? 'opacity-60 bg-slate-50' : ''}`}
                    onClick={() => toggleTask(task.id)}
                  >
                    <button className="flex-shrink-0 mt-1 text-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-full">
                      {task.completed ? (
                        <CheckCircle2 className="w-7 h-7 text-red-600" />
                      ) : (
                        <Circle className="w-7 h-7" />
                      )}
                    </button>
                    <span className={`flex-grow text-base md:text-lg transition-all ${task.completed ? 'line-through text-slate-500' : 'text-slate-700'}`}>
                      {task.text}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </main>

      {/* Completion Status */}
      {progressPercentage === 100 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-full shadow-lg font-bold flex items-center gap-2 animate-bounce">
          <img src="1000009900.png" alt="Pizza Hut Logo" className="w-5 h-5 object-contain" />
          Shift Complete. Great job team!
        </div>
      )}
    </div>
  );
}
