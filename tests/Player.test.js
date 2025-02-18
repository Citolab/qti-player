import { expect, test } from 'vitest'
import { getByText, fireEvent } from '@testing-library/dom'

test('renders name', async () => {
  const element = getByText(document, 'Volgende')
  expect(element).toBeInTheDocument()

  await fireEvent.click(element)
  await new Promise(resolve => setTimeout(resolve, 1));

  await fireEvent.click(element)
  await new Promise(resolve => setTimeout(resolve, 1));

  await fireEvent.click(element)
  await new Promise(resolve => setTimeout(resolve, 1));

  await fireEvent.click(element)
  await new Promise(resolve => setTimeout(resolve, 1));

  await fireEvent.click(element)
  await new Promise(resolve => setTimeout(resolve, 1));

  await fireEvent.click(element)
  await new Promise(resolve => setTimeout(resolve, 1));

  await fireEvent.click(element)
  await new Promise(resolve => setTimeout(resolve, 1));
  
  await fireEvent.click(element)
  await new Promise(resolve => setTimeout(resolve, 1));

  await fireEvent.click(element)
  await new Promise(resolve => setTimeout(resolve, 1));
})
