import { afterEach, expect, test, vi } from 'vitest'
import { pause } from './pause'

/**
 * The adaptive demos, driven through the real controls: answer, Controleer, Volgende.
 *
 * The tester page is the player itself on its default route, so each test loads the player in an
 * iframe on the route it needs (same origin, so the test can reach into it).
 */

let frame: HTMLIFrameElement | undefined

afterEach(() => {
  frame?.remove()
  frame = undefined
})

const until = <T>(check: () => T | undefined | null | false, message: string, timeout = 15000): Promise<T> =>
  vi.waitFor(
    () => {
      const value = check()
      if (!value) throw new Error(message)
      return value
    },
    { timeout, interval: 50 }
  )

interface QtiTest extends HTMLElement {
  state: { session: { navItemRefId?: string } }
}

async function openPlayer(route: string) {
  sessionStorage.clear() // same origin and tab: the iframe shares it, so every test starts fresh
  frame = document.createElement('iframe')
  frame.style.cssText = 'width: 1200px; height: 900px'
  frame.src = new URL(`index.html#/${route}`, document.baseURI).href
  document.body.append(frame)

  const doc = await until(() => frame!.contentWindow?.customElements.get('qti-test') && frame!.contentDocument, 'player did not load')
  const qtiTest = doc.querySelector('qti-test') as QtiTest
  const current = () => qtiTest.state?.session?.navItemRefId
  const item = () => doc.querySelector('test-container')?.shadowRoot?.querySelector('qti-assessment-item')
  const button = (tag: string) => doc.querySelector(tag) as HTMLElement
  const enabled = (tag: string) => !button(tag).hasAttribute('disabled')

  /** Click an element inside the item that is on screen. */
  const click = async (selector: string) => {
    const el = await until(() => item()?.querySelector<HTMLElement>(selector), `${selector} not found on ${current()}`)
    await pause()
    el.click()
  }

  /** Controleer: end the attempt. */
  const check = async () => {
    await until(() => enabled('test-end-attempt'), `Controleer stays disabled on ${current()}`)
    await pause()
    button('test-end-attempt').click()
  }

  /** Volgende: wait until it unlocks, click it, and return the item the test moved to. */
  const next = async () => {
    const from = current()
    await until(() => enabled('test-next'), `Volgende stays disabled on ${from}`)
    await pause()
    button('test-next').click()
    return until(() => (current() !== from || resultsOpen()) && current(), `stayed on ${from}`)
  }

  /** Answer the item on screen, check it and go on. */
  const answer = async (selector: string) => {
    await click(selector)
    await check()
    return next()
  }

  const resultsOpen = () => (doc.querySelector('#results') as HTMLDialogElement).open
  const results = async () => {
    await until(resultsOpen, 'the results did not open')
    return {
      score: doc.querySelector('#result-score')!.textContent,
      feedback: doc.querySelector('#result-feedback')!.textContent!.trim(),
    }
  }

  await until(item, 'no item on screen')
  return { doc, current, click, check, next, answer, results, enabled, item }
}

const choice = (id: string) => `qti-simple-choice[identifier="${id}"]`
const hotspot = (id: string) => `qti-hotspot-choice[identifier="${id}"]`
/** A choice of the item's main question (adaptive items also hold the follow-up questions). */
const mainChoice = (id: string) => `qti-choice-interaction[response-identifier="RESPONSE"] ${choice(id)}`

test('adaptief via de toets: every step right straight away skips all follow-up questions', async () => {
  const player = await openPlayer('adaptief-toets')
  expect(player.current()).toBe('DAGBOEK')

  await player.click(choice('BLIJ'))
  expect(await player.answer(choice('ZELFSTANDIG'))).toBe('TELLER')
  expect(await player.answer(hotspot('A_T'))).toBe('NOEMER')
  // working zelfstandig: no tussenvraag: straight to the first main question
  expect(await player.answer(hotspot('B_N'))).toBe('S1_MAIN')
  expect(await player.answer(choice('A'))).toBe('S2_MAIN')
  expect(await player.answer(choice('B'))).toBe('S3_MAIN')
  expect(await player.answer(choice('B'))).toBe('S4_MAIN')
  await player.click(choice('A'))
  await player.check()
  await player.next() // the branch rule ends the test (EXIT_TEST)

  // MAXSCORE counts only the presented scored items (qti-number-presented)
  expect(await player.results()).toEqual({
    score: '6 / 6',
    feedback: expect.stringContaining('Alle vier de stappen in één keer goed'),
  })
})

