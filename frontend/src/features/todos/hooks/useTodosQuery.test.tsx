import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useTodosQuery } from './useTodosQuery'

vi.mock('../api/todos', () => ({
  todosApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}))

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useTodosQuery(), { wrapper })
  return { queryClient, result }
}

beforeEach(() => vi.clearAllMocks())

it('loads tasks under the list key and passes the abort signal', async () => {
  vi.mocked(todosApi.list).mockResolvedValue([todoFixture])
  const { queryClient, result } = setup()
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual([todoFixture])
  expect(todosApi.list).toHaveBeenCalledWith(expect.any(AbortSignal))
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([todoFixture])
})

it('exposes loading errors', async () => {
  vi.mocked(todosApi.list).mockRejectedValue(new Error('Server down'))
  const { result } = setup()
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.error?.message).toBe('Server down')
})
