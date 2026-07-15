import { useEffect } from 'react';
import type { GardenPlan, GardenZone } from './types/plant';

const CURRENT_PLAN_KEY = 'garden-planner-current';
type RecipeZone = GardenZone & { plantingRecipeId?: string };

function readCurrentPlan(): Partial<GardenPlan> | null {
  try {
    const raw = localStorage.getItem(CURRENT_PLAN_KEY);
    return raw ? JSON.parse(raw) as Partial<GardenPlan> : null;
  } catch {
    return null;
  }
}

function restoreRecipeSelection(): void {
  const host = document.querySelector<HTMLElement>('[data-recipe-react-host]');
  const select = host?.querySelector<HTMLSelectElement>('select');
  if (!host || !select) return;

  const modal = host.closest('div.fixed') || host.parentElement?.parentElement;
  const zoneName = modal?.querySelector('h3')?.textContent?.trim();
  if (!zoneName) return;

  const plan = readCurrentPlan();
  const zone = ((plan?.zones || []) as RecipeZone[]).find(item => item.name === zoneName);
  const savedRecipeId = zone?.plantingRecipeId;
  if (!savedRecipeId || select.value === savedRecipeId) return;
  if (![...select.options].some(option => option.value === savedRecipeId)) return;

  select.value = savedRecipeId;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

export default function RecipeSelectionPersistence() {
  useEffect(() => {
    let frame = 0;
    const scheduleRestore = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(restoreRecipeSelection);
    };

    const observer = new MutationObserver(scheduleRestore);
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleRestore();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
