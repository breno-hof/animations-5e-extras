import { getSyncMode, MODULE_ID, registerSettings } from './settings.ts';
import { openSyncDialog, SyncMenu } from './sync-dialog.ts';
import { applyPlan, computePlan, hasChanges } from './sync.ts';

Hooks.once('init', () => {
  registerSettings(SyncMenu);
});

Hooks.once('ready', async () => {
  // One GM is enough; the menus are world settings.
  if (!game.user.isGM || game.users.activeGM?.isSelf !== true) return;
  const mode = getSyncMode();
  if (mode === 'off') return;
  try {
    const plan = await computePlan();
    if (!hasChanges(plan)) return;
    if (mode === 'prompt') return void openSyncDialog(plan);
    await applyPlan(plan);
    ui.notifications.info(
      game.i18n.format('ANIM5EX.Sync.Done', {
        add: plan.add.length,
        update: plan.update.length,
        remove: plan.remove.length,
      }),
    );
  } catch (error) {
    console.error(`${MODULE_ID} | sync failed`, error);
    ui.notifications.error(`Animations 5e Extras | ${String(error)}`);
  }
});
