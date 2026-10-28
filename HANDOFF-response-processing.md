# Handoff: scoped response processing in qti-components

Written 2026-10-22 for a fresh session (Opus 5.5). Scratch file, untracked, not part of the player: delete or move it when done.
The user speaks Dutch; code, comments and changesets are English.

## Where things are

| What | Where |
|---|---|
| Main qti-components checkout | `/Users/patrickklein/Projects/Edtech/QTI/qti-components`, branch `next`, HEAD `fbfc4785` |
| Experiment worktree (work here) | `/Users/patrickklein/Projects/Edtech/QTI/qti-components-processing-scope`, branch `experiment/processing-scope`, cut from `next`, nothing committed |
| The player (consumer, Tailwind cookbook) | `/Users/patrickklein/Projects/Edtech/QTI/qti-player` (see its CLAUDE.md) |
| Other consumers | `/Users/patrickklein/Projects/PrototypesQTI` (`Kennisnet/projects/shared/src/lib/qti/events.ts`, `Peilinglezen/apps/leesvaardigheid/src/app/components/assessment-test.component.tsx` still listen to the old `qti-outcome-changed`) |

Read `CLAUDE.md` / `CONTRIBUTING.md` in qti-components first. The repo has a pnpm monorepo in `packages/*`.

## The problem we started from

`QtiAssessmentItem.processResponse` (`packages/qti-elements/src/components/qti-assessment-item/qti-assessment-item.ts`) used to publish the item context at every step: attempt count, the QTI reset of a non-adaptive item's outcomes to their defaults (QTI info model section 2.5: non-adaptive items reset outcomes before each response processing; adaptive items do not), every `qti-set-outcome-value`, the completion status. Every consumer (qti-feedback*, test-navigation, test-end-attempt, modal feedback) saw states that never really exist (SCORE 0, FEEDBACK empty), then the real result. Visible effect: on a repeat attempt with the same answer a feedback element goes off and on again in one synchronous pass.

The user's mental model: a backend runs response processing once and returns all outcomes; the client then calls `updateOutcomeVariables(all)`. The client should behave the same: no intermediate states, one update at the end. The spec says nothing about publishing the intermediate state, so skipping it is allowed.

## What we found (facts from the code)

- Processing itself **relied on the in-between publishes**. Expressions read the item context they consume (`QtiExpression.context`, `packages/qti-base/src/abstract/qti-expression.ts`; `qti-custom-operator` has its own `_context`), and `qti-set-outcome-value` only reaches them through a new publish. So `SCORE = SCORE + 1` twice, or a later rule reading an outcome set by an earlier one, break if you simply publish once at the end. A working copy that the readers see is required.
- Every outcome **write** goes through `item.updateOutcomeVariable`: the `qti-set-outcome-value` event, `qti-lookup-outcome-value`, `qti-custom-operator`, `numAttempts`, `completionStatus`.
- **Readers** during a run: `QtiExpression.context` (all expressions: `qti-variable`, `qti-correct`, `qti-map-response`, `qti-index`, `qti-repeat`, `qti-default` ...), `qti-custom-operator._context` (also passed to inline JS as `context`), the item's own `getVariable` / `getOutcome`. `qti-lookup-outcome-value` reads only declaration tables (unchanged during a run).
- Nothing outside processing relied on the reset state: test-navigation, the numAttempts/optimal latches, qti-item, test-end-attempt listen to `qti-item-context-updated`, which was already sent once at the end. PrototypesQTI has `qti-outcome-changed` handlers using `detail`, one `computedContext` consumer, no custom expressions, no item-context consumers.
- `numAttempts` appears with type `response` in the computed context (not `outcome`), which once made `isDefaultResponse` false after a restored session (fixed in the main checkout, see below).

## What exists now in the worktree (experiment/processing-scope)

Done by a previous subagent, reviewed and unit-tested (not committed). Option A "scope with a global stack":

