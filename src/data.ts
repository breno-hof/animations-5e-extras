import aliases from '../data/aliases.json' with { type: 'json' };
import translations from '../data/translations.json' with { type: 'json' };
import { MENUS, type Menu, type Wanted } from './plan.ts';

interface AliasEntry {
  labels: string[];
  source: string;
  menu: string;
  exactMatch?: boolean;
  excludedTerms?: string[];
  overrides?: Record<string, unknown>;
}

interface TranslationEntry {
  menu: string;
  label: string;
  source: string;
  exactMatch?: boolean;
  excludedTerms?: string[];
}

function asMenu(menu: string): Menu {
  if (!(MENUS as readonly string[]).includes(menu)) throw new Error(`unknown Automated Animations menu "${menu}"`);
  return menu as Menu;
}

function optional(entry: { exactMatch?: boolean; excludedTerms?: string[]; overrides?: Record<string, unknown> }) {
  return {
    ...(entry.exactMatch !== undefined ? { exactMatch: entry.exactMatch } : {}),
    ...(entry.excludedTerms !== undefined ? { excludedTerms: entry.excludedTerms } : {}),
    ...(entry.overrides !== undefined ? { overrides: entry.overrides } : {}),
  };
}

/** Everything this module adds. Hand-picked aliases come first, so they win over generated translations. */
export function wantedEntries(): Wanted[] {
  const fromAliases = (aliases.entries as AliasEntry[]).flatMap((a) =>
    a.labels.map((label) => ({ menu: asMenu(a.menu), label, source: a.source, ...optional(a) })),
  );
  const fromTranslations = (translations.entries as TranslationEntry[]).map((t) => ({
    menu: asMenu(t.menu),
    label: t.label,
    source: t.source,
    ...optional(t),
  }));
  return [...fromAliases, ...fromTranslations];
}
