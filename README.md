# QTI Player Cookbook

Cookbook examples of a **QTI 3 player** built with [`@citolab/qti-components`](https://github.com/Citolab/qti-components) (the 10.0 `next` line), plain JavaScript, and Tailwind. A toolbar on top picks an example; each example is a page of its own with its own `<qti-test>` template, its own theme and its own QTI package.

**[▶️ Live demo](https://citolab.github.io/qti-player/)** · **[⚡ Open in StackBlitz](https://stackblitz.com/~/github.com/Citolab/qti-player?file=index.html)**

The player holds no opinion of its own: all behaviour comes from the QTI package.

## 🍳 Examples

| Example (`#/…`)  | Page                          | Package               | Theme (in the page) | Mode                                                                 |
| ---------------- | ----------------------------- | --------------------- | ------------------- | -------------------------------------------------------------------- |
| `formatief`      | `examples/formatief`          | `public/formatief`    | playful             | Formative: werkwoordspelling, 2 attempts, hint + explanation          |
| `facet`          | `examples/facet`              | `public/facet`        | kennisnet           | Summative, in the layout of Facet: question numbers at the bottom, overview        |
| `vraagtypen`     | `examples/vraagtypen`         | `public/vraagtypen`   | biologie            | One topic (fotosynthese) in 13 question types, all under each other (`navigate="section"`), one attempt per question, Nakijken per question |
| `adaptief-toets` | `examples/adaptief-toets`     | `public/adaptief-toets` | cito              | ⅔ + ⅙, adaptive **in the test**: `qti-branch-rule` skips the hulpvragen when a step is right straight away |
| `adaptief-item`  | `examples/adaptief-item`      | `public/adaptief-item`  | nacht (dark)      | The same four steps, adaptive **in the item**: one `adaptive="true"` item per step |
| `rekenen`        | `examples/rekenen`            | `public/rekenen`      | rekenen             | Rekenopdrachten: free order, 3 attempts, tip then explanation         |
| `examen`         | `examples/examen`             | `public/examen`       | examen              | Examen (Engels KB 2025 examenvariant): sections, simultaneous, hand in |
| `examenkompas`   | `examples/examenkompas`       | `public/examenkompas` | examenkompas        | Examenkompas (aardrijkskunde BB 2023, half the questions): one question at a time, Nakijken (scorer view + Punten for the open questions), a toolbar of plugins (bookmark, zoom, character sheet), host data per question (`initContext`: name, domain, points) |
| `wikiwijs`       | `examples/wikiwijs`           | `public/wikiwijs`     | wikiwijs            | The Wikiwijs Toetsen oefentoets (Kennisnet Demonstratietoets, CC BY-SA 4.0, 17 question types): Start, one question per card with Nakijken and an alert (goed / nog niet helemaal / niet goed), unlimited attempts, Volgende only after a check, the question list with ○ ✕ ✓ beside it or as a dropdown, Resultaat |

`index.html` is only the shell: the toolbar and an iframe. `#/<example>/<item>` deep-links to an item, e.g. `#/formatief/KOFSCHIP`.

### One file per example

Each `examples/<id>/index.html` is self-contained: the theme (a `<style>` with the `--cito-*` tokens), the `<qti-test>` template, and a two-line script. There is nothing shared to import, so an example can be copied out as it is; only the `PACKAGE` constant in its script points at the QTI package (`public/<id>/`).

Adding an example: a QTI package in `public/<id>/` (then `pnpm packages`), a copy of the closest example page, and a line in the `examples` list of the shell (`index.html`).

### Themes

The theme is the tier-1 tokens of the 10.0 theme (`--cito-color-primary`, `--cito-radius-field`, … see qti-components `packages/qti-theme/CONTRACT.md` §8) on `<html data-qti-theme="…">`. `item.css` derives everything else. The page's own Tailwind classes read the same `--cito-*` tokens (`bg-surface`, `text-ink`, `bg-brand`, `rounded-box`, mapped in an `@theme inline` block; every colour the page uses is set explicitly in its theme), so the chrome follows the theme together with the items and the test controls. playful, soft, kennisnet and cito are presets of qti-components' Storybook; `nacht` is the same tokens under `color-scheme: dark`.

## 🧠 What the QTI decides

| QTI                                                          | Player behaviour                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `navigation-mode="linear"`                                   | progress `steps`, no jumping back                                             |
| `navigation-mode="nonlinear"`                                | item buttons + previous                                                       |
| `submission-mode="individual"`                               | **Nakijken** button (`<test-end-attempt>`) + attempt badge                  |
| `submission-mode="simultaneous"`                             | items are scored silently on every change (`autoScoreItems`), **Inleveren**   |
| `<qti-item-session-control max-attempts="2">`                | Nakijken locks after 2 attempts or a correct answer, then Volgende unlocks  |
| `<qti-item-session-control show-feedback="true/false">`      | whether feedback stays visible after the last attempt                         |
| `qti-feedback-inline` / `qti-feedback-block`                 | inline feedback per choice, plus a block with a hint (attempt 1) or explanation (attempt 2) |
| `qti-rubric-block class="qti-rubric-discretionary-placement"`| instructions shown above the item                                             |
| `qti-outcome-processing` + `qti-test-feedback access="atEnd"`| result report: score, percentage and the matching test feedback               |

### Formative item pattern

Each formative item sets `FEEDBACK` from its own response processing. `numAttempts` separates the first attempt from the next ones:

```xml
<qti-response-condition>
  <qti-response-if>        <!-- SCORE >= MAXSCORE      --> FEEDBACK = GOED   </qti-response-if>
  <qti-response-else-if>   <!-- numAttempts <= 1       --> FEEDBACK = HINT   </qti-response-else-if>
  <qti-response-else>      <!-- after that             --> FEEDBACK = UITLEG </qti-response-else>
</qti-response-condition>
```

Choice feedback copies the response into an outcome (`KEUZE = RESPONSE`), so a `qti-feedback-inline identifier="A"` inside choice A appears when A was chosen.

## 🧩 Stamp context

`<test-stamp>` renders its template with `activeItem`, `activeSection`, `activeTestpart`, `test` and `view`. Handy fields for session control are `numAttempts`, `maxAttempts`, `done`, `optimal`, `score` and `maxScore`. The formatief example has a gear icon that shows the live context.

```html
<template type="if" if="{{ activeTestpart.submissionMode == 'individual' }}">
  <span>Poging {{ activeItem.numAttempts }} van {{ activeItem.maxAttempts }}</span>
  <test-end-attempt>Nakijken</test-end-attempt>
</template>
```

## ⚠️ What an example does itself

Almost nothing: it imports the components and `item.css`, puts the instructions in `#rubric`, and shows a result dialog from a `<test-stamp>` (answered, correct, points, and per question the status and bookmark). There is no session saving, no MAXSCORE seeding and no report page yet; those come later (`pnpm packages` still writes `declarations.json` for that).

## 🔧 Development

```bash
pnpm install
pnpm dev            # http://localhost:5173
pnpm test:browser   # vitest + playwright
```

**Opnieuw** in the dialog clears the example's saved state (sessionStorage) and its address, and reloads.
