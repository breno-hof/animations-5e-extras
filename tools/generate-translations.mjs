// Generates data/translations.json: for every Automated Animations entry that
// D&D5e Animations ships, the pt-BR names the same item has in the Babele
// translation modules, so that translated items find their animation.
//
//   node tools/generate-translations.mjs [--modules <Foundry modules dir>]
//
// Only labels are written, never the animation config. At sync time the module
// copies the config from the D&D5e Animations entry already in the world.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const MODULES = flag('--modules', '/srv/foundry-modules/base');
const OUT = flag('--out', 'data/translations.json');

const MENUS = ['melee', 'range', 'ontoken', 'templatefx', 'preset', 'aura', 'aefx'];
// Automated Animations searches active effects (aefx) apart from everything else.
const scopeOf = (menu) => (menu === 'aefx' ? 'aefx' : 'main');
const rinse = (label) => label.replace(/\s+/g, '').toLowerCase();

// Short pt-BR words that occur inside unrelated names ("Rede" in "Parede",
// "Sono" in "Sonoro"). They only match an item with exactly that name.
const EXACT = new Set(['luz', 'voo', 'voar', 'rede', 'sono', 'azar', 'bote', 'laço', 'uivo', 'medo']);
// A pt-BR name seen only once next to a well-attested one is usually an
// activity or a one-off rewording, not the item's name.
const MIN_COUNT = 2;

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

/** Babele files: <module>-pt-br/packs/*.json and the dnd5e system's decito-dnd5e-pt-br/compendium/*.json. */
async function babeleFiles() {
  const files = [];
  for (const dir of await readdir(MODULES)) {
    if (!dir.endsWith('-pt-br')) continue;
    for (const sub of ['packs', 'compendium']) {
      let names;
      try {
        names = await readdir(join(MODULES, dir, sub));
      } catch {
        continue;
      }
      for (const name of names) if (name.endsWith('.json') && name !== 'mappings.json') files.push(join(MODULES, dir, sub, name));
    }
  }
  return files.sort();
}

/** English name -> Map(pt-BR name -> times seen), walking entries and the items and activities inside them. */
async function buildDictionary() {
  const dictionary = new Map();
  const add = (en, pt) => {
    if (typeof pt !== 'string' || !en || !pt.trim() || pt.trim() === en.trim()) return;
    const key = en.trim().toLowerCase();
    if (!dictionary.has(key)) dictionary.set(key, new Map());
    const counts = dictionary.get(key);
    counts.set(pt.trim(), (counts.get(pt.trim()) ?? 0) + 1);
  };
  const walk = (entries) => {
    if (!entries || typeof entries !== 'object') return;
    for (const [en, value] of Object.entries(entries)) {
      if (!value || typeof value !== 'object') continue;
      add(en, value.name);
      walk(value.items);
      walk(value.activities);
      walk(value.effects);
    }
  };
  const files = await babeleFiles();
  for (const file of files) {
    try {
      walk((await readJson(file)).entries);
    } catch (error) {
      console.warn(`skipped ${file}: ${error.message}`);
    }
  }
  return { dictionary, files: files.length };
}

const source = await readJson(join(MODULES, 'dnd5e-animations/module/autorec.json'));
const sourceManifest = await readJson(join(MODULES, 'dnd5e-animations/module.json'));
const { dictionary, files } = await buildDictionary();

const taken = { main: new Set(), aefx: new Set() };
for (const menu of MENUS) for (const entry of source[menu] ?? []) taken[scopeOf(menu)].add(rinse(entry.label));

// Words the dnd5e system itself translates rather than a compendium. dnd5e
// names concentration effects "<EFFECT.DND5E.StatusConcentrating>: <item>".
const SYSTEM_TERMS = { concentrating: 'Concentrado', concentrat: 'Concentra' };

const translateWhole = (term) => {
  const key = term.trim().toLowerCase();
  if (SYSTEM_TERMS[key]) return [{ pt: SYSTEM_TERMS[key], count: Infinity }];
  const counts = dictionary.get(key);
  if (!counts) return [];
  const top = Math.max(...counts.values());
  return [...counts].filter(([, count]) => count >= MIN_COUNT || count === top).map(([pt, count]) => ({ pt, count }));
};

/** pt-BR names for an English label. "Prefix: Suffix" labels (effects) are translated part by part. */
const translate = (term) => {
  const whole = translateWhole(term);
  const separator = term.indexOf(': ');
  if (whole.length || separator === -1) return whole;
  const prefix = translateWhole(term.slice(0, separator));
  const rest = term.slice(separator + 2);
  const suffix = rest.trim() ? translateWhole(rest) : [{ pt: '', count: Infinity }];
  return prefix.flatMap((p) =>
    suffix.map((s) => ({ pt: `${p.pt}: ${s.pt}`, count: Math.min(p.count, s.count) })),
  );
};

// Several English labels can share a pt-BR name ("Claw" and "Talon" are both
// "Garra"). The English label that most often translates to it wins.
const candidates = new Map();
let untranslated = 0;
for (const menu of MENUS) {
  for (const entry of source[menu] ?? []) {
    const names = translate(entry.label);
    if (names.length === 0) untranslated++;
    for (const { pt, count } of names) {
      const key = `${scopeOf(menu)}|${rinse(pt)}`;
      if (taken[scopeOf(menu)].has(rinse(pt))) continue;
      const best = candidates.get(key);
      if (best && best.count >= count) continue;
      const excludedTerms = (entry.advanced?.excludedTerms ?? [])
        .filter(Boolean)
        .flatMap((term) => [term, ...translate(term).map(({ pt: translated }) => translated)]);
      candidates.set(key, {
        count,
        entry: {
          menu,
          label: pt,
          source: entry.label,
          ...(EXACT.has(rinse(pt)) || entry.advanced?.exactMatch ? { exactMatch: true } : {}),
          ...(excludedTerms.length ? { excludedTerms: [...new Set(excludedTerms)] } : {}),
        },
      });
    }
  }
}

const entries = [...candidates.values()]
  .map(({ entry }) => entry)
  .sort((a, b) => a.menu.localeCompare(b.menu) || a.label.localeCompare(b.label, 'pt-BR'));

await writeFile(
  OUT,
  `${JSON.stringify({ lang: 'pt-BR', dnd5eAnimations: sourceManifest.version, entries }, null, 1)}\n`,
);
// Which labels D&D5e Animations has in which menu, so tools/check-data.mjs can
// validate data/aliases.json without D&D5e Animations installed.
const sourceLabels = Object.fromEntries(MENUS.map((menu) => [menu, (source[menu] ?? []).map((e) => e.label).sort()]));
await writeFile(
  join(OUT, '../source-labels.json'),
  `${JSON.stringify({ dnd5eAnimations: sourceManifest.version, ...sourceLabels }, null, 1)}\n`,
);
console.log(
  `${entries.length} pt-BR labels from ${files} Babele files (D&D5e Animations ${sourceManifest.version}); ` +
    `${untranslated} source labels have no translation.`,
);
