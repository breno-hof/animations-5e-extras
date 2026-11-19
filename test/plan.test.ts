import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fingerprint, META_NAME, MENUS, planRemoveAll, planSync, type AutorecEntry, type Menus, type PlanInput } from '../src/plan.ts';

const menus = (partial: Partial<Menus>): Menus =>
  Object.fromEntries(MENUS.map((m) => [m, structuredClone(partial[m] ?? [])])) as Menus;

const longsword: AutorecEntry = {
  id: 'src1',
  label: 'Longsword',
  menu: 'melee',
  primary: { video: { animation: 'sword', color: 'white' } },
  metaData: { name: '5e Animations', version: 7 },
};

let ids = 0;
const input = (overrides: Partial<PlanInput>): PlanInput => ({
  menus: menus({ melee: [longsword] }),
  fallback: null,
  wanted: [{ menu: 'melee', label: 'Espada Longa', source: 'Longsword' }],
  ignored: [],
  moduleVersion: '1.0.0',
  randomId: () => `id${++ids}`,
  ...overrides,
});

/** Apply a plan to menus, as the module does with setMenu. */
const applied = (before: Menus, plan: ReturnType<typeof planSync>): Menus => ({ ...before, ...plan.changed });

test('adds a copy of the source under the new label, with our metadata', () => {
  const plan = planSync(input({}));
  assert.equal(plan.add.length, 1);
  const entry = plan.add[0]!;
  assert.equal(entry.label, 'Espada Longa');
  assert.deepEqual(entry.primary, longsword.primary);
  assert.equal(entry.metaData?.name, META_NAME);
  assert.equal(entry.metaData?.fingerprint, fingerprint(entry));
  assert.notEqual(entry.id, longsword.id);
  assert.deepEqual(plan.changed.melee?.map((e) => e.label), ['Espada Longa', 'Longsword']);
});

test('a second run changes nothing', () => {
  const first = input({});
  const after = applied(first.menus, planSync(first));
  const second = planSync(input({ menus: after }));
  assert.deepEqual(second.changed, {});
});

test('follows changes to the source entry', () => {
  const first = input({});
  const after = applied(first.menus, planSync(first));
  (after.melee.find((e) => e.label === 'Longsword')!.primary as { video: { color: string } }).video.color = 'red';
  const plan = planSync(input({ menus: after }));
  assert.equal(plan.update.length, 1);
  assert.equal((plan.update[0]!.primary as { video: { color: string } }).video.color, 'red');
  assert.equal(plan.update[0]!.id, after.melee.find((e) => e.label === 'Espada Longa')!.id);
});

test('never touches an entry someone else made with the same name', () => {
  const custom = { id: 'gm', label: 'espada longa', metaData: {} };
  const plan = planSync(input({ menus: menus({ melee: [longsword, custom] }) }));
  assert.deepEqual(plan.changed, {});
  assert.equal(plan.skipped[0]?.reason, 'exists');
});

test('a name taken in another menu counts too, except across the active-effect menu', () => {
  const taken = planSync(input({ menus: menus({ melee: [longsword], ontoken: [{ label: 'Espada Longa' }] }) }));
  assert.equal(taken.skipped[0]?.reason, 'exists');
  const effect = planSync(input({ menus: menus({ melee: [longsword], aefx: [{ label: 'Espada Longa' }] }) }));
  assert.equal(effect.add.length, 1);
});

test('keeps our entry once the GM edits it, even when it is no longer wanted', () => {
  const first = input({});
  const after = applied(first.menus, planSync(first));
  (after.melee.find((e) => e.label === 'Espada Longa')!.primary as { video: { color: string } }).video.color = 'blue';
  assert.equal(planSync(input({ menus: after })).skipped[0]?.reason, 'modified');
  assert.deepEqual(planSync(input({ menus: after, wanted: [] })).changed, {});
});

test('removes our entries that are no longer wanted or are ignored', () => {
  const first = input({});
  const after = applied(first.menus, planSync(first));
  assert.equal(planSync(input({ menus: after, wanted: [] })).remove.length, 1);
  const ignored = planSync(input({ menus: after, ignored: ['Espada  longa'] }));
  assert.equal(ignored.remove.length, 1);
  assert.deepEqual(ignored.changed.melee?.map((e) => e.label), ['Longsword']);
});

test('falls back to the D&D5e Animations file and reports missing sources', () => {
  const fromFile = planSync(input({ menus: menus({}), fallback: { melee: [longsword] } }));
  assert.equal(fromFile.add.length, 1);
  const missing = planSync(input({ menus: menus({}) }));
  assert.equal(missing.skipped[0]?.reason, 'noSource');
});

test('never copies one of our own entries as a source', () => {
  const ours = { label: 'Longsword', metaData: { name: META_NAME } };
  assert.equal(planSync(input({ menus: menus({ melee: [ours] }) })).skipped[0]?.reason, 'noSource');
});

test('applies exactMatch, excludedTerms and overrides; first duplicate wins', () => {
  const plan = planSync(
    input({
      wanted: [
        { menu: 'melee', label: 'Espada', source: 'Longsword', exactMatch: true, excludedTerms: ['Espadarte'], overrides: { 'primary.video.color': 'green' } },
        { menu: 'melee', label: 'ESPADA', source: 'Longsword' },
      ],
    }),
  );
  assert.equal(plan.add.length, 1);
  const entry = plan.add[0]!;
  assert.equal(entry.advanced?.exactMatch, true);
  assert.deepEqual(entry.advanced?.excludedTerms, ['Espadarte']);
  assert.equal((entry.primary as { video: { color: string } }).video.color, 'green');
  assert.equal((longsword.primary as { video: { color: string } }).video.color, 'white');
});

test('remove all takes out only our entries', () => {
  const first = input({});
  const after = applied(first.menus, planSync(first));
  const plan = planRemoveAll(after);
  assert.equal(plan.remove.length, 1);
  assert.deepEqual(plan.changed.melee?.map((e) => e.label), ['Longsword']);
});

test('entries from the old module name are ours: retagged, and removable', () => {
  const first = input({});
  const after = applied(first.menus, planSync(first));
  const legacy = after.melee.find((e) => e.label === 'Espada Longa')!;
  legacy.metaData = { ...legacy.metaData, name: 'More 5e Animations' };
  const plan = planSync(input({ menus: after }));
  assert.equal(plan.update.length, 1);
  assert.equal(plan.update[0]!.metaData?.name, META_NAME);
  assert.equal(plan.update[0]!.id, legacy.id);
  assert.equal(planRemoveAll(after).remove.length, 1);
});
