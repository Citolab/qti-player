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

`@citolab/qti-components` is `10.0.0-next.11`. A theme is the tier-1 `--cito-*` tokens (`--cito-color-primary`, `--cito-radius-field`, …; qti-components `packages/qti-theme/CONTRACT.md` §8) on `<html data-qti-theme="…">`, in a `<style>` of the example page; `import "@citolab/qti-components/item.css"` derives the rest. The page's Tailwind classes read the same `--cito-*` tokens through an `@theme inline` block (`bg-surface`, `text-ink`, `bg-brand`, `border-line`, …), never the derived `--qti-*` ones; `page` and `line` are derived on the page with `color-mix` (the same formula as the theme's base-200/300). Every page therefore sets all the tier-1 colours it uses, since an unset input has no value outside the theme. The test controls (`<test-next>`, `<test-prev>`, item links, …) are painted by the theme, so they carry no button classes. Tailwind runs with its normal preflight, which resets `border` and `padding` on every element; a page rule beats the `:host` styles of a custom element, so the test controls may lose their own border and padding. If that shows, fix it per control (the `--test-button-*` slots or explicit rules) rather than dropping preflight.

### Sequencing (pre-conditions, branch rules)

The test engine has `qti-number-presented` and `qtiTest.getTestFeedback()` (PR #300), `qti-pre-condition`, `qti-branch-rule`, `ITEMREF.VAR` lookups in `qti-variable`, boolean `qti-match`, extended-text `min-strings` (PR #289) and adaptive items that are `done` on `completionStatus = completed` (PR #298). each example page listens to `cito-test-end-reached` (opens the results). Skipped items are not tracked: QTI treats them as items that were not presented. A total over the candidate's own route belongs in the test's outcome processing: `adaptief-toets` computes `MAXSCORE` with `qti-number-presented` (the unscored intro item has category `unscored`).

### Adaptive packages

Two small demos of the same four-step mini-lesson (⅔ + ⅙), to compare where adaptivity lives: `public/adaptief-toets` adapts in the **test** (plain items + `qti-branch-rule`), `public/adaptief-item` adapts in the **item** (one `adaptive="true"` item per step, flow driven by a `FASE` outcome).

### Environment / base paths

`vite.config.js` sets `base: ''` (relative paths): examples reach their package with `../../<id>/`, so the site works from any folder (GitHub Pages included). The `VITE_BASE_HREF` of `env/` is no longer used. Vite watches `node_modules/@citolab/qti-components` and forces a full reload on any change, so qti-components can be linked from source during development.

### QTI content

Packages in `public/` are plain QTI 3 content packages (`examen` is the Questify `kb-en-25-examenvariant` export, with MAXSCORE/PERCENTAGE outcome processing added to its test) (`imsmanifest.xml`, `AssessmentTest.xml`, item XMLs). Formative items follow a pattern documented in the README: response processing sets `FEEDBACK` to `GOED` / `HINT` (first attempt) / `UITLEG` (later attempts) using `numAttempts`, and choice feedback copies `RESPONSE` into a `KEUZE` outcome so `qti-feedback-inline` per choice can show. UI text is Dutch.