test('adaptief via de toets: working met begeleiding gives the tussenvragen, a wrong step goes deeper', async () => {
  const player = await openPlayer('adaptief-toets')

  await player.click(choice('TWIJFEL'))
  expect(await player.answer(choice('BEGELEID'))).toBe('TELLER')
  // pointing at the teller allows unlimited attempts: a wrong hotspot keeps Volgende locked
  await player.click(hotspot('A_N'))
  await player.check()
  await vi.waitFor(() => expect(player.enabled('test-next')).toBe(false))
  expect(await player.answer(hotspot('A_T'))).toBe('NOEMER')
  expect(await player.answer(hotspot('B_N'))).toBe('S1_TUSSEN')

  expect(await player.answer(choice('B'))).toBe('S1_MAIN')
  expect(await player.answer(choice('A'))).toBe('S2_TUSSEN') // right: the follow-up questions of step 1 are skipped
  expect(await player.answer(choice('A'))).toBe('S2_MAIN')
  expect(await player.answer(choice('A'))).toBe('S2_V1') // wrong: even dieper kijken
  expect(await player.answer(choice('B'))).toBe('S2_V2')
  expect(await player.answer(choice('A'))).toBe('S2_RETRY')
  expect(await player.answer(choice('B'))).toBe('S3_TUSSEN')
  expect(await player.answer(choice('A'))).toBe('S3_MAIN')
  expect(await player.answer(choice('B'))).toBe('S4_TUSSEN')
  expect(await player.answer(choice('B'))).toBe('S4_MAIN')
  await player.click(choice('A'))
  await player.check()
  await player.next()

  // 13 scored items presented, the wrong main question of step 2 is the only miss
  expect(await player.results()).toEqual({
    score: '12 / 13',
    feedback: expect.stringContaining('Een deel van de stappen ging meteen goed'),
  })
})

test('adaptief binnen het item: a wrong answer keeps the item open until it completes itself', async () => {
  const player = await openPlayer('adaptief-item')

  expect(await player.answer(choice('BLIJ'))).toBe('TELLER')
  expect(await player.answer(hotspot('A_T'))).toBe('NOEMER')
  expect(await player.answer(hotspot('B_N'))).toBe('S1_ADAPTIEF')

  // attempt 1, wrong: Volgende stays locked and the follow-up questions appear inside the item
  await player.click(mainChoice('B'))
  await player.check()
  await player.click('qti-choice-interaction[response-identifier="R_V1"]')
  expect(player.enabled('test-next')).toBe(false)
  // attempt 2: the follow-up questions, then the retry is offered
  await player.click(`qti-choice-interaction[response-identifier="R_V1"] ${choice('A')}`)
  await player.click(`qti-choice-interaction[response-identifier="R_V2"] ${choice('A')}`)
  await player.check()
  // attempt 3: the retry decides; the item is completed, so Controleer locks and Volgende unlocks
  await player.click(`qti-choice-interaction[response-identifier="R_RETRY"] ${choice('A')}`)
  await player.check()
  await vi.waitFor(() => expect(player.enabled('test-end-attempt')).toBe(false))
  expect(await player.next()).toBe('S2_ADAPTIEF')

  expect(await player.answer(mainChoice('B'))).toBe('S3_ADAPTIEF')
  expect(await player.answer(mainChoice('B'))).toBe('S4_ADAPTIEF')
  await player.click(mainChoice('A'))
  await player.check()
  ;(player.doc.defaultView as unknown as { showResults(): void }).showResults()

  // SCORE only counts steps right straight away: step 1 needed the retry
  expect(await player.results()).toEqual({
    score: '5 / 6',
    feedback: expect.stringContaining('Een deel van de stappen ging meteen goed'),
  })
})
