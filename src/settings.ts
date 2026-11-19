export const MODULE_ID = 'animations-5e-extras';

export const Setting = {
  SyncMode: 'syncMode',
  Ignored: 'ignored',
} as const;

/** What happens when a GM loads the world and the module has entries to add, update or remove. */
export type SyncMode = 'prompt' | 'auto' | 'off';

export function registerSettings(menuType: unknown): void {
  game.settings.registerMenu(MODULE_ID, 'sync', {
    name: 'ANIM5EX.Settings.Sync.Name',
    label: 'ANIM5EX.Settings.Sync.Label',
    hint: 'ANIM5EX.Settings.Sync.Hint',
    icon: 'fa-solid fa-wand-magic-sparkles',
    type: menuType,
    restricted: true,
  });
  game.settings.register<SyncMode>(MODULE_ID, Setting.SyncMode, {
    name: 'ANIM5EX.Settings.SyncMode.Name',
    hint: 'ANIM5EX.Settings.SyncMode.Hint',
    scope: 'world',
    config: true,
    restricted: true,
    type: String,
    choices: {
      prompt: 'ANIM5EX.Settings.SyncMode.Prompt',
      auto: 'ANIM5EX.Settings.SyncMode.Auto',
      off: 'ANIM5EX.Settings.SyncMode.Off',
    },
    default: 'prompt',
  });
  game.settings.register<string[]>(MODULE_ID, Setting.Ignored, {
    scope: 'world',
    config: false,
    type: Array,
    default: [],
  });
}

export const getSyncMode = (): SyncMode => game.settings.get(MODULE_ID, Setting.SyncMode) as SyncMode;

export function getIgnored(): string[] {
  const value = game.settings.get(MODULE_ID, Setting.Ignored);
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export const setIgnored = (labels: string[]): Promise<unknown> => game.settings.set(MODULE_ID, Setting.Ignored, labels);