- `packages/qti-base/src/lib/processing-scope.ts` (new, exported from `packages/qti-base/src/index.ts`): `ProcessingScope` (a Map overlaid on the context at the start of the run, with `written`, `values`, `valid`, `context`), a stack of active runs (`openProcessingScope`, `closeProcessingScope`, `processingScopeOf`), and `scopedItemContext(node, consumed)`.
- `qti-expression.ts`: `context` became a getter returning the scope while a run of its item is active, else the consumed context; `qti-custom-operator.ts` the same; `qti-default.ts` lost a redundant `context` field (a field cannot override an accessor).
- `qti-assessment-item.ts`: `processResponse` creates the scope, runs validate, numAttempts, the reset (non-adaptive only), processing and completionStatus inside it (try/finally), then applies everything with one `#applyOutcomes` (one publish), then dispatches events. New public `updateOutcomeVariables([{identifier, value}])`; `updateOutcomeVariable` now delegates to it; during a run writes go to the scope; a run that throws applies nothing.
- Events: `cito-item-outcome-changed` and its legacy name `qti-outcome-changed` are **removed** (user decision; cito events are not released outside prereleases). Replaced by one batch event `cito-item-outcomes-changed`, `detail: { item, outcomes: [{ identifier, value }] }` (`OutcomesChangedDetails` in `packages/qti-elements/src/internal/event-types.ts`, declared in `public-events.ts`), sent after the publish. `internal/events/qti-outcome-changed.ts` is deleted.
- Spec: `packages/qti-elements/src/components/qti-assessment-item/qti-assessment-item.processing-scope.spec.ts` (6 tests: one publish per run with final values; `SCORE = SCORE + 1` twice gives 2 and a later rule sees it; a repeat attempt never publishes SCORE 0 / FEEDBACK default; adaptive keeps outcomes 2 then 4; event after the publish; a throwing run publishes nothing and leaves no scope; `updateOutcomeVariables` publishes once). `public-events.spec.ts` and three stories were updated for the removed event; `docs/public-api.mdx` and `.changeset/processing-scope.md` too.
- Results in the worktree: `pnpm vitest run --project tests` 159 files, 1143 tests passed (1 skipped). An earlier run with feedback work in it: VRT 17/17. Stories: 4 failures in `test-end-attempt.stories.ts` and 1 in `docs/formative-test.stories.ts`, all also failing on clean HEAD.

## What the user wants next (the design to build)

The user thinks there is **too much code in `qti-assessment-item.ts`** and proposed moving the scope into `qti-response-processing` (Option B):

> `qti-response-processing` subscribes to the variables in the item context and keeps a copy. On end-attempt it processes with its own copy, and when ready throws an event; the assessment item catches it and updates all outcome variables.

My assessment (agreed in discussion, not yet built):
- All expressions and `qti-set-outcome-value` are DOM descendants of `qti-response-processing`, so they find the copy with `closest('qti-response-processing')`. That removes the global stack, `processingScopeOf`, `scopedItemContext` and the getters in `qti-expression` / `qti-custom-operator`. The item only listens for the end event and publishes once.
- Take **one snapshot at the start of `process()`**, not a copy on every change: the processor already consumes the context (latest values), and processing is synchronous.
- `process()` could simply **return** the outcomes; an event is only needed if something else must listen. Pick the simpler one, keep the public contract described below.
- The reset to defaults (non-adaptive) belongs in the processor, on the copy (defaults are in the context as `defaultValue`).
- Open points to resolve (the risky part, can produce two publishes again):
  1. `numAttempts` and `completionStatus` are set by the item before / after processing and must land in the **same** publish. Options: pass `numAttempts` into the run (`process({ numAttempts })`) and have the item compute `completionStatus` from the result (check `#getCompletionStatus` only needs the final outcomes), or merge into one `updateOutcomeVariables`.
  2. Items **without** `qti-response-processing` still need numAttempts/completionStatus in one update (a small path stays in the item).
  3. `validate()` / `valid` must go out with the same publish.
  4. Adaptive items: no reset; completionStatus is set by the template (`qti-default`/adaptive template processing).
  5. Nested runs (an item processed while another run is active) and a run that throws (apply nothing, as now).
  6. Test-level `qti-outcome-processing` reads no item context and must stay untouched.
