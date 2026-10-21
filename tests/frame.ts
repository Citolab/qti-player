import { vi } from 'vitest'

/** Poll until `check` returns something truthy, and return it. */
export const until = <T>(check: () => T | undefined | null | false, message: string, timeout = 15000): Promise<T> =>
  vi.waitFor(
    () => {
      const value = check()
      if (!value) throw new Error(message)
      return value
    },
    { timeout, interval: 50 }
  )

export interface QtiTest extends HTMLElement {
  state: { session: { navItemRefId?: string } }
}

let frame: HTMLIFrameElement | undefined

/** Remove the frame of the previous test. */
export function closeFrame() {
  frame?.remove()
  frame = undefined
}

/**
 * Load a page in an iframe (same origin, so a test can reach into it) and wait until its test has an item on screen.
 * `page` is relative to the shell, e.g. `examples/formatief/index.html`; `ready` is the selector that must be on the page.
 */
export async function openPage(page: string, ready = 'qti-test') {
  sessionStorage.clear() // same origin and tab: the iframe shares it, so every test starts fresh
  frame = document.createElement('iframe')
  frame.style.cssText = 'width: 1200px; height: 900px'
  frame.src = new URL(page, document.baseURI).href
  document.body.append(frame)

  const doc = await until(() => frame!.contentDocument?.querySelector(ready) && (ready !== 'qti-test' || frame!.contentWindow?.customElements.get('qti-test')) && frame!.contentDocument, `${page} did not load`)
  return { frame, doc }
}
