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

Browser tests: `tests/Player.test.ts` (default route) and `tests/Rekengesprek.test.ts`, which loads the player in a same-origin iframe on the `#/rekengesprek` and `#/rekengesprek-adaptief` routes and clicks through them (answer, Controleer, Volgende), checking the route and the final score.

There is no linter configured. CI (`.github/workflows/publish.yml`) only installs, builds and deploys `dist/` to GitHub Pages on push to `main` — it does not run tests.

## Architecture

The whole player is **one file: `index.html`** — markup, Tailwind (browser CDN build) + daisyUI classes, and a single inline `<script type="module">`. There is no app framework; behaviour comes from `@citolab/qti-components` web components (`<qti-test>`, `<test-navigation>`, `<test-container>`, `<test-stamp>`, `<test-end-attempt>`, `<test-item-to-speech>`, …). `src/themes.css` holds daisyUI theme definitions. `wc.config.js` only configures the web-components language server against the qti-components custom-elements manifest.

Core design principle (see README): **the player has no opinion of its own; all behaviour is driven by the QTI package** — `navigation-mode`, `submission-mode`, `qti-item-session-control` (`max-attempts`, `show-feedback`), feedback/rubric blocks and test outcome processing. When changing behaviour, prefer changing the QTI content or reading a QTI attribute over hard-coding per-route logic. UI conditions are expressed with `<test-stamp>` templates (`{{ activeTestpart.submissionMode == 'individual' }}`, `activeItem.numAttempts`, etc.); the gear-icon drawer shows the live stamp context.

Script flow in `index.html`:
1. **Routing**: `#/<route>/<itemId>`; a `packages` map translates route → folder in `public/` (`formatief` → `formatief`, `summatief` → `kennisnet-1`, `oefenen` → `kennisnet-2`). Changing package triggers a full reload. Adding a demo package = add a folder in `public/` + entry in `packages` + a tab link.
2. **Loading**: `getManifestInfo(<folder>/imsmanifest.xml)` gives the test URL set on `<test-container>`; optional `<folder>/items.json` feeds `testNavigation.initContext`; `<folder>/declarations.json` (written by `pnpm packages` → `tools/item-declarations.mjs`) holds each item's declared `MAXSCORE`, seeded with `qtiTest.updateItemVariables` on `cito-test-loaded`. Rerun `pnpm packages` after changing a package.
3. **Session**: `qtiTest.state` (a `QtiTestState`: answers + position) is saved to `sessionStorage` per package on `cito-test-state-changed` and assigned back before the test loads; `<qti-test navigate="item">` then opens the restored item, or the first one. On `cito-test-loaded`, `autoScoreItems` is enabled for `simultaneous` submission and a deep-linked item is opened. `cito-test-navigated` updates the hash via `replaceState`.
4. **Results** (`window.showResults`): runs `qtiTest.outcomeProcessing()`, and renders matching `qti-test-feedback` (qti-components renders nothing for it).

Use the `cito-` public events (`cito-test-loaded`, `cito-test-navigated`, `cito-test-state-changed`, `cito-item-rubric-placement`, …); the old `qti-*` names are deprecated and log a warning.

### Sequencing (pre-conditions, branch rules)

`@citolab/qti-components` is `10.0.0-next.2` (the `next` dist-tag), which has `qti-pre-condition`, `qti-branch-rule`, `ITEMREF.VAR` lookups in `qti-variable`, boolean `qti-match`, extended-text `min-strings` (PR #289) and adaptive items that are `done` on `completionStatus = completed` (PR #298). `index.html` listens to `cito-test-end-reached` (opens the results). Skipped items are not tracked: QTI treats them as items that were not presented. A total over the candidate's own route belongs in the test's outcome processing (`qti-number-presented`, coming in qti-components; see `docs/rekengesprek-qti3-findings.md`).

### Rekengesprek packages

Two small demos of the same four-step mini-lesson (½ + ¼), to compare where adaptivity lives: `public/rekengesprek` adapts in the **test** (plain items + `qti-branch-rule`), `public/rekengesprek-adaptief` adapts in the **item** (one `adaptive="true"` item per step, flow driven by a `FASE` outcome). Both are generated: edit `tools/rekengesprek/generate.mjs` and run `node tools/rekengesprek/generate.mjs` rather than editing the XML. Findings (what works in the player, what doesn't, what doesn't fit QTI 3) are in `docs/rekengesprek-qti3-findings.md`.

### Environment / base paths

`vite.config.js` sets `envDir: ./env` and `base: ''` (relative paths); the actual base href comes from `VITE_BASE_HREF` per mode (`env/.env.development|production|testing`). Vite watches `node_modules/@citolab/qti-components` and forces a full reload on any change, so qti-components can be linked from source during development.

### QTI content

Packages in `public/` are plain QTI 3 content packages (`imsmanifest.xml`, `AssessmentTest.xml`, item XMLs). Formative items follow a pattern documented in the README: response processing sets `FEEDBACK` to `GOED` / `HINT` (first attempt) / `UITLEG` (later attempts) using `numAttempts`, and choice feedback copies `RESPONSE` into a `KEUZE` outcome so `qti-feedback-inline` per choice can show. UI text is Dutch.
