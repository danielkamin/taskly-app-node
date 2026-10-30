import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { useTheme } from 'styled-components'
import { beforeEach, expect, it, vi } from 'vitest'
import { GlobalStyles, theme } from '../design-system'
import { queryClient } from '../lib/queryClient'
import { AppProviders } from './AppProviders'

vi.mock('../design-system', () => import('../design-system/mocks'))
beforeEach(() => vi.clearAllMocks())

function Probe({ onRender }: { onRender: (client: QueryClient, value: unknown) => void }) {
  onRender(useQueryClient(), useTheme())
  return <p>Child content</p>
}

it('renders children with the shared query client, theme and global styles', () => {
  const onRender = vi.fn()
  render(
    <AppProviders>
      <Probe onRender={onRender} />
    </AppProviders>,
  )
  expect(screen.getByText('Child content')).toBeVisible()
  expect(onRender).toHaveBeenCalledWith(queryClient, theme)
  expect(GlobalStyles).toHaveBeenCalled()
})

it('uses an injected query client', () => {
  const client = new QueryClient()
  const onRender = vi.fn()
  render(
    <AppProviders client={client}>
      <Probe onRender={onRender} />
    </AppProviders>,
  )
  expect(onRender.mock.calls[0][0]).toBe(client)
})
