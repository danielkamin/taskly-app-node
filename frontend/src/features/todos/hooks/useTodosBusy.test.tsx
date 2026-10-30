import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it } from 'vitest'
import { todoKeys } from '../api/queryKeys'
import { useTodosBusy } from './useTodosBusy'

function setup(mutationKey: readonly string[] = todoKeys.create) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  let finish!: () => void
  const done = new Promise<void>((resolve) => (finish = resolve))
  const { result } = renderHook(
    () => ({
      busy: useTodosBusy(),
      mutation: useMutation({ mutationKey, mutationFn: () => done }),
    }),
    { wrapper },
  )
  return { queryClient, result, finish }
}

it('is idle without pending mutations', () => {
  expect(setup().result.current.busy).toBe(false)
})

it.each([
  { key: todoKeys.create },
  { key: todoKeys.update },
  { key: todoKeys.delete },
])(
  'is busy while a $key mutation is pending',
  async ({ key }) => {
    const { result, finish } = setup(key)
    act(() => result.current.mutation.mutate())
    await waitFor(() => expect(result.current.busy).toBe(true))
    await act(async () => finish())
    await waitFor(() => expect(result.current.busy).toBe(false))
  },
)

it('ignores mutations unrelated to tasks', async () => {
  const { queryClient, result, finish } = setup(['profile', 'update'])
  act(() => result.current.mutation.mutate())
  await waitFor(() => expect(queryClient.isMutating()).toBe(1))
  expect(result.current.busy).toBe(false)
  await act(async () => finish())
})
