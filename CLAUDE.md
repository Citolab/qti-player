# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Uses pnpm (pinned via `packageManager`) and Node 24.15.0 (`.nvmrc`; kept below 24.16 because `playwright install` hangs there — bump together with CI and other QTI repos).

```bash
pnpm install
pnpm dev            # Vite dev server, http://localhost:5173
pnpm build          # production build to dist/ (base href = GitHub Pages URL)
pnpm test:browser   # builds with --mode testing, then runs vitest in Playwright/Chromium
```

Browser tests run against the **built** `dist/index.html` (`testerHtmlPath` in `vitest.workspace.js`), so rebuild with `pnpm vite build --mode testing` before re-running vitest after changing `index.html`. Single test:

```bash
pnpm vitest --config vitest.workspace.js tests/Player.test.ts -t "can move through test items"
```

`pnpm test:browser:slow` (or `STEP_DELAY=<ms> pnpm test:browser`) pauses before every click (`tests/pause.ts`), to follow a run in the Vitest browser UI.

Browser tests (the tester page is the shell, `dist/index.html`; `tests/frame.ts` loads a page in a same-origin iframe): `tests/Examples.test.ts` (shell tabs, every example opens in its theme, rekenen answer + Nakijken, examen hand-in) and `tests/Adaptief.test.ts` (clicks through the two adaptive examples: answer, Nakijken, Volgende, checking the route and the final score).

There is no linter configured. CI (`.github/workflows/publish.yml`) only installs, builds and deploys `dist/` to GitHub Pages on push to `main` — it does not run tests.

## Architecture

A cookbook: `index.html` is only a **shell** (toolbar + iframe, `#/<example>/<item>`). Every example is one self-contained page `examples/<id>/index.html` — its theme tokens (`<style>`), its `<qti-test>` template (markup, Tailwind classes only, no daisyUI) and its script — plus its own QTI package `public/<id>/`. There are no shared source files on purpose: a page can be copied out as is. The JavaScript is as small as possible: two imports (the components and `item.css`), and where a page has instructions, one line that puts the rubric block in `#rubric`. The examen also has a short script for the reading texts. The package is loaded with `test-url` on `<test-container>`, silent scoring is the `auto-score-items` attribute on `<test-navigation>`, and the Overzicht/Inleveren dialog is a `<test-stamp>` that shows the state of the test (answered, correct, points, per question the answer status and, in the examen, the bookmark), without code. A full report page comes later. Vite builds every `examples/*/index.html` as an entry (`vite.config.js`). Behaviour comes from `@citolab/qti-components` web components (`<qti-test>`, `<test-navigation>`, `<test-container>`, `<test-stamp>`, `<test-end-attempt>`, `<test-item-to-speech>`, …).

Core design principle (see README): **the player has no opinion of its own; all behaviour is driven by the QTI package** — `navigation-mode`, `submission-mode`, `qti-item-session-control` (`max-attempts`, `show-feedback`), feedback/rubric blocks and test outcome processing. When changing behaviour, prefer changing the QTI content or reading a QTI attribute over hard-coding per-route logic. UI conditions are expressed with `<test-stamp>` templates (`{{ activeTestpart.submissionMode == 'individual' }}`, `activeItem.numAttempts`, etc.); the gear-icon drawer shows the live stamp context.

Use the `cito-` public events (`cito-item-rubric-placement`, …) when code is needed; the old `qti-*` names are deprecated and log a warning.

### Themes (qti-components 10.0 `next`)

`@citolab/qti-components` is `10.0.0-next.15` (from the registry; during qti-components development it can be `pnpm link`ed from `../qti-components/packages/qti-components`). A theme is the tier-1 `--cito-*` tokens (`--cito-color-primary`, `--cito-radius-field`, …; qti-components `packages/qti-theme/CONTRACT.md` §8) on `<html data-qti-theme="…">`, in a `<style>` of the example page; `import "@citolab/qti-components/item.css"` derives the rest. The page's Tailwind classes read the same `--cito-*` tokens through an `@theme inline` block (`bg-surface`, `text-ink`, `bg-brand`, `border-line`, …), never the derived `--qti-*` ones; `page` and `line` are derived on the page with `color-mix` (the same formula as the theme's base-200/300). Every page therefore sets all the tier-1 colours it uses, since an unset input has no value outside the theme. The test controls (`<test-next>`, `<test-prev>`, item links, …) are painted by the theme, so they carry no button classes. Tailwind runs with its normal preflight, which resets `border` and `padding` on every element; since next.14 the controls paint theirs on an inner `part="button"`, out of reach of the page's `*` rule, so a page restyles a control with the `--test-button-*` slots or `test-next::part(button)`, never with padding/border on the host. The theme paints rubric blocks as grey callouts and feedback (`qti-feedback-block`, `-inline`, `qti-modal-feedback`) as grey bubbles with a hard shadow on `::part(feedback)`; a page that gives feedback its own look sets `box-shadow: none` there.

### Sequencing (pre-conditions, branch rules)