- Keep the public API: `updateOutcomeVariables`, `cito-item-outcomes-changed` after the publish. Decide whether `ProcessingScope` needs to be exported at all (my advice: keep it internal; with Option B it may not exist).

Acceptance: the six spec cases above still pass (rewrite the spec's setup if the internals changed), the whole `tests` project passes, VRT passes, `qti-assessment-item.ts` is clearly smaller than in the worktree's current version.

## Related work that is NOT in the worktree (main checkout, `next`, uncommitted)

These were removed from the experiment on purpose ("feedback should be rewritten onto the new scoped processing; remove it for now"). They live uncommitted in the main checkout:

1. **Feedback events** (staged): cancelable `cito-feedback-show` / `cito-feedback-hide` in `qti-base/src/abstract/qti-feedback.ts` plus `qti-feedback-block`, `qti-feedback-inline`, `qti-modal-feedback`, `internal/feedback-events.ts`, `qti-feedback-events.spec.ts`, a story `qti-feedback-events.stories.ts`, docs, `.changeset/feedback-show-event.md`. Design in its final form: right before `showStatus` changes the element dispatches the cancelable event; cancelling `show` keeps it off and the host shows the content itself (a `#hostShows` flag stops it asking again until the condition is gone, otherwise it asks on every context update); cancelling `hide` keeps it showing; no hide for taken-over feedback. Without publish-once, a repeat attempt sends hide then show in the same tick; with scoped processing it sends nothing (the outcome does not change). `show-hide="hide"` feedback is shown by default and hidden when the outcome matches the identifier (QTI spec); that case must keep working. Rework this on top of the scoped processing once that lands.
2. **Lock an item after its attempts are used**: in `packages/qti-test/src/components/test-navigation/test-navigation.ts` (`#lockUsedItems` after `willUpdate`), spec `test-navigation.attempts-used.spec.ts`, `.changeset/test-lock-used-attempts.md`. Non-adaptive item with `maxAttempts > 0` and `numAttempts >= maxAttempts` gets `disabled`; exempt with `auto-score-items` (that mode counts every answer as an attempt).
3. Already committed on `next`: `<test-end-attempt require-answer>` and own-item attempt ending (`fbfc4785`).

The player pages `examples/formatief` (inline feedback pop-in) and `examples/vraagtypen` (feedback block in a dialog) listen to `cito-feedback-show`; those only work against the main checkout, not the worktree.

## Environment gotchas

- The pre-commit hook (husky: VRT then lint-staged with `--hide-unstaged` and `vitest run --changed`) fails in the main checkout: three story files (`test-stamp`, `test-print-context`, `test-print-item-variables`) cannot load because the gitignored `custom-elements.json` lacks several `test-*` tags (`pnpm run cem` does not add them). Do not use `--no-verify` unless the user says so. Commit nothing unless asked.
- 4 stories in `test-end-attempt.stories.ts` and `docs/formative-test.stories.ts` fail on clean `next`; not caused by this work.
- The worktree has its own `node_modules` (installed with `pnpm install --frozen-lockfile --offline`).
- Commands: `pnpm vitest run --project tests [path]`, `pnpm run test:vrt` (compare only), `pnpm run cem`, `pnpm run tsc` (only starlight node_modules errors are expected).
- To try it in the player: link the worktree (`pnpm link` / the player's symlink to qti-components) and run `build:watch` there; the player's Vite server reloads on changes in `node_modules/@citolab/qti-components`.

## Decisions still open for the user

1. Changeset level for scoped processing: `minor` as written, or `major` on `next` (a third-party element reading the item context during processing now sees the pre-run state; `cito-item-outcomes-changed` replaces the per-outcome event; a `QtiExpression` subclass redeclaring `context` as a field gets TS2610). My advice: `major`.
2. A run that throws applies nothing, including the numAttempts increment (backend-like). My advice: keep.
3. Whether `ProcessingScope` and `updateOutcomeVariables` are public API (the latter yes; the former probably not).
