import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useUpdateTodoMutation } from './useUpdateTodoMutation'

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
  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  return { queryClient, result }
}

beforeEach(() => vi.clearAllMocks())

it('replaces only the updated task in the cached list', async () => {
  const { queryClient, result } = setup()
  const other = { ...todoFixture, id: 1 }
  const saved = { ...todoFixture, completed: true }
  queryClient.setQueryData(todoKeys.list, [todoFixture, other])
  vi.mocked(todosApi.update).mockResolvedValue(saved)
  const cancel = vi.spyOn(queryClient, 'cancelQueries')
  await act(() =>
    result.current.mutateAsync({ id: 7, input: { completed: true } }),
  )
  expect(todosApi.update).toHaveBeenCalledWith(7, { completed: true })
  expect(cancel).toHaveBeenCalledWith({ queryKey: todoKeys.list })
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([saved, other])
})

it('does not create a list cache that was never loaded', async () => {
  const { queryClient, result } = setup()
  vi.mocked(todosApi.update).mockResolvedValue(todoFixture)
  await act(() => result.current.mutateAsync({ id: 7, input: { title: 'X' } }))
  expect(queryClient.getQueryData(todoKeys.list)).toBeUndefined()
})

it('exposes the error and keeps the cache when updating fails', async () => {
  const { queryClient, result } = setup()
  queryClient.setQueryData(todoKeys.list, [todoFixture])
  vi.mocked(todosApi.update).mockRejectedValue(new Error('Task not found.'))
  await act(() =>
    expect(
      result.current.mutateAsync({ id: 7, input: { completed: true } }),
    ).rejects.toThrow('Task not found.'),
  )
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
