import { inject } from 'vitest'

declare module 'vitest' {
  interface ProvidedContext {
    /** Milliseconds to wait before every click (STEP_DELAY, see vitest.workspace.js); 0 runs at full speed. */
    stepDelay: number
  }
}

/** Wait STEP_DELAY ms, so a run can be followed step by step in the browser UI. */
export const pause = () => new Promise(resolve => setTimeout(resolve, inject('stepDelay')))
