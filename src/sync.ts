import { wantedEntries } from './data.ts';
import { MENUS, planRemoveAll, planSync, type AutorecEntry, type Menus, type Plan } from './plan.ts';
import { getIgnored, MODULE_ID } from './settings.ts';

const SOURCE_MODULE = 'dnd5e-animations';

function manager() {
  const api = typeof AutomatedAnimations === 'undefined' ? undefined : AutomatedAnimations;
  if (!api?.AutorecManager) throw new Error('Automated Animations is not active.');
  return api.AutorecManager;
}

function readMenus(): Menus {
  const autorec = manager();
  return Object.fromEntries(
    MENUS.map((menu) => [menu, (autorec.getMenu(menu) ?? []).filter((e): e is AutorecEntry => !!e && typeof e === 'object')]),
  ) as Menus;
}

let fallback: Promise<Partial<Menus> | null> | undefined;

/** D&D5e Animations' own autorec.json, for sources the world does not have (e.g. never imported). */
function readFallback(): Promise<Partial<Menus> | null> {
  if (!game.modules.get(SOURCE_MODULE)?.active) return Promise.resolve(null);
  fallback ??= fetch(`modules/${SOURCE_MODULE}/module/autorec.json`)
    .then((response) => (response.ok ? (response.json() as Promise<Partial<Menus>>) : null))
    .catch(() => null);
  return fallback;
}

export async function computePlan(ignored: string[] = getIgnored()): Promise<Plan> {
  return planSync({
    menus: readMenus(),
    fallback: await readFallback(),
    wanted: wantedEntries(),
    ignored,
    moduleVersion: game.modules.get(MODULE_ID)?.version ?? '0.0.0',
    randomId: () => foundry.utils.randomID(16),
  });
}

export const computeRemoveAll = (): Plan => planRemoveAll(readMenus());

export const hasChanges = (plan: Plan): boolean => Object.keys(plan.changed).length > 0;

export async function applyPlan(plan: Plan): Promise<void> {
  const autorec = manager();
  for (const [menu, entries] of Object.entries(plan.changed)) await autorec.setMenu(menu, entries);
}
