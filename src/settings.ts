export const MODULE_ID = 'more-dnd5e-animations';

export const Setting = {
  SyncMode: 'syncMode',
  Ignored: 'ignored',
} as const;

/** What happens when a GM loads the world and the module has entries to add, update or remove. */
export type SyncMode = 'prompt' | 'auto' | 'off';

export function registerSettings(menuType: unknown): void {
  game.settings.registerMenu(MODULE_ID, 'sync', {
    name: 'MORE5EANIM.Settings.Sync.Name',
    label: 'MORE5EANIM.Settings.Sync.Label',
    hint: 'MORE5EANIM.Settings.Sync.Hint',
    icon: 'fa-solid fa-wand-magic-sparkles',
    type: menuType,
    restricted: true,
  });
  game.settings.register<SyncMode>(MODULE_ID, Setting.SyncMode, {
    name: 'MORE5EANIM.Settings.SyncMode.Name',
    hint: 'MORE5EANIM.Settings.SyncMode.Hint',
    scope: 'world',
    config: true,
    restricted: true,
    type: String,
    choices: {
      prompt: 'MORE5EANIM.Settings.SyncMode.Prompt',
      auto: 'MORE5EANIM.Settings.SyncMode.Auto',
      off: 'MORE5EANIM.Settings.SyncMode.Off',
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
