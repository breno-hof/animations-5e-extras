/**
 * Works out which Automated Animations entries this module adds, updates or
 * removes. Pure: no Foundry globals, so it runs under `node --test`.
 *
 * Every entry this module wants is a copy of a D&D5e Animations entry (the
 * "source") under another label. The copy is taken from the world's own menus
 * when the source is there, so it follows D&D5e Animations updates and any
 * edits the GM made to the source, and from D&D5e Animations' autorec.json
 * otherwise.
 */

export const MENUS = ['melee', 'range', 'ontoken', 'templatefx', 'preset', 'aura', 'aefx'] as const;
export type Menu = (typeof MENUS)[number];

/** Written into metaData.name. D&D5e Animations leaves entries with any other name alone. */
export const META_NAME = 'Animations 5e Extras';
/** Names earlier releases wrote; their entries still count as this module's. */
const LEGACY_META_NAMES = new Set(['More 5e Animations']);

export interface AutorecEntry {
  id?: string;
  label: string;
  menu?: string;
  advanced?: { exactMatch?: boolean; excludedTerms?: string[]; [key: string]: unknown } | null;
  metaData?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export type Menus = Record<Menu, AutorecEntry[]>;

/** One label this module wants in a menu, and the entry to copy for it. */
export interface Wanted {
  menu: Menu;
  label: string;
  source: string;
  exactMatch?: boolean;
  excludedTerms?: string[];
  /** Dot paths into the copied entry, e.g. {"primary.video.color": "green"}. */
  overrides?: Record<string, unknown>;
}

export interface PlanInput {
  /** The world's current Automated Animations menus. */
  menus: Menus;
  /** D&D5e Animations' autorec.json, used when a source is missing from the world. */
  fallback: Partial<Menus> | null;
  wanted: Wanted[];
  /** Labels the GM chose not to have. Their entries are removed and never re-added. */
  ignored: string[];
  moduleVersion: string;
  randomId: () => string;
}

export interface Skip {
  menu: Menu;
  label: string;
  reason: 'exists' | 'modified' | 'noSource';
  source?: string;
}

export interface Plan {
  add: AutorecEntry[];
  update: AutorecEntry[];
  remove: AutorecEntry[];
  skipped: Skip[];
  /** The full menus to write, for those menus that change. */
  changed: Partial<Menus>;
}

export const rinse = (label: string): string => label.replace(/\s+/g, '').toLowerCase();

/** Automated Animations searches active effects apart from every other menu. */
const scopeOf = (menu: Menu): string => (menu === 'aefx' ? 'aefx' : 'main');

export const isOurs = (entry: AutorecEntry): boolean =>
  entry.metaData?.name === META_NAME || LEGACY_META_NAMES.has(String(entry.metaData?.name));

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** FNV-1a over everything but id and metaData: equal when two entries animate the same way. */
export function fingerprint(entry: AutorecEntry): string {
  const { id: _id, metaData: _metaData, ...content } = entry;
  const text = stableStringify(content);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let node = target;
  for (const key of keys.slice(0, -1)) {
    if (!node[key] || typeof node[key] !== 'object') node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]!] = structuredClone(value);
}

function build(wanted: Wanted, source: AutorecEntry, moduleVersion: string): AutorecEntry {
  const { id: _id, metaData: _metaData, ...copy } = structuredClone(source);
  const entry: AutorecEntry = { ...copy, label: wanted.label, menu: wanted.menu };
  entry.advanced = {
    ...(source.advanced ?? {}),
    exactMatch: wanted.exactMatch ?? source.advanced?.exactMatch ?? false,
    excludedTerms: wanted.excludedTerms ?? source.advanced?.excludedTerms ?? [],
  };
  for (const [path, value] of Object.entries(wanted.overrides ?? {})) setPath(entry, path, value);
  entry.metaData = {
    name: META_NAME,
    moduleVersion,
    source: wanted.source,
    fingerprint: fingerprint(entry),
    // Automated Animations shows label and menu in its metadata dialog.
    label: wanted.label,
    menu: wanted.menu,
  };
  return entry;
}

