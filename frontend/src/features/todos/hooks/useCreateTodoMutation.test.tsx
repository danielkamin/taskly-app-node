import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useCreateTodoMutation } from './useCreateTodoMutation'

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
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  return { queryClient, result }
}

beforeEach(() => vi.clearAllMocks())

it('prepends the saved task to the cached list without duplicates', async () => {
  const { queryClient, result } = setup()
  const saved = { ...todoFixture, id: 8, title: 'New' }
  const other = { ...todoFixture, id: 1 }
  queryClient.setQueryData(todoKeys.list, [{ ...saved, title: 'Stale' }, other])
  vi.mocked(todosApi.create).mockResolvedValue(saved)
  const cancel = vi.spyOn(queryClient, 'cancelQueries')
  await act(() => result.current.mutateAsync(todoFixture))
  expect(todosApi.create).toHaveBeenCalledWith(todoFixture)
  expect(cancel).toHaveBeenCalledWith({ queryKey: todoKeys.list })
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([saved, other])
})

it('creates the list cache when nothing was loaded yet', async () => {
  const { queryClient, result } = setup()
  vi.mocked(todosApi.create).mockResolvedValue(todoFixture)
  await act(() => result.current.mutateAsync(todoFixture))
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([todoFixture])
})

it('leaves the cache untouched when creation fails', async () => {
  const { queryClient, result } = setup()
  queryClient.setQueryData(todoKeys.list, [todoFixture])
  vi.mocked(todosApi.create).mockRejectedValue(new Error('Server error'))
  await act(() =>
    expect(result.current.mutateAsync(todoFixture)).rejects.toThrow(
      'Server error',
    ),
  )
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
