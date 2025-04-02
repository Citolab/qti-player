import { expect, test } from 'vitest'
import { page, userEvent } from '@vitest/browser/context'

import { getByText, fireEvent, getByRole, findByRole,  } from '@testing-library/dom'

test('renders name', async () => {
  
  const element = getByText(document, 'Volgende')
  
  
  const selectElement = await findByRole(document, 'combobox');
  
  await userEvent.selectOptions(selectElement, './kennisnet-1/');
  
  await new Promise(resolve => setTimeout(resolve, 500)); // take time to load test

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
