import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useDeleteTodoMutation } from './useDeleteTodoMutation'

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
  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  return { queryClient, result }
}

beforeEach(() => vi.clearAllMocks())

it('removes the deleted task from the cached list', async () => {
  const { queryClient, result } = setup()
  const other = { ...todoFixture, id: 1 }
  queryClient.setQueryData(todoKeys.list, [todoFixture, other])
  vi.mocked(todosApi.remove).mockResolvedValue(undefined)
  const cancel = vi.spyOn(queryClient, 'cancelQueries')
  await act(() => result.current.mutateAsync(7))
  expect(todosApi.remove).toHaveBeenCalledWith(7)
  expect(cancel).toHaveBeenCalledWith({ queryKey: todoKeys.list })
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([other])
})

it('does not create a list cache that was never loaded', async () => {
  const { queryClient, result } = setup()
  vi.mocked(todosApi.remove).mockResolvedValue(undefined)
  await act(() => result.current.mutateAsync(7))
  expect(queryClient.getQueryData(todoKeys.list)).toBeUndefined()
})

it('keeps the task cached when deletion fails', async () => {
  const { queryClient, result } = setup()
  queryClient.setQueryData(todoKeys.list, [todoFixture])
  vi.mocked(todosApi.remove).mockRejectedValue(new Error('Could not delete.'))
  await act(() =>
    expect(result.current.mutateAsync(7)).rejects.toThrow('Could not delete.'),
  )
  expect(queryClient.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
