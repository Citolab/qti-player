import { test } from 'vitest'
import { findByText, fireEvent } from '@testing-library/dom'

test('can move through test items', async () => {
  const nextButton = await findByText(document.body, 'Volgende')
  await new Promise((resolve) => setTimeout(resolve, 500)) // allow initial item to load

  for (let i = 0; i < 8; i += 1) {
    await fireEvent.click(nextButton)
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
})
