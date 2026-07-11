// LocalStorage utilities for saving and loading garden plans

import { GardenPlan } from '../types/plant';

const STORAGE_KEY = 'garden-planner-plans';
const CURRENT_PLAN_KEY = 'garden-planner-current';

// Generate a unique ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Load all saved plans
export function loadSavedPlans(): GardenPlan[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save all plans
function savePlans(plans: GardenPlan[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

// Save a single plan (create or update)
export function savePlan(plan: GardenPlan): void {
  const plans = loadSavedPlans();
  const existingIndex = plans.findIndex(p => p.id === plan.id);

  if (existingIndex >= 0) {
    plans[existingIndex] = { ...plan, updatedAt: new Date().toISOString() };
  } else {
    plans.push({ ...plan, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  savePlans(plans);
}

// Delete a plan
export function deletePlan(planId: string): void {
  const plans = loadSavedPlans().filter(p => p.id !== planId);
  savePlans(plans);
}

// Load the current working plan
export function loadCurrentPlan(): Partial<GardenPlan> | null {
  try {
    const data = localStorage.getItem(CURRENT_PLAN_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// Save the current working plan
export function saveCurrentPlan(plan: Partial<GardenPlan>): void {
  localStorage.setItem(CURRENT_PLAN_KEY, JSON.stringify(plan));
}

// Clear the current plan
export function clearCurrentPlan(): void {
  localStorage.removeItem(CURRENT_PLAN_KEY);
}

// Export plan as JSON file download
export function exportPlanAsJSON(plan: GardenPlan): void {
  const json = JSON.stringify(plan, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${plan.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-plan.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Import plan from JSON file
export function importPlanFromJSON(file: File): Promise<GardenPlan> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const plan = JSON.parse(content) as GardenPlan;

        // Validate required fields
        if (!plan.placedPlants || !Array.isArray(plan.placedPlants)) {
          throw new Error('Invalid plan file: missing placedPlants array');
        }

        // Assign new ID to avoid conflicts
        plan.id = generateId();
        plan.name = `${plan.name || 'Imported Plan'} (imported)`;
        plan.createdAt = new Date().toISOString();
        plan.updatedAt = new Date().toISOString();

        resolve(plan);
      } catch (err) {
        reject(new Error(`Failed to parse plan file: ${err instanceof Error ? err.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// Create a new empty plan
export function createNewPlan(name: string): GardenPlan {
  return {
    id: generateId(),
    name: name || 'Untitled Plan',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    backgroundImage: null,
    backgroundOpacity: 0.5,
    backgroundLocked: false,
    scalePixelsPerFoot: null,
    placedPlants: [],
    notes: '',
  };
}
