# QTI Player Example

A minimal, fully functional **QTI 3 player** built with [`@citolab/qti-components`](https://github.com/Citolab/qti-components), plain JavaScript, Tailwind and [daisyUI](https://daisyui.com/). Everything lives in a single `index.html`.

The demo shows how **one player** delivers both formative and summative tests. The player holds no opinion of its own: all behaviour comes from the QTI package.

## 🗂️ Demo packages

| Route          | Package              | Mode                                                                 |
| -------------- | -------------------- | -------------------------------------------------------------------- |
| `#/formatief`  | `public/formatief`   | Formative: werkwoordspelling, 2 attempts, hint + explanation          |
| `#/summatief`  | `public/kennisnet-1` | Summative: browse freely, no feedback, result after handing in        |
| `#/oefenen`    | `public/kennisnet-2` | Practice: 1 attempt per question, feedback straight away              |

Deep links to an item work too: `#/formatief/KOFSCHIP`.

## 🧠 What the QTI decides

| QTI                                                          | Player behaviour                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `navigation-mode="linear"`                                   | progress `steps`, no jumping back                                             |
| `navigation-mode="nonlinear"`                                | item buttons + previous                                                       |
| `submission-mode="individual"`                               | **Controleer** button (`<test-end-attempt>`) + attempt badge                  |
| `submission-mode="simultaneous"`                             | items are scored silently on every change (`autoScoreItems`), **Inleveren**   |
| `<qti-item-session-control max-attempts="2">`                | Controleer locks after 2 attempts or a correct answer, then Volgende unlocks  |
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

`<test-stamp>` renders its template with `activeItem`, `activeSection`, `activeTestpart`, `test` and `view`. Handy fields for session control are `numAttempts`, `maxAttempts`, `done`, `optimal`, `score` and `maxScore`. Open the gear icon to see the live context.

```html
<template type="if" if="{{ activeTestpart.submissionMode == 'individual' }}">
  <span class="badge">Poging {{ activeItem.numAttempts }} van {{ activeItem.maxAttempts }}</span>
  <test-end-attempt class="btn btn-secondary">Controleer</test-end-attempt>
</template>
```

## ⚠️ Workarounds for qti-components 9.0.0

`index.html` contains two small, commented workarounds that can go once they are fixed upstream:

- `<qti-test-variables>` never finds its test element (selector typo `qti-asssessment-test` + missed connected event), so test totals are always 0. The player patches `getResult`.
- `qtiTest.outcomeProcessing()` only searches the light DOM. The player calls `process()` on the `qti-outcome-processing` inside the test instead.

Items are loaded lazily. Before reporting, the player adds the declared `MAXSCORE` of items that were never opened, so totals match the whole test.

## 🔧 Development

```bash
pnpm install
pnpm dev            # http://localhost:5173
pnpm test:browser   # vitest + playwright
```

Session state is kept per package in `sessionStorage`. Use **Opnieuw** or **Sessie wissen** to start over.
