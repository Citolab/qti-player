import { afterEach, expect, test } from 'vitest'
import { pause } from './pause'
import { closeFrame, openPage, until } from './frame'

/**
 * The cookbook: the shell with its toolbar, and every example as a page of its own.
 */

afterEach(closeFrame)

const examples = ['formatief', 'facet', 'oefenen', 'adaptief-toets', 'adaptief-item', 'rekenen', 'examen']

test('the shell shows an example per tab', async () => {
  const { doc } = await openPage('index.html#/rekenen', '#examples a')
  const frame = () => doc.querySelector('iframe')!
  const tabs = () => [...doc.querySelectorAll('#examples a')] as HTMLAnchorElement[]

  expect(tabs().map(a => a.dataset.id)).toEqual(examples)
  expect(tabs().find(a => a.getAttribute('aria-current') === 'page')?.dataset.id).toBe('rekenen')
  await until(() => frame().src.endsWith('examples/rekenen/index.html'), 'rekenen did not load')

  await pause()
  tabs().find(a => a.dataset.id === 'examen')!.click()
  await until(() => frame().src.endsWith('examples/examen/index.html'), 'the examen tab did not load its example')
  expect(tabs().find(a => a.getAttribute('aria-current') === 'page')?.dataset.id).toBe('examen')
})

test.each(examples)('%s: opens with the first item or section on screen, in its own theme', async id => {
  const { doc } = await openPage(`examples/${id}/index.html`)
  const container = () => doc.querySelector('test-container')!.shadowRoot
  await until(() => container()?.querySelector('qti-assessment-item'), `${id} shows no item`)

  // every example brings its own theme: the tokens its theme.css sets on <html data-qti-theme>
  const html = doc.documentElement
  expect(html.dataset.qtiTheme).toBeTruthy()
  expect(getComputedStyle(html).getPropertyValue('--qti-color-primary')).not.toBe('')
})

test('rekenen: a wrong sum gets a tip, the right one is scored', async () => {
  const { doc } = await openPage('examples/rekenen/index.html')
  const item = () => doc.querySelector('test-container')!.shadowRoot!.querySelector('qti-assessment-item') as
    | (HTMLElement & { variables: { identifier: string; value: unknown }[] })
    | null
  const variable = (id: string) => item()?.variables?.find(v => v.identifier === id)?.value
  const check = async () => {
    await until(() => !doc.querySelector('test-end-attempt')!.hasAttribute('disabled'), 'Nakijken stays disabled')
    await pause()
    ;(doc.querySelector('test-end-attempt') as HTMLElement).click()
  }
  /** Type into the text entry, as a candidate does. */
  const type = async (value: string) => {
    const input = await until(() => item()?.querySelector('qti-text-entry-interaction')?.shadowRoot?.querySelector('input'), 'no text entry')
    await pause()
    input.value = value
    for (const type of ['input', 'change']) input.dispatchEvent(new Event(type, { bubbles: true, composed: true }))
  }

  await type('80')
  await check()
  await until(() => variable('FEEDBACK') === 'HINT', 'no tip after a wrong answer')
  expect(Number(variable('SCORE'))).toBe(0)

  await type('85')
  await check()
  await until(() => variable('FEEDBACK') === 'GOED', 'the right answer is not recognised')
  expect(Number(variable('SCORE'))).toBe(1)
})

test('examen: three opgaven, handing in shows the overview', async () => {
  const { doc } = await openPage('examples/examen/index.html')
  await until(() => doc.querySelectorAll('test-section-link').length === 3, 'the opgaven are not listed')

  const dialog = doc.querySelector('#results') as HTMLDialogElement
  ;(Array.from(doc.querySelectorAll('button')).find(b => b.textContent?.includes('Inleveren')) as HTMLElement).click()
  await until(() => dialog.open, 'the results did not open')
  // nothing is answered yet: the overview lists the questions of the opened opgave, all "niet ingevuld"
  await until(() => dialog.querySelectorAll('tbody tr').length > 0, 'no overview in the dialog')
  expect(dialog.querySelector('tbody')!.textContent).toContain('niet ingevuld')
})