/** Later duplicates (same menu scope, same label once spaces and case are ignored) are dropped. */
export function dedupeWanted(wanted: Wanted[]): Wanted[] {
  const seen = new Set<string>();
  return wanted.filter((w) => {
    const key = `${scopeOf(w.menu)}|${rinse(w.label)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function planSync(input: PlanInput): Plan {
  const { menus, fallback, ignored, moduleVersion, randomId } = input;
  const wanted = dedupeWanted(input.wanted);
  const ignoredSet = new Set(ignored.map(rinse));
  const plan: Plan = { add: [], update: [], remove: [], skipped: [], changed: {} };

  const findSource = (menu: Menu, label: string): AutorecEntry | undefined =>
    menus[menu].find((e) => e.label === label && !isOurs(e)) ?? fallback?.[menu]?.find((e) => e.label === label);

  // Labels already taken in each scope, by whom.
  const owners = new Map<string, { menu: Menu; entry: AutorecEntry }>();
  for (const menu of MENUS) for (const entry of menus[menu]) owners.set(`${scopeOf(menu)}|${rinse(entry.label ?? '')}`, { menu, entry });

  const next: Menus = Object.fromEntries(MENUS.map((m) => [m, [...menus[m]]])) as Menus;
  const touched = new Set<Menu>();
  const kept = new Set<AutorecEntry>();

  for (const w of wanted) {
    if (ignoredSet.has(rinse(w.label))) continue;
    const owner = owners.get(`${scopeOf(w.menu)}|${rinse(w.label)}`);
    if (owner && !isOurs(owner.entry)) {
      plan.skipped.push({ menu: w.menu, label: w.label, reason: 'exists' });
      continue;
    }
    if (owner && fingerprint(owner.entry) !== owner.entry.metaData?.fingerprint) {
      // The GM edited our entry in Automated Animations: it is theirs now.
      kept.add(owner.entry);
      plan.skipped.push({ menu: owner.menu, label: w.label, reason: 'modified' });
      continue;
    }
    const source = findSource(w.menu, w.source);
    if (!source) {
      if (owner) kept.add(owner.entry);
      plan.skipped.push({ menu: w.menu, label: w.label, reason: 'noSource', source: w.source });
      continue;
    }
    const entry = build(w, source, moduleVersion);
    if (!owner) {
      entry.id = randomId();
      next[w.menu].push(entry);
      touched.add(w.menu);
      plan.add.push(entry);
    } else if (
      owner.menu !== w.menu ||
      owner.entry.metaData?.fingerprint !== entry.metaData?.fingerprint ||
      owner.entry.metaData?.name !== META_NAME // written under an old name: retag it
    ) {
      entry.id = owner.entry.id ?? randomId();
      next[owner.menu] = next[owner.menu].filter((e) => e !== owner.entry);
      next[w.menu].push(entry);
      touched.add(owner.menu).add(w.menu);
      plan.update.push(entry);
    } else {
      kept.add(owner.entry);
      continue;
    }
    kept.add(entry);
  }

  // Our entries that are no longer wanted, or now ignored.
  for (const menu of MENUS) {
    for (const entry of next[menu]) {
      if (!isOurs(entry) || kept.has(entry)) continue;
      const modified = fingerprint(entry) !== entry.metaData?.fingerprint;
      if (modified && !ignoredSet.has(rinse(entry.label))) continue;
      plan.remove.push(entry);
      touched.add(menu);
    }
    next[menu] = next[menu].filter((e) => !plan.remove.includes(e));
  }

  for (const menu of touched) {
    plan.changed[menu] = next[menu].sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''));
  }
  return plan;
}

/** Plan that removes every entry this module added, e.g. before uninstalling it. */
export function planRemoveAll(menus: Menus): Plan {
  const plan: Plan = { add: [], update: [], remove: [], skipped: [], changed: {} };
  for (const menu of MENUS) {
    const ours = menus[menu].filter(isOurs);
    if (!ours.length) continue;
    plan.remove.push(...ours);
    plan.changed[menu] = menus[menu].filter((e) => !isOurs(e));
  }
  return plan;
}
