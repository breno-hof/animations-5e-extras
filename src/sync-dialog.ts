import type { AutorecEntry, Plan, Skip } from './plan.ts';
import { getIgnored, setIgnored } from './settings.ts';
import { applyPlan, computePlan, computeRemoveAll, hasChanges } from './sync.ts';

const t = (key: string, data?: Record<string, string | number>): string =>
  data ? game.i18n.format(`MORE5EANIM.Sync.${key}`, data) : game.i18n.localize(`MORE5EANIM.Sync.${key}`);

const escape = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function list(title: string, items: string[], open = false): string {
  if (!items.length) return '';
  return `<details class="more5eanim-list"${open ? ' open' : ''}>
    <summary>${escape(title)} <span class="more5eanim-count">${items.length}</span></summary>
    <ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>
  </details>`;
}

const describe = (e: AutorecEntry): string =>
  `${escape(e.label)} <span class="more5eanim-muted">← ${escape(String(e.metaData?.source ?? ''))} (${escape(String(e.menu ?? ''))})</span>`;

const describeSkip = (s: Skip): string =>
  `${escape(s.label)} <span class="more5eanim-muted">(${escape(s.menu)}${s.source ? `, ${escape(s.source)}` : ''})</span>`;

function content(plan: Plan): string {
  const skipped = (reason: Skip['reason']) => plan.skipped.filter((s) => s.reason === reason).map(describeSkip);
  const summary = hasChanges(plan)
    ? t('Summary', { add: plan.add.length, update: plan.update.length, remove: plan.remove.length })
    : t('NothingToDo');
  return `<div class="more5eanim-sync">
    <p>${t('Intro')}</p>
    <p class="more5eanim-summary">${summary}</p>
    ${list(t('Added'), plan.add.map(describe))}
    ${list(t('Updated'), plan.update.map(describe), plan.update.length <= 20)}
    ${list(t('Removed'), plan.remove.map(describe), plan.remove.length <= 20)}
    ${list(t('SkippedExists'), skipped('exists'))}
    ${list(t('SkippedModified'), skipped('modified'))}
    ${list(t('SkippedNoSource'), skipped('noSource'))}
    <details class="more5eanim-list">
      <summary>${t('Ignored')}</summary>
      <p class="hint">${t('IgnoredHint')}</p>
      <textarea name="ignored" rows="6">${escape(getIgnored().join('\n'))}</textarea>
    </details>
  </div>`;
}

const readIgnored = (button: HTMLButtonElement): string[] => {
  const field = button.form?.elements.namedItem('ignored');
  const text = field instanceof HTMLTextAreaElement ? field.value : getIgnored().join('\n');
  return [...new Set(text.split('\n').map((line) => line.trim()).filter(Boolean))];
};

async function apply(ignored: string[]): Promise<void> {
  await setIgnored(ignored);
  // Recompute: the menus may have changed since the dialog opened (e.g. D&D5e Animations' own update ran).
  const plan = await computePlan(ignored);
  await applyPlan(plan);
  ui.notifications.info(
    hasChanges(plan)
      ? t('Done', { add: plan.add.length, update: plan.update.length, remove: plan.remove.length })
      : t('NothingToDo'),
  );
}

export async function openSyncDialog(plan?: Plan): Promise<void> {
  let current: Plan;
  try {
    current = plan ?? (await computePlan());
  } catch (error) {
    ui.notifications.error(`More D&D5e Animations | ${String(error)}`);
    return;
  }
  await foundry.applications.api.DialogV2.wait({
    window: { title: t('Title'), icon: 'fa-solid fa-wand-magic-sparkles' },
    position: { width: 640 },
    classes: ['more5eanim-dialog'],
    content: content(current),
    rejectClose: false,
    buttons: [
      {
        action: 'apply',
        label: t('Apply'),
        icon: 'fa-solid fa-check',
        default: true,
        callback: (_event, button) => apply(readIgnored(button)),
      },
      {
        action: 'removeAll',
        label: t('RemoveAll'),
        icon: 'fa-solid fa-trash',
        callback: async () => {
          const removal = computeRemoveAll();
          await applyPlan(removal);
          ui.notifications.info(t('Done', { add: 0, update: 0, remove: removal.remove.length }));
        },
      },
      { action: 'cancel', label: t('Cancel'), icon: 'fa-solid fa-xmark' },
    ],
  });
}

/** Settings menu entry: Foundry instantiates it and calls render(), which opens the dialog instead. */
export class SyncMenu extends foundry.applications.api.ApplicationV2 {
  override async render(): Promise<this> {
    await openSyncDialog();
    return this;
  }
}
