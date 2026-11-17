# More D&D5e Animations

More presets for [D&D5e Animations](https://github.com/MrVauxs/dnd5e-animations), for items it does not animate.

[Automated Animations](https://github.com/theripper93/autoanimations) picks an animation by matching the item's name against the labels in its global menus. D&D5e Animations fills those menus with English labels, so:

- **Translated items get nothing.** With the pt-BR compendium translations (Babele), "Espada Longa", "Raio de Fogo" and "Curar Ferimentos" never match "Longsword", "Fire Bolt" and "Cure Wounds". Short English labels also match inside Portuguese words: "Fe**rram**entas" plays "Ram", "Com**pan**heiro" plays "Pan".
- **Some items have no preset at all**, in any language: Detect Magic, Lucky, Legendary Resistance, Hungering Blade, Verdant Wisp, musical instruments, Spell Scroll, and more.

This module adds:

- **pt-BR labels** for 1,111 D&D5e Animations entries, generated from the Babele translation files of the official books (`data/translations.json`).
- **139 hand-picked labels** (English and pt-BR) for items D&D5e Animations does not cover, plus generic Portuguese weapon words (Machado, Arco, Besta, Espada…) and fixes for accidental matches (`data/aliases.json`).

## How it works

The module does not ship animation configs. Each entry is a **copy of a D&D5e Animations entry** (its "source") under another label: "Espada Longa" is a copy of "Longsword". The copy is taken from the world's own Automated Animations menus, so it follows D&D5e Animations updates and any change the GM made to the source. If a source is missing from the world, it is read from D&D5e Animations' `autorec.json`.

When a GM loads the world, the module compares what it wants with what is in the menus and, by default, asks before changing anything (*Configure Settings → More D&D5e Animations → Review and sync*). It never touches an entry it did not create:

| Situation | What happens |
|---|---|
| Label is free | Added |
| Source entry changed | Updated |
| Another entry already has the label (yours, D&D5e Animations', anyone's) | Skipped |
| You edited one of this module's entries in Automated Animations | Kept as is from then on |
| Label is in the *Ignored names* list | Removed and never added again |
| Label was dropped in a module update | Removed |

The entries are tagged `metaData.name: "More 5e Animations"`, so D&D5e Animations' own update menu keeps them. *Remove all* in the sync dialog takes them all out, e.g. before disabling the module.

## Installation

Requires Automated Animations and D&D5e Animations, and through them JB2A and PSFX (the Patreon versions are recommended).

Install with the manifest URL:

```
https://github.com/breno-hof/more-dnd5e-animations/releases/latest/download/module.json
```

## Development

```bash
npm install
npm run check      # typecheck, validate data, tests, build into dist/
npm run generate   # regenerate data/translations.json from installed modules
```

`npm run generate` reads D&D5e Animations and every `*-pt-br` Babele module from a Foundry modules folder (default `/srv/foundry-modules/base`, or pass `-- --modules <dir>`). Rerun it when D&D5e Animations or a translation module updates, and commit the result.

To add a preset, add an entry to `data/aliases.json`:

```json
{ "labels": ["Detect Magic", "Detectar Magia"], "source": "Identify", "menu": "ontoken" }
```

`source` must be a D&D5e Animations label in `menu` (see `data/source-labels.json`). Optional: `exactMatch`, `excludedTerms`, and `overrides` (dot paths into the copied entry, e.g. `{"primary.video.color": "green"}`). Automated Animations prefers the longest matching label, so a specific label ("Maça Golpeadora") wins over a generic one ("Golpe"). `npm run check-data` rejects unknown sources and labels that collide with D&D5e Animations'.

Release: bump `version` in `module.json` and `package.json`, then push a tag `vX.Y.Z`.

## Credits

- breno-hof - More D&D 5e Animations Module programmer [Patreon](https://www.patreon.com/c/brenohof)
- MrVauxs - D&D 5e Animations Module programmer [Patreon](https://www.patreon.com/mrvauxs) & [Ko-Fi](https://ko-fi.com/mrvauxs)
- Sisimshow - Animation configurations [Ko-Fi](https://ko-fi.com/sisimshow)
- Ben and Jules - Graphics [Patreon](https://www.patreon.com/JB2A)
- Peri - Sound effects [Patreon](https://www.patreon.com/PeriSFX)
- MorePurpleMoreBetter - Original sound configurations [Patreon](https://www.patreon.com/morepurplemorebetter) & [website](https://www.flapkan.com/)
