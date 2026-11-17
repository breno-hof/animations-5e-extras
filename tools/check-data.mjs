// Validates data/aliases.json and data/translations.json against the labels
// D&D5e Animations ships (data/source-labels.json, written by the generator):
// every source must exist in its menu, and no new label may shadow one of
// D&D5e Animations' own (it would be skipped at sync time anyway).
import { readFile } from 'node:fs/promises';

const read = async (path) => JSON.parse(await readFile(path, 'utf8'));
const aliases = await read('data/aliases.json');
const translations = await read('data/translations.json');
const sourceLabels = await read('data/source-labels.json');

const MENUS = ['melee', 'range', 'ontoken', 'templatefx', 'preset', 'aura', 'aefx'];
const rinse = (label) => label.replace(/\s+/g, '').toLowerCase();
const scopeOf = (menu) => (menu === 'aefx' ? 'aefx' : 'main');

const taken = new Map();
for (const menu of MENUS) for (const label of sourceLabels[menu] ?? []) taken.set(`${scopeOf(menu)}|${rinse(label)}`, `${menu}:${label}`);

const errors = [];
const seenAliases = new Map();
for (const [index, alias] of aliases.entries.entries()) {
  const where = `aliases[${index}] (${alias.labels?.[0]})`;
  if (!MENUS.includes(alias.menu)) errors.push(`${where}: unknown menu "${alias.menu}"`);
  else if (!sourceLabels[alias.menu]?.includes(alias.source)) errors.push(`${where}: no "${alias.source}" in ${alias.menu}`);
  if (!Array.isArray(alias.labels) || alias.labels.length === 0) errors.push(`${where}: labels must be a non-empty array`);
  for (const label of alias.labels ?? []) {
    const key = `${scopeOf(alias.menu)}|${rinse(label)}`;
    if (taken.has(key)) errors.push(`${where}: "${label}" is already D&D5e Animations' ${taken.get(key)}`);
    if (seenAliases.has(key)) errors.push(`${where}: "${label}" repeats ${seenAliases.get(key)}`);
    seenAliases.set(key, where);
  }
}
for (const entry of translations.entries) {
  if (!sourceLabels[entry.menu]?.includes(entry.source)) errors.push(`translation "${entry.label}": no "${entry.source}" in ${entry.menu}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(
  `ok: ${aliases.entries.length} aliases (${seenAliases.size} labels), ${translations.entries.length} translations ` +
    `against D&D5e Animations ${sourceLabels.dnd5eAnimations}`,
);