The test engine has `qti-number-presented` and `qtiTest.getTestFeedback()` (PR #300), `qti-pre-condition`, `qti-branch-rule`, `ITEMREF.VAR` lookups in `qti-variable`, boolean `qti-match`, extended-text `min-strings` (PR #289) and adaptive items that are `done` on `completionStatus = completed` (PR #298). each example page listens to `cito-test-end-reached` (opens the results). Whether an item is answered is `valid && !isDefaultResponse` in the stamp context: since next.14 `completionStatus` is `unknown` until an attempt is processed, so in a `simultaneous` part it says nothing before hand-in. Feedback asks the page before it shows: `cito-feedback-show` / `cito-feedback-hide` are cancelable (`detail`: `kind` block/inline/modal, `element`, `identifier`); `formatief` shows inline feedback as its own animated copy, `vraagtypen` shows the feedback block in a dialog. Skipped items are not tracked: QTI treats them as items that were not presented. A total over the candidate's own route belongs in the test's outcome processing: `adaptief-toets` computes `MAXSCORE` with `qti-number-presented` (the unscored intro item has category `unscored`).

### Examenkompas example

`examples/examenkompas` is the Examenkompas player (examenkompas.citolab.nl) as a cookbook page, on `public/examenkompas` (half of the `bb-ak-23-examenvariant` package from the Examenkompas Storybook: 23 questions and one info page, 8 open questions with `external-scored="human"`; no css, only the images the items use, the manifest trimmed to match). It imports `@citolab/qti-components/corrections` instead of the package root (one of the two, never both): the same elements with the correction variants, so `<test-show-correct-response>` (in the scorer view) marks the correct answer in the question; it is disabled for the open questions, which have no answer key. Everything else is a plugin inside `<test-navigation>`: `test-view-toggle` (Nakijken), `test-scoring-buttons` with a `<template>` of round buttons (Punten; disabled for questions the engine scores), `test-scoring-feedback`, `test-bookmark`, `test-zoom-in/-out/-reset` and `test-character-sheet` (both new in qti-components `next`, see below), `test-stamp` for the question circles, the question list and the Rapportage. What the host knows per question (name, domain, points) goes in with `initContext` on `<test-navigation>` as `name`, `domain`, `domainTitle`, `domainColor`, `points` and a template reads it as `item.<field>`; do not reuse a built-in name (`maxScore` is recomputed by `test-navigation` and would win). Two one-liners of JavaScript: `cito-test-switch-view` sets `data-view` on `<html>` (the toolbar shows Punten only in the scorer view) and `cito-test-navigate` closes the question list.

The zoom and character-sheet plugins exist only in the qti-components `next` source (`packages/qti-test/src/components/test-zoom/`, `test-character-sheet/`) until they are released; the player then runs on a symlink to `../qti-components/packages/qti-components` (build it with `pnpm run build` there) instead of the registry version in `package.json`.

### Wikiwijs example

`examples/wikiwijs` mimics the formative player of Wikiwijs Toetsen (toetsen.wikiwijs.nl/player/…/formative) on its own Kennisnet Demonstratietoets (`public/wikiwijs`, the QTI package the preview offers for download, CC BY-SA 4.0, 17 items, one per question type). The page starts on Start (`data-view` on `<html>`: `start`, `item`, `resultaat`; CSS shows `.only-*`), the test's own rubric block lands there through `cito-item-rubric-placement`, Starten is a `test-item-link` to the first item. Per question: `test-end-attempt require-answer` (Nakijken), a `test-stamp` that renders the alert (goed / nog niet helemaal / niet goed, from `numAttempts`, `optimal`, `score`) and hidden markers the CSS reads with `:has()` (`.needs-check` holds Volgende until the question is checked, `.is-optimal` hides Nakijken once the answer is right, `.is-last` swaps Volgende for the Resultaat button). A changed answer sets `data-dirty` on `<html>` (`cito-item-response-changed`, cleared by `cito-test-end-attempt` and navigation): the alert hides and Volgende waits for the next Nakijken, as Wikiwijs does. The question list (sidebar ≥ 1536px, else a `<details>` dropdown) shows ○ ✕ ✓ per question; Resultaat lists them all. The package's test part is `linear` without `qti-item-session-control`; the copy says `nonlinear` and `max-attempts="0"`, which is how Wikiwijs plays it (jump anywhere, check as often as you like).

### Adaptive packages

Two small demos of the same four-step mini-lesson (⅔ + ⅙), to compare where adaptivity lives: `public/adaptief-toets` adapts in the **test** (plain items + `qti-branch-rule`), `public/adaptief-item` adapts in the **item** (one `adaptive="true"` item per step, flow driven by a `FASE` outcome).

### Environment / base paths

`vite.config.js` sets `base: ''` (relative paths): examples reach their package with `../../<id>/`, so the site works from any folder (GitHub Pages included). The `VITE_BASE_HREF` of `env/` is no longer used. Vite watches `node_modules/@citolab/qti-components` and forces a full reload on any change, so qti-components can be linked from source during development.

### QTI content

Packages in `public/` are plain QTI 3 content packages (`examen` is the Questify `kb-en-25-examenvariant` export, with MAXSCORE/PERCENTAGE outcome processing added to its test) (`imsmanifest.xml`, `AssessmentTest.xml`, item XMLs). Formative items follow a pattern documented in the README: response processing sets `FEEDBACK` to `GOED` / `HINT` (first attempt) / `UITLEG` (later attempts) using `numAttempts`, and choice feedback copies `RESPONSE` into a `KEUZE` outcome so `qti-feedback-inline` per choice can show. UI text is Dutch.
